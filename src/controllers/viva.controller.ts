import { Request, Response } from 'express';

export class VivaWebhookController {
  // A Regra 2: O Handshake (GET)
  static async verifyOrigin(req: Request, res: Response) {
    const key = process.env.VIVA_WEBHOOK_KEY;
    
    if (!key) {
      console.error("[VIVA] Chave de verificação ausente no .env");
      return res.status(500).json({ error: "Configuração Viva incompleta." });
    }

    // A Viva exige exatamente este objeto JSON
    return res.status(200).json({ Key: key });
  }

  // A receção dos pagamentos reais (POST)
  static async handleEvent(req: Request, res: Response) {
    try {
      const event = req.body;
      console.log("[VIVA WEBHOOK] Evento recebido:", event.EventTypeId);

      // EventTypeId 1799 = Transaction Payment Created
      if (event.EventTypeId === 1799) {
         const txDetails = event.EventData;
         console.log(`✅ Pagamento Viva Confirmado. Valor: ${txDetails.Amount}`);
         // Aqui entramos no teu SettlementService.commitTransaction()
      }

      // Responder 200 OK rapidamente para a Viva não tentar reenviar
      return res.status(200).send();
    } catch (e) {
      console.error("[VIVA WEBHOOK ERROR]", e);
      return res.status(500).send();
    }
  }
}