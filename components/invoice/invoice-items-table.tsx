import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvoiceItem } from "@/types/invoice";

const krw = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
});

export function InvoiceItemsTable({ items }: { items: InvoiceItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="p-3.5">항목</TableHead>
          <TableHead className="p-3.5 text-right">수량</TableHead>
          <TableHead className="p-3.5 text-right">단가</TableHead>
          <TableHead className="p-3.5 text-right">소계</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, i) => (
          <TableRow key={`${item.name}-${i}`}>
            <TableCell className="p-3.5">{item.name}</TableCell>
            <TableCell className="p-3.5 text-right">{item.qty}</TableCell>
            <TableCell className="p-3.5 text-right">
              {krw.format(item.unitPrice)}
            </TableCell>
            <TableCell className="p-3.5 text-right">
              {krw.format(item.qty * item.unitPrice)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
