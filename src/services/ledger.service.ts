import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Regra de Contabilidade Institucional
export const isAssetWallet = (type: string) => type === 'treasury' || type === 'fx_pool';

export interface LedgerEntryInput {
  wallet_id: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  currency_code: string;
  _type: string; // Para sabermos se é Asset ou Liability
}

export class LedgerService {
  
  // 1. O Guarda Matemático
  static validateBalance(entries: LedgerEntryInput[]) {
    const sums: Record<string, number> = {};
    for (const e of entries) {
      if (!sums[e.currency_code]) sums[e.currency_code] = 0;
      if (e.direction === 'CREDIT') sums[e.currency_code] += e.amount;
      else if (e.direction === 'DEBIT') sums[e.currency_code] -= e.amount;
    }
    for (const [curr, sum] of Object.entries(sums)) {
      if (Math.abs(sum) > 0.00000001) throw new Error(`[CRITICAL] Falha Contabilística em ${curr}! (Desvio: ${sum})`);
    }
  }

  // 2. O Processador Central (Apply Ledger Impact)
  static async commitTransaction(
    type: 'PAYIN' | 'PAYOUT' | 'SWAP' | 'FEE',
    status: 'pending' | 'cleared',
    reference_id: string,
    description: string,
    entries: LedgerEntryInput[],
    tx: Prisma.TransactionClient // Injetamos a transação Prisma para ser 100% Atómico
  ) {
    
    this.validateBalance(entries);

    // 1. Grava a imutabilidade no Livro-Razão
    const ledgerTx = await tx.ledgerTransaction.create({
      data: {
        type,
        status,
        reference_id,
        description,
        cleared_at: status === 'cleared' ? new Date() : null,
        entries: {
          create: entries.map(({ _type, ...rest }) => rest)
        }
      }
    });

    // 2. Projeção nas Wallets (A Correção do Bug do Payout!)
    for (const e of entries) {
      const isAsset = isAssetWallet(e._type);
      const isAddition = isAsset ? e.direction === 'DEBIT' : e.direction === 'CREDIT';
      
      const updateData: any = {};
      
      if (status === 'cleared') {
        // SETTLEMENT: Mexe no Total e no Available
        updateData.balance_available = isAddition ? { increment: e.amount } : { decrement: e.amount };
        updateData.balance_available = isAddition ? { increment: e.amount } : { decrement: e.amount };
      } else {
        // LOCK (Pending): Se está a sair dinheiro, cativa no Available mas mantém no Total até aprovação
        if (!isAddition) {
          updateData.balance_available = { decrement: e.amount };
        }
        // Se for uma entrada pendente, não fazemos nada à Wallet até ser 'cleared'
      }

      if (Object.keys(updateData).length > 0) {
        await tx.wallet.update({
          where: { id: e.wallet_id },
          data: updateData
        });
      }
    }

    return ledgerTx;
  }
}
