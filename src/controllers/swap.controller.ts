import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SwapController {
  static async executeSwap(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id; // Vem do Middleware JWT
      const { fromCurrency, toCurrency, amount } = req.body;
      const swapAmount = Number(amount);

      if (!fromCurrency || !toCurrency || swapAmount <= 0) {
        return res.status(400).json({ error: 'Parâmetros inválidos para Swap.' });
      }

      // 1. Simulação do Roteador Guardarian/NOWPayments/Onramp (A ser ligado às APIs reais depois)
      let exchangeRate = 1;
      if (fromCurrency === 'EUR' && toCurrency === 'USDT') exchangeRate = 1.08;
      if (fromCurrency === 'USDT' && toCurrency === 'EUR') exchangeRate = 0.92;
      if (fromCurrency === 'BRL' && toCurrency === 'USDT') exchangeRate = 0.19;

      // 2. Procurar Carteiras e Perfil de Taxas do User
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const fromWallet = await prisma.wallet.findUnique({ where: { user_id_currency_code_type: { user_id: userId, currency_code: fromCurrency, type: 'customer' } } });
      const toWallet = await prisma.wallet.findUnique({ where: { user_id_currency_code_type: { user_id: userId, currency_code: toCurrency, type: 'customer' } } });

      if (!fromWallet || !toWallet) return res.status(400).json({ error: 'Carteiras não encontradas.' });
      if (Number(fromWallet.balance_available) < swapAmount) return res.status(400).json({ error: 'Saldo insuficiente.' });

      // 3. Cálculo Financeiro (Comissão da NeXFlowX)
      const rawConverted = swapAmount * exchangeRate;
      const feePct = Number(user?.overrideFeeSwap) || 0.015; // 1.5% de taxa padrão ou a VIP do User
      const feeAmount = rawConverted * feePct;
      const finalAmount = rawConverted - feeAmount;

      // 4. Transação Atómica (Double-Entry Ledger)
      await prisma.$transaction(async (tx) => {
        // Debita a origem
        await tx.wallet.update({
          where: { id: fromWallet.id },
          data: { balance_available: { decrement: swapAmount } }
        });

        // Credita o destino
        await tx.wallet.update({
          where: { id: toWallet.id },
          data: { balance_available: { increment: finalAmount } }
        });

        // Opcional: Registar no LedgerTransaction o lucro da NeXFlowX (feeAmount)
      });

      return res.status(200).json({
        data: {
          status: 'SETTLED',
          from: fromCurrency,
          to: toCurrency,
          amount_debited: swapAmount,
          amount_credited: finalAmount,
          fee_retained: feeAmount,
          rate: exchangeRate
        }
      });

    } catch (error: any) {
      console.error('[SWAP ERROR]', error);
      return res.status(500).json({ error: 'Erro ao processar o câmbio.' });
    }
  }
}
