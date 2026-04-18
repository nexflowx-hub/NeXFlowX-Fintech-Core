import { Request, Response, NextFunction } from 'express';

export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== requiredRole) {
      return res.status(403).json({ error: "Acesso negado. Privilégios insuficientes." });
    }
    next();
  };
};
