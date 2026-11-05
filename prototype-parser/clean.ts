// PROTOTYPE — dibuang. Membuang header, nomor halaman, footer salinan, dan kata sambung di kaki halaman.
import type { Halaman } from "./extract.ts";

export type Baris = { teks: string; hal: number };

export function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const HEADER = ["PRESIDEN", "REPUBLIK INDONESIA", "PRESIDEN REPUBLIK INDONESIA", "SALINAN"];
const mirip = (s: string, t: string) => lev(s.toUpperCase().replace(/\s+/g, " "), t) <= Math.max(2, Math.floor(t.length * 0.35));
export const isHeader = (s: string) => s.length <= 26 && HEADER.some((h) => mirip(s, h));
// Nomor halaman: diapit - atau _ dan memuat angka. OCR membuatnya jadi "-to2-", "_18_", "-r23-", "-4,-".
export const isNomorHalaman = (s: string) => /^[-_~]\s*[\w,.]{1,5}\s*[-_~]?$|^[-_~]?\s*[\w,.]{1,5}\s*[-_~]$/.test(s) && /\d/.test(s) && s.length <= 9;
const isFooterSalinan = (s: string) => /^SK\s*No\.?\s*[\dlIO]/i.test(s);
// Kata sambung: baris terakhir halaman yang mengulang awal halaman berikut ("(2) Bagi...", "16. Ketentuan", "b. Perusahaan. . .")
const isKataSambung = (s: string) => /(\.\s*){2,}[-\s]*$|…$|\s\.$/.test(s);

export type HasilBersih = { baris: Baris[]; dibuang: Record<string, number>; barisBerulang: string[] };

export function bersihkan(halaman: Halaman[]): HasilBersih {
  const dibuang: Record<string, number> = { header: 0, nomorHalaman: 0, footerSalinan: 0, kataSambung: 0, berulang: 0 };
  const perHal: Baris[][] = [];
  for (const h of halaman) {
    let b = [...h.baris];
    // Atas: bila nomor halaman ada di 5 baris pertama, semua baris di atasnya adalah header (apa pun bunyi OCR-nya).
    const iNo = b.slice(0, 5).findIndex(isNomorHalaman);
    if (iNo >= 0) { dibuang.header += iNo; dibuang.nomorHalaman++; b.splice(0, iNo + 1); }
    let i = 0;
    while (iNo < 0 && i < Math.min(5, b.length)) {
      if (isNomorHalaman(b[i])) { dibuang.nomorHalaman++; b.splice(i, 1); break; }
      if (isHeader(b[i])) { dibuang.header++; b.splice(i, 1); continue; }
      i++;
    }
    // Bawah: footer salinan lalu kata sambung.
    while (b.length && isFooterSalinan(b[b.length - 1])) { dibuang.footerSalinan++; b.pop(); }
    if (b.length && isKataSambung(b[b.length - 1]) && h.no < halaman.length) {
      // Kata sambung hampir selalu pendek; baris panjang yang kebetulan berakhir " ." tidak dibuang.
      if (b[b.length - 1].length <= 40) { dibuang.kataSambung++; b.pop(); }
    }
    // Kata sambung model UU 6/2023 kadang tanpa titik ("16. Ketentuan"): buang bila sama dengan awal halaman berikut.
    const next = halaman[h.no]; // h.no 1-based → halaman berikut
    if (b.length && next) {
      const awalBerikut = next.baris.filter((x) => !isHeader(x) && !isNomorHalaman(x))[0] ?? "";
      const last = b[b.length - 1];
      const inti = (x: string) => x.replace(/[^A-Za-z0-9]/g, "");
      const a = inti(last), z = inti(awalBerikut).slice(0, inti(last).length);
      if (last.length <= 40 && a.length >= 4 && lev(a, z) <= 2 && last.length <= awalBerikut.length) {
        dibuang.kataSambung++; b.pop();
      }
    }
    perHal.push(b.map((teks) => ({ teks, hal: h.no })));
  }
  // Watermark/teks berulang: baris yang sama muncul di tepi (3 baris atas/bawah) > 30% halaman.
  const hitung = new Map<string, number>();
  for (const b of perHal) {
    const tepi = [...b.slice(0, 3), ...b.slice(-3)].map((x) => x.teks);
    for (const t of new Set(tepi)) hitung.set(t, (hitung.get(t) ?? 0) + 1);
  }
  const ambang = Math.max(5, halaman.length * 0.3);
  const barisBerulang = [...hitung.entries()].filter(([t, n]) => n >= ambang && !/^(Cukup jelas\.?|Ayat \(\d\)|Huruf [a-z])$/i.test(t)).map(([t]) => t);
  const set = new Set(barisBerulang);
  const baris = perHal.flatMap((b) => b.filter((x, i) => (set.has(x.teks) && (i < 3 || i >= b.length - 3) ? (dibuang.berulang++, false) : true)));
  return { baris, dibuang, barisBerulang };
}
