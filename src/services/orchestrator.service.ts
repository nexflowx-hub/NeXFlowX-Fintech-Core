import { PaymentProvider } from '../interfaces/payment-provider.interface';

// Mocks provisórios para garantir a compilação.
// Numa Fase 2, estes vão ler as chaves dinâmicas da base de dados.
class MockPixProvider implements PaymentProvider {
  async createPayment(amount: number, currency: string, reference: string, metadata?: any) { return {}; }
  async createPixPayment(amount: number, reference: string, customer: any) {
    return {
      qr_code: "00020101021126580014br.gov.bcb.pix0136nexflowx-dev-mock-12345204000053039865802BR5915NEXFLOWX_TEST6009SAO_PAULO62140510" + reference + "6304ABCD",
      qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==",
      expires_in: 3600
    };
  }
  async verifyPayment(transactionId: string) { return true; }
}

export class PaymentOrchestrator {
  private static providers: Record<string, PaymentProvider> = {
    mistic: new MockPixProvider(),
    mercadopago: new MockPixProvider()
  };

  static getProviderForBRL(name: string): PaymentProvider {
    const provider = this.providers[name.toLowerCase()];
    if (!provider) throw new Error(`Provedor PIX ${name} não suportado pelo Orquestrador BRL.`);
    return provider;
  }
}
