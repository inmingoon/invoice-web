import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function InvoiceListSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>견적서 번호</TableHead>
          <TableHead>클라이언트</TableHead>
          <TableHead>발행일</TableHead>
          <TableHead>만료일</TableHead>
          <TableHead className="text-right">총액</TableHead>
          <TableHead className="text-right">상태</TableHead>
          <TableHead className="text-right">동작</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-40" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="ml-auto h-4 w-24" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="ml-auto h-5 w-16" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="ml-auto h-8 w-44" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
