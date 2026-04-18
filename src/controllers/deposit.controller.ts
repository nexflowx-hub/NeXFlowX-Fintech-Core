import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PaymentOrchestrator } from '../services/orchestrator.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class DepositController {
  
  static async requestDeposit(req: Request, res: Response) {
    try {
      const payee_id = (req as any).user.id;
      const { amount, currency, method, store_id, customer_email, country, metadata } = req.body;
      const amountNum = Number(amount);

      if (!amount || !currency) {
        return res.status(400).json({ error: "Amount e Currency são obrigatórios." });
      }

      // 1. OBTENÇÃO DE GATEWAYS (Tenant & Global)
      const whereClause = store_id 
        ? { store_id: store_id, is_active: true } 
        : { user_id: payee_id, store_id: null, is_active: true };
      
      const activeGateways = await prisma.gatewayConfig.findMany({ where: whereClause });

      if (activeGateways.length === 0) {
        return res.status(500).json({ error: "Nenhum Gateway de pagamento ativo encontrado." });
      }

      // 2. LÓGICA DE PRIORIZAÇÃO (Smart Routing)
      let primaryGateway = activeGateways[0];
      let fallbackGateway = activeGateways.length > 1 ? activeGateways[1] : null;

      if (currency.toUpperCase() === 'BRL') {
         primaryGateway = activeGateways.find(g => g.provider_name === 'mistic') || primaryGateway;
         fallbackGateway = activeGateways.find(g => g.provider_name === 'mercadopago' && g.id !== primaryGateway.id) || fallbackGateway;
      } else if (currency.toUpperCase() === 'EUR') {
         primaryGateway = activeGateways.find(g => g.provider_name === 'stripe') || primaryGateway;
         fallbackGateway = activeGateways.find(g => g.provider_name === 'sumup' && g.id !== primaryGateway.id) || fallbackGateway;
      }

      const txId = `dep_${crypto.randomBytes(8).toString('hex')}`;

      // 3. REGISTO PRÉVIO (Imutabilidade)
      await prisma.transaction.create({
        data: {
          id: txId,
          amount: amountNum,
          currency: currency.toUpperCase(),
          status: 'pending',
          provider_name: primaryGateway.provider_name, 
          payment_method: method || 'CHECKOUT',
          payee_id: payee_id,
          store_id: store_id || null,
          country_code: country || 'UNKNOWN',
          customer_email: customer_email || null,
          metadata: metadata || {},
          fee_amount: 0,
          net_amount: amountNum
        }
      });

      // 🛠️ MOTOR FÍSICO DE COMUNICAÇÃO
      const processViaProvider = async (providerName: string) => {
         let responsePayload: any = { transaction_id: txId, currency: currency.toUpperCase(), amount: amountNum, provider: providerName };
         
         if (providerName === 'mistic' || providerName === 'mercadopago') {
            const providerInstance = PaymentOrchestrator.getProviderForBRL(providerName as any);
            const pixData = await providerInstance.createPixPayment!(amountNum, txId, { 
              email: customer_email, name: metadata?.name || 'Cliente NeXFlowX', document: metadata?.tax_id || '00000000000' 
            });
            responsePayload.type = 'QR_CODE'; responsePayload.provider_data = pixData;
            
         } else if (providerName === 'stripe' || providerName === 'sumup' || providerName === 'viva') {
            responsePayload.type = 'HOSTED_CHECKOUT';
            // Devolvemos a URL mágica do nosso frontend de Checkout (O Iframe)
            responsePayload.checkout_url = `https://checkout.nexflowx.tech/?txId=${txId}`;
            
         } else if (providerName === 'internal_bank') {
            responsePayload.type = 'BANK_TRANSFER';
            responsePayload.provider_data = { iban: 'PT50 0000 0000 1234 5678 9012 3', bic_swift: 'NEXFPTPL', bank_name: 'NeXFlowX Core Bank', reference: txId.toUpperCase() };
         } else {
            throw new Error(`Provedor ${providerName} não suportado.`);
         }
         return responsePayload;
      };

      // 🚀 EXECUÇÃO & FALLBACK AUTOMÁTICO
      try {
         console.log(`[ROUTING] 🚀 A tentar Rota Principal: ${primaryGateway.provider_name}`);
         const payload = await processViaProvider(primaryGateway.provider_name);
         return res.status(201).json({ success: true, data: payload, routed_via: 'primary' });
         
      } catch (error: any) {
         console.error(`[ROUTING] ⚠️ Falha na Rota Principal: ${error.message}`);
         
         if (fallbackGateway) {
            try {
               console.log(`[ROUTING] 🛡️ A ativar Plano B (Fallback): ${fallbackGateway.provider_name}`);
               const fallbackPayload = await processViaProvider(fallbackGateway.provider_name);
               await prisma.transaction.update({ where: { id: txId }, data: { provider_name: fallbackGateway.provider_name, metadata: { ...(metadata as object), fallback_triggered: true } } });
               return res.status(201).json({ success: true, data: fallbackPayload, routed_via: 'fallback' });
            } catch (fallbackError: any) {
               console.error(`[ROUTING] ❌ Falha catastrófica no Fallback.`);
            }
         }

         await prisma.transaction.update({ where: { id: txId }, data: { status: 'failed' } });
         return res.status(502).json({ error: "Serviço de pagamentos temporariamente indisponível. Rotas esgotadas." });
      }

    } catch (e: any) { res.status(500).json({ error: e.message || "Erro interno ao processar depósito" }); }
  }
}
