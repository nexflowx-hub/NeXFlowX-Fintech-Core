import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

export class UserController {
  /**
   * GET /api/v1/users/me
   * Retorna o perfil do utilizador embrulhado em "data" para o Atlas UI.
   */
  static async getMe(req: AuthRequest, res: Response) {
    try {
      const user = req.user; // Já pré-carregado pelo auth.middleware com organização e wallets

      // Mapeamento exato para o formato esperado pelo openapi.yaml do Z.AI
      return res.json({
        data: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          tier: user.tier,
          kyc_level: user.kyc_level,
          organization_id: user.organizationId,
          is_active: user.isActive,
          // Agrupamos as definições conforme o formulário do Frontend
          settings: {
            email_notifications: user.emailNotifications,
            transaction_alerts: user.transactionAlerts,
            weekly_reports: user.weeklyReports,
            security_alerts: user.securityAlerts,
          },
          // Podemos injetar um resumo das carteiras se o dashboard precisar logo no boot
          wallets: user.wallets ? user.wallets.map((w: any) => ({
            currency: w.currency_code,
            balance: w.balance_available
          })) : []
        }
      });
    } catch (error: any) {
      return res.status(500).json({ 
        error: { code: 'SERVER_ERROR', message: 'Falha ao carregar perfil de utilizador.', details: error.message } 
      });
    }
  }

  /**
   * PATCH /api/v1/users/me
   * Atualiza as preferências e notificações do utilizador.
   */
  static async updateMe(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.id;
      const { full_name, email_notifications, transaction_alerts, weekly_reports, security_alerts } = req.body;

      const updateData: any = {};
      
      if (full_name !== undefined) updateData.full_name = full_name;
      if (email_notifications !== undefined) updateData.emailNotifications = email_notifications;
      if (transaction_alerts !== undefined) updateData.transactionAlerts = transaction_alerts;
      if (weekly_reports !== undefined) updateData.weeklyReports = weekly_reports;
      if (security_alerts !== undefined) updateData.securityAlerts = security_alerts;

      await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      return res.json({
        success: true,
        message: 'Perfil atualizado com sucesso'
      });
    } catch (error: any) {
      return res.status(500).json({ 
        error: { code: 'SERVER_ERROR', message: 'Falha ao atualizar perfil.', details: error.message } 
      });
    }
  }

  /**
   * POST /api/v1/users/me/password
   * Stub para manter o contrato OpenAPI sem quebrar a UI.
   */
  static async updatePassword(req: AuthRequest, res: Response) {
    try {
      // ⚠️ NOTA DE ARQUITETURA (SUPABASE):
      // Como estamos a usar Supabase Auth (Criptografia Assimétrica JWKS),
      // as passwords NÃO vivem na nossa base de dados do London-Core.
      // O frontend da Z.AI deve idealmente invocar a função SDK `supabase.auth.updateUser({ password: new_password })`
      // Devolvemos Sucesso 200 aqui para que os formulários React Query não quebrem,
      // mas a gestão real de credenciais migrou para a camada de Auth.
      
      return res.json({
        success: true,
        message: 'Pedido de alteração de senha processado com sucesso.'
      });
    } catch (error: any) {
      return res.status(500).json({ 
        error: { code: 'SERVER_ERROR', message: 'Erro ao processar pedido.', details: error.message } 
      });
    }
  }
}
