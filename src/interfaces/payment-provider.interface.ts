export interface PaymentProvider {
  createPayment(amount: number, currency: string, reference: string, metadata?: any): Promise<any>;
  createPixPayment?(amount: number, reference: string, customer: any): Promise<any>;
  verifyPayment(transactionId: string): Promise<boolean>;
}
