import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class ApiKeyController {
  
  static async listKeys(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const keys = await prisma.apiKey.findMany({
        where: { user_id },
        select: { id: true, name: true, key_prefix: true, created_at: true }
      });
      res.json({ data: keys });
    } catch (e: any) { res.status(500).json({ error: "Erro ao listar chaves API" }); }
  }

  static async createKey(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      let { name } = req.body;
      
      // 🛡️ O NOSSO ESCUDO ANTI-FALHAS DO FRONTEND
      // Se a Z.AI não enviar o nome, nós criamos um automaticamente em vez de dar Erro 400!
      if (!name) {
        name = `Key gerada a ${new Date().toISOString().split('T')[0]}`;
      }

      // Gera a chave real
      const rawSecret = crypto.randomBytes(32).toString('hex');
      const apiKey = `nx_live_${rawSecret}`;
      
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const keyPrefix = apiKey.substring(0, 12) + "..." + apiKey.substring(apiKey.length - 4);

      // Grava no Supabase!
      const newKey = await prisma.apiKey.create({
        data: { name, key_hash: keyHash, key_prefix: keyPrefix, user_id }
      });

      res.status(201).json({ success: true, data: { id: newKey.id, name: newKey.name, raw_key: apiKey }, message: "Guarde esta chave. Não será mostrada novamente." });
    } catch (e: any) { 
      console.error(e);
      res.status(500).json({ error: "Erro ao criar chave API na base de dados" }); 
    }
  }

  static async revokeKey(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const key_id = req.params.id;
      
      const deleted = await prisma.apiKey.deleteMany({ where: { id: key_id, user_id } });
      if (deleted.count === 0) return res.status(404).json({ error: "Chave não encontrada." });

      res.json({ success: true, message: "Chave revogada com sucesso." });
    } catch (e: any) { res.status(500).json({ error: "Erro ao revogar chave" }); }
  }
}
