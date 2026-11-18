// Seam A: UU 13/2003 lalu UU 6/2023 → Parser Perubahan menerapkan Pasal 81 Lampiran UU 6/2023 ke UU 13/2003 (#7, ADR-0001).
// Tes hanya membaca database, tidak memanggil fungsi parser.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ingest, type SumberMeta } from "../src/ingest.ts";
import { DIR_DATA_TES, dbTes, fetchTiruan, muatSumber, unduhFixture } from "./bantu.ts";

const s = schema;
const uu13 = muatSumber("uu-13-2003");
const uu6 = muatSumber("uu-6-2023");
let db: Db;
let tutup: () => Promise<void>;
let fetchFixture: typeof fetch;

const jalankan = (meta: SumberMeta) => ingest(meta, { db, fetch: fetchFixture, dirData: DIR_DATA_TES, jedaMs: [0, 0] });

beforeAll(async () => {
  fetchFixture = fetchTiruan({ [uu13.url]: await unduhFixture(uu13), [uu6.url]: await unduhFixture(uu6) });
  ({ db, tutup } = await dbTes());
  await jalankan(uu13);
  await jalankan(uu6);
});
afterAll(() => tutup?.());

async function idPeraturan(nomor: string, tahun: number) {
  const [p] = await db.select().from(s.peraturan).where(and(eq(s.peraturan.jenis, "UU"), eq(s.peraturan.nomor, nomor), eq(s.peraturan.tahun, tahun)));
  return p!.id;
}

/** Pasal UU 13/2003 beserta semua Versi Pasal (dan Ayat-nya) serta Catatan Perubahan (dan Ayat Perubahan-nya). */
async function pasal13(nomor: string) {
  const id13 = await idPeraturan("13", 2003);
  const [ps] = await db.select().from(s.pasal).where(and(eq(s.pasal.peraturanId, id13), eq(s.pasal.bagian, "batang"), eq(s.pasal.nomor, nomor)));
  if (!ps) return null;
  const versi = await db.select().from(s.versiPasal).where(eq(s.versiPasal.pasalId, ps.id)).orderBy(asc(s.versiPasal.id));
  const ayat = versi.length ? await db.select().from(s.ayat).where(inArray(s.ayat.versiPasalId, versi.map((v) => v.id))).orderBy(asc(s.ayat.urutan)) : [];
  const catatan = await db.select().from(s.catatanPerubahan).where(eq(s.catatanPerubahan.pasalId, ps.id)).orderBy(asc(s.catatanPerubahan.id));
  const ayatBaru = catatan.length
    ? await db.select().from(s.ayatPerubahan).where(inArray(s.ayatPerubahan.catatanPerubahanId, catatan.map((c) => c.id))).orderBy(asc(s.ayatPerubahan.urutan))
    : [];
  return {
    pasal: ps,
    versi: versi.map((v) => ({ ...v, ayat: ayat.filter((a) => a.versiPasalId === v.id) })),
    catatan: catatan.map((c) => ({ ...c, ayatBaru: ayatBaru.filter((a) => a.catatanPerubahanId === c.id) })),
  };
}

/** Versi Pasal bersumber dari UU 6/2023 (sebelum #10 memberi tanggal berlaku, inilah Versi Terkini untuk Pasal yang diubah UU 6/2023). */
async function versiDari6(nomor: string) {
  const id6 = await idPeraturan("6", 2023);
  return (await pasal13(nomor))!.versi.find((v) => v.sumberPeraturanId === id6);
}

const huruf = (teks: string) => teks.split("\n").slice(1).map((l) => l.match(/^([a-z])\. /)?.[1]);

describe("Parser Perubahan: Pasal 81 Lampiran UU 6/2023 → UU 13/2003", () => {
  it("mencatat relasi: UU 6/2023 mengubah UU 13/2003", async () => {
    const [id13, id6] = [await idPeraturan("13", 2003), await idPeraturan("6", 2023)];
    const relasi = await db.select().from(s.relasiPeraturan);
    expect(relasi.map(({ sumberPeraturanId, sasaranPeraturanId, jenis }) => ({ sumberPeraturanId, sasaranPeraturanId, jenis }))).toEqual([
      { sumberPeraturanId: id6, sasaranPeraturanId: id13, jenis: "mengubah" },
    ]);
  });

  it("Versi Terkini Pasal 156 bersumber dari Lampiran Pasal 81 angka 47, Asal Teks OCR, Ayat (1)–(5)", async () => {
    const v = (await versiDari6("156"))!;
    expect(v).toMatchObject({ rujukan: "Lampiran, Pasal 81 angka 47", asalTeks: "ocr", perluTinjauan: false });
    expect(v.ayat.map((a) => a.nomor)).toEqual(["1", "2", "3", "4", "5"]);
    const [, a2, a3, a4] = v.ayat;
    // Ayat (2) uang pesangon huruf a–i, maks. 9 bulan Upah.
    expect(a2!.teks).toMatch(/^Uang pesangon sebagaimana dimaksud pada ayat \(1\) diberikan dengan ketentuan sebagai berikut:\na\. masa kerja kurang dari 1 \(satu\) tahun/);
    expect(huruf(a2!.teks)).toEqual([..."abcdefghi"]);
    expect(a2!.teks).toMatch(/i\. masa kerja 8 \(delapan\) tahun atau lebih, 9 \(sembilan\) bulan Upah\.$/);
    // Ayat (3) UPMK huruf a–h, maks. 10 bulan Upah.
    expect(huruf(a3!.teks)).toEqual([..."abcdefgh"]);
    expect(a3!.teks).toMatch(/h\. masa kerja 24 \(dua puluh empat\) tahun atau lebih, 10 \(sepuluh\) bulan Upah\.$/);
    // Ayat (4) penggantian hak huruf a–c.
    expect(huruf(a4!.teks)).toEqual([..."abc"]);
  });

  it("bunyi asli UU 13/2003 tetap tersimpan sebagai Versi Pasal lama", async () => {
    const p = (await pasal13("156"))!;
    const id13 = await idPeraturan("13", 2003);
    expect(p.versi).toHaveLength(2);
    const lama = p.versi.find((v) => v.sumberPeraturanId === id13)!;
    expect(lama).toMatchObject({ rujukan: "Pasal 156", asalTeks: "digital", halaman: [61, 62] });
    expect(lama.ayat[0]!.teks).toMatch(/^Dalam hal terjadi pemutusan hubungan kerja, pengusaha diwajibkan membayar/);
  });

  it("Catatan Perubahan Pasal 156 menunjukkan Ayat yang berbeda dari versi sebelumnya", async () => {
    const p = (await pasal13("156"))!;
    const v = (await versiDari6("156"))!;
    expect(p.catatan).toEqual([
      expect.objectContaining({
        pengubahPeraturanId: await idPeraturan("6", 2023),
        versiPasalId: v.id,
        rujukan: "Lampiran, Pasal 81 angka 47",
        jenis: "ubah",
        cakupan: "pasal-utuh",
        // Kelima Ayat ditulis ulang ("dan atau" → "dan/atau", besaran pesangon, rujukan PP).
        ayatTerdampak: ["1", "2", "3", "4", "5"],
        ayatBaru: [],
      }),
    ]);
  });

  it("setiap Pasal yang diubah punya Catatan Perubahan yang menunjuk Versi Pasal barunya dan Ayat terdampaknya", async () => {
    const id13 = await idPeraturan("13", 2003);
    const id6 = await idPeraturan("6", 2023);
    const versiBaru = await db
      .select({ id: s.versiPasal.id, rujukan: s.versiPasal.rujukan })
      .from(s.versiPasal)
      .innerJoin(s.pasal, eq(s.pasal.id, s.versiPasal.pasalId))
      .where(and(eq(s.pasal.peraturanId, id13), eq(s.versiPasal.sumberPeraturanId, id6)));
    expect(versiBaru.length).toBeGreaterThan(40);
    const catatan = await db.select().from(s.catatanPerubahan).where(eq(s.catatanPerubahan.pengubahPeraturanId, id6));
    for (const v of versiBaru) {
      const c = catatan.find((x) => x.versiPasalId === v.id);
      expect(c, v.rujukan).toBeDefined();
      expect(c!.rujukan).toBe(v.rujukan);
      // Pasal tanpa Ayat bernomor (mis. Pasal 49, angka 11) tidak punya nomor Ayat untuk ditunjuk.
      const bernomor = await db.$count(s.ayat, and(eq(s.ayat.versiPasalId, v.id), isNotNull(s.ayat.nomor)));
      if (bernomor) expect(c!.ayatTerdampak.length, v.rujukan).toBeGreaterThan(0);
      else expect(c!.ayatTerdampak, v.rujukan).toEqual([]);
    }
  });

  it("Pasal 154A ada sebagai Pasal Sisipan (angka 45), urut di antara Pasal 154 dan Pasal 155", async () => {
    const p = (await pasal13("154A"))!;
    expect(p.pasal.sisipan).toBe(true);
    expect(p.versi).toHaveLength(1);
    expect(p.versi[0]).toMatchObject({ rujukan: "Lampiran, Pasal 81 angka 45", asalTeks: "ocr", sumberPeraturanId: await idPeraturan("6", 2023) });
    expect(p.versi[0]!.ayat.map((a) => a.nomor)).toEqual(["1", "2", "3"]);
    // Butir "1." alasan PHK di dalam Pasal 154A bukan angka perubahan.
    expect(p.versi[0]!.ayat[0]!.teks).toContain("\n1. menganiaya, menghina secara kasar atau mengancam Pekerja/ Buruh;");
    expect(p.catatan).toEqual([expect.objectContaining({ jenis: "sisip", cakupan: "pasal-utuh", rujukan: "Lampiran, Pasal 81 angka 45", ayatTerdampak: ["1", "2", "3"] })]);
    const urutan = await Promise.all(["154", "154A", "155"].map(async (n) => (await pasal13(n))!.pasal.urutan));
    expect(urutan[0]).toBeLessThan(urutan[1]!);
    expect(urutan[1]).toBeLessThan(urutan[2]!);
  });

  it("Pasal yang dihapus mendapat Catatan Perubahan hapus; bunyi aslinya tetap tersimpan", async () => {
    const p = (await pasal13("155"))!;
    expect(p.versi).toHaveLength(1);
    expect(p.versi[0]!.rujukan).toBe("Pasal 155");
    expect(p.catatan).toEqual([
      expect.objectContaining({ jenis: "hapus", cakupan: "pasal-utuh", versiPasalId: null, rujukan: "Lampiran, Pasal 81 angka 46", ayatTerdampak: ["1", "2", "3"] }),
    ]);
  });

  it("angka 37 dan 38 yang menempel di akhir angka 36 (OCR tanpa baris baru) tercatat sendiri-sendiri", async () => {
    // Teks OCR: "... pemegang hak jaminan kebendaan. 37 Pasal 96 dihapus. 38 Pasal 97 dihapus."
    for (const [nomor, angka] of [["96", 37], ["97", 38]] as const) {
      const p = (await pasal13(nomor))!;
      expect(p.catatan).toEqual([expect.objectContaining({ jenis: "hapus", cakupan: "pasal-utuh", rujukan: `Lampiran, Pasal 81 angka ${angka}` })]);
    }
    const v95 = (await versiDari6("95"))!;
    expect(v95.rujukan).toBe("Lampiran, Pasal 81 angka 36");
    expect(v95.ayat.map((a) => a.nomor)).toEqual(["1", "2", "3"]);
    expect(v95.ayat[2]!.teks).toMatch(/kecuali para kreditur pemegang hak jaminan kebendaan\.$/);
    expect(v95.ayat.map((a) => a.teks).join("\n")).not.toMatch(/Pasal 9[67] dihapus/);
  });

  it("70 dari 71 angka Pasal 81 dikenali; angka 21 (judul Paragraf) ada di antrean tinjauan manual", async () => {
    const id6 = await idPeraturan("6", 2023);
    const catatan = await db.select().from(s.catatanPerubahan).where(eq(s.catatanPerubahan.pengubahPeraturanId, id6));
    const angka = new Set(catatan.map((c) => c.rujukan.match(/^Lampiran, Pasal 81 angka (\d+)$/)?.[1]));
    expect(angka.has(undefined)).toBe(false);
    expect(angka.size).toBe(70);
    expect(angka.has("21")).toBe(false);
    const tinjauan = await db
      .select()
      .from(s.catatanTinjauan)
      .where(and(eq(s.catatanTinjauan.peraturanId, id6), inArray(s.catatanTinjauan.jenis, ["perubahan-tak-dikenali", "angka-tidak-urut", "judul-isi-beda", "sisip-bab", "penjelasan-diubah"])));
    const pasal81 = tinjauan.filter((t) => t.pesan.startsWith("Lampiran, Pasal 81 "));
    expect(pasal81.map((t) => [t.jenis, t.pesan.match(/^Lampiran, Pasal 81 angka \d+/)?.[0]])).toEqual([["perubahan-tak-dikenali", "Lampiran, Pasal 81 angka 21"]]);
  });

  it("Ayat (5) Pasal 160 tetap di Pasal 160, tidak masuk ke Pasal 185", async () => {
    const p160 = (await versiDari6("160"))!;
    expect(p160.ayat.map((a) => a.nomor)).toEqual(["1", "2", "3", "4", "5"]);
    expect(p160.ayat[4]!.teks).toMatch(/^Dalam hal pengadilan memutuskan perkara pidana sebelum masa 6 \(enam\) bulan berakhir dan Pekerja\/Buruh dinyatakan bersalah/);
    const p185 = (await versiDari6("185"))!;
    expect(p185.ayat.map((a) => a.nomor)).toEqual(["1", "2"]);
    expect(p185.ayat.map((a) => a.teks).join("\n")).not.toContain("dinyatakan bersalah");
  });

  it("salah baca OCR yang tidak aman dikoreksi ditandai ocr-ragu tanpa menyembunyikan Versi Pasal", async () => {
    const id6 = await idPeraturan("6", 2023);
    const ragu = await db.select().from(s.catatanTinjauan).where(and(eq(s.catatanTinjauan.peraturanId, id6), eq(s.catatanTinjauan.jenis, "ocr-ragu")));
    const v190 = (await versiDari6("190"))!;
    expect(v190.perluTinjauan).toBe(false);
    expect(ragu.filter((t) => t.versiPasalId === v190.id).map((t) => t.pesan)).toContainEqual(expect.stringContaining("Pasal t4"));
    // Teks tidak diganti: "Pasal t4" tetap seperti di PDF.
    expect(v190.ayat[0]!.teks).toContain("Pasal t4 ayat (1)");
    // "(21," di tengah Ayat (5) Pasal 156 adalah rujukan, bukan judul Ayat: tidak diganti, ditandai.
    const v156 = (await versiDari6("156"))!;
    expect(v156.ayat[4]!.teks).toContain("ayat (21, ayat (3)");
    expect(ragu.filter((t) => t.versiPasalId === v156.id).map((t) => t.pesan)).toContainEqual(expect.stringContaining("(21,"));
  });
});

describe("ingest ulang berurutan 13/2003 → 6/2023 → 13/2003 → 6/2023", () => {
  async function hitung() {
    const [id13, id6] = [await idPeraturan("13", 2003), await idPeraturan("6", 2023)];
    return {
      pasal13: await db.$count(s.pasal, eq(s.pasal.peraturanId, id13)),
      versiPasal: await db.$count(s.versiPasal),
      catatanPerubahan: await db.$count(s.catatanPerubahan),
      ayatPerubahan: await db.$count(s.ayatPerubahan),
      relasi: await db.$count(s.relasiPeraturan),
      tinjauan13: await db.$count(s.catatanTinjauan, eq(s.catatanTinjauan.peraturanId, id13)),
      tinjauan6: await db.$count(s.catatanTinjauan, eq(s.catatanTinjauan.peraturanId, id6)),
    };
  }

  it("menghasilkan jumlah yang sama seperti satu kali jalan, dan Pasal 154A tetap ada", async () => {
    const sekali = await hitung();
    expect(sekali.catatanPerubahan).toBeGreaterThan(0);
    expect(sekali.relasi).toBe(1);

    await jalankan(uu13);
    // Ingest ulang Peraturan yang diubah tidak membuang Pasal Sisipan dan Catatan Perubahan dari Peraturan Pengubah.
    expect(await pasal13("154A")).not.toBeNull();
    expect(await hitung()).toEqual(sekali);

    await jalankan(uu6);
    expect(await hitung()).toEqual(sekali);
    expect((await pasal13("154A"))!.pasal.sisipan).toBe(true);
    expect((await versiDari6("156"))!.rujukan).toBe("Lampiran, Pasal 81 angka 47");
  });
});
