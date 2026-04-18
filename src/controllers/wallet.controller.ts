import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class WalletController {
  static async getMyWallet(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      // 1. Procurar a carteira principal do utilizador
      let wallet = await prisma.wallet.findFirst({
        where: { user_id: userId }
      });

      // 2. Se for um utilizador novo e não tiver carteira, o sistema auto-cria uma
      if (!wallet) {
        // Garantir que a moeda EUR existe na base de dados para evitar erros de Foreign Key
        await prisma.currency.upsert({
          where: { code: 'EUR' },
          update: {},
          create: { code: 'EUR', type: 'fiat', precision: 2, is_active: true }
        });

        wallet = await prisma.wallet.create({
          data: {
            user_id: userId,
            currency_code: 'EUR',
            type: 'merchant',
            balance_incoming: 0,
            balance_pending: 0,
            balance_available: 0
          }
        });
      }

      // 3. Devolver no formato que o Frontend espera { data: { ... } }
      // Nota: Algumas versões do teu frontend pedem um array, outras um objeto. 
      // Vamos devolver a carteira pura (objeto) mas também suportar a listagem.
      res.json({ data: wallet });
    } catch (error) {
      console.error("[WALLET ERROR]", error);
      res.status(500).json({ error: "Erro ao carregar a tesouraria." });
    }
  }

  // Rota para suportar caso o hook do frontend use array (useWallets)
  static async listMyWallets(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const wallets = await prisma.wallet.findMany({ where: { user_id: userId } });
      res.json({ data: wallets });
    } catch (error) {
      res.status(500).json({ error: "Erro ao listar carteiras." });
    }
  }
}
