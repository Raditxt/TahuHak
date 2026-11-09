// Seam A: hasil parse janggal ditandai perlu tinjauan di database.
// UU 13/2003 tidak punya keanehan, jadi dipakai PDF kecil buatan tes yang sengaja janggal.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, setTextRenderingMode, TextRenderingMode } from "pdf-lib";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ingest, type SumberMeta } from "../src/ingest.ts";
import { DIR_DATA_TES, dbTes, fetchTiruan } from "./bantu.ts";
import { bacaIsi, type IsiDb } from "./isi-db.ts";

const meta: SumberMeta = { id: "tes-janggal", jenis: "UU", nomor: "99", tahun: 2099, judul: "Tes Janggal", url: "https://contoh.test/janggal.pdf" };

/** `scan`: teks digambar tak terlihat (render mode 3), seperti lapisan OCR di atas gambar hasil scan. */
async function buatPdf(halaman: string[][], scan = false): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const baris of halaman) {
    const page = doc.addPage([595, 842]);
    if (scan) page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
    baris.forEach((t, i) => page.drawText(t, { x: 72, y: 780 - i * 18, size: 11, font }));
  }
  return doc.save();
}

let db: Db;
let tutup: () => Promise<void>;
let isi: IsiDb;

beforeAll(async () => {
  const pdf = await buatPdf([
    [
      "UNDANG-UNDANG REPUBLIK INDONESIA",
      "Pasal 1",
      "Pasal ini wajar.",
      "Pasal 3",
      "(1) Ayat pertama.",
      "(3) Ayat ketiga tanpa ayat kedua.",
      "Pasal 4",
      "Pasal ini juga wajar.",
    ],
    ["PENJELASAN", "ATAS", "UNDANG-UNDANG REPUBLIK INDONESIA", "II. PASAL DEMI PASAL", "Pasal 1", "Cukup jelas", "Pasal 3", "Cukup jelas", "Pasal 4", "Cukup jelas", "Pasal 5", "Penjelasan tanpa Pasal."],
  ]);
  ({ db, tutup } = await dbTes());
  await ingest(meta, { db, fetch: fetchTiruan({ [meta.url]: pdf }), dirData: DIR_DATA_TES, jedaMs: [0, 0] });
  isi = (await bacaIsi(db, "UU", "99", 2099))!;
});
afterAll(() => tutup?.());

const versi = (nomor: string) => isi.pasal.find((p) => p.nomor === nomor)!.versi[0]!;

describe("entri janggal", () => {
  it("nomor Pasal loncat dan Ayat tidak urut menandai Versi Pasal itu perlu tinjauan", () => {
    expect(versi("3").perluTinjauan).toBe(true);
    expect(isi.tinjauan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jenis: "pasal-loncat", versi: "Pasal 3" }),
        expect.objectContaining({ jenis: "ayat-tidak-urut", versi: "Pasal 3" }),
      ]),
    );
  });

  it("Pasal yang wajar tidak ditandai", () => {
    expect(versi("1").perluTinjauan).toBe(false);
    expect(versi("4").perluTinjauan).toBe(false);
  });

  it("Penjelasan tanpa Pasal tercatat sebagai Penjelasan tak tertaut", () => {
    expect(isi.tinjauan).toEqual(
      expect.arrayContaining([expect.objectContaining({ jenis: "penjelasan-tak-tertaut", versi: null, pesan: expect.stringContaining("Pasal 5") })]),
    );
  });
});

describe("lapisan OCR yang tidak layak", () => {
  const metaScan: SumberMeta = { id: "tes-scan", jenis: "Perda", nomor: "2", tahun: 1983, judul: "Tes Scan Buruk", url: "https://contoh.test/scan.pdf" };
  // Salah baca seperti di lapisan bawaan Perda Makassar 1983 (prototype #2): simbol asing dan angka bercampur huruf.
  const rusak = ["Pasa| 1", "Pemturan Daerab {ni} beriaku seiak 2O2O.", "Pasa| 2", "PRESiDEN mene|apkan Ti{ngkat 14 pada l98E."];

  it("masuk antrean OCR laptop: berkas dinilai perlu-ocr dan Pasal tidak diurai", async () => {
    const pdf = await buatPdf([rusak, rusak], true);
    const r = await ingest(metaScan, { db, fetch: fetchTiruan({ [metaScan.url]: pdf }), dirData: DIR_DATA_TES, jedaMs: [0, 0] });
    expect(r).toEqual(expect.objectContaining({ penilaian: "perlu-ocr", pasal: 0 }));
    expect(r.kataAnehPer1000).toBeGreaterThanOrEqual(10);
    const isiScan = (await bacaIsi(db, "Perda", "2", 1983))!;
    expect(isiScan.peraturan.asalTeks).toBe("ocr");
    expect(isiScan.berkas).toEqual([expect.objectContaining({ url: metaScan.url, penilaianTeks: "perlu-ocr" })]);
    expect(isiScan.pasal).toEqual([]);
  });

  it("PDF tanpa lapisan teks tak terlihat dinilai digital walau bunyinya aneh", async () => {
    const [b] = await db.select().from(schema.berkasSumber).where(eq(schema.berkasSumber.url, meta.url));
    expect(b!.penilaianTeks).toBe("digital");
  });
});
