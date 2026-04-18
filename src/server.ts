import { startCronJobs } from './cron';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import apiRoutes from './routes/api.routes';

dotenv.config();
const app = express();

const allowedOrigins = [
  'https://central.nexflowx.tech',
  'https://atlas.nexflowx.tech',
  'https://pay.nexflowx.tech', // Frontend Vercel (Checkout V2) Autorizado
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin || '*');
    } else {
      callback(new Error('Acesso bloqueado por CORS (Origin não autorizada)'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'stripe-signature', 'x-nowpayments-sig', 'x-nexflowx-signature'],
  credentials: true
}));

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;
const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY || '';

// Função de Segurança para Chaves
function decryptKey(text: string) {
  if (!text || !text.includes(':') || !MASTER_KEY) return text;
  try {
    const ENCRYPTION_KEY = Buffer.from(MASTER_KEY, 'hex');
    const textParts = text.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, Buffer.from(textParts[0], 'hex'));
    return decipher.update(Buffer.from(textParts[1], 'hex'), undefined, 'utf8') + decipher.final('utf8');
  } catch (e) { return text; }
}

// ⚠️ STRIPE WEBHOOK (Tem de estar antes do express.json)
import { WebhookController } from './controllers/webhook.controller';
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), WebhookController.stripeWebhook);

app.use(express.json());

// ==========================================
// 🔐 AUTENTICAÇÃO E LOGIN (DASHBOARD)
// ==========================================
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
  } catch (e) {
    res.status(500).json({ error: "Erro interno no login" });
  }
});

app.use('/api/v1', apiRoutes);

// ==========================================
// 🛒 CHECKOUT SESSION (SDUI ARCHITECTURE)
// ==========================================
app.get('/api/v1/checkout-session/:id', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { payee: { select: { username: true } }, store: true }
    });

    if (!tx) return res.status(404).json({ error: 'Sessão não encontrada' });

    // Payload SDUI estrito de acordo com o types.ts do Frontend
    res.json({
      tx_id: tx.id,
      mode: 'redirect',
      branding: {
        logo_url: tx.store?.logo_url || "https://ui-avatars.com/api/?name=" + tx.payee.username,
        primary_color: tx.store?.primary_color || "#1a1a2e",
        accent_color: tx.store?.accent_color || "#f0ebe3",
        merchant_name: tx.store?.name || tx.payee.username
      },
      collected_fields: [
        { key: 'email', required: true }
      ],
      products: [
        {
          id: tx.id,
          name: "Pagamento - " + (tx.store?.name || tx.payee.username),
          description: "Transação Segura NeXFlowX",
          price: Number(tx.amount),
          currency: tx.currency,
          type: "digital",
          quantity: 1
        }
      ],
      available_methods: [
        {
          id: "card_default",
          type: "credit_card",
          label: "Cartão de Crédito",
          provider_data: { engine: tx.provider_name === 'stripe' ? 'stripe' : 'sumup' }
        },
        {
          id: "mbway_native",
          type: "mbway_native",
          label: "MB WAY",
          provider_data: { engine: "native" }
        }
      ],
      expires_at: new Date(Date.now() + 86400000).toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: "Erro interno" });
  }
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
  } catch (e) { 
    res.status(500).json({ error: "Erro save" }); 
  }
});

app.post('/api/v1/checkout-session/:id/initiate', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({ 
      where: { id: req.params.id },
      include: { payee: { include: { gateway_configs: true } }, store: { include: { gateways: true } } }
    });
    
    if (!tx) return res.status(404).json({ error: "Transação não encontrada" });

    const requestedProvider = tx.provider_name === 'stripe' ? 'stripe' : 'sumup';

    let config = tx.store?.gateways.find(c => c.provider_name === requestedProvider && c.is_active);
    if (!config) config = tx.payee.gateway_configs.find(c => c.provider_name === requestedProvider && c.is_active && !c.store_id);

    if (!config) return res.status(500).json({ error: `Gateway ${requestedProvider} offline ou não configurado.` });

    const secretKey = decryptKey(config.api_key);
    if (!secretKey) return res.status(500).json({ error: "Erro de encriptação ao ler chave do Gateway." });

    if (requestedProvider === 'stripe') {
      const Stripe = require('stripe');
      const stripeInstance = new Stripe(secretKey, { apiVersion: '2023-10-16' });
      
      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: Math.round(Number(tx.amount) * 100),
        currency: tx.currency.toLowerCase(),
        metadata: { txId: tx.id }
      });
      return res.json({ provider: 'stripe', client_secret: paymentIntent.client_secret });
    } else if (requestedProvider === 'sumup') {
      let merchantCode = config.merchant_id;
      if (!merchantCode || merchantCode.startsWith('sup_pk_')) {
        const meRes = await fetch('https://api.sumup.com/v0.1/me', { headers: { 'Authorization': `Bearer ${secretKey}` } });
        const meData = await meRes.json();
        if (meData.merchant_profile?.merchant_code) merchantCode = meData.merchant_profile.merchant_code;
      }

      const sumupRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(tx.amount),
          currency: tx.currency.toUpperCase(),
          checkout_reference: `${tx.id}_${Date.now()}`,
          merchant_code: merchantCode
        })
      });
      const data = await sumupRes.json();
      if (!data.id) return res.status(500).json({ error: "Erro na comunicação com a SumUp", details: data });
      return res.json({ provider: 'sumup', checkout_id: data.id });
    }

    res.status(400).json({ error: "Provedor não suportado para Iniciação de Checkout" });
  } catch (e) { 
    console.error("[INITIATE ERROR]", e);
    res.status(500).json({ error: "Erro interno na iniciação do pagamento" }); 
  }
});

startCronJobs();
app.listen(8080, '0.0.0.0', () => console.log('🚀 NeXFlowX Core Bank API ON'));
