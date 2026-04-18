import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class PaymentLinkController {
  static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { amount, currency, description, store_id } = req.body;
      const slug = crypto.randomBytes(6).toString('hex');

      const link = await prisma.paymentLink.create({
        data: {
          userId,
          storeId: store_id || null,
          amount: Number(amount),
          currency: currency.toUpperCase(),
          description,
          slug,
          active: true
        }
      });

      res.status(201).json({ 
        success: true, 
        url: `https://pay.nexflowx.tech/${slug}`,
        data: link 
      });
    } catch (e) { res.status(500).json({ error: "Erro ao criar link" }); }
  }

  static async list(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const links = await prisma.paymentLink.findMany({
        where: { userId },
        include: { store: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ data: links });
    } catch (e) { res.status(500).json({ error: "Erro ao listar links" }); }
  }
}
