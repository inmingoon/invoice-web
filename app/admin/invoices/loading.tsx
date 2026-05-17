import { InvoiceListSkeleton } from "@/components/admin/invoice-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </header>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-6 w-64" />
      </div>
      <InvoiceListSkeleton />
    </main>
  );
}
