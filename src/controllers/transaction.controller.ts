import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LedgerService } from '../services/ledger.service';

const prisma = new PrismaClient();

export class TransactionController {
  
  static async swap(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const { from_currency, to_currency, amount } = req.body;
      const amountNum = Number(amount);

      if (!from_currency || !to_currency || !amount) return res.status(400).json({ error: "Missing parameters" });

      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      if (!admin) return res.status(500).json({ error: "Admin account not found for FX Pool" });

      const walletFrom = await prisma.wallet.findUnique({ 
        where: { user_id_currency_code_type: { user_id, currency_code: from_currency, type: 'merchant' } } 
      });

      if (!walletFrom || Number(walletFrom.balance_available) < amountNum) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      const walletTo = await prisma.wallet.upsert({
        where: { user_id_currency_code_type: { user_id, currency_code: to_currency, type: 'merchant' } },
        update: {}, create: { user_id, currency_code: to_currency, type: 'merchant' }
      });

      const feeWallet = await prisma.wallet.upsert({
        where: { user_id_currency_code_type: { user_id: admin.id, currency_code: to_currency, type: 'fee' } },
        update: {}, create: { user_id: admin.id, currency_code: to_currency, type: 'fee' }
      });

      const fxPoolFrom = await prisma.wallet.upsert({
        where: { user_id_currency_code_type: { user_id: admin.id, currency_code: from_currency, type: 'fx_pool' } },
        update: {}, create: { user_id: admin.id, currency_code: from_currency, type: 'fx_pool' }
      });

      const fxPoolTo = await prisma.wallet.upsert({
        where: { user_id_currency_code_type: { user_id: admin.id, currency_code: to_currency, type: 'fx_pool' } },
        update: {}, create: { user_id: admin.id, currency_code: to_currency, type: 'fx_pool' }
      });

      const rate = from_currency === 'EUR' && to_currency === 'USDT' ? 1.08 : 0.92;
      const feePercent = 0.01; 
      const grossToAmount = amountNum * rate;
      const feeAmount = grossToAmount * feePercent;
      const netToAmount = grossToAmount - feeAmount;

      const refId = 'SWAP_' + Date.now();

      const ledgerTx = await prisma.$transaction(async (tx) => {
        return await LedgerService.commitTransaction(
          'SWAP', 'cleared', refId,
          `Swap ${amountNum} ${from_currency} to ${netToAmount.toFixed(2)} ${to_currency}`,
          [
            { wallet_id: walletFrom.id, direction: 'DEBIT', amount: amountNum, currency_code: from_currency, _type: 'merchant' },
            { wallet_id: fxPoolFrom.id, direction: 'CREDIT', amount: amountNum, currency_code: from_currency, _type: 'fx_pool' },
            { wallet_id: walletTo.id, direction: 'CREDIT', amount: netToAmount, currency_code: to_currency, _type: 'merchant' },
            { wallet_id: feeWallet.id, direction: 'CREDIT', amount: feeAmount, currency_code: to_currency, _type: 'fee' },
            { wallet_id: fxPoolTo.id, direction: 'DEBIT', amount: grossToAmount, currency_code: to_currency, _type: 'fx_pool' }
          ],
          tx
        );
      });

      res.json({ success: true, data: { ledger_tx: ledgerTx.id, from_currency, to_currency, amount_debited: amountNum, amount_credited: netToAmount } });
    } catch (e: any) { res.status(500).json({ error: e.message || "Internal error" }); }
  }

  static async payout(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const { amount, currency, method, destination } = req.body;
      const amountNum = Number(amount);

      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      if (!admin) return res.status(500).json({ error: "Admin account missing for Treasury" });

      const walletFrom = await prisma.wallet.findUnique({ 
        where: { user_id_currency_code_type: { user_id, currency_code: currency, type: 'merchant' } } 
      });

      if (!walletFrom || Number(walletFrom.balance_available) < amountNum) {
         return res.status(400).json({ error: "Insufficient balance" });
      }

      const treasuryWallet = await prisma.wallet.upsert({
        where: { user_id_currency_code_type: { user_id: admin.id, currency_code: currency, type: 'treasury' } },
        update: {}, create: { user_id: admin.id, currency_code: currency, type: 'treasury' }
      });

      const payoutResult = await prisma.$transaction(async (tx) => {
        const refId = 'PAYOUT_' + Date.now();
        
        const ledgerTx = await LedgerService.commitTransaction(
          'PAYOUT', 'pending', refId, `Hold for Payout to ${destination}`,
          [
            { wallet_id: walletFrom.id, direction: 'DEBIT', amount: amountNum, currency_code: currency, _type: 'merchant' },
            { wallet_id: treasuryWallet.id, direction: 'CREDIT', amount: amountNum, currency_code: currency, _type: 'treasury' }
          ],
          tx
        );

        return await tx.payout.create({
          data: { user_id, amount: amountNum, currency_code: currency, method, destination, status: 'pending', reference_id: ledgerTx.id }
        });
      });

      res.json({ success: true, message: "Payout requested and funds secured", data: payoutResult });
    } catch (e: any) { res.status(500).json({ error: e.message || "Internal error" }); }
  }
}
