// Detektor Asal Teks dan mutu lapisan teks, dinilai per dokumen (jangan diasumsikan dari sumbernya: UU 6/2023 dan
// PP 35/2021 dari JDIH BPK ternyata scan berlapis OCR). Aturan dari verdict prototype #2.
import type { Baris } from "./bersih.ts";
import type { Halaman } from "./ekstrak.ts";

export type AsalTeks = "digital" | "ocr";
/** digital: teks asli PDF. ocr-layak: lapisan OCR bawaan dipakai apa adanya. perlu-ocr: masuk antrean OCR laptop (ADR-0003). */
export type PenilaianTeks = "digital" | "ocr-layak" | "perlu-ocr";
export type Mutu = { asalTeks: AsalTeks; penilaian: PenilaianTeks; kataAnehPer1000: number };

/** Lapisan teks tak terlihat (render mode 3) di sekurangnya porsi halaman ini berarti scan berlapis OCR. */
const PORSI_LAPISAN_OCR = 0.5;
/** Lapisan OCR dengan kata aneh di bawah ambang ini (per 1000 kata) layak dipakai tanpa OCR ulang. */
const AMBANG_KATA_ANEH = 10;

const kata = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w.replace(/^[("'“]+|[)"'”.,;:!?]+$/g, ""))
    .filter(Boolean);

/** Kata yang hampir pasti rusak OCR: simbol asing, angka bercampur O/l/I, huruf besar-kecil acak, kata menempel. */
function aneh(w: string): boolean {
  return (
    /[{}|~\\^`•·»«©®□■¡]/.test(w) ||
    (/^\d*[0-9][OolI][0-9OolI]*$|^[OolI][0-9]+$/.test(w) && /\d/.test(w)) || // 2O2O, 16O, l0
    /[A-Z]{2,}[a-z]+[A-Z]/.test(w) || // PRESiDEN
    /^[a-z]{3,}[A-Z][a-z]{2,}/.test(w) // pemerintahDaerah
  );
}

export function nilaiMutu(halaman: Halaman[], baris: Baris[]): Mutu {
  const porsiOcr = halaman.filter((h) => h.teksTakTerlihat).length / Math.max(1, halaman.length);
  const ws = baris.flatMap((b) => kata(b.teks));
  const kataAnehPer1000 = Math.round((10_000 * ws.filter(aneh).length) / Math.max(1, ws.length)) / 10;
  if (porsiOcr < PORSI_LAPISAN_OCR) return { asalTeks: "digital", penilaian: "digital", kataAnehPer1000 };
  return { asalTeks: "ocr", penilaian: kataAnehPer1000 < AMBANG_KATA_ANEH ? "ocr-layak" : "perlu-ocr", kataAnehPer1000 };
}
