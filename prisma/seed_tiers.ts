import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 A plantar os Tiers na Base de Dados...');
  
  const tiers = [
    { name: 'NEW', feeInEur: 0.25, feeInBrl: 0.15, feeSwap: 0.05, volLimit: 5000, defaultBrlProv: 'MISTIC', defaultEurProv: 'STRIPE_001_UK' },
    { name: 'C', feeInEur: 0.25, feeInBrl: 0.15, feeSwap: 0.05, volLimit: 10000, defaultBrlProv: 'MISTIC', defaultEurProv: 'STRIPE_001_UK' },
    { name: 'B', feeInEur: 0.20, feeInBrl: 0.15, feeSwap: 0.05, volLimit: 50000, defaultBrlProv: 'MISTIC', defaultEurProv: 'SUMUP_001_PT' },
    { name: 'A', feeInEur: 0.15, feeInBrl: 0.10, feeSwap: 0.03, volLimit: 100000, defaultBrlProv: 'PIXMATRIZ', defaultEurProv: 'STRIPE_002_PT' },
    { name: 'AAA', feeInEur: 0.10, feeInBrl: 0.05, feeSwap: 0.02, volLimit: 999999, defaultBrlProv: 'PIXMATRIZ', defaultEurProv: 'SUMUP_001_PT' }
  ];

  for (const t of tiers) {
    await prisma.tierConfig.upsert({
      where: { name: t.name },
      update: t,
      create: t,
    });
  }

  console.log('✅ Tiers criados com sucesso!');
}
main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect());
