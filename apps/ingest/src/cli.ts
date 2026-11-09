// CLI ingestion (dijalankan di laptop, ADR-0005): pnpm ingest <id-sumber>
// Contoh: pnpm ingest uu-13-2003   → ambil, ekstrak, parse, dan simpan ke Postgres (DATABASE_URL).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrasi, sambung } from "@tahuhak/db";
import { ingest, type SumberMeta } from "./ingest.ts";

const id = process.argv[2];
if (!id) {
  console.error("Pakai: pnpm ingest <id-sumber>   (lihat apps/ingest/sumber/*.json)");
  process.exit(1);
}
const meta: SumberMeta = JSON.parse(readFileSync(fileURLToPath(new URL(`../sumber/${id}.json`, import.meta.url)), "utf8"));
const dirData = fileURLToPath(new URL("../../../data", import.meta.url));

const { db, tutup } = sambung();
try {
  await migrasi(db);
  const r = await ingest(meta, { db, dirData });
  console.log(`${meta.jenis} ${meta.nomor}/${meta.tahun}: ${r.pasal} Pasal, ${r.penjelasan} Penjelasan tertaut, ${r.tinjauan.length} perlu tinjauan`);
  for (const t of r.tinjauan) console.log(`  perlu tinjauan: ${t}`);
} finally {
  await tutup();
}
