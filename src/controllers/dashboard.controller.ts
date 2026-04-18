import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DashboardController {
  
  static async getPipeline(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const storeId = req.query.store_id as string;
      
      // Filtro de segurança: Admin vê tudo, Merchant vê apenas o seu
      const whereClause: any = user.role === 'admin' ? {} : { payee_id: user.id };
      if (storeId) whereClause.store_id = storeId;

      const txs = await prisma.transaction.findMany({ where: whereClause });

      // Estrutura de dados que o Frontend V2 e V1 esperam
      const p: any = {
        pending: { total: 0, count: 0 },
        gateway_confirmed: { total: 0, count: 0 },
        settled: { total: 0, count: 0 },
        failed: { total: 0, count: 0 },
        // Fallbacks falsos caso o Frontend antigo ainda os procure
        holding_provider: { total: 0, count: 0 },
        fx_in_transit: { total: 0, count: 0 },
        inventory_wallet: { total: 0, count: 0 },
        distributed: { total: 0, count: 0 }
      };

      txs.forEach((t) => {
        const status = t.status as string;
        if (p[status]) {
          p[status].count += 1;
          p[status].total += Number(t.net_amount || t.amount || 0);
        }
      });

      res.json({ data: p });
    } catch (e: any) {
      console.error("[PIPELINE ERROR]", e);
      res.status(500).json({ error: "Erro ao carregar o pipeline." });
    }
  }

  static async getTransactions(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const storeId = req.query.store_id as string;
      const limit = Number(req.query.limit) || 25;
      const page = Number(req.query.page) || 1;
      const skip = (page - 1) * limit;

      const whereClause: any = user.role === 'admin' ? {} : { payee_id: user.id };
      if (storeId) whereClause.store_id = storeId;

      const txs = await prisma.transaction.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: skip,
        include: { store: { select: { name: true } } }
      });

      res.json({ data: txs });
    } catch (e: any) {
      console.error("[TRANSACTIONS ERROR]", e);
      res.status(500).json({ error: "Erro ao listar transações." });
    }
  }
}
