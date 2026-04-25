import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Estende a interface do Express para incluir o utilizador tipado.
 * Evita erros de compilação ao aceder a req.user nos controllers.
 */
export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  // 1. Validar a presença e formato do Header Authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token de acesso não fornecido ou formato inválido.',
        details: {}
      }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    /**
     * 2. Verificar o token com o segredo do Supabase.
     * O segredo deve estar definido no ficheiro .env como SUPABASE_JWT_SECRET.
     */
    if (!process.env.SUPABASE_JWT_SECRET) {
      throw new Error('SUPABASE_JWT_SECRET não está definido no ambiente.');
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET) as any;

    /**
     * 3. Sincronizar Identidade: Procurar o utilizador no Postgres (London-Core).
     * Utilizamos o email vindo do JWT para cruzar com a nossa base de dados.
     * Incluímos 'organization' e 'wallets' para que os controllers tenham os dados prontos.
     */
    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
      include: {
        organization: true,
        wallets: true
      }
    });

    // 4. Validação de Existência e Estado da Conta
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_SYNCHRONIZED',
          message: 'Utilizador autenticado no Supabase não encontrado no sistema Fintech-Core.',
          details: { email: decoded.email }
        }
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Esta conta de utilizador encontra-se desativada.',
          details: {}
        }
      });
    }

    /**
     * 5. Sucesso: Anexar o utilizador ao objeto da requisição.
     * O 'req.user' passará a estar disponível em todos os endpoints protegidos.
     */
    req.user = user;
    next();
  } catch (error: any) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'O token fornecido é inválido, expirou ou a assinatura não coincide.',
        details: process.env.NODE_ENV === 'development' ? { message: error.message } : {}
      }
    });
  }
};
