import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validate = (schema: z.ZodSchema) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Dados inválidos no Payload", 
          details: error.issues.map(e => ({ campo: e.path.join('.'), mensagem: e.message })) 
        });
      }
      return res.status(400).json({ error: "Erro de validação" });
    }
  };
