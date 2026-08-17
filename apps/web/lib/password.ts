import { compare, hash } from "bcryptjs";

export const PASSWORD_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, PASSWORD_ROUNDS);
}

export async function verifyPassword(plain: string, hashValue: string): Promise<boolean> {
  return compare(plain, hashValue);
}