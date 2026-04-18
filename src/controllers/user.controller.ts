import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export class UserController {
  static async getMe(req: Request, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (req as any).user.id },
        select: { id: true, username: true, role: true, email: true, kyc_level: true }
      });
      res.json({ data: user });
    } catch (e) { res.status(500).json({ error: "Erro ao obter perfil" }); }
  }

  static async updateMe(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { email, full_name, phone } = req.body;
      await prisma.user.update({
        where: { id: userId },
        data: { email, full_name, phone }
      });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro ao atualizar perfil" }); }
  }

  static async updatePassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { current_password, new_password } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

      // Valida a password atual (suporta plain-text legado ou bcrypt)
      const isValid = (user.password_hash === current_password) || await bcrypt.compare(current_password, user.password_hash);
      if (!isValid) return res.status(401).json({ error: "Password atual incorreta" });

      // Encripta a nova password
      const hashedNewPassword = await bcrypt.hash(new_password, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password_hash: hashedNewPassword }
      });

      res.json({ success: true, message: "Password atualizada com sucesso" });
    } catch (e) {
      console.error("[ERRO PASSWORD]", e);
      res.status(500).json({ error: "Erro interno ao atualizar password" });
    }
  }
}
