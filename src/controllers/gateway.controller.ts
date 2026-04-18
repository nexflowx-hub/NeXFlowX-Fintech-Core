import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY || '';
const ENCRYPTION_KEY = Buffer.from(MASTER_KEY.padEnd(64, '0').slice(0, 64), 'hex');
const IV_LENGTH = 16;

function encryptKey(text: string) {
  if (!MASTER_KEY) return text; // Fallback para Dev sem chave
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export class GatewayController {
  static async listGateways(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const configs = await prisma.gatewayConfig.findMany({ where: { user_id: userId } });
      
      // Removemos a API Key da resposta por segurança (o frontend não precisa de a ver)
      const safeConfigs = configs.map(c => ({
        id: c.id, provider_name: c.provider_name, is_active: c.is_active, merchant_id: c.merchant_id, store_id: c.store_id
      }));
      res.json({ data: safeConfigs });
    } catch (e) { res.status(500).json({ error: "Erro ao listar gateways" }); }
  }

  static async createGateway(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { provider_name, api_key, merchant_id, is_active, store_id } = req.body;
      
      if (store_id) {
        // Valida se a loja existe e pertence a este utilizador antes de ligar o gateway
        const store = await prisma.store.findFirst({ where: { id: store_id, user_id: userId } });
        if (!store) return res.status(403).json({ error: "Loja inválida." });
      }

      const encryptedKey = encryptKey(api_key);

      const config = await prisma.gatewayConfig.create({
        data: { user_id: userId, store_id: store_id || null, provider_name, api_key: encryptedKey, merchant_id, is_active }
      });
      res.status(201).json({ success: true, id: config.id });
    } catch (e) { res.status(500).json({ error: "Erro ao configurar gateway" }); }
  }
}
