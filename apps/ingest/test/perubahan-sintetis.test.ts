// Seam A: pola perubahan yang tidak muncul di Lampiran UU 6/2023 (ubah/sisip/hapus Ayat saja, sasaran belum diingest),
// memakai PDF kecil buatan tes. Tes hanya membaca database dan ringkasan ingest, tidak memanggil fungsi parser.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ingest, type RingkasanIngest, type SumberMeta } from "../src/ingest.ts";
import { DIR_DATA_TES, buatPdf, dbTes, fetchTiruan } from "./bantu.ts";

const s = schema;
const sasaran: SumberMeta = { id: "tes-sasaran", jenis: "UU", nomor: "99", tahun: 2098, judul: "Tes Sasaran", url: "https://contoh.test/sasaran.pdf" };
const belum: SumberMeta = { id: "tes-belum", jenis: "UU", nomor: "97", tahun: 2011, judul: "Belum Diingest", url: "https://contoh.test/belum.pdf" };
const pengubah: SumberMeta = { id: "tes-pengubah", jenis: "UU", nomor: "98", tahun: 2098, judul: "Tes Pengubah", url: "https://contoh.test/pengubah.pdf" };

let db: Db;
let tutup: () => Promise<void>;
let ringkasan: RingkasanIngest;
let opsi: Parameters<typeof ingest>[1];

beforeAll(async () => {
  const pdfSasaran = await buatPdf([
    [
      "UNDANG-UNDANG REPUBLIK INDONESIA",
      "Pasal 1",
      "(1) Ayat satu Pasal 1.",
      "(2) Ayat dua Pasal 1 lama.",
      "(3) Ayat tiga Pasal 1.",
      "Pasal 2",
      "(1) Ayat satu Pasal 2.",
      "(2) Ayat dua Pasal 2.",
      "Pasal 3",
      "Pasal tiga lama.",
      "Pasal 4",
      "Pasal empat lama.",
      "Pasal 5",
      "Pasal lima lama.",
      "Pasal 6",
      "Pasal enam lama.",
      "Pasal 7",
      "Pasal tujuh lama.",
      "Pasal 8",
      "Pasal delapan lama.",
      "Pasal 9",
      "Pasal sembilan lama.",
    ],
  ]);
  const pdfPengubah = await buatPdf([
    ["UNDANG-UNDANG REPUBLIK INDONESIA", "Pasal 1", "Lampiran merupakan bagian tidak terpisahkan dari", "Undang-Undang ini.", "Pasal 2", "Undang-Undang ini mulai berlaku."],
    [
      "LAMPIRAN",
      "UNDANG-UNDANG REPUBLIK INDONESIA",
      "Pasal 1",
      // Baris panjang dipotong seperti di PDF asli; teks yang melewati lebar halaman terpotong.
      "Beberapa ketentuan dalam Undang-Undang Nomor 99 Tahun 2098 tentang Tes Sasaran",
      "diubah sebagai berikut:",
      "1. Ketentuan ayat (2) Pasal 1 diubah sehingga berbunyi sebagai berikut:",
      "(2) Ayat dua Pasal 1 baru.",
      "2. Ketentuan ayat (3) Pasal 1 dihapus.",
      "3. Di antara ayat (1) dan ayat (2) Pasal 2 disisipkan 1 (satu) ayat, yakni ayat (1a)",
      "sehingga berbunyi sebagai berikut:",
      "(1a) Ayat sisipan Pasal 2.",
      "4. Pasal 3 dihapus.",
      // Angka 5 hilang (rusak OCR): angka 6 loncat.
      "6. Ketentuan Pasal 4 diubah sehingga berbunyi sebagai berikut:",
      "Pasal 4",
      "Pasal empat baru.",
      "7. Pasal 5 dihapus.",
      "8. Pasal 6 dihapus.",
      "9. Pasal 7 dihapus.",
      "10. Ketentuan Pasal 8 diubah sehingga berbunyi sebagai berikut:",
      "Pasal 8",
      // OCR menelan pergantian baris dan membaca "11." sebagai "t1.".
      "Pasal delapan baru. t1. Pasal 9 dihapus.",
      "Pasal 2",
      // Tahun rusak OCR seperti di Lampiran UU 6/2023 Pasal 50 ("2OLl" = 2011).
      "Beberapa ketentuan dalam Undang-Undang Nomor 97 Tahun 2OLl tentang Belum Diingest",
      "diubah sebagai berikut:",
      "1. Ketentuan Pasal 5 diubah sehingga berbunyi sebagai berikut:",
      "Pasal 5",
      "Bunyi baru Pasal 5.",
      "2. Di antara BAB I dan BAB II disisipkan 1 (satu) bab dan 1 (satu) pasal,",
      "yakni BAB IA dan Pasal 5A sehingga berbunyi sebagai berikut:",
      "Pasal 5A",
      "Bunyi Pasal 5A.",
      "Pasal 3",
      "Peraturan ini mulai berlaku.",
    ],
  ]);
  ({ db, tutup } = await dbTes());
  const pdfBelum = await buatPdf([["UNDANG-UNDANG REPUBLIK INDONESIA", "Pasal 5", "Bunyi lama Pasal 5."]]);
  const fetchFixture = fetchTiruan({ [sasaran.url]: pdfSasaran, [pengubah.url]: pdfPengubah, [belum.url]: pdfBelum });
  opsi = { db, fetch: fetchFixture, dirData: DIR_DATA_TES, jedaMs: [0, 0] };
  await ingest(sasaran, opsi);
  ringkasan = await ingest(pengubah, opsi);
});
afterAll(() => tutup?.());

async function pasalSasaran(nomor: string) {
  const [p] = await db.select().from(s.peraturan).where(and(eq(s.peraturan.nomor, "99"), eq(s.peraturan.tahun, 2098)));
  const [ps] = await db.select().from(s.pasal).where(and(eq(s.pasal.peraturanId, p!.id), eq(s.pasal.nomor, nomor)));
  const versi = await db.select().from(s.versiPasal).where(eq(s.versiPasal.pasalId, ps!.id));
  const ayat = await db.select().from(s.ayat).where(inArray(s.ayat.versiPasalId, versi.map((v) => v.id))).orderBy(asc(s.ayat.urutan));
  const catatan = await db.select().from(s.catatanPerubahan).where(eq(s.catatanPerubahan.pasalId, ps!.id)).orderBy(asc(s.catatanPerubahan.id));
  const ayatBaru = catatan.length
    ? await db.select().from(s.ayatPerubahan).where(inArray(s.ayatPerubahan.catatanPerubahanId, catatan.map((c) => c.id))).orderBy(asc(s.ayatPerubahan.urutan))
    : [];
  return {
    versi,
    ayat: ayat.map((a) => ({ nomor: a.nomor, teks: a.teks })),
    catatan: catatan.map(({ rujukan, jenis, cakupan, versiPasalId, ayatTerdampak, id }) => ({
      rujukan,
      jenis,
      cakupan,
      versiPasalId,
      ayatTerdampak,
      ayatBaru: ayatBaru.filter((a) => a.catatanPerubahanId === id).map((a) => ({ nomor: a.nomor, teks: a.teks })),
    })),
  };
}

describe("perubahan Ayat saja", () => {
  it("ubah dan hapus Ayat: Catatan Perubahan memuat bunyi Ayat baru, tanpa Versi Pasal baru dan tanpa penyambungan", async () => {
    const p = await pasalSasaran("1");
    expect(p.versi).toHaveLength(1);
    expect(p.ayat).toEqual([
      { nomor: "1", teks: "Ayat satu Pasal 1." },
      { nomor: "2", teks: "Ayat dua Pasal 1 lama." },
      { nomor: "3", teks: "Ayat tiga Pasal 1." },
    ]);
    expect(p.catatan).toEqual([
      { rujukan: "Lampiran, Pasal 1 angka 1", jenis: "ubah", cakupan: "ayat-saja", versiPasalId: null, ayatTerdampak: ["2"], ayatBaru: [{ nomor: "2", teks: "Ayat dua Pasal 1 baru." }] },
      { rujukan: "Lampiran, Pasal 1 angka 2", jenis: "hapus", cakupan: "ayat-saja", versiPasalId: null, ayatTerdampak: ["3"], ayatBaru: [] },
    ]);
  });

  it("sisip Ayat: Catatan Perubahan memuat Ayat sisipan", async () => {
    const p = await pasalSasaran("2");
    expect(p.versi).toHaveLength(1);
    expect(p.catatan).toEqual([
      { rujukan: "Lampiran, Pasal 1 angka 3", jenis: "sisip", cakupan: "ayat-saja", versiPasalId: null, ayatTerdampak: ["1a"], ayatBaru: [{ nomor: "1a", teks: "Ayat sisipan Pasal 2." }] },
    ]);
  });

  it("hapus Pasal tanpa Ayat bernomor: Catatan Perubahan hapus, bunyi lama tetap", async () => {
    const p = await pasalSasaran("3");
    expect(p.ayat).toEqual([{ nomor: null, teks: "Pasal tiga lama." }]);
    expect(p.catatan).toEqual([{ rujukan: "Lampiran, Pasal 1 angka 4", jenis: "hapus", cakupan: "pasal-utuh", versiPasalId: null, ayatTerdampak: [], ayatBaru: [] }]);
  });
});

describe("angka perubahan tak berurutan", () => {
  it("angka yang loncat masuk antrean tinjauan manual dan tidak diterapkan; angka sesudahnya tetap diterapkan dengan nomor aslinya", async () => {
    const [p] = await db.select().from(s.peraturan).where(and(eq(s.peraturan.nomor, "98"), eq(s.peraturan.tahun, 2098)));
    const tinjauan = await db
      .select()
      .from(s.catatanTinjauan)
      .where(and(eq(s.catatanTinjauan.peraturanId, p!.id), eq(s.catatanTinjauan.jenis, "angka-tidak-urut")));
    expect(tinjauan.map((t) => t.pesan)).toEqual([expect.stringMatching(/^Lampiran, Pasal 1 angka 6: .*diharapkan angka 5/)]);
    const p4 = await pasalSasaran("4");
    expect(p4.versi).toHaveLength(1);
    expect(p4.catatan).toEqual([]);
    // Bunyi angka 6 tidak tertelan ke angka sebelumnya.
    expect((await pasalSasaran("3")).catatan).toEqual([expect.objectContaining({ rujukan: "Lampiran, Pasal 1 angka 4" })]);
    expect((await pasalSasaran("5")).catatan).toEqual([
      { rujukan: "Lampiran, Pasal 1 angka 7", jenis: "hapus", cakupan: "pasal-utuh", versiPasalId: null, ayatTerdampak: [], ayatBaru: [] },
    ]);
  });
});

describe("angka perubahan yang menempel di akhir angka sebelumnya", () => {
  it("nomor angka rusak OCR (\"t1.\" = 11) tetap dikenali bila cocok dengan angka yang diharapkan", async () => {
    const p8 = await pasalSasaran("8");
    expect(p8.ayat.at(-1)).toEqual({ nomor: null, teks: "Pasal delapan baru." });
    expect((await pasalSasaran("9")).catatan).toEqual([
      { rujukan: "Lampiran, Pasal 1 angka 11", jenis: "hapus", cakupan: "pasal-utuh", versiPasalId: null, ayatTerdampak: [], ayatBaru: [] },
    ]);
  });
});

describe("Pasal pengubah yang menyasar Peraturan yang belum diingest", () => {
  it("dilewati dan dicatat di ringkasan ingest; relasi hanya ke Peraturan yang ada", async () => {
    expect(ringkasan.perubahanDilewati).toEqual([expect.stringMatching(/^Lampiran, Pasal 2: UU 97\/2011 belum diingest/)]);
    expect(await db.$count(s.relasiPeraturan)).toBe(1);
    expect(await db.$count(s.catatanPerubahan)).toBe(9);
  });

  it("sisip BAB sekaligus Pasal tetap masuk antrean tinjauan manual walau sasarannya belum diingest", async () => {
    const [p] = await db.select().from(s.peraturan).where(and(eq(s.peraturan.nomor, "98"), eq(s.peraturan.tahun, 2098)));
    const tinjauan = await db
      .select()
      .from(s.catatanTinjauan)
      .where(and(eq(s.catatanTinjauan.peraturanId, p!.id), eq(s.catatanTinjauan.jenis, "sisip-bab")));
    expect(tinjauan.map((t) => t.pesan)).toEqual([expect.stringMatching(/^Lampiran, Pasal 2 angka 2: /)]);
  });
});

describe("Peraturan sasaran diingest sesudah Peraturan Pengubah-nya", () => {
  // Penerapan otomatis untuk urutan ini belum ada (issue lanjutan); ingest tidak boleh diam.
  it("mencetak peringatan untuk menjalankan ulang ingest Peraturan Pengubah", async () => {
    const r = await ingest(belum, opsi);
    expect(r.peringatan).toEqual([expect.stringContaining("jalankan ulang: pnpm ingest uu-98-2098")]);
    expect(r.peringatan[0]).toMatch(/UU 98\/2098/);
  });

  it("tidak memperingatkan Peraturan sasaran yang relasinya sudah tercatat", async () => {
    const r = await ingest(sasaran, opsi);
    expect(r.peringatan).toEqual([]);
  });
});
