import { PaymentProvider } from '../interfaces/payment-provider.interface';

export class NowPaymentsProvider implements PaymentProvider {
  private apiKey: string;
  private email?: string;
  private password?: string;
  private baseUrl = 'https://api.nowpayments.io/v1';

  constructor(apiKey: string, email?: string, password?: string) {
    this.apiKey = apiKey;
    this.email = email || process.env.NOWPAYMENTS_EMAIL;
    this.password = password || process.env.NOWPAYMENTS_PASSWORD;
  }

  private getHeaders(extraToken?: string) {
    const headers: any = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json'
    };
    if (extraToken) headers['Authorization'] = `Bearer ${extraToken}`;
    return headers;
  }

  // ==========================================
  // 1. CASH-IN (Gerar Endereço de Pagamento)
  // ==========================================
  async createPayment(amount: number, currency: string, reference: string, metadata?: any) {
    // Assumimos que queremos receber sempre em USDT (TRC20 ou BEP20)
    const payCurrency = metadata?.network === 'BEP20' ? 'usdtbsc' : 'usdttrc20';

    const payload = {
      price_amount: amount,
      price_currency: currency.toLowerCase(), // Ex: 'usd', 'eur', 'brl'
      pay_currency: payCurrency,
      ipn_callback_url: 'https://api-core.nexflowx.tech/api/v1/webhooks/nowpayments',
      order_id: reference,
      order_description: `NeXFlowX Deposit - ${reference}`
    };

    const response = await fetch(`${this.baseUrl}/payment`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[NOWPAYMENTS IN ERROR]", err);
      throw new Error('Erro ao gerar pagamento Crypto na NowPayments');
    }

    const data = await response.json();
    return {
      txid: data.payment_id,
      qr_code: data.pay_address, // O cliente copia isto
      qr_code_base64: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${data.pay_address}`,
      expires_in: 3600 // Expira em 1 hora
    };
  }

  // ==========================================
  // 2. AUTENTICAÇÃO (Para Payouts)
  // ==========================================
  private async getAuthToken(): Promise<string> {
    if (!this.email || !this.password) throw new Error("Credenciais de conta ausentes para Payout");

    const response = await fetch(`${this.baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password })
    });

    if (!response.ok) throw new Error('Falha ao autenticar na NowPayments (Verifique Email/Password)');
    const data = await response.json();
    return data.token;
  }

  // ==========================================
  // 3. CASH-OUT (Saque Automático)
  // ==========================================
  async createPayout(amount: number, currency: string, destinationAddress: string) {
    const token = await this.getAuthToken();
    const payoutCurrency = currency.toLowerCase() === 'usdt' ? 'usdttrc20' : currency.toLowerCase();

    const payload = {
      ipn_callback_url: 'https://api-core.nexflowx.tech/api/v1/webhooks/nowpayments',
      withdrawals: [
        {
          address: destinationAddress,
          currency: payoutCurrency,
          amount: amount,
          ipn_callback_url: 'https://api-core.nexflowx.tech/api/v1/webhooks/nowpayments'
        }
      ]
    };

    const response = await fetch(`${this.baseUrl}/payout`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[NOWPAYMENTS OUT ERROR]", err);
      throw new Error('Erro ao disparar saque na NowPayments');
    }

    const data = await response.json();
    return {
      batch_id: data.id,
      status: 'PROCESSING'
    };
  }

  // A NowPayments usa o IPN para avisar do estado, por isso a verificação síncrona não é tão usada.
  async verifyPayment(transactionId: string) {
    return false; // Delegado para o WebhookController
  }
}
