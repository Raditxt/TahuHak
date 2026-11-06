// Pembersih: membuang header, nomor halaman, watermark, dan kata sambung kaki halaman.
// Aturan diangkat dari prototype #2 (clean.ts), lihat verdict di issue #2.
import type { Halaman } from "./ekstrak.ts";

export type Baris = { teks: string; hal: number };

export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** Nomor halaman dikenali dari bentuknya: diapit "-"/"_" dan memuat angka ("- 2 -", "-to2-", "_18_"). */
export function isNomorHalaman(s: string): boolean {
  return s.length <= 9 && /\d/.test(s) && /^[-_~]\s*[\w,.]{1,5}\s*[-_~]?$|^[-_~]?\s*[\w,.]{1,5}\s*[-_~]$/.test(s);
}

/** Nomor halaman hanya dicari di beberapa baris teratas. */
const BARIS_ATAS = 5;
/** Watermark hanya dicari di tepi halaman: sekian baris teratas dan terbawah. */
const TEPI = 3;
/** Baris tepi yang muncul di lebih dari porsi halaman ini dianggap watermark. */
const PORSI_WATERMARK = 0.3;
/** Baris berulang yang sah di Penjelasan, bukan watermark. */
const BUKAN_WATERMARK = /^(Cukup jelas\.?|Ayat \(\d+\)|Huruf [a-z])$/i;
/** Kata sambung kaki halaman selalu pendek. */
const MAKS_KATA_SAMBUNG = 40;

const inti = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");

/**
 * Kata sambung: baris terakhir halaman yang mengulang awal halaman berikut ("f. bahwa …", "Bagian ...").
 * Dibuang bila intinya mirip awal baris pertama halaman berikut (Levenshtein ≤ 2).
 */
function isKataSambung(terakhir: string, awalBerikut: string | undefined): boolean {
  if (!awalBerikut || terakhir.length > MAKS_KATA_SAMBUNG) return false;
  const a = inti(terakhir);
  if (a.length < 4) return false;
  return levenshtein(a, inti(awalBerikut).slice(0, a.length)) <= 2;
}

function watermark(halaman: Halaman[]): Set<string> {
  const hitung = new Map<string, number>();
  for (const h of halaman) {
    const tepi = new Set([...h.baris.slice(0, TEPI), ...h.baris.slice(-TEPI)]);
    for (const t of tepi) hitung.set(t, (hitung.get(t) ?? 0) + 1);
  }
  const ambang = Math.max(5, halaman.length * PORSI_WATERMARK);
  return new Set([...hitung].filter(([t, n]) => n >= ambang && !BUKAN_WATERMARK.test(t) && !isNomorHalaman(t)).map(([t]) => t));
}

export function bersihkan(halaman: Halaman[]): Baris[] {
  const wm = watermark(halaman);
  const isiHalaman = halaman.map((h) => {
    let b = [...h.baris];
    // Semua baris di atas nomor halaman adalah header, apa pun bunyinya.
    const iNo = b.slice(0, BARIS_ATAS).findIndex(isNomorHalaman);
    if (iNo >= 0) b.splice(0, iNo + 1);
    // Watermark hanya di tepi halaman; baris sama di tengah halaman adalah isi.
    b = b.filter((t, i) => !(wm.has(t) && (i < TEPI || i >= b.length - TEPI)));
    return b;
  });
  return isiHalaman.flatMap((b, k) => {
    if (b.length && isKataSambung(b.at(-1)!, isiHalaman[k + 1]?.[0])) b = b.slice(0, -1);
    return b.map((teks) => ({ teks, hal: halaman[k]!.no }));
  });
}
