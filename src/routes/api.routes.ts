import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { swapSchema, payoutSchema } from '../validators/transaction.validator';

// Controllers
import { VivaWebhookController } from '../controllers/viva.controller';
import { WalletController } from '../controllers/wallet.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { TransactionController } from '../controllers/transaction.controller';
import { UserController } from '../controllers/user.controller';
import { ApiKeyController } from '../controllers/apikey.controller';
import { StoreController } from '../controllers/store.controller';
import { GatewayController } from '../controllers/gateway.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { PaymentLinkController } from '../controllers/payment-link.controller';
import { AdminController } from '../controllers/admin.controller';
import { DepositController } from '../controllers/deposit.controller';
import { ActionTicketController } from '../controllers/ticket.controller';

// Futuro Controller para Roteamento de Fiat <-> Crypto
import { OnrampController } from '../controllers/onramp.controller'; 

const router = Router();

// ==========================================
// 👤 UTILIZADOR & SEGURANÇA
// ==========================================
router.get('/users/me', authenticateUser, UserController.getMe);
router.patch('/users/me', authenticateUser, UserController.updateMe);
router.post('/users/me/password', authenticateUser, UserController.updatePassword);

// ==========================================
// 🎫 TICKETS & SUPORTE (Integração de Dados / KYC)
// ==========================================
router.post('/tickets', authenticateUser, ActionTicketController.createTicket);

// ==========================================
// 🏦 TESOURARIA & CARTEIRAS
// ==========================================
router.get('/wallets', authenticateUser, WalletController.listMyWallets);
router.get('/wallets/primary', authenticateUser, WalletController.getMyWallet);

// ==========================================
// 💸 OPERAÇÕES FINANCEIRAS
// ==========================================
router.get('/transactions', authenticateUser, DashboardController.getTransactions);
router.post('/transactions/swap', authenticateUser, validate(swapSchema), TransactionController.swap);
router.post('/transactions/payout', authenticateUser, validate(payoutSchema), TransactionController.payout);
router.post('/transactions/deposit', authenticateUser, DepositController.requestDeposit);

// ==========================================
// 🔄 ONRAMP / OFFRAMP (Fiat <-> Crypto)
// Integração unificada para Guardarian & OnRamp.Money
// ==========================================
router.post('/onramp/quote', authenticateUser, OnrampController.getQuote);
router.post('/onramp/initiate', authenticateUser, OnrampController.initiate);
router.get('/onramp/status/:id', authenticateUser, OnrampController.getStatus);

// ==========================================
// 📊 DASHBOARD & RELATÓRIOS
// ==========================================
router.get('/dashboard/pipeline', authenticateUser, DashboardController.getPipeline);

// ==========================================
// 🛠️ DEVELOPER HUB (SaaS & Gateways)
// ==========================================
router.get('/api-keys', authenticateUser, ApiKeyController.listKeys);
router.post('/api-keys', authenticateUser, ApiKeyController.createKey);
router.delete('/api-keys/:id', authenticateUser, ApiKeyController.revokeKey);

router.get('/payment-links', authenticateUser, PaymentLinkController.list);
router.post('/payment-links', authenticateUser, PaymentLinkController.create);

router.get('/stores', authenticateUser, StoreController.listStores);
router.post('/stores', authenticateUser, StoreController.createStore);
router.patch('/stores/:id', authenticateUser, StoreController.updateStore);

router.get('/settings/gateways', authenticateUser, GatewayController.listGateways);
router.post('/settings/gateways', authenticateUser, GatewayController.createGateway);

// ==========================================
// 👮 BACKOFFICE / ADMIN
// ==========================================
router.get('/admin/users', authenticateUser, requireRole('admin'), AdminController.listUsers);
router.post('/admin/users/:id/force-password', authenticateUser, requireRole('admin'), AdminController.forcePasswordReset);
router.get('/admin/payouts/pending', authenticateUser, requireRole('admin'), AdminController.listAllPendingPayouts);
router.post('/admin/payouts/:id/approve', authenticateUser, requireRole('admin'), AdminController.approvePayout);

// Gestão de Tickets / Integração de Dados
router.get('/admin/tickets/pending', authenticateUser, requireRole('admin'), ActionTicketController.listPendingTickets);
router.patch('/admin/tickets/:id/resolve', authenticateUser, requireRole('admin'), ActionTicketController.resolveTicket);

// ==========================================
// 🌍 WEBHOOKS (Públicos / Sem Auth)
// ==========================================
router.post('/webhooks/supabase-sync', WebhookController.supabaseSync); 
router.post('/webhooks/mistic', WebhookController.misticWebhook);
router.post('/webhooks/nowpayments', WebhookController.nowpaymentsIpn);
router.post('/webhooks/sumup', WebhookController.sumupWebhook);

// Novos Webhooks Onramp (Confirmação de liquidação Fiat/Crypto)
router.post('/webhooks/onramp-money', WebhookController.onrampMoneyWebhook);
router.post('/webhooks/guardarian', WebhookController.guardarianWebhook);

// Viva Wallet
router.get('/webhooks/viva', VivaWebhookController.verifyOrigin);
router.post('/webhooks/viva', VivaWebhookController.handleEvent);

export default router;
