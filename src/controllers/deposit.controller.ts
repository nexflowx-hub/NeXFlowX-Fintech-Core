import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { OrchestratorService } from '../services/orchestrator.service';
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

      // 1. Geração de ID Único da Transação
      const txId = `dep_${crypto.randomBytes(8).toString('hex')}`;

      // 2. REGISTO PRÉVIO (Imutabilidade) - Criamos sempre como 'pending' primeiro
      const tx = await prisma.transaction.create({
        data: {
          id: txId,
          amount: amountNum,
          currency: currency.toUpperCase(),
          status: 'pending',
          provider_name: 'pending_routing', // O Orchestrator vai decidir isto!
          payment_method: method || 'credit_card',
          payee_id: payee_id,
          store_id: store_id || null,
          country_code: country || 'UNKNOWN',
          customer_email: customer_email || null,
          metadata: metadata || {},
          fee_amount: 0,
          net_amount: amountNum
        }
      });

      // 3. 🚀 O CÉREBRO ENTRA EM AÇÃO (Smart Routing & Cascata)
      try {
        console.log(`[ROUTING] 🧠 A pedir ao Orchestrator para resolver a transação ${txId}...`);
        
        // Resolve a transação usando as nossas regras de Tiers, Custos e Limites
        const routePlan = await OrchestratorService.resolveBestProvider(txId);
        
        // Atualiza a transação com o provedor vencedor
        await prisma.transaction.update({
          where: { id: txId },
          data: { provider_name: routePlan.providerType }
        });

        // 4. Mapeamento da Resposta para o Cliente Frontend (API Response)
        let responsePayload: any = { 
          transaction_id: txId, 
          currency: currency.toUpperCase(), 
          amount: amountNum, 
          provider: routePlan.providerType,
          mode: routePlan.mode
        };

        if (routePlan.providerType === 'mistic' || routePlan.providerType === 'elitepay') {
           // Fluxo PIX: Aqui, no futuro, chamarás a classe concreta do PIX provider
           responsePayload.type = 'QR_CODE'; 
           responsePayload.message = "Integração Mistic/Pix pendente no Controller.";
           // responsePayload.provider_data = await MisticProvider.createPix(...)

        } else if (routePlan.providerType === 'stripe' || routePlan.providerType === 'viva' || routePlan.providerType === 'sumup') {
           // Fluxo SDUI (Server-Driven UI): Devolve a URL mágica do nosso frontend Vercel!
           responsePayload.type = 'HOSTED_CHECKOUT';
           responsePayload.checkout_url = `https://pay.nexflowx.tech/?txId=${txId}`;
           
        } else if (routePlan.providerType === 'bank_transfer') {
           responsePayload.type = 'BANK_TRANSFER';
           responsePayload.provider_data = { 
             iban: 'PT50 0000 0000 1234 5678 9012 3', 
             bic_swift: 'NEXFPTPL', 
             bank_name: 'NeXFlowX Core Bank', 
             reference: txId.toUpperCase() 
           };
        } else {
           throw new Error(`Motor de pagamento ${routePlan.providerType} não tem mapeamento no controller de resposta.`);
        }

        return res.status(201).json({ success: true, data: responsePayload, routed_via: routePlan.mode });

      } catch (routingError: any) {
         console.error(`[ROUTING] ❌ Falha catastrófica no Orchestrator:`, routingError.message);
         await prisma.transaction.update({ where: { id: txId }, data: { status: 'failed', metadata: { error: routingError.message } } });
         return res.status(502).json({ error: "Serviço de pagamentos indisponível ou rotas esgotadas." });
      }

    } catch (e: any) { 
      res.status(500).json({ error: e.message || "Erro interno ao processar depósito" }); 
    }
  }
}
