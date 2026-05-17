/** INV-2025-001 row의 items relation에 들어있는 page id들과,
 *  그 첫 번째 page의 properties를 dump해서 Items DB가 정말 별도인지 확인. */
import { Client as NotionClient } from "@notionhq/client";

const auth = process.env.NOTION_TOKEN;
const rowId = "360c3a76-f5ed-80b5-99cd-c3348ecf93a0";
if (!auth) {
  console.error("NOTION_TOKEN required");
  process.exit(2);
}

const notion = new NotionClient({ auth });

try {
  const invoice = await notion.pages.retrieve({ page_id: rowId });
  const itemRel = invoice.properties?.items?.relation ?? [];
  console.log("invoice items relation count:", itemRel.length);
  console.log(
    "invoice items relation ids:",
    itemRel.map((r) => r.id),
  );

  if (itemRel.length === 0) {
    console.error("no related items");
    process.exit(0);
  }

  const firstItem = await notion.pages.retrieve({ page_id: itemRel[0].id });
  console.log(
    "\nfirst item page parent:",
    JSON.stringify(firstItem.parent, null, 2),
  );
  console.log("\nfirst item properties (name → type):");
  const out = Object.entries(firstItem.properties).map(([name, p]) => {
    const r = { name, type: p.type };
    if (p.type === "title") {
      r.value = p.title?.map((x) => x.plain_text).join("");
    } else if (p.type === "number") {
      r.value = p.number;
    } else if (p.type === "formula") {
      r.value = p.formula;
    } else if (p.type === "rich_text") {
      r.value = p.rich_text?.map((x) => x.plain_text).join("");
    } else if (p.type === "relation") {
      r.value = `relation(count=${p.relation?.length ?? 0})`;
    }
    return r;
  });
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error("FATAL:", e.code || e.name, e.message);
  process.exit(1);
}
