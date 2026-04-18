import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class SettlementService {
  static async closeDailyIncoming() {
    console.log("[SETTLEMENT] A iniciar Fecho do Dia (Incoming -> Pending)...");
    try {
      await prisma.$transaction(async (tx) => {
        const wallets = await tx.wallet.findMany({ where: { balance_incoming: { gt: 0 } } });
        for (const wallet of wallets) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance_incoming: 0,
              balance_pending: { increment: wallet.balance_incoming }
            }
          });
        }
        await tx.transaction.updateMany({
          where: { status: 'gateway_confirmed' as any },
          data: { status: 'pending' as any }
        });
      });
      console.log("[SETTLEMENT] Fecho do dia concluído.");
    } catch (error) { console.error("[SETTLEMENT FATAL ERROR]", error); }
  }

  static async clearMatureFunds() {
    console.log("[CLEARING] A procurar fundos maduros (Pending -> Available)...");
    try {
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const matureTransactions = await tx.transaction.findMany({
          where: { status: 'pending' as any, clears_at: { lte: now } }
        });

        if (matureTransactions.length === 0) {
          console.log("[CLEARING] Nenhum fundo para libertar hoje.");
          return;
        }

        for (const t of matureTransactions) {
          const net = Number(t.net_amount || 0);
          
          // Procura a wallet correta usando o dono e a moeda da transação
          const wallet = await tx.wallet.findFirst({
            where: { user_id: t.payee_id, currency_code: t.currency, type: 'merchant' }
          });

          if (wallet) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                balance_pending: { decrement: net },
                balance_available: { increment: net }
              }
            });
          }

          await tx.transaction.update({
            where: { id: t.id },
            data: { status: 'settled' as any }
          });
        }
      });
      console.log("[CLEARING] Liquidação concluída.");
    } catch (error) { console.error("[CLEARING FATAL ERROR]", error); }
  }
}
