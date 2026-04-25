import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export class ActionTicketController {
  
  static async createTicket(req: AuthRequest, res: Response) {
    try {
      const { category, priority, subject, description, metadata } = req.body;

      const ticket = await prisma.actionTicket.create({
        data: {
          userId: req.user.id,
          type: category || 'GENERAL', // Mapeado para a coluna 'type'
          status: 'OPEN',
          // Tudo o resto vai para dentro do 'payload' (que é o campo JsonValue)
          payload: { 
            ...(metadata || {}), 
            subject: subject || 'Sem assunto',
            description: description || 'Sem descrição fornecida',
            priority: priority || 'MEDIUM' 
          }
        }
      });

      return res.status(201).json({ data: ticket });
    } catch (error: any) {
      return res.status(500).json({ error: { message: 'Erro ao abrir ticket.', details: error.message } });
    }
  }

  static async resolveTicket(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { resolution, internal_notes, action_performed } = req.body;

    try {
      const result = await prisma.$transaction(async (tx) => {
        
        const ticket = await tx.actionTicket.update({
          where: { id },
          data: {
            status: 'RESOLVED',
            // Usamos a coluna real 'adminNotes'
            adminNotes: `[${new Date().toISOString()}] Resolução: ${resolution || 'N/A'} | ${internal_notes || ''}` 
          }
        });

        if (action_performed === 'UPGRADE_KYC') {
          await tx.user.update({
            where: { id: ticket.userId },
            data: { kyc_level: 2 }
          });
        }

        return ticket;
      });

      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ error: { message: 'Falha ao processar resolução.', details: error.message } });
    }
  }

  static async listPendingTickets(req: Request, res: Response) {
    try {
      const tickets = await prisma.actionTicket.findMany({
        where: { status: 'OPEN' },
        include: { user: { select: { email: true, username: true } } },
        orderBy: { createdAt: 'asc' } // Usando createdAt com 'A' maiúsculo conforme o teu log mostrou
      });
      return res.json({ data: tickets });
    } catch (error: any) {
      return res.status(500).json({ error: { message: 'Erro ao listar tickets' } });
    }
  }
}
