import cron from 'node-cron';
import { SettlementService } from '../services/settlement.service';

export function startCronJobs() {
  console.log('⏳ Cron Jobs de Tesouraria Iniciados...');
  cron.schedule('0 0 * * *', async () => { await SettlementService.closeDailyIncoming(); }, { timezone: "America/Sao_Paulo" });
  cron.schedule('0 * * * *', async () => { await SettlementService.clearMatureFunds(); });
}
