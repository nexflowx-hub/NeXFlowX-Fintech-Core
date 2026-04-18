import Stripe from 'stripe';

export class StripeProvider {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
  }

  async createPaymentLink(amount: number, currency: string, description: string, txId: string, uiMode: string = 'hosted') {
    const isEmbedded = uiMode === 'embedded';
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ 
        price_data: { 
          currency: currency.toLowerCase(), 
          product_data: { name: description || `NeXFlowX #${txId.substring(0, 8)}` }, 
          unit_amount: Math.round(amount * 100) 
        }, 
        quantity: 1 
      }],
      ui_mode: isEmbedded ? 'embedded' : 'hosted',
      success_url: isEmbedded ? undefined : `https://api.nexflowx.tech/success?tx=${txId}`,
      cancel_url: isEmbedded ? undefined : `https://api.nexflowx.tech/cancel`,
      return_url: isEmbedded ? `https://api.nexflowx.tech/success?tx=${txId}` : undefined,
      metadata: { transaction_id: txId }
    } as any);

    return { 
      checkout_url: session.url, 
      client_secret: session.client_secret 
    };
  }
}
