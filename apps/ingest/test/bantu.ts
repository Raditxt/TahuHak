// Alat bantu tes Seam A: fixture PDF (diunduh dari URL di metadata sumber, tidak di-commit),
// fetch tiruan yang melayani fixture itu, dan database tes yang dikosongkan.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrasi, sambung, type Db } from "@tahuhak/db";
import type { SumberMeta } from "../src/ingest.ts";

const AKAR = fileURLToPath(new URL("../../../", import.meta.url));
export const DIR_FIXTURE = `${AKAR}.cache/fixtures`;

export function muatSumber(id: string): SumberMeta {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../sumber/${id}.json`, import.meta.url)), "utf8"));
}

/** Unduh PDF fixture sekali dari URL di metadata sumber, lalu pakai cache-nya. */
export async function unduhFixture(meta: SumberMeta): Promise<Uint8Array> {
  const f = `${DIR_FIXTURE}/${meta.id}.pdf`;
  if (!existsSync(f)) {
    mkdirSync(DIR_FIXTURE, { recursive: true });
    const r = await fetch(meta.url);
    if (!r.ok) throw new Error(`Gagal mengunduh fixture ${meta.url}: ${r.status}`);
    writeFileSync(f, new Uint8Array(await r.arrayBuffer()));
  }
  return new Uint8Array(readFileSync(f));
}

/** fetch tiruan di batas HTTP: robots.txt mengizinkan, URL fixture dilayani dari memori. */
export function fetchTiruan(berkas: Record<string, Uint8Array>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    if (new URL(url).pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /Admin/\n");
    const isi = berkas[url];
    return isi ? new Response(new Blob([isi as Uint8Array<ArrayBuffer>]), { headers: { "content-type": "application/pdf" } }) : new Response("tidak ada", { status: 404 });
  }) as typeof fetch;
}

/** Tes memakai database terpisah (tahuhak_test) supaya truncate tidak menghapus hasil ingest pengembangan. */
const URL_TES = process.env.TEST_DATABASE_URL ?? "postgres://tahuhak:tahuhak@localhost:54329/tahuhak_test";

export async function dbTes(): Promise<{ db: Db; tutup: () => Promise<void> }> {
  const induk = sambung(URL_TES.replace(/\/[^/]+$/, "/postgres"));
  const nama = new URL(URL_TES).pathname.slice(1);
  const ada = await induk.db.execute(sql`select 1 from pg_database where datname = ${nama}`);
  if (!ada.length) await induk.db.execute(sql.raw(`create database "${nama}"`));
  await induk.tutup();
  const k = sambung(URL_TES);
  await migrasi(k.db);
  await k.db.execute(sql`truncate peraturan restart identity cascade`);
  return k;
}

export const DIR_DATA_TES = `${AKAR}.cache/data-tes`;
