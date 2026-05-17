/**
 * 견적서 토큰 링크 생성기. NEXT_PUBLIC_SITE_URL이 있으면 absolute URL, 없으면 path만.
 *
 * 토큰 자체는 URL-safe base64이므로 추가 인코딩 불필요하지만 안전하게 encodeURIComponent.
 * 호출지: admin/invoices 목록의 CopyButton, ShareButton.
 */
export function buildInvoiceLink(input: {
  id: string;
  accessToken: string;
}): string {
  if (!input.id) throw new Error("invoice id missing");
  if (!input.accessToken) throw new Error("accessToken missing");
  const path = `/invoice/${encodeURIComponent(input.id)}?token=${encodeURIComponent(input.accessToken)}`;
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}
