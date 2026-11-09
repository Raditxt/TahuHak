// Ekstraktor Teks: pdfjs → baris per halaman, ditambah tanda lapisan OCR (teks tak terlihat).
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

export type Halaman = { no: number; baris: string[]; teksTakTerlihat: boolean };

type Item = { x: number; y: number; w: number; h: number; s: string };

/** Ambang celah antar-item (× tinggi huruf) di bawah ini disambung tanpa spasi; mencegah "sediki t". */
const CELAH_SAMBUNG = 0.15;
/** Toleransi selisih y (× tinggi huruf) untuk satu baris; teks OCR sering miring sedikit. */
const TOLERANSI_BARIS = 0.45;

function susunBaris(items: Item[]): string[] {
  items.sort((a, b) => b.y - a.y);
  const rows: Item[][] = [];
  for (const it of items) {
    const last = rows.at(-1);
    if (last) {
      const yRef = last.reduce((a, b) => a + b.y, 0) / last.length;
      const hRef = Math.max(...last.map((i) => i.h), it.h, 4);
      if (Math.abs(yRef - it.y) < hRef * TOLERANSI_BARIS) {
        last.push(it);
        continue;
      }
    }
    rows.push([it]);
  }
  return rows
    .map((r) => {
      r.sort((a, b) => a.x - b.x);
      let out = "";
      let akhir = -Infinity;
      for (const it of r) {
        if (out && it.x - akhir > it.h * CELAH_SAMBUNG) out += " ";
        out += it.s;
        akhir = it.x + it.w;
      }
      return out.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

export async function ekstrak(pdf: Uint8Array): Promise<Halaman[]> {
  // pdfjs memindahkan buffer ke worker; beri salinan supaya pemanggil tetap memegang datanya.
  const tugas = getDocument({ data: pdf.slice(), verbosity: 0 });
  const doc = await tugas.promise;
  const hasil: Halaman[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items: Item[] = [];
      for (const it of tc.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        items.push({ x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height, s: it.str });
      }
      // Bukti scan: teks digambar dengan render mode 3 (tak terlihat) di atas gambar.
      // Gambar saja bukan bukti: PDF digital pun punya logo Garuda di tiap halaman.
      const ops = await page.getOperatorList();
      const teksTakTerlihat = ops.fnArray.some((f, k) => f === OPS.setTextRenderingMode && ops.argsArray[k]?.[0] === 3);
      hasil.push({ no: i, baris: susunBaris(items), teksTakTerlihat });
      page.cleanup();
    }
  } finally {
    await tugas.destroy();
  }
  return hasil;
}
