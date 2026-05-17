/** Notion row의 items JSON과 subtotal/vat/total Number 필드를 stdout으로 dump.
 *  사용: $env:ROW_ID="..."; node --env-file=.env.local scripts/inspect-row.mjs
 *  토큰은 절대 출력하지 않음 — 진단 목적의 일반 필드만. */
import { Client as NotionClient } from "@notionhq/client";

const auth = process.env.NOTION_TOKEN;
const rowId = process.env.ROW_ID;

if (!auth || !rowId) {
  console.error("NOTION_TOKEN and ROW_ID required");
  process.exit(2);
}

const notion = new NotionClient({ auth });

try {
  const page = await notion.pages.retrieve({ page_id: rowId });
  const props = page.properties ?? {};

  function rt(p) {
    const arr = p?.rich_text;
    return (
      arr?.map((x) => x.plain_text ?? x.text?.content ?? "").join("") ?? ""
    );
  }
  function title(p) {
    return (
      p?.title?.map((x) => x.plain_text ?? x.text?.content ?? "").join("") ?? ""
    );
  }
  function num(p) {
    return p?.number ?? null;
  }
  function date(p) {
    return p?.date?.start ?? "";
  }
  function sel(p) {
    return p?.select?.name ?? "";
  }

  const rawItems = rt(props.items);
  let parsedItems;
  try {
    parsedItems = JSON.parse(rawItems);
  } catch {
    parsedItems = "<parse error>";
  }

  let computedSubtotal = null;
  if (Array.isArray(parsedItems)) {
    computedSubtotal = parsedItems.reduce(
      (acc, it) => acc + (it.qty ?? 0) * (it.unit_price ?? 0),
      0,
    );
  }

  console.log(
    JSON.stringify(
      {
        invoice_no: title(props.invoice_no),
        client_name: rt(props.client_name),
        issued_at: date(props.issued_at),
        expires_at: date(props.expires_at),
        status: sel(props.status),
        items_parsed: parsedItems,
        items_computed_subtotal: computedSubtotal,
        stored_subtotal: num(props.subtotal),
        stored_vat: num(props.vat),
        stored_total: num(props.total),
        last_edited_time: page.last_edited_time,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("FATAL:", e.code || e.name, e.message);
  process.exit(1);
}
