import { z } from "zod";

const EMAIL = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(200);

export const registerSchema = z
  .object({
    email: EMAIL,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(200, "Password is too long"),
    name: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: EMAIL,
    password: z.string().min(1, "Password is required").max(200),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function parseJsonBody<T>(raw: unknown, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid request body" };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? issue.message : "Invalid input" };
  }
  return { ok: true, data: parsed.data };
}