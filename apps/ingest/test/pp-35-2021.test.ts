// Seam A: PP 35/2021 dari JDIH BPK → isi database, memakai lapisan OCR bawaan PDF.
// Tes hanya membaca database, tidak memanggil fungsi parser.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ingest } from "../src/ingest.ts";
import { DIR_DATA_TES, dbTes, fetchTiruan, muatSumber, unduhFixture } from "./bantu.ts";
import { bacaIsi } from "./isi-db.ts";
import { cariBocor } from "./bocor.ts";

const meta = muatSumber("pp-35-2021");
let db: Db;
let tutup: () => Promise<void>;

beforeAll(async () => {
  const pdf = await unduhFixture(meta);
  ({ db, tutup } = await dbTes());
  await ingest(meta, { db, fetch: fetchTiruan({ [meta.url]: pdf }), dirData: DIR_DATA_TES, jedaMs: [0, 0] });
});
afterAll(() => tutup?.());

describe("ingest PP 35/2021", () => {
  it("menilai PDF sebagai scan dengan lapisan OCR bawaan yang layak, tanpa OCR ulang", async () => {
    const [p] = await db.select().from(schema.peraturan);
    expect(p).toEqual(expect.objectContaining({ jenis: "PP", nomor: "35", tahun: 2021, asalTeks: "ocr" }));
    const [b] = await db.select().from(schema.berkasSumber);
    expect(b!.penilaianTeks).toBe("ocr-layak");
    expect(b!.kataAnehPer1000).toBeLessThan(10);
  });

  it("menyimpan 66 Pasal batang tubuh, urut 1 sampai 66, ber-Asal Teks OCR", async () => {
    const rows = await db.select().from(schema.pasal).orderBy(schema.pasal.urutan);
    expect(rows.map((r) => r.nomor)).toEqual(Array.from({ length: 66 }, (_, i) => String(i + 1)));
    expect(rows.every((r) => r.bagian === "batang")).toBe(true);
    const versi = await db.select().from(schema.versiPasal);
    expect(versi.every((v) => v.asalTeks === "ocr")).toBe(true);
  });

  it("memecah Pasal 40 (uang pesangon) menjadi Ayat dengan rincian huruf di baris sendiri", async () => {
    const { ayat } = await versiPasal("40");
    expect(ayat.map((a) => a.nomor)).toEqual(["1", "2", "3", "4"]);
    expect(ayat[1]!.teks.split("\n").slice(0, 2)).toEqual([
      "Uang pesangon sebagaimana dimaksud pada ayat (1) diberikan dengan ketentuan sebagai berikut:",
      "a. masa kerja kurang dari 1 (satu) tahun, 1 (satu) bulan Upah;",
    ]);
  });

  it("menautkan Penjelasan ke 64 Pasal; Penjelasan Pasal 17 dan 19 (judul \"Pasal t7\", \"Pasal t9\") tercatat perlu tinjauan", async () => {
    expect(await db.$count(schema.penjelasan)).toBe(64);
    const t = await tinjauan();
    expect(t.filter((x) => x.jenis === "penjelasan-tidak-ditemukan").map((x) => x.rujukan)).toEqual(["Pasal 17", "Pasal 19"]);
  });

  it("mencatat Ayat Pasal 39 yang tidak urut (\"(2\\\" salah baca OCR) sebagai perlu tinjauan", async () => {
    const t = await tinjauan();
    expect(t.filter((x) => x.jenis === "ayat-tidak-urut")).toEqual([
      expect.objectContaining({ rujukan: "Pasal 39", pesan: "Pasal 39: Ayat (3) muncul, diharapkan (2)" }),
    ]);
  });

  it("hanya Pasal dengan catatan tinjauan yang ditandai perlu tinjauan", async () => {
    const versi = await db.select().from(schema.versiPasal);
    expect(versi.filter((v) => v.perluTinjauan).map((v) => v.rujukan).sort()).toEqual(["Pasal 17", "Pasal 19", "Pasal 39"]);
    expect(await db.$count(schema.catatanTinjauan)).toBe(3);
  });
});

describe("cek-bocor PP 35/2021", () => {
  it("tidak ada header, nomor halaman, footer, atau kata sambung di teks Ayat dan Penjelasan", async () => {
    const { jumlahTeks, temuan } = await cariBocor(db);
    expect(jumlahTeks).toBeGreaterThan(66);
    expect(temuan).toEqual([]);
  });
});

describe("snapshot Seam A PP 35/2021", () => {
  // Bila snapshot berubah, tinjau ulang dengan scripts/sampel-tinjauan.ts sebelum memperbaruinya (vitest -u).
  it("isi database sama dengan snapshot yang sudah ditinjau", async () => {
    const isi = await bacaIsi(db, "PP", "35", 2021);
    await expect(JSON.stringify(isi, null, 2) + "\n").toMatchFileSnapshot("__snapshots__/pp-35-2021.isi.json");
  });
});

async function versiPasal(nomor: string) {
  const [ps] = await db.select().from(schema.pasal).where(eq(schema.pasal.nomor, nomor));
  const [v] = await db.select().from(schema.versiPasal).where(eq(schema.versiPasal.pasalId, ps!.id));
  const ayat = await db.select().from(schema.ayat).where(eq(schema.ayat.versiPasalId, v!.id)).orderBy(schema.ayat.urutan);
  return { versi: v!, ayat };
}

async function tinjauan() {
  const rows = await db
    .select({ jenis: schema.catatanTinjauan.jenis, pesan: schema.catatanTinjauan.pesan, rujukan: schema.versiPasal.rujukan })
    .from(schema.catatanTinjauan)
    .leftJoin(schema.versiPasal, eq(schema.catatanTinjauan.versiPasalId, schema.versiPasal.id))
    .orderBy(schema.catatanTinjauan.id);
  return rows;
}
