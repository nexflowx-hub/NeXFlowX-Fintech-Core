import { z } from 'zod';

export const swapSchema = z.object({
  // Apenas coerce.number(), o ".positive()" já garante que não é zero nem vazio!
  amount: z.coerce.number().positive("Amount tem de ser maior que zero"),
  from_currency: z.string().min(3).max(5),
  to_currency: z.string().min(3).max(5),
});

export const payoutSchema = z.object({
  amount: z.coerce.number().positive("Amount tem de ser maior que zero"),
  currency: z.string().min(3).max(5),
  method: z.enum(["IBAN", "CRYPTO", "PIX", "SEPA", "BANK"]),
  destination: z.string().min(5),
});
