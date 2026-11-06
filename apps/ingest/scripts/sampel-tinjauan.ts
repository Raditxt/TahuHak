// Halaman tinjauan sebelum snapshot dibekukan: teks Pasal/Penjelasan dari database berdampingan dengan halaman PDF resminya.
// Pakai: pnpm --filter @tahuhak/ingest exec tsx scripts/sampel-tinjauan.ts UU 13 2003 "1,156,193" 151
// Hasil: .cache/tinjauan/<jenis>-<nomor>-<tahun>.html (buka di browser; PDF ikut disalin ke folder yang sama).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { schema, sambung } from "@tahuhak/db";
import { ekstrak } from "../src/ekstrak.ts";

const [jenis, nomor, tahunStr, daftarPasal = "", pasalPenjelasan = ""] = process.argv.slice(2);
if (!jenis || !nomor || !tahunStr) throw new Error("Pakai: <jenis> <nomor> <tahun> <pasal,pasal> <pasal-penjelasan>");
const tahun = Number(tahunStr);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const { db, tutup } = sambung();
try {
  const [p] = await db.select().from(schema.peraturan).where(and(eq(schema.peraturan.jenis, jenis), eq(schema.peraturan.nomor, nomor), eq(schema.peraturan.tahun, tahun)));
  if (!p) throw new Error("Peraturan belum diingest");
  const [berkas] = await db.select().from(schema.berkasSumber).where(eq(schema.berkasSumber.peraturanId, p.id));
  const dir = fileURLToPath(new URL("../../../.cache/tinjauan/", import.meta.url));
  mkdirSync(dir, { recursive: true });
  const namaPdf = `${jenis}-${nomor}-${tahun}.pdf`.toLowerCase();
  copyFileSync(berkas!.path, dir + namaPdf);

  const ambil = async (n: string) => {
    const [ps] = await db.select().from(schema.pasal).where(and(eq(schema.pasal.peraturanId, p.id), eq(schema.pasal.nomor, n)));
    const [v] = await db.select().from(schema.versiPasal).where(eq(schema.versiPasal.pasalId, ps!.id));
    const ayat = await db.select().from(schema.ayat).where(eq(schema.ayat.versiPasalId, v!.id)).orderBy(schema.ayat.urutan);
    const [pj] = await db.select().from(schema.penjelasan).where(eq(schema.penjelasan.versiPasalId, v!.id));
    return { v: v!, ayat, pj };
  };

  const kartu: string[] = [];
  const panel = (judul: string, hal: number, isi: string) =>
    `<section><h2>${esc(judul)} <small>hal. PDF ${hal}</small></h2><div class="dua"><div class="db">${isi}</div>` +
    `<iframe src="${namaPdf}#page=${hal}&zoom=page-width" loading="lazy"></iframe></div></section>`;

  for (const n of daftarPasal.split(",").filter(Boolean)) {
    const { v, ayat } = await ambil(n);
    const isi = ayat.map((a) => `<p>${a.nomor ? `<b>(${a.nomor})</b> ` : ""}${esc(a.teks).replace(/\n/g, "<br>")}</p>`).join("");
    kartu.push(panel(`Pasal ${n}`, v.halaman[0]!, `<p class="meta">Halaman tersimpan: ${v.halaman.join(", ")} · ${ayat.length} Ayat</p>${isi}`));
  }
  if (pasalPenjelasan) {
    const { pj } = await ambil(pasalPenjelasan);
    // Cari halaman Penjelasan: baris isi pertama yang bukan label, sesudah judul "PENJELASAN".
    const halaman = await ekstrak(new Uint8Array(readFileSync(berkas!.path)));
    const kunci = pj!.teks.split("\n").find((l) => !/^(Ayat|Huruf|Angka) /.test(l))!.slice(0, 40);
    const mulai = halaman.findIndex((h) => h.baris.includes("PENJELASAN"));
    const hal = halaman.slice(mulai).find((h) => h.baris.join(" ").includes(kunci))?.no ?? halaman[mulai]!.no;
    kartu.push(panel(`Penjelasan Pasal ${pasalPenjelasan}`, hal, `<p>${esc(pj!.teks).replace(/\n/g, "<br>")}</p>`));
  }

  const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tinjauan ${esc(jenis)} ${esc(nomor)}/${tahun}</title>
<style>
:root{--bg:#fafaf7;--fg:#1d1d1b;--muted:#6b6b66;--line:#ddd9cf;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ecebe6;--muted:#9a9890;--line:#34332f;--card:#1f1f1c}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,sans-serif}
main{max-width:1400px;margin:auto;padding:16px}
h1{font-size:20px}h2{font-size:16px;margin:0 0 8px}small,.meta{color:var(--muted);font-weight:normal}
section{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;margin:16px 0}
.dua{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.db{max-height:80vh;overflow:auto;white-space:normal}
iframe{width:100%;height:80vh;border:1px solid var(--line);border-radius:4px;background:#fff}
@media (max-width:800px){.dua{grid-template-columns:1fr}}
</style><main><h1>Tinjauan sebelum snapshot: ${esc(jenis)} ${esc(nomor)}/${tahun}</h1>
<p class="meta">Kiri: isi database (Seam A). Kanan: PDF resmi, ${esc(berkas!.url)}, diambil ${berkas!.diambilPada.toISOString()}.
Pasal yang melewati beberapa halaman: gulir PDF ke halaman berikutnya.</p>${kartu.join("")}</main></html>`;
  const out = `${dir}${jenis}-${nomor}-${tahun}.html`.toLowerCase();
  writeFileSync(out, html);
  console.log(out);
} finally {
  await tutup();
}
