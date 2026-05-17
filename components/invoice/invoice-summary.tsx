import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Invoice } from "@/types/invoice";

const statusLabel: Record<
  Invoice["status"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { label: "초안", variant: "secondary" },
  sent: { label: "발송됨", variant: "default" },
  viewed: { label: "열람됨", variant: "outline" },
};

export function InvoiceSummary({ invoice }: { invoice: Invoice }) {
  const status = statusLabel[invoice.status];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{invoice.invoiceNo}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm leading-relaxed">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">클라이언트</span>
          <span className="font-medium">{invoice.clientName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">발행일</span>
          <span>{invoice.issuedAt}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">유효기간</span>
          <span>{invoice.expiresAt}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">상태</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
