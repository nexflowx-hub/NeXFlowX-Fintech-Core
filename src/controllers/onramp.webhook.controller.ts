import { Request, Response } from 'express';
import crypto from 'crypto';
 // Assumindo o caminho do teu Prisma Client

export const handleOnrampWebhook = async (req: Request, res: Response) => {
  try {
    // 1. O Secret que a Onramp te vai dar no painel deles
    const ONRAMP_SECRET = process.env.ONRAMP_WEBHOOK_SECRET || 'teste_secret';
    
    // 2. Extrair a assinatura enviada pela Onramp nos headers (geralmente x-onramp-signature)
    const signature = req.headers['x-onramp-signature'] as string;
    
    // NOTA DE DEV: Na fase de testes, podemos ignorar a assinatura, mas em produção é OBRIGATÓRIO validar.
    console.log("🔔 [WEBHOOK ONRAMP] Recebido evento:", req.body.type);
    console.log("📦 Payload completo:", JSON.stringify(req.body, null, 2));

    const { type, data } = req.body;

    // 3. Processar o status da transação
    if (type === 'transaction_status_updated') {
      const { txId, status, fiatAmount, cryptoAmount, walletAddress } = data;

      if (status === 'completed' || status === 'success') {
        console.log(`✅ [ONRAMP] Transação ${txId} concluída! ${fiatAmount} BRL convertidos em ${cryptoAmount} Crypto para a wallet ${walletAddress}.`);
        
        // Aqui vais procurar a transação na Tabela Atlas e marcar como PAGA
        // await prisma.transaction.update({ ... status: 'PAID' })
      } 
      else if (status === 'failed') {
        console.log(`❌ [ONRAMP] Transação ${txId} falhou.`);
      }
    }

    // A Onramp precisa sempre de receber um 200 OK rápido, senão fica a reenviar o Webhook
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ Erro no Webhook da Onramp:', error);
    return res.status(500).json({ error: 'Internal Webhook Error' });
  }
};
