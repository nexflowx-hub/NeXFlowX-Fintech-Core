import axios from 'axios';

export class VivaProvider {
  private apiUrl: string;
  private accountsUrl: string;
  private clientId: string;
  private clientSecret: string;
  private sourceCode: string;

  constructor() {
    const mode = (process.env.VIVA_MODE || 'demo').toLowerCase();
    this.apiUrl = mode === 'live' ? 'https://api.vivapayments.com' : 'https://demo-api.vivapayments.com';
    this.accountsUrl = mode === 'live' ? 'https://accounts.vivapayments.com' : 'https://demo-accounts.vivapayments.com';
    this.clientId = process.env.VIVA_CLIENT_ID || '';
    this.clientSecret = process.env.VIVA_CLIENT_SECRET || '';
    this.sourceCode = process.env.VIVA_SOURCE_CODE || '';
  }

  private async getAuthToken() {
    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await axios.post(
        `${this.accountsUrl}/connect/token`,
        'grant_type=client_credentials',
        { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      return response.data.access_token;
    } catch (error: any) {
      const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Falha na Autenticação Viva: ${details}`);
    }
  }

  async createPaymentLink(amount: number, currency: string, description: string, txId: string) {
    const token = await this.getAuthToken();
    try {
      const payload: any = {
        amount: Math.round(amount * 100), // Em cêntimos
        customerTrns: description || `NeXFlowX #${txId.substring(0,8)}`,
        merchantTrns: txId,
        paymentTimeout: 3600
      };

      // Injeta o Source Code se estiver no .env (Muitas vezes obrigatório)
      if (this.sourceCode) {
        payload.sourceCode = this.sourceCode;
      }

      const response = await axios.post(
        `${this.apiUrl}/checkout/v2/orders`,
        payload,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const mode = (process.env.VIVA_MODE || 'demo').toLowerCase();
      const checkoutBase = mode === 'live' ? 'https://www.vivapayments.com/web/checkout' : 'https://demo.vivapayments.com/web/checkout';
      
      return { checkout_url: `${checkoutBase}?ref=${response.data.orderCode}` };
    } catch (error: any) {
      // Aqui está o "Raio-X": Extrai o erro exato devolvido pela API da Viva
      const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`Viva Rejeitou o Pedido: ${details}`);
    }
  }
}
