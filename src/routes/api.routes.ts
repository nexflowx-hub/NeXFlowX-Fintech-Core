import { VivaWebhookController } from '../controllers/viva.controller';
import { requireRole } from '../middleware/role.middleware';
import { WalletController } from '../controllers/wallet.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { UserController } from '../controllers/user.controller';
import { ApiKeyController } from '../controllers/apikey.controller';
import { StoreController } from '../controllers/store.controller';
import { GatewayController } from '../controllers/gateway.controller';
import { WebhookController } from '../controllers/webhook.controller';
import { PaymentLinkController } from '../controllers/payment-link.controller';
import { AdminController } from '../controllers/admin.controller';
import { DepositController } from '../controllers/deposit.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { swapSchema, payoutSchema } from '../validators/transaction.validator';

const router = Router();

// Rotas de Mutação Financeira
router.post('/swap', authenticateUser, validate(swapSchema), TransactionController.swap);
router.post('/payout', authenticateUser, validate(payoutSchema), TransactionController.payout);

// NOVO: Rota de Depósito Modular (A porta de entrada)
router.post('/deposits', authenticateUser, DepositController.requestDeposit);

// Rotas de Utilizador & Definições
router.get('/users/me', authenticateUser, UserController.getMe);
router.patch('/users/me', authenticateUser, UserController.updateMe);
router.post('/users/me/password', authenticateUser, UserController.updatePassword);

// Rotas do Developer Hub (API Keys)
router.get('/api-keys', authenticateUser, ApiKeyController.listKeys);
router.post('/api-keys', authenticateUser, ApiKeyController.createKey);
router.delete('/api-keys/:id', authenticateUser, ApiKeyController.revokeKey);

// Rotas de Leitura (Dashboard)



// Rotas de Backoffice / Operador
router.get('/admin/users', authenticateUser, requireRole('admin'), AdminController.listUsers);
router.post('/admin/users/:id/force-password', authenticateUser, requireRole('admin'), AdminController.forcePasswordReset);

// Rotas Merchant (SaaS)
router.get('/payment-links', authenticateUser, PaymentLinkController.list);
router.post('/payment-links', authenticateUser, PaymentLinkController.create);
router.get('/stores', authenticateUser, StoreController.listStores);
router.post('/stores', authenticateUser, StoreController.createStore);
router.patch('/stores/:id', authenticateUser, StoreController.updateStore);

router.get('/settings/gateways', authenticateUser, GatewayController.listGateways);
router.post('/settings/gateways', authenticateUser, GatewayController.createGateway);

// Webhooks (Públicos)
router.post('/webhooks/mistic', WebhookController.misticWebhook);
router.post('/webhooks/nowpayments', WebhookController.nowpaymentsIpn);
router.post('/webhooks/sumup', WebhookController.sumupWebhook);


// ==========================================
// 🏦 ROTAS DE TESOURARIA (V2)
// ==========================================




// ==========================================
// 🏦 ROTAS DE TESOURARIA (V2)
// ==========================================
router.get('/wallet', authenticateUser, WalletController.getMyWallet);
router.get('/wallets', authenticateUser, WalletController.listMyWallets);


router.get('/admin/payouts/pending', authenticateUser, requireRole('admin'), AdminController.listAllPendingPayouts);
router.post('/admin/payouts/:id/approve', authenticateUser, requireRole('admin'), AdminController.approvePayout);
router.get('/pipeline', authenticateUser, DashboardController.getPipeline);
router.get('/transactions', authenticateUser, DashboardController.getTransactions);


// ==========================================
// 🔵 VIVA WALLET WEBHOOKS
// ==========================================
router.get('/webhooks/viva', VivaWebhookController.verifyOrigin);
router.post('/webhooks/viva', VivaWebhookController.handleEvent);

export default router;
