// Pengambil Sumber: HTTP biasa, jeda acak antar-request, mematuhi robots.txt.
// PDF asli disimpan ke disk dengan nama sha256-nya.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type BerkasDiambil = { url: string; isi: Uint8Array; sha256: string; path: string; diambilPada: Date };
export type OpsiAmbil = { fetch: typeof fetch; dirData: string; jedaMs: [number, number] };

const AGEN = "TahuHak-ingest/0.1 (+https://github.com/Raditxt/TahuHak)";
const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Aturan Disallow untuk "User-agent: *" (cukup untuk sumber yang kami pakai). */
export function dilarangRobots(robots: string, path: string): boolean {
  let berlaku = false;
  const larangan: string[] = [];
  for (const mentah of robots.split(/\r?\n/)) {
    const baris = mentah.replace(/#.*/, "").trim();
    const m = baris.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, kunci, nilai] = m as unknown as [string, string, string];
    if (/^user-agent$/i.test(kunci)) berlaku = nilai === "*";
    else if (berlaku && /^disallow$/i.test(kunci) && nilai) larangan.push(nilai);
  }
  return larangan.some((l) => path.startsWith(l));
}

export async function ambilPdf(url: string, o: OpsiAmbil): Promise<BerkasDiambil> {
  const u = new URL(url);
  const robots = await o.fetch(`${u.origin}/robots.txt`, { headers: { "user-agent": AGEN } });
  if (robots.ok && dilarangRobots(await robots.text(), decodeURIComponent(u.pathname))) {
    throw new Error(`robots.txt melarang ${url}`);
  }
  const [min, maks] = o.jedaMs;
  await tunggu(min + Math.random() * (maks - min));
  const r = await o.fetch(url, { headers: { "user-agent": AGEN } });
  if (!r.ok) throw new Error(`Gagal mengambil ${url}: HTTP ${r.status}`);
  const isi = new Uint8Array(await r.arrayBuffer());
  const sha256 = createHash("sha256").update(isi).digest("hex");
  const dir = resolve(o.dirData, "sumber");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${sha256}.pdf`);
  writeFileSync(path, isi);
  return { url, isi, sha256, path, diambilPada: new Date() };
}
