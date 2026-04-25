import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export class WalletController {
  /**
   * GET /api/v1/wallets
   * Lista todas as carteiras do utilizador (EUR, USD, BRL, etc.)
   */
  static async listMyWallets(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.id;

      const wallets = await prisma.wallet.findMany({
        where: { user_id: userId },
        include: {
          currency: true
        }
      });

      // Mapeamento para o formato Atlas Global
      return res.json({
        data: wallets.map(w => ({
          id: w.id,
          currency: w.currency_code,
          type: w.type,
          balance_available: w.balance_available,
          balance_pending: w.balance_pending,
          balance_incoming: w.balance_incoming,
          precision: w.currency.precision
        }))
      });
    } catch (error: any) {
      return res.status(500).json({
        error: { code: 'WALLET_FETCH_ERROR', message: 'Erro ao listar carteiras.', details: error.message }
      });
    }
  }

  /**
   * GET /api/v1/wallets/primary
   * Retorna a carteira principal (normalmente EUR) para o resumo do Header.
   */
  static async getMyWallet(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.id;
      const { currency = 'EUR' } = req.query;

      const wallet = await prisma.wallet.findFirst({
        where: { 
          user_id: userId,
          currency_code: String(currency)
        },
        include: { currency: true }
      });

      if (!wallet) {
        return res.status(404).json({
          error: { code: 'WALLET_NOT_FOUND', message: `Carteira em ${currency} não encontrada.` }
        });
      }

      return res.json({
        data: {
          id: wallet.id,
          currency: wallet.currency_code,
          balance: wallet.balance_available,
          pending: wallet.balance_pending,
          incoming: wallet.balance_incoming
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        error: { code: 'SERVER_ERROR', message: 'Erro ao obter carteira principal.' }
      });
    }
  }
}
