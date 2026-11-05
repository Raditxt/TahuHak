// PROTOTYPE — dibuang. Ekstraksi teks per halaman dengan pdfjs, dikelompokkan per baris.
// Hasil di-cache ke out/<id>.pages.json supaya PDF 1127 halaman tidak diekstrak ulang.
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export type Halaman = { no: number; baris: string[]; jumlahKarakter: number; teksTakTerlihat: boolean };

type Item = { x: number; y: number; w: number; h: number; s: string };

// Kelompokkan item jadi baris: urutkan menurut y turun, item masuk baris yang sama
// bila selisih y-nya < 45% tinggi huruf (teks OCR sering miring sedikit).
function susunBaris(items: Item[]): string[] {
  items.sort((a, b) => b.y - a.y);
  const rows: Item[][] = [];
  for (const it of items) {
    const last = rows[rows.length - 1];
    if (last) {
      const yRef = last.reduce((a, b) => a + b.y, 0) / last.length;
      const hRef = Math.max(...last.map((i) => i.h), it.h, 4);
      if (Math.abs(yRef - it.y) < hRef * 0.45) { last.push(it); continue; }
    }
    rows.push([it]);
  }
  return rows.map((r) => {
    r.sort((a, b) => a.x - b.x);
    let out = "";
    let end = -Infinity;
    for (const it of r) {
      const gap = it.x - end;
      // Item pdfjs sering memotong di tengah kata ("sediki" + "t"): sambung tanpa spasi bila celahnya sempit.
      if (out && gap > it.h * 0.15) out += " ";
      out += it.s;
      end = it.x + it.w;
    }
    return out.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

export async function ekstrak(id: string, file: string): Promise<Halaman[]> {
  const cache = `out/${id}.pages.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  mkdirSync("out", { recursive: true });
  const data = new Uint8Array(readFileSync(file));
  const doc = await getDocument({ data, verbosity: 0 }).promise;
  const hasil: Halaman[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const items: Item[] = [];
    for (const it of tc.items as any[]) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || it.height, s: it.str });
    }
    // Bukti scan: teks digambar dengan mode tak terlihat (render mode 3) = lapisan OCR di atas gambar scan.
    // (Gambar saja tidak cukup: PDF digital pun punya logo Garuda di tiap halaman.)
    const ops = await page.getOperatorList();
    const teksTakTerlihat = ops.fnArray.some((f: number, k: number) => f === OPS.setTextRenderingMode && ops.argsArray[k][0] === 3);
    const baris = susunBaris(items);
    hasil.push({ no: i, baris, jumlahKarakter: baris.join("").length, teksTakTerlihat });
    page.cleanup();
  }
  writeFileSync(cache, JSON.stringify(hasil));
  return hasil;
}

if (import.meta.main) {
  const src = JSON.parse(readFileSync("sources.json", "utf8"));
  for (const d of src.dokumen) {
    const t = Date.now();
    const h = await ekstrak(d.id, d.file);
    console.log(d.id, h.length, "hal", ((Date.now() - t) / 1000).toFixed(1) + "s", "hal berlapis OCR:", h.filter((p) => p.teksTakTerlihat).length);
  }
}
