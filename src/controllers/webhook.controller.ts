import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any });

export class WebhookController {
  
  // =======================================================
  // 🧠 MOTOR CENTRAL DE CASH-IN (Atualiza o Ledger e Wallet)
  // =======================================================
  private static async processCashIn(txId: string, providerTxId: string, netAmount: number) {
    await prisma.$transaction(async (tx) => {
      // 1. Verifica se a transação existe e ainda está pendente
      const transaction = await tx.transaction.findUnique({ where: { id: txId } });
      if (!transaction || transaction.status !== 'pending') return;

      // 2. Atualiza a Transação para Confirmada
      await tx.transaction.update({
        where: { id: txId },
        data: { status: 'gateway_confirmed' as any, provider_transaction_id: providerTxId, net_amount: netAmount }
      });

      // 3. Procura a Wallet do Merchant para esta moeda
      const wallet = await tx.wallet.findFirst({
        where: { user_id: transaction.payee_id, currency_code: transaction.currency }
      });

      // 4. Injeta o dinheiro no Estágio 1: 'balance_incoming' (Fluxo do Dia)
      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance_incoming: { increment: netAmount } }
        });
        console.log(`[LEDGER] +${netAmount} ${transaction.currency} adicionados ao Fluxo Diário (Incoming) da Wallet ${wallet.id}.`);
      }
    });
  }

  // =======================================================
  // 💳 1. STRIPE (Requer Express.raw no server.ts)
  // =======================================================
  static async stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    try {
      // Aqui o req.body tem de ser o Buffer bruto!
      const event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET as string);

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as any;
        const txId = paymentIntent.metadata?.txId;
        const netAmount = paymentIntent.amount_received / 100; // Simplificado, idealmente ler taxas da Stripe

        if (txId) await WebhookController.processCashIn(txId, paymentIntent.id, netAmount);
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("[STRIPE WEBHOOK ERRO]", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  // =======================================================
  // 📱 2. SUMUP (Notificação via API/Frontend ou Webhook)
  // =======================================================
  static async sumupWebhook(req: Request, res: Response) {
    try {
      const { txId, checkoutId, status, amount } = req.body;
      // Em produção, aqui deves verificar o evento batendo na API da SumUp para evitar spoofing
      if (status === 'PAID' && txId) {
        await WebhookController.processCashIn(txId, checkoutId, Number(amount));
      }
      res.json({ received: true });
    } catch (e) { res.status(500).json({ error: "Erro SumUp Webhook" }); }
  }

  // =======================================================
  // 🇧🇷 3. MISTIC PAY (PIX)
  // =======================================================
  static async misticWebhook(req: Request, res: Response) {
    try {
      const payload = req.body;
      if (payload.transactionType === 'DEPOSITO' && payload.status === 'COMPLETO') {
        const txId = payload.clientTransactionId || payload.transactionId; // Depende de como gravaste no Início
        await WebhookController.processCashIn(txId, String(payload.transactionId), Number(payload.value));
      }
      res.status(200).json({ received: true });
    } catch (e) { res.status(500).json({ error: "Erro Mistic Webhook" }); }
  }

  // =======================================================
  // 🪙 4. NOWPAYMENTS (CRYPTO IPN)
  // =======================================================
  static async nowpaymentsIpn(req: Request, res: Response) {
    try {
      const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || '';
      const signature = req.headers['x-nowpayments-sig'];
      if (!signature) return res.status(401).json({ error: "Assinatura ausente" });

      const hmac = crypto.createHmac('sha512', ipnSecret);
      hmac.update(JSON.stringify(req.body, Object.keys(req.body).sort()));
      if (hmac.digest('hex') !== signature) return res.status(403).json({ error: "Fraude IPN" });

      const payload = req.body;
      if (payload.payment_status === 'finished' && payload.order_id) {
         // order_id é onde costumamos guardar o nosso txId interno
         await WebhookController.processCashIn(payload.order_id, String(payload.payment_id), Number(payload.price_amount));
      }
      res.status(200).json({ received: true });
    } catch (e) { res.status(500).json({ error: "Erro IPN" }); }
  }
}
