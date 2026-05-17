"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { updateInvoiceToken } from "@/lib/notion";

export type RegenerateResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "rate_limited" | "failed" };

/**
 * 견적서 access_token 재발급. 호출 시 세션 재검증 → 32B base64url 토큰 생성 → Notion update.
 *
 * Phase D에서 rate-limit이 추가될 자리 (현재는 트로틀 없음 — 세션 가드만).
 * revalidatePath로 /admin/invoices와 /invoice/[id] 모두 SSR 재실행 강제.
 */
export async function regenerateTokenAction(
  invoiceId: string,
): Promise<RegenerateResult> {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  if (!(await verifySession(session))) {
    logger.warn({ event: "admin.unauth", action: "regenerate_token" });
    return { ok: false, reason: "unauthorized" };
  }
  if (!invoiceId) {
    return { ok: false, reason: "failed" };
  }
  const newToken = randomBytes(32).toString("base64url");
  try {
    await updateInvoiceToken(invoiceId, newToken);
    logger.info({ event: "token.regenerated", invoiceId });
    revalidatePath("/admin/invoices");
    revalidatePath(`/invoice/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    logger.error({
      event: "token.regenerate.fail",
      invoiceId,
      message: e instanceof Error ? e.message : "unknown",
    });
    return { ok: false, reason: "failed" };
  }
}
