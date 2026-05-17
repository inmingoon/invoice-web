/** Invoices DB의 첫 data source의 property 이름·타입을 stdout으로 dump.
 *  Notion API 2025-09부터 schema는 data_source에 위치. Relation/Rollup/Formula 구성도 표시. */
import { Client as NotionClient } from "@notionhq/client";

const auth = process.env.NOTION_TOKEN;
// argv > env (PowerShell set이 --env-file에 덮이는 문제 회피)
const dbId = process.argv[2] || process.env.NOTION_DATABASE_ID;
const dsIdEnv = process.env.NOTION_DATA_SOURCE_ID;
if (!auth || (!dbId && !dsIdEnv)) {
  console.error(
    "NOTION_TOKEN and (db id via argv or NOTION_DATABASE_ID) required",
  );
  process.exit(2);
}

const notion = new NotionClient({ auth });

try {
  let dsId = dsIdEnv;
  if (!dsId) {
    const db = await notion.databases.retrieve({ database_id: dbId });
    dsId = db.data_sources?.[0]?.id;
    if (!dsId) {
      console.error("DB has no data sources");
      process.exit(1);
    }
  }

  const ds = await notion.dataSources.retrieve({ data_source_id: dsId });
  const props = ds.properties ?? {};
  const out = Object.entries(props).map(([name, p]) => {
    const base = { name, type: p.type };
    if (p.type === "relation") {
      base.relation = {
        database_id: p.relation?.database_id,
        type: p.relation?.type,
      };
    } else if (p.type === "rollup") {
      base.rollup = {
        relation_property_name: p.rollup?.relation_property_name,
        rollup_property_name: p.rollup?.rollup_property_name,
        function: p.rollup?.function,
      };
    } else if (p.type === "formula") {
      base.formula = { expression: p.formula?.expression };
    }
    return base;
  });
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error("FATAL:", e.code || e.name, e.message);
  process.exit(1);
}
