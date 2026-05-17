import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DownloadPdfButton } from "@/components/invoice/download-pdf-button";
import { ExpiredBadge } from "@/components/invoice/expired-badge";
import { InvoiceItemsTable } from "@/components/invoice/invoice-items-table";
import { InvoiceMemo } from "@/components/invoice/invoice-memo";
import { InvoiceSummary } from "@/components/invoice/invoice-summary";
import { InvoiceTotals } from "@/components/invoice/invoice-totals";
import { loadVerified } from "@/lib/invoice/load-verified";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function InvoicePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ id }, { token }] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  const invoice = await loadVerified(id, token);
  if (!invoice || !token) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <InvoiceSummary invoice={invoice} />
        </div>
        <ExpiredBadge expiresAt={invoice.expiresAt} />
      </div>
      <InvoiceItemsTable items={invoice.items} />
      <InvoiceTotals
        subtotal={invoice.subtotal}
        vat={invoice.vat}
        total={invoice.total}
      />
      <InvoiceMemo memo={invoice.memo} />
      <div className="flex justify-end">
        <DownloadPdfButton invoiceId={invoice.id} token={token} />
      </div>
    </main>
  );
}
