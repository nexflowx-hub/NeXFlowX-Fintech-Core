import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class StoreController {
  static async listStores(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const stores = await prisma.store.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' }
      });
      res.json({ data: stores });
    } catch (e) { res.status(500).json({ error: "Erro ao listar lojas" }); }
  }

  static async createStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { name, logo_url, primary_color, accent_color, webhook_url } = req.body;
      const webhook_secret = 'nx_sec_' + crypto.randomBytes(16).toString('hex');
      
      const store = await prisma.store.create({
        data: { name, logo_url, primary_color, accent_color, webhook_url, webhook_secret, user_id: userId }
      });
      res.status(201).json({ success: true, data: store });
    } catch (e) { res.status(500).json({ error: "Erro ao criar loja" }); }
  }

  static async updateStore(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const storeId = req.params.id;
      const { name, logo_url, primary_color, accent_color, webhook_url } = req.body;
      
      // O Prisma updateMany garante que só atualiza se for a loja certa E do dono certo
      const result = await prisma.store.updateMany({
        where: { id: storeId, user_id: userId },
        data: { name, logo_url, primary_color, accent_color, webhook_url }
      });
      
      if (result.count === 0) return res.status(404).json({ error: "Loja não encontrada ou sem permissão." });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro ao atualizar loja" }); }
  }
}
