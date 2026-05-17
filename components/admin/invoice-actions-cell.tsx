import { CopyButton } from "@/components/admin/copy-button";
import { RegenerateButton } from "@/components/admin/regenerate-button";
import { ShareButton } from "@/components/admin/share-button";
import { buildInvoiceLink } from "@/lib/utils/link-generator";
import type { InvoiceListItem } from "@/types/invoice";

export function InvoiceActionsCell({ invoice }: { invoice: InvoiceListItem }) {
  const url = buildInvoiceLink({
    id: invoice.id,
    accessToken: invoice.accessToken,
  });
  return (
    <div className="flex items-center justify-end gap-1">
      <CopyButton value={url} />
      <ShareButton
        url={url}
        invoiceNo={invoice.invoiceNo}
        clientName={invoice.clientName}
      />
      <RegenerateButton invoiceId={invoice.id} />
    </div>
  );
}
