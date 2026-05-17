"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
} from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { LOGIN_LIMIT, getClientIp, tryConsume } from "@/lib/rate-limit";

export type LoginState = { error: string | null };

const THROTTLE_MS = 1000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 비밀번호 검증 후 세션 쿠키를 설정.
 * - IP당 분당 5회 rate-limit (Phase D)
 * - 실패 시 1초 sleep으로 무차별 대입 마찰 추가
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const ip = await getClientIp();
  const gate = tryConsume(`login:${ip}`, LOGIN_LIMIT);
  if (!gate.ok) {
    logger.warn({
      event: "ratelimit.deny",
      scope: "login",
      ip,
      retryAfterMs: gate.retryAfterMs,
    });
    return {
      error: `요청이 너무 잦습니다. ${Math.ceil(gate.retryAfterMs / 1000)}초 후 다시 시도해 주세요.`,
    };
  }
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { error: "비밀번호를 입력하세요." };
  }
  const expected = process.env.ADMIN_PASSWORD_HASH;
  if (!expected) {
    logger.error({ event: "auth.misconfig", reason: "missing_hash" });
    return { error: "관리자 환경 변수가 설정되지 않았습니다." };
  }
  const ok = await verifyPassword(password, expected);
  if (!ok) {
    await sleep(THROTTLE_MS);
    logger.warn({ event: "auth.fail", ip });
    return { error: "비밀번호가 일치하지 않습니다." };
  }
  const token = await signSession();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  logger.info({ event: "auth.success" });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  logger.info({ event: "auth.logout" });
  redirect("/admin-login");
}
