// Seam A: hasil parse janggal ditandai perlu tinjauan di database.
// UU 13/2003 tidak punya keanehan, jadi dipakai PDF kecil buatan tes yang sengaja janggal.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { type Db } from "@tahuhak/db";
import { ingest, type SumberMeta } from "../src/ingest.ts";
import { DIR_DATA_TES, dbTes, fetchTiruan } from "./bantu.ts";
import { bacaIsi, type IsiDb } from "./isi-db.ts";

const meta: SumberMeta = { id: "tes-janggal", jenis: "UU", nomor: "99", tahun: 2099, judul: "Tes Janggal", url: "https://contoh.test/janggal.pdf" };

async function buatPdf(halaman: string[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const baris of halaman) {
    const page = doc.addPage([595, 842]);
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
