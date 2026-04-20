import { Request, Response } from 'express';
// import prisma from '../lib/prisma'; // Descomenta quando ligarmos à base de dados

export const getCheckoutConfig = async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    // Opcional: o frontend pode enviar a moeda selecionada para forçar o roteamento
    const { currency = 'BRL' } = req.query;

    console.log(`🔍 [CHECKOUT] A gerar configuração para o link: ${linkId} | Moeda: ${currency}`);

    // ==========================================
    // 🧠 LÓGICA DE SMART ROUTING (MOCK PARA JÁ)
    // Na versão final, isto procura na base de dados qual o provider ativo para este lojista e moeda.
    // ==========================================
    
    let configResponse = {};

    if (currency === 'BRL') {
      // Regras para Brasil -> Força Onramp e PIX
      configResponse = {
        linkId,
        currency: 'BRL',
        amount: 500, // Valor mockado
        activeProvider: 'ONRAMP',
        allowedMethods: ['pix'],
        kycRequirements: [
          { field: 'fullName', type: 'text', label: 'Nome Completo', required: true },
          { field: 'email', type: 'email', label: 'Email', required: true },
          { field: 'documentNumber', type: 'text', label: 'CPF', required: true, mask: '000.000.000-00' }
        ],
        theme: { primaryColor: '#00D09C' } // Verde Neon da Atlas
      };
    } else if (currency === 'EUR') {
      // Regras para Europa -> Força Stripe e SEPA/Cartões
      configResponse = {
        linkId,
        currency: 'EUR',
        amount: 85, // Valor mockado
        activeProvider: 'STRIPE',
        allowedMethods: ['card', 'sepa'],
        kycRequirements: [
          { field: 'fullName', type: 'text', label: 'Nome Completo', required: true },
          { field: 'email', type: 'email', label: 'Email', required: true }
          // Nota: Não pede CPF para Europa!
        ],
        theme: { primaryColor: '#00D09C' }
      };
    } else {
       return res.status(400).json({ error: 'Moeda não suportada para este checkout.' });
    }

    return res.status(200).json(configResponse);

  } catch (error) {
    console.error('❌ Erro a gerar config de checkout:', error);
    return res.status(500).json({ error: 'Erro interno ao gerar configuração.' });
  }
};
