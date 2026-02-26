// lib/auth.ts
import { cookies } from "next/headers";

export const AUTH_COOKIE = "pt_auth";

export async function isAuthed() {
  const cookieStore = await cookies(); // 🔥 要 await
  const v = cookieStore.get(AUTH_COOKIE)?.value;
  return v === process.env.ADMIN_PASSWORD;
}