// Seam A: UU 6/2023 (batang tubuh + Lampiran Perppu 2/2022) dari JDIH BPK → isi database, memakai lapisan OCR bawaan PDF.
// Tes hanya membaca database, tidak memanggil fungsi parser.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ingest } from "../src/ingest.ts";
import { DIR_DATA_TES, dbTes, fetchTiruan, muatSumber, unduhFixture } from "./bantu.ts";
import { bacaIsi } from "./isi-db.ts";
import { cariBocor } from "./bocor.ts";

const meta = muatSumber("uu-6-2023");
let db: Db;
let tutup: () => Promise<void>;
let pdf: Uint8Array;

beforeAll(async () => {
  pdf = await unduhFixture(meta);
  ({ db, tutup } = await dbTes());
  await jalankan();
});
const jalankan = () => ingest(meta, { db, fetch: fetchTiruan({ [meta.url]: pdf }), dirData: DIR_DATA_TES, jedaMs: [0, 0] });
afterAll(() => tutup?.());

const urut = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

describe("ingest UU 6/2023", () => {
  it("menilai PDF sebagai scan dengan lapisan OCR bawaan yang layak, tanpa OCR ulang", async () => {
    const [p] = await db.select().from(schema.peraturan);
    expect(p).toEqual(expect.objectContaining({ jenis: "UU", nomor: "6", tahun: 2023, asalTeks: "ocr" }));
    const [b] = await db.select().from(schema.berkasSumber);
    expect(b!.penilaianTeks).toBe("ocr-layak");
    expect(b!.kataAnehPer1000).toBeLessThan(10);
  });

  it("memisahkan batang tubuh (2 Pasal) dari Lampiran (186 Pasal Perppu 2/2022, urut)", async () => {
    expect(await nomorPasal("batang")).toEqual(urut(2));
    expect(await nomorPasal("lampiran")).toEqual(urut(186));
  });

  it("menyimpan semua Versi Pasal dengan Asal Teks OCR dan rujukan ke bagiannya", async () => {
    const versi = await db.select().from(schema.versiPasal);
    expect(versi).toHaveLength(188);
    expect(versi.every((v) => v.asalTeks === "ocr")).toBe(true);
    expect(versi.filter((v) => v.rujukan.startsWith("Lampiran, Pasal ")).length).toBe(186);
  });

  it("menautkan Penjelasan batang tubuh walau judulnya rusak OCR (\"PASAL DEMT PASAL\", \"Pasa1 1\")", async () => {
    expect((await versiPasal("batang", "1")).penjelasan).toBe("Cukup jelas.");
    expect((await versiPasal("batang", "2")).penjelasan).toBe("Cukup jelas");
  });

  it("menyimpan Pasal 81 Lampiran utuh sebagai satu teks: Pasal di dalam Pasal bukan Pasal Perppu", async () => {
    const p81 = await versiPasal("lampiran", "81");
    expect(p81.versi.halaman[0]).toBe(549);
    expect(p81.versi.halaman.at(-1)).toBe(579);
    expect(p81.ayat).toHaveLength(1);
    const teks = p81.ayat[0]!.teks;
    expect(teks).toMatch(/^Beberapa ketentuan dalam Undang-Undang Nomor 13 Tahun 2003 tentang Ketenagakerjaan/);
    expect(teks).toContain(
      "\n45. Di antara Pasal 154 dan Pasal 155 disisipkan 1 (satu) pasal, yakni Pasal 154A sehingga berbunyi sebagai berikut:\nPasal 154A\n(1) Pemutusan Hubungan Kerja dapat terjadi karena alasan:",
    );
    expect(teks).toContain("\n47. Ketentuan Pasal 156 diubah sehingga berbunyi sebagai berikut:\nPasal 156\n");
    // Pasal Perppu sesudahnya tidak bergeser oleh kutipan atau batas "Di antara Pasal X dan Pasal Y".
    expect((await versiPasal("lampiran", "82")).versi.halaman[0]).toBe(579);
  });

  it("memecah Pasal Lampiran yang bukan pengubah menjadi Ayat", async () => {
    const p186 = await versiPasal("lampiran", "186");
    expect(p186.ayat).toEqual([
      expect.objectContaining({ nomor: null, teks: expect.stringMatching(/^Peraturan Pemerintah Pengganti Undang-Undang ini mulai berlaku/) }),
    ]);
    const p133 = await versiPasal("lampiran", "133");
    expect(p133.ayat.map((a) => a.nomor)).toEqual(["1", "3", "4"]);
    // "(2t" bukan judul Ayat yang sah, jadi menempel ke Ayat (1); Pasal ini ditandai perlu tinjauan (lihat di bawah).
    expect(p133.ayat[0]!.teks).toMatch(/^Badan Pelaksana terdiri atas Kepala dan Deputi\. \(2t Jumlah Deputi/);
  });

  it("menandai Ayat yang tidak urut karena salah baca OCR (\"(2t\", \"14)\") sebagai perlu tinjauan", async () => {
    const t = await db.select().from(schema.catatanTinjauan);
    expect(t.map((x) => [x.jenis, x.pesan])).toEqual([
      ["ayat-tidak-urut", "Pasal 133: Ayat (3) muncul, diharapkan (2)"],
      ["ayat-tidak-urut", "Pasal 138: Ayat (5) muncul, diharapkan (4)"],
    ]);
    expect((await versiPasal("lampiran", "133")).versi.perluTinjauan).toBe(true);
    expect((await versiPasal("lampiran", "138")).versi.perluTinjauan).toBe(true);
    expect((await versiPasal("lampiran", "81")).versi.perluTinjauan).toBe(false);
  });
});

describe("cek-bocor UU 6/2023", () => {
  it("tidak ada header, nomor halaman, footer, atau kata sambung di teks Ayat dan Penjelasan", async () => {
    const { jumlahTeks, temuan } = await cariBocor(db);
    expect(jumlahTeks).toBeGreaterThan(188);
    expect(temuan).toEqual([]);
  });
});

describe("snapshot Seam A UU 6/2023", () => {
  // Bila snapshot berubah, tinjau ulang dengan scripts/sampel-tinjauan.ts sebelum memperbaruinya (vitest -u).
  it("isi database sama dengan snapshot yang sudah ditinjau", async () => {
    const isi = await bacaIsi(db, "UU", "6", 2023);
    await expect(JSON.stringify(isi, null, 2) + "\n").toMatchFileSnapshot("__snapshots__/uu-6-2023.isi.json");
  });
});

describe("ingest ulang UU 6/2023", () => {
  it("tidak menggandakan data: Pasal batang tubuh dan Lampiran bernomor sama tetap terpisah", async () => {
    const sebelum = await bacaIsi(db, "UU", "6", 2023);
    await jalankan();
    expect(await db.$count(schema.pasal)).toBe(188);
    expect(await bacaIsi(db, "UU", "6", 2023)).toEqual(sebelum);
  });
});

async function nomorPasal(bagian: "batang" | "lampiran") {
  const rows = await db.select().from(schema.pasal).where(eq(schema.pasal.bagian, bagian)).orderBy(schema.pasal.urutan);
  return rows.map((r) => r.nomor);
}

async function versiPasal(bagian: "batang" | "lampiran", nomor: string) {
  const [ps] = await db.select().from(schema.pasal).where(and(eq(schema.pasal.bagian, bagian), eq(schema.pasal.nomor, nomor)));
  const [v] = await db.select().from(schema.versiPasal).where(eq(schema.versiPasal.pasalId, ps!.id));
  const ayat = await db.select().from(schema.ayat).where(eq(schema.ayat.versiPasalId, v!.id)).orderBy(schema.ayat.urutan);
  const [pj] = await db.select().from(schema.penjelasan).where(eq(schema.penjelasan.versiPasalId, v!.id));
  return { versi: v!, ayat, penjelasan: pj?.teks ?? null };
}
