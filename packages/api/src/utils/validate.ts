import type { NextFunction, Request, Response } from "express";
import { z, ZodSchema } from "zod";

/** Parse req.body against a schema; ZodError → 422 via errorHandler. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}

// ─── Reusable field rules ───
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password needs an uppercase letter")
  .regex(/[0-9]/, "Password needs a number");

const username = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, "Alphanumeric and underscore only");

// ─── Auth schemas ───
export const registerSchema = z.object({
  email: z.string().email(),
  password,
  displayName: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

// ─── User schemas ───
export const updateMeSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  username: username.optional(),
  bio: z.string().max(1000).optional(),
  genrePreferences: z.array(z.string()).max(20).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
