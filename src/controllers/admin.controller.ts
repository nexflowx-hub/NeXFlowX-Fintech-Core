import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export class AdminController {
  
  // =========================================================
  // 1. TESOURARIA: Gestão de Saques (Payouts)
  // =========================================================
  static async approvePayout(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const payout = await prisma.payout.findUnique({ where: { id } });

      if (!payout) return res.status(404).json({ error: "Saque não encontrado." });
      if (payout.status !== 'pending') return res.status(400).json({ error: "Este saque já foi processado." });

      const updated = await prisma.payout.update({
        where: { id },
        data: {
          status: 'completed',
          resolved_at: new Date(),
          reference_id: req.body.reference_id || 'MANUAL_APPROVAL'
        }
      });

      console.log(`[ADMIN] Saque ${id} aprovado manualmente.`);
      res.json({ success: true, data: updated });
    } catch (e) {
      res.status(500).json({ error: "Erro ao aprovar saque." });
    }
  }

  static async listAllPendingPayouts(req: Request, res: Response) {
    try {
      const payouts = await prisma.payout.findMany({
        where: { status: 'pending' },
        include: { user: { select: { username: true, full_name: true } } },
        orderBy: { created_at: 'desc' }
      });
      res.json({ data: payouts });
    } catch (e) {
      res.status(500).json({ error: "Erro ao listar saques." });
    }
  }

  // =========================================================
  // 2. GESTÃO SaaS: Utilizadores e Segurança
  // =========================================================
  static async listUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, username: true, role: true, tier: true, created_at: true },
        orderBy: { created_at: 'desc' }
      });
      res.json({ data: users });
    } catch (e) {
      res.status(500).json({ error: "Erro ao listar utilizadores." });
    }
  }

  static async forcePasswordReset(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password) return res.status(400).json({ error: "Nova password é obrigatória." });

      const password_hash = await bcrypt.hash(new_password, 10);

      await prisma.user.update({
        where: { id },
        data: { password_hash }
      });

      console.log(`[ADMIN] Password resetada para o utilizador ${id}.`);
      res.json({ success: true, message: "Password alterada com sucesso." });
    } catch (e) {
      res.status(500).json({ error: "Erro ao forçar reset de password." });
    }
  }
}
