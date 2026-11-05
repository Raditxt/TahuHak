// PROTOTYPE — kriteria issue #2: tidak ada header, nomor halaman, footer salinan, kata sambung, atau watermark di teks Pasal.
// Jalankan setelah parse: bun run cek-bocor.ts
import { readFileSync } from "node:fs";
import { isHeader } from "./clean.ts";

const POLA: [string, RegExp][] = [
  ["header PRESIDEN", /(^|\n| )PRES[IiT1]DEN( REPUBLIK INDONESIA)?(\n|$)/],
  ["nomor halaman", /(^|\s)[-_~]\s?[\w,.]{0,4}\d[\w,.]{0,4}\s?[-_~](\s|$)/],
  ["header rusak OCR", /[{}\[\]$|]{1}\S*[{}\[\]$|]/],
  ["footer salinan", /SK\s*No\.?\s*[\dlIO]{4,}/i],
  ["kata sambung", /(\.\s){2,}|\.{3}|…/],
  ["SALINAN", /\bSALINAN\b/],
];
const ids = ["uu-13-2003", "uu-6-2023", "pp-35-2021", "perda-mks-1983", "perda-mks-1983-ocr"];
for (const id of ids) {
  const r = JSON.parse(readFileSync(`out/${id}.json`, "utf8"));
  const teks: [string, string][] = [];
  for (const p of r.pasal) for (const a of p.ayat) teks.push([`Pasal ${p.nomor}`, a.teks]);
  for (const p of r.lampiran?.pasal ?? []) for (const a of p.ayat) teks.push([`Lampiran Pasal ${p.nomor}`, a.teks]);
  for (const x of r.perubahan) if (x.teksBaru) teks.push([x.rujukan, x.teksBaru]);
  const temuan: string[] = [];
  for (const [ref, t] of teks) {
    for (const [nama, re] of POLA) { const m = t.match(re); if (m) temuan.push(`${nama} @ ${ref}: …${t.slice(Math.max(0, m.index! - 30), m.index! + 30).replace(/\n/g, " ")}…`); }
    for (const baris of t.split("\n")) if (isHeader(baris.trim())) temuan.push(`header (fuzzy) @ ${ref}: "${baris.trim()}"`);
  }
  console.log(`\n=== ${id}: ${teks.length} potongan teks, ${temuan.length} temuan`);
  console.log(temuan.slice(0, 12).join("\n"));
}
