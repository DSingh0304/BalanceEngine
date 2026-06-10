import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must have minimum of 8 characters")
    .max(72, "Passwords must have maximum of 72 characters"),
});

export const loginSchema = z.object({
  email: z.email("Invalid email format"),
  password: z.string().min(8, "Password must have 8 characters"),
});

export const createAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(100),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  currency: z.string().length(3).default("INR"),
});

export const createTransactionSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
  entries: z
    .array(
      z.object({
        accountId: z.uuid("Invalid account ID"),
        type: z.enum(["DEBIT", "CREDIT"]),
        amount: z
          .number()
          .int("Amount must be an integer (in paise)")
          .positive("Amount must be positive"),
      }),
    )
    .min(2, "A transaction requires at least two entries"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const reverseTransactionSchema = z.object({
  reason: z.string().min(1, 'Reason for reversal is required').max(500)
})

