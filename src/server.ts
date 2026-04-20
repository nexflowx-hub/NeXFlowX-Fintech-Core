import { getCheckoutConfig } from './controllers/checkout.config.controller';
import { handleOnrampWebhook } from './controllers/onramp.webhook.controller';
import { startCronJobs } from './cron';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import apiRoutes from './routes/api.routes';
import { OrchestratorService } from './services/orchestrator.service'; // 🔥 IMPORT DO CÉREBRO

dotenv.config();
const app = express();

const allowedOrigins = [
  'https://central.nexflowx.tech',
  'https://atlas.nexflowx.tech',
  'https://pay.nexflowx.tech',
  'https://api-core.nexflowx.tech',
  'https://api.atlasglobal.digital',
  'https://dashboard.atlasglobal.digital',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, origin || '*');
    else callback(new Error('Acesso bloqueado por CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'stripe-signature', 'x-nowpayments-sig', 'x-nexflowx-signature'],
  credentials: true
}));

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;
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

import { WebhookController } from './controllers/webhook.controller';
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), WebhookController.stripeWebhook);

app.use(express.json());

// Rota de Diagnóstico Atlas Global
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'Atlas Global Core Engine',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
// Webhook Onramp (PIX/Crypto)
app.post('/api/v1/webhooks/onramp', handleOnrampWebhook);

});
// Checkout Dinâmico (Smart Routing)
app.get('/api/v1/checkout/:linkId/config', getCheckoutConfig);



app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

    const isValid = (user.password_hash === password) || await bcrypt.compare(password, user.password_hash);
    if (isValid) {
      return res.json({
        success: true,
        token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET as string, { expiresIn: '24h' }),
        user: { id: user.id, role: user.role, username: user.username }
      });
    }
    res.status(401).json({ error: "Credenciais inválidas" });
  } catch (e) { res.status(500).json({ error: "Erro interno no login" }); }
});

app.use('/api/v1', apiRoutes);

app.get('/api/v1/checkout-session/:id', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: req.params.id }, include: { payee: { select: { username: true } }, store: true }
    });
    if (!tx) return res.status(404).json({ error: 'Sessão não encontrada' });

    res.json({
      tx_id: tx.id,
      mode: 'redirect',
      branding: {
        logo_url: tx.store?.logo_url || "https://ui-avatars.com/api/?name=" + tx.payee.username,
        primary_color: tx.store?.primary_color || "#1a1a2e",
        accent_color: tx.store?.accent_color || "#f0ebe3",
        merchant_name: tx.store?.name || tx.payee.username
      },
      collected_fields: [{ key: 'email', required: true }],
      products: [{
        id: tx.id, name: "Pagamento - " + (tx.store?.name || tx.payee.username),
        description: "Transação Segura NeXFlowX", price: Number(tx.amount), currency: tx.currency, type: "digital", quantity: 1
      }],
      available_methods: [
        { id: "card_default", type: "credit_card", label: "Cartão de Crédito", provider_data: { engine: tx.provider_name === 'stripe' ? 'stripe' : 'sumup' } }
      ],
      expires_at: new Date(Date.now() + 86400000).toISOString()
    });
  } catch (err) { res.status(500).json({ error: "Erro interno" }); }
});

app.patch('/api/v1/checkout-session/:id/customer', async (req, res) => {
  try {
    const { customer_name, customer_email, address, country } = req.body;
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    const meta = (tx?.metadata as any) || {};
    await prisma.transaction.update({
      where: { id: req.params.id },
      data: { customer_email, country_code: country, metadata: { ...meta, customer_name, address, updated_at: new Date() } }
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Erro save" }); }
});

// 🔥 O NOVO INITIATE ROTEADO PELO ORCHESTRATOR
app.post('/api/v1/checkout-session/:id/initiate', async (req, res) => {
  try {
    const txId = req.params.id;
    
    // 1. O Cérebro decide o Caminho!
    const routePlan = await OrchestratorService.resolveBestProvider(txId);
    const { tx, providerType } = routePlan;

    let secretKey = "";
    
    // 2. Extrai a chave correta dependendo do Modelo
    if (routePlan.mode === 'BYOK') {
      secretKey = decryptKey(routePlan.apiKey || "");
    } else if (routePlan.mode === 'PAYFAC') {
      // JSON da NeXFlowX (Ex: { "sk": "sk_test_123..." })
      const creds = routePlan.credentials;
      if (!creds || !creds.sk) return res.status(500).json({ error: "Credenciais institucionais inválidas." });
      secretKey = decryptKey(creds.sk); // Permite estar guardado encriptado na DB
    }

    if (!secretKey) return res.status(500).json({ error: "Chave do Gateway não encontrada." });

    // 3. Executar Transação com Stripe
    if (providerType === 'stripe') {
      const Stripe = require('stripe');
      const stripeInstance = new Stripe(secretKey, { apiVersion: '2023-10-16' });

      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: Math.round(Number(tx.amount) * 100),
        currency: tx.currency.toLowerCase(),
        metadata: { 
          txId: tx.id, 
          routeMode: routePlan.mode, 
          masterNode: routePlan.masterProviderId || 'NONE' 
        }
      });
      return res.json({ provider: 'stripe', client_secret: paymentIntent.client_secret });
    } 

    res.status(400).json({ error: `Motor ${providerType} ainda não implementado no backend.` });
  } catch (e: any) {
    console.error("[INITIATE ERROR]", e.message);
    res.status(500).json({ error: e.message || "Erro interno na iniciação do pagamento" });
  }
});

startCronJobs();
app.listen(8080, '0.0.0.0', () => console.log('🚀 NeXFlowX Core Bank API ON'));
