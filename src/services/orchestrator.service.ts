import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class OrchestratorService {
  static async resolveBestProvider(transactionId: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        payee: { include: { gateway_configs: true } },
        store: { include: { gateways: true } }
      }
    });

    if (!tx) throw new Error("Transação não encontrada.");

    // 1. Procura a GatewayConfig do Lojista (apenas para ver se ele ATIVOU o método/moeda)
    let config = tx.store?.gateways.find(c => c.is_active && c.provider_name === tx.payment_method);
    if (!config) config = tx.payee.gateway_configs.find(c => c.is_active && !c.store_id && c.provider_name === tx.payment_method);
    
    // NOTA: Se o lojista não ativou explicitamente, podemos optar por um Fallback Global ou bloquear.
    // Para PayFac puro, assumimos que se a transação foi criada, ele tem permissão de Tier.

    // 2. MODO PAYFAC EXCLUSIVO (A NeXFlowX é o Banco)
    let masterProvider;

    if (config?.master_provider_id) {
      // O Admin forçou este lojista a usar um MasterProvider específico (ex: Lojista de alto risco vai para ElitePay)
      masterProvider = await prisma.masterProvider.findUnique({ where: { id: config.master_provider_id } });
    } else {
      // SMART ROUTING: Procura o MasterProvider mais barato e com volume disponível para o método
      const availableProviders = await prisma.masterProvider.findMany({
        where: {
          isActive: true,
          healthStatus: 'optimal',
          supportedCurrencies: { has: tx.currency },
          supportedMethods: { has: tx.payment_method }
        },
        orderBy: [{ priorityScore: 'asc' }, { costPercentage: 'asc' }]
      });

      masterProvider = availableProviders.find(p => {
        if (!p.monthlyVolumeLimit) return true;
        return (Number(p.monthlyVolumeLimit) - Number(p.currentMonthVolume)) >= Number(tx.amount);
      });
    }

    if (!masterProvider) {
      throw new Error(`Orquestração falhou: Nenhuma Ponte Bancária NeXFlowX disponível para ${tx.payment_method} em ${tx.currency}.`);
    }

    const credentials = masterProvider.mode === 'live' ? masterProvider.credentials_live : masterProvider.credentials_test;

    return {
      mode: 'PAYFAC', // A NeXFlowX é sempre a detentora do processamento
      providerType: masterProvider.providerType,
      masterProviderId: masterProvider.id,
      credentials: credentials as any,
      apiKey: (credentials as any)?.sk || (credentials as any)?.api_key || '',
      tx
    };
  }
}
