export type InvoiceStatus = "draft" | "sent" | "viewed";

export interface InvoiceItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  clientName: string;
  issuedAt: string;
  expiresAt: string;
  items: InvoiceItem[];
  subtotal: number;
  vat: number;
  total: number;
  memo: string | null;
  accessToken: string;
  status: InvoiceStatus;
}

/** items rich_text JSON 파싱 실패 시 throw. 호출자는 name === 'InvoiceParseError'로 분기. */
export class InvoiceParseError extends Error {
  readonly invoiceId: string;
  constructor(invoiceId: string, cause?: unknown) {
    super(`failed to parse invoice items: ${invoiceId}`);
    this.name = "InvoiceParseError";
    this.invoiceId = invoiceId;
    if (cause !== undefined) this.cause = cause;
  }
}

/** 관리자 목록용 경량 Invoice — items/memo/accessToken 제외 (필요할 때 getInvoiceById로 단건 조회). */
export interface InvoiceListItem {
  id: string;
  invoiceNo: string;
  clientName: string;
  issuedAt: string;
  expiresAt: string;
  total: number;
  status: InvoiceStatus;
}

export type ExpiredFilter = "all" | "active" | "expired";

export interface InvoiceListFilter {
  q?: string;
  status?: InvoiceStatus[];
  expired?: ExpiredFilter;
}

export type SortKey = "issuedAt" | "expiresAt" | "total";
export type SortDirection = "asc" | "desc";

export interface InvoiceListSort {
  by: SortKey;
  direction: SortDirection;
}

export interface InvoiceListResult {
  items: InvoiceListItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface InvoiceStats {
  total: number;
  expiringSoon: number;
  unviewed: number;
}
