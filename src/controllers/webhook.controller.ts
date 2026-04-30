import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WebhookController {

  static async supabaseSync(req: Request, res: Response) {
    try {
      const webhookSecret = req.headers['x-supabase-webhook-secret'];
      if (webhookSecret !== process.env.SUPABASE_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Assinatura Inválida' });
      }

      const { type, record } = req.body;
      if (type === 'INSERT' && record && record.email) {
        const existingUser = await prisma.user.findUnique({ where: { email: record.email } });
        
        if (!existingUser) {
          // 1. Extrair Metadados do Frontend (opcionais)
          const meta = record.raw_user_meta_data || {};
          const fullName = meta.full_name || meta.name || null;
          const phone = meta.phone || null;
          const telegram = meta.telegram || null;

          // 2. Transação Atómica: Cria User + Garante Moedas + Cria Wallets
          await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
              data: {
                id: record.id, // Forçamos o ID do Postgres a ser igual ao do Supabase
                email: record.email,
                username: `user_${record.id.substring(0, 8)}`,
                password_hash: 'SUPABASE_MANAGED_AUTH',
                full_name: fullName,
                phone: phone,
                isActive: true,
                tier: 'NEW',
                kyc_level: 0,
                metadata: telegram ? { telegram } : {}
              }
            });

            // 3. Matriz Base de Moedas (Fiat e Crypto)
            const defaultCurrencies = [
              { code: 'EUR', type: 'fiat', precision: 2 },
              { code: 'BRL', type: 'fiat', precision: 2 },
              { code: 'USDT', type: 'crypto', precision: 6 }
            ];

            for (const curr of defaultCurrencies) {
              // Garante que a moeda existe no sistema (sem dar erro se já existir)
              await tx.currency.upsert({
                where: { code: curr.code },
                update: {},
                create: { code: curr.code, type: curr.type, precision: curr.precision, is_active: true }
              });

              // Abre a carteira (Wallet)
              await tx.wallet.create({
                data: {
                  user_id: newUser.id,
                  currency_code: curr.code,
                  type: 'customer'
                }
              });
            }
          });
        }
      }
      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[WEBHOOK ERROR]', error);
      return res.status(500).json({ error: 'Falha interna na sincronização' });
    }
  }

  // Stubs para Webhooks
  static async stripeWebhook(req: Request, res: Response) { res.send(); }
  static async misticWebhook(req: Request, res: Response) { res.send(); }
  static async nowpaymentsIpn(req: Request, res: Response) { res.send(); }
  static async sumupWebhook(req: Request, res: Response) { res.send(); }
  static async onrampMoneyWebhook(req: Request, res: Response) { res.send(); }
  static async guardarianWebhook(req: Request, res: Response) { res.send(); }
}
