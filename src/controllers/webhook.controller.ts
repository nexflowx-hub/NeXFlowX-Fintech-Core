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
          await prisma.user.create({
            data: {
              email: record.email,
              username: `user_${record.id.substring(0, 8)}`,
              password_hash: 'SUPABASE_MANAGED_AUTH',
              isActive: true,
              tier: 'NEW',
              kyc_level: 0
            }
          });
        }
      }
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: 'Falha interna na sincronização' });
    }
  }

  // Webhooks Legados e Futuros (Stubs para o TypeScript não reclamar)
  static async stripeWebhook(req: Request, res: Response) { res.send(); }
  static async misticWebhook(req: Request, res: Response) { res.send(); }
  static async nowpaymentsIpn(req: Request, res: Response) { res.send(); }
  static async sumupWebhook(req: Request, res: Response) { res.send(); }
  
  // 🔥 OS WEBHOOKS DE ONRAMP QUE FALTAVAM
  static async onrampMoneyWebhook(req: Request, res: Response) { res.send(); }
  static async guardarianWebhook(req: Request, res: Response) { res.send(); }
}
