import { createElement } from "react";

import { renderToBuffer } from "@react-pdf/renderer";

import { InvoicePdf } from "@/components/invoice/pdf/invoice-pdf";
import { loadVerified } from "@/lib/invoice/load-verified";
import { logger } from "@/lib/logger";
import { PDF_LIMIT, getClientIp, tryConsume } from "@/lib/rate-limit";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ip = await getClientIp();
  const gate = tryConsume(`pdf:${ip}`, PDF_LIMIT);
  if (!gate.ok) {
    logger.warn({
      event: "ratelimit.deny",
      scope: "pdf",
      ip,
      retryAfterMs: gate.retryAfterMs,
    });
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(gate.retryAfterMs / 1000)) },
    });
  }

  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token") ?? undefined;

  const invoice = await loadVerified(id, token);
  if (!invoice) return new Response(null, { status: 404 });

  const buffer = await renderToBuffer(
    createElement(InvoicePdf, { invoice }) as Parameters<
      typeof renderToBuffer
    >[0],
  );

  const encoded = encodeURIComponent(`${invoice.invoiceNo}.pdf`);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNo}.pdf"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}
