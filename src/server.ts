import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// Controllers e Serviços
import apiRoutes from './routes/api.routes';
import { OrchestratorService } from './services/orchestrator.service';
import { getCheckoutConfig } from './controllers/checkout.config.controller';
import { handleOnrampWebhook } from './controllers/onramp.webhook.controller';
import { WebhookController } from './controllers/webhook.controller';
import { startCronJobs } from './cron';

dotenv.config();
const app = express();
const prisma = new PrismaClient();

// ==========================================
// 🛡️ CONFIGURAÇÃO DE SEGURANÇA (CORS)
// ==========================================
const allowedOrigins = [
  'https://central.nexflowx.tech',
  'https://atlas.nexflowx.tech',
  'https://pay.nexflowx.tech',
  'https://api-core.nexflowx.tech',
  'https://api.atlasglobal.digital',
  'https://dashboard.atlasglobal.digital',
  'https://wallet.atlasglobal.digital',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, origin || '*');
    else callback(new Error('Acesso bloqueado pela Política de CORS da NeXFlowX'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'stripe-signature', 'x-nowpayments-sig', 'x-nexflowx-signature', 'x-supabase-webhook-secret'],
  credentials: true
}));

// ==========================================
// 🔑 MOTOR DE ENCRIPTAÇÃO (BYOK)
// ==========================================
const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY || '';

function decryptKey(text: string) {
  if (!text || !text.includes(':') || !MASTER_KEY) return text;
  try {
    const ENCRYPTION_KEY = Buffer.from(MASTER_KEY, 'hex');
    const textParts = text.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, Buffer.from(textParts[0], 'hex'));
    return decipher.update(Buffer.from(textParts[1], 'hex'), undefined, 'utf8') + decipher.final('utf8');
  } catch (e) { return text; }
}

// ==========================================
// 🌍 WEBHOOKS CRÍTICOS (Parse Raw Body para Stripe)
// ==========================================
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), WebhookController.stripeWebhook);

// ==========================================
// 🛠️ MIDDLEWARES GLOBAIS
// ==========================================
app.use(express.json());

// ==========================================
// 🏥 DIAGNÓSTICO E ROTAS BASE
// ==========================================
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'Atlas Global Core Engine',
    version: '2.5.0',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/webhooks/onramp', handleOnrampWebhook);
app.get('/api/v1/checkout/:linkId/config', getCheckoutConfig);

// ==========================================
// 🚦 ROTAS PRINCIPAIS (Protegidas pelo Supabase Auth)
// ==========================================
app.use('/api/v1', apiRoutes);

// 🔥 O CÉREBRO ORQUESTRADOR (Initiate)
app.post('/api/v1/checkout-session/:id/initiate', async (req, res) => {
  try {
    const txId = req.params.id;
    const routePlan = await OrchestratorService.resolveBestProvider(txId);
    const { tx, providerType } = routePlan;
    let secretKey = "";

    if (routePlan.mode === 'BYOK') {
      secretKey = decryptKey(routePlan.apiKey || "");
    } else if (routePlan.mode === 'PAYFAC') {
      const creds = routePlan.credentials as any;
      if (!creds || !creds.sk) return res.status(500).json({ error: "Credenciais inválidas." });
      secretKey = decryptKey(creds.sk);
    }

    if (!secretKey) return res.status(500).json({ error: "Chave não encontrada." });

    if (providerType === 'stripe') {
      const Stripe = require('stripe');
      const stripeInstance = new Stripe(secretKey, { apiVersion: '2023-10-16' });
      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: Math.round(Number(tx.amount) * 100),
        currency: tx.currency.toLowerCase(),
        metadata: { txId: tx.id, routeMode: routePlan.mode }
      });
      return res.json({ provider: 'stripe', client_secret: paymentIntent.client_secret });
    }
    res.status(400).json({ error: `Motor ${providerType} pendente.` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

startCronJobs();
app.listen(8080, '0.0.0.0', () => console.log('🚀 NeXFlowX Core Bank API ON (Port 8080)'));
