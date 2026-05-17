/** 환경변수 LOOKUP_TOKEN과 일치하는 access_token을 가진 row의 page id를 stdout으로 출력.
 *  사용: $env:LOOKUP_TOKEN="..."; node scripts/find-row-by-token.mjs
 *  stdout: row page id (UUID) 또는 빈 줄(미발견). 토큰 값은 어디에도 로깅하지 않음. */
import { Client as NotionClient } from "@notionhq/client";

const auth = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_DATABASE_ID;
const dsIdEnv = process.env.NOTION_DATA_SOURCE_ID;
const target = process.env.LOOKUP_TOKEN;

if (!auth || !target) {
  console.error("NOTION_TOKEN and LOOKUP_TOKEN required");
  process.exit(2);
}

const notion = new NotionClient({ auth });

async function getDataSourceId() {
  if (dsIdEnv) return dsIdEnv;
  if (!dbId)
    throw new Error("NOTION_DATABASE_ID or NOTION_DATA_SOURCE_ID required");
  const db = await notion.databases.retrieve({ database_id: dbId });
  const ds = db.data_sources?.[0]?.id;
  if (!ds) throw new Error("DB has no data sources");
  return ds;
}

try {
  const dsId = await getDataSourceId();
  let cursor;
  for (let i = 0; i < 5; i++) {
    const res = await notion.dataSources.query({
      data_source_id: dsId,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const row of res.results) {
      const rt = row.properties?.access_token?.rich_text;
      const stored = rt?.[0]?.plain_text ?? rt?.[0]?.text?.content ?? "";
      if (stored === target) {
        process.stdout.write(row.id + "\n");
        process.exit(0);
      }
    }
    if (!res.has_more) break;
    cursor = res.next_cursor ?? undefined;
  }
  console.error("no row matched LOOKUP_TOKEN");
  process.exit(1);
} catch (e) {
  console.error("FATAL:", e.code || e.name, e.message);
  process.exit(1);
}
