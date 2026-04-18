import { PaymentProvider } from '../interfaces/payment-provider.interface';

export class MisticProvider implements PaymentProvider {
  private ci: string;
  private cs: string;
  private baseUrl = 'https://api.misticpay.com/api';

  constructor(ci: string, cs: string) {
    this.ci = ci;
    this.cs = cs;
  }

  private getHeaders() {
    return {
      'ci': this.ci,
      'cs': this.cs,
      'Content-Type': 'application/json'
    };
  }

  async createPayment(amount: number, currency: string, reference: string, metadata?: any) {
    if (currency.toUpperCase() === 'BRL') return this.createPixPayment(amount, reference, metadata);
    throw new Error('Mistic Provider só suporta BRL (PIX) para Cash-in');
  }

  async createPixPayment(amount: number, reference: string, customer: any) {
    const payload = {
      amount: Number(amount.toFixed(2)),
      payerName: customer?.name || 'Cliente NeXFlowX',
      payerDocument: customer?.document?.replace(/\D/g, '') || '00000000000',
      transactionId: reference,
      description: `NeXFlowX Depósito - ${reference}`
    };

    const response = await fetch(`${this.baseUrl}/transactions/create`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[MISTIC ERROR]", err);
      throw new Error('Erro ao gerar PIX na MisticPay');
    }

    const json = await response.json();
    
    return {
      txid: json.data.transactionId,
      qr_code: json.data.copyPaste,
      qr_code_base64: json.data.qrCodeBase64,
      expires_in: 3600 
    };
  }

  async verifyPayment(transactionId: string) {
    const response = await fetch(`${this.baseUrl}/transactions/check`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ transactionId })
    });
    
    if (!response.ok) return false;
    const json = await response.json();
    return json.transaction?.transactionState === 'COMPLETO';
  }
}
