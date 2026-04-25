import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AdminController {
  /**
   * POST /api/v1/admin/payouts/:id/approve
   * Aprova um levantamento e liquida o saldo pendente do lojista.
   */
  static async approvePayout(req: Request, res: Response) {
    const { id } = req.params;
    const { admin_notes } = req.body;

    try {
      // 1. Iniciar Transação Atómica
      const result = await prisma.$transaction(async (tx) => {
        
        // A. Buscar o Payout e validar estado
        const payout = await tx.payout.findUnique({
          where: { id },
          include: { user: true }
        });

        if (!payout || payout.status !== 'pending') {
          throw new Error('Payout não encontrado ou já processado.');
        }

        // B. Buscar a Wallet correspondente
        const wallet = await tx.wallet.findUnique({
          where: {
            user_id_currency_code_type: {
              user_id: payout.user_id,
              currency_code: payout.currency_code,
              type: 'merchant'
            }
          }
        });

        if (!wallet || wallet.balance_pending.lt(payout.amount)) {
          throw new Error('Inconsistência de saldo: Saldo pendente insuficiente.');
        }

        // C. Deduzir do saldo pendente (O dinheiro "sai" definitivamente do sistema)
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance_pending: { decrement: payout.amount }
          }
        });

        // D. Atualizar o Payout para status final
        const updatedPayout = await tx.payout.update({
          where: { id },
          data: {
            status: 'completed',
            resolved_at: new Date(),
            reference_id: `SETTLE-${Date.now()}` // ID de liquidação interna
          }
        });

        // E. Registar na Auditoria (Compliance)
        await tx.auditLog.create({
          data: {
            userId: (req as any).user.id, // O Admin que aprovou
            action: 'PAYOUT_APPROVED',
            entityType: 'payout',
            entityId: id,
            newValue: 'completed',
            ipAddress: req.ip
          }
        });

        return updatedPayout;
      });

      return res.json({
        success: true,
        message: 'Payout liquidado com sucesso.',
        data: result
      });

    } catch (error: any) {
      console.error('[PAYOUT_APPROVAL_ERROR]', error.message);
      return res.status(400).json({
        error: { code: 'PAYOUT_FAILED', message: error.message }
      });
    }
  }

  /**
   * GET /api/v1/admin/users
   * Lista todos os utilizadores para o Dashboard Admin.
   */
  static async listUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        include: { organization: true },
        orderBy: { created_at: 'desc' }
      });
      return res.json({ data: users });
    } catch (error: any) {
      return res.status(500).json({ error: { message: error.message } });
    }
  }

  /**
   * GET /api/v1/admin/payouts/pending
   * Fila de espera para o Centro de Comando.
   */
  static async listAllPendingPayouts(req: Request, res: Response) {
    try {
      const payouts = await prisma.payout.findMany({
        where: { status: 'pending' },
        include: { user: { select: { email: true, full_name: true } } },
        orderBy: { created_at: 'asc' }
      });
      return res.json({ data: payouts });
    } catch (error: any) {
      return res.status(500).json({ error: { message: error.message } });
    }
  }

  static async forcePasswordReset(req: Request, res: Response) {
    res.status(200).json({ success: true });
  }
}
