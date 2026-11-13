// Seam A: pola perubahan yang tidak muncul di Lampiran UU 6/2023 (ubah/sisip/hapus Ayat saja, sasaran belum diingest),
// memakai PDF kecil buatan tes. Tes hanya membaca database dan ringkasan ingest, tidak memanggil fungsi parser.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ingest, type RingkasanIngest, type SumberMeta } from "../src/ingest.ts";
import { DIR_DATA_TES, buatPdf, dbTes, fetchTiruan } from "./bantu.ts";

const s = schema;
const sasaran: SumberMeta = { id: "tes-sasaran", jenis: "UU", nomor: "99", tahun: 2098, judul: "Tes Sasaran", url: "https://contoh.test/sasaran.pdf" };
const belum: SumberMeta = { id: "tes-belum", jenis: "UU", nomor: "97", tahun: 2098, judul: "Belum Diingest", url: "https://contoh.test/belum.pdf" };
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
    ],
  ]);
  const pdfPengubah = await buatPdf([
    ["UNDANG-UNDANG REPUBLIK INDONESIA", "Pasal 1", "Lampiran merupakan bagian tidak terpisahkan dari Undang-Undang ini.", "Pasal 2", "Undang-Undang ini mulai berlaku."],
    [
      "LAMPIRAN",
      "UNDANG-UNDANG REPUBLIK INDONESIA",
      "Pasal 1",
      "Beberapa ketentuan dalam Undang-Undang Nomor 99 Tahun 2098 tentang Tes Sasaran diubah sebagai berikut:",
      "1. Ketentuan ayat (2) Pasal 1 diubah sehingga berbunyi sebagai berikut:",
      "(2) Ayat dua Pasal 1 baru.",
      "2. Ketentuan ayat (3) Pasal 1 dihapus.",
      "3. Di antara ayat (1) dan ayat (2) Pasal 2 disisipkan 1 (satu) ayat, yakni ayat (1a) sehingga berbunyi sebagai berikut:",
      "(1a) Ayat sisipan Pasal 2.",
      "4. Pasal 3 dihapus.",
      "Pasal 2",
      "Beberapa ketentuan dalam Undang-Undang Nomor 97 Tahun 2098 tentang Belum Diingest diubah sebagai berikut:",
      "1. Ketentuan Pasal 5 diubah sehingga berbunyi sebagai berikut:",
      "Pasal 5",
      "Bunyi baru Pasal 5.",
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

describe("Pasal pengubah yang menyasar Peraturan yang belum diingest", () => {
  it("dilewati dan dicatat di ringkasan ingest; relasi hanya ke Peraturan yang ada", async () => {
    expect(ringkasan.perubahanDilewati).toEqual([expect.stringMatching(/^Lampiran, Pasal 2: UU 97\/2098 belum diingest/)]);
    expect(await db.$count(s.relasiPeraturan)).toBe(1);
    expect(await db.$count(s.catatanPerubahan)).toBe(4);
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
