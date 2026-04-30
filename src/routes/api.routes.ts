import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { payoutSchema } from '../validators/transaction.validator'; // Retirei o swapSchema daqui, usaremos validação própria no SwapController

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
import { SwapController } from '../controllers/swap.controller'; // NOVO CONTROLADOR DE SWAP

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
// 🏦 TESOURARIA & CARTEIRAS (Acesso Universal)
// ==========================================
router.get('/wallets', authenticateUser, WalletController.listMyWallets);
router.get('/wallets/primary', authenticateUser, WalletController.getMyWallet);

// ==========================================
// 💸 OPERAÇÕES FINANCEIRAS B2C (Customer & Merchant)
// ==========================================
router.get('/transactions', authenticateUser, DashboardController.getTransactions);
router.post('/transactions/deposit', authenticateUser, DepositController.requestDeposit);
router.post('/transactions/payout', authenticateUser, validate(payoutSchema), TransactionController.payout);

// 🔥 NOVA MÁQUINA DE SWAP ATÓMICA 🔥
router.post('/swap/execute', authenticateUser, SwapController.executeSwap);

// ==========================================
// 🔄 ONRAMP / OFFRAMP (Fiat <-> Crypto)
// Integração unificada para Guardarian & OnRamp.Money
// ==========================================
router.post('/onramp/quote', authenticateUser, OnrampController.getQuote);
router.post('/onramp/initiate', authenticateUser, OnrampController.initiate);
router.get('/onramp/status/:id', authenticateUser, OnrampController.getStatus);

// ==========================================
// 📊 DASHBOARD B2B (Métricas de Lojas)
// ==========================================
router.get('/dashboard/pipeline', authenticateUser, requireRole('merchant', 'admin'), DashboardController.getPipeline);

// ==========================================
// 🛠️ DEVELOPER HUB & SAAS (Acesso Apenas B2B)
// ==========================================
router.get('/api-keys', authenticateUser, requireRole('merchant', 'admin'), ApiKeyController.listKeys);
router.post('/api-keys', authenticateUser, requireRole('merchant', 'admin'), ApiKeyController.createKey);
router.delete('/api-keys/:id', authenticateUser, requireRole('merchant', 'admin'), ApiKeyController.revokeKey);

router.get('/payment-links', authenticateUser, requireRole('merchant', 'admin'), PaymentLinkController.list);
router.post('/payment-links', authenticateUser, requireRole('merchant', 'admin'), PaymentLinkController.create);

router.get('/stores', authenticateUser, requireRole('merchant', 'admin'), StoreController.listStores);
router.post('/stores', authenticateUser, requireRole('merchant', 'admin'), StoreController.createStore);
router.patch('/stores/:id', authenticateUser, requireRole('merchant', 'admin'), StoreController.updateStore);

router.get('/settings/gateways', authenticateUser, requireRole('merchant', 'admin'), GatewayController.listGateways);
router.post('/settings/gateways', authenticateUser, requireRole('merchant', 'admin'), GatewayController.createGateway);

// ==========================================
// 👮 BACKOFFICE / ADMIN
// ==========================================
router.get('/admin/users', authenticateUser, requireRole('admin'), AdminController.listUsers);
router.post('/admin/users/:id/force-password', authenticateUser, requireRole('admin'), AdminController.forcePasswordReset);
router.get('/admin/payouts/pending', authenticateUser, requireRole('admin'), AdminController.listAllPendingPayouts);
router.post('/admin/payouts/:id/approve', authenticateUser, requireRole('admin'), AdminController.approvePayout);

// Gestão de Tickets (Onboarding de Lojistas)
router.get('/admin/tickets/pending', authenticateUser, requireRole('admin'), ActionTicketController.listPendingTickets);
router.patch('/admin/tickets/:id/resolve', authenticateUser, requireRole('admin'), ActionTicketController.resolveTicket);

// ==========================================
// 🌍 WEBHOOKS (Públicos / Sem Auth)
// ==========================================
router.post('/webhooks/supabase-sync', WebhookController.supabaseSync);
router.post('/webhooks/mistic', WebhookController.misticWebhook);
router.post('/webhooks/nowpayments', WebhookController.nowpaymentsIpn);
router.post('/webhooks/sumup', WebhookController.sumupWebhook);

// Webhooks Onramp
router.post('/webhooks/onramp-money', WebhookController.onrampMoneyWebhook);
router.post('/webhooks/guardarian', WebhookController.guardarianWebhook);

// Viva Wallet
router.get('/webhooks/viva', VivaWebhookController.verifyOrigin);
router.post('/webhooks/viva', VivaWebhookController.handleEvent);

export default router;
