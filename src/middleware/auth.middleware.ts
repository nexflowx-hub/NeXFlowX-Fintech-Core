import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Tentar Autenticação por API KEY (Servidor-para-Servidor)
    const apiKey = req.headers['x-api-key'] as string;
    
    if (apiKey) {
       const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
       const keyData = await prisma.apiKey.findUnique({ 
         where: { key_hash: hashedKey }, 
         include: { user: true } 
       });

       if (keyData) { 
         (req as any).user = { id: keyData.user_id, role: keyData.user.role }; 
         return next(); 
       }
       return res.status(401).json({ error: "API Key inválida ou revogada" });
    }

    // 2. Tentar Autenticação por JWT (Humano no Dashboard)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Acesso negado. Token ou API Key ausente." });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;

    if (!secret) {
       return res.status(500).json({ error: "Erro crítico de servidor: JWT_SECRET não definida." });
    }

    // O TypeScript agora aceita o secret em segurança
    const decoded = jwt.verify(token, secret as string) as any;
    
    (req as any).user = {
      id: decoded.sub || decoded.id,
      role: decoded.role || decoded.app_metadata?.role || 'merchant',
      email: decoded.email || null
    };

    return next();
  } catch (error: any) {
    console.error("[AUTH ERROR]", error.message);
    return res.status(401).json({ error: "Sessão expirada ou Token inválido." });
  }
};
