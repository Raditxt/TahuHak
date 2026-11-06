// Seam A: UU 13/2003 dari JDIH BPK → isi database. Tes hanya membaca database, tidak memanggil fungsi parser.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ingest } from "../src/ingest.ts";
import { DIR_DATA_TES, dbTes, fetchTiruan, muatSumber, unduhFixture } from "./bantu.ts";
import { bacaIsi } from "./isi-db.ts";

const meta = muatSumber("uu-13-2003");
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

describe("ingest UU 13/2003", () => {
  it("menyimpan Peraturan dengan Asal Teks digital", async () => {
    const rows = await db.select().from(schema.peraturan);
    expect(rows).toEqual([
      expect.objectContaining({ jenis: "UU", nomor: "13", tahun: 2003, judul: "Ketenagakerjaan", asalTeks: "digital" }),
    ]);
  });

  it("menyimpan PDF asli, URL, dan tanggal ambil", async () => {
    const [p] = await db.select().from(schema.peraturan);
    const berkas = await db.select().from(schema.berkasSumber).where(eq(schema.berkasSumber.peraturanId, p!.id));
    expect(berkas).toHaveLength(1);
    const b = berkas[0]!;
    expect(b.url).toBe(meta.url);
    expect(b.halamanDetail).toBe(meta.halamanDetail);
    expect(Date.now() - b.diambilPada.getTime()).toBeLessThan(10 * 60_000);
    expect(b.sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    expect(existsSync(b.path)).toBe(true);
    expect(new Uint8Array(readFileSync(b.path))).toEqual(pdf);
  });

  it("menyimpan 193 Pasal, urut 1 sampai 193", async () => {
    const rows = await db.select().from(schema.pasal).orderBy(schema.pasal.urutan);
    // UU 13/2003 asli: Pasal 1–193, tanpa Pasal Sisipan.
    expect(rows.map((r) => r.nomor)).toEqual(Array.from({ length: 193 }, (_, i) => String(i + 1)));
    expect(rows.every((r) => !r.sisipan)).toBe(true);
  });

  it("memecah Pasal 156 menjadi Ayat (1)–(5) sesuai PDF", async () => {
    const ayat = await ayatPasal("156");
    expect(ayat.map((a) => a.nomor)).toEqual(["1", "2", "3", "4", "5"]);
    expect(ayat[0]!.teks).toBe(
      "Dalam hal terjadi pemutusan hubungan kerja, pengusaha diwajibkan membayar uang pesangon dan atau uang penghargaan masa kerja dan uang penggantian hak yang seharusnya diterima.",
    );
    // Baris "(2), ayat (3), ..." di hal. 62 adalah lanjutan "dimaksud dalam ayat", bukan Ayat baru.
    expect(ayat[4]!.teks).toContain("sebagaimana dimaksud dalam ayat (2), ayat (3), dan ayat (4) ditetapkan dengan Peraturan Pemerintah");
  });

  it("menyimpan Pasal tanpa Ayat bernomor sebagai satu Ayat tanpa nomor, butir di baris sendiri", async () => {
    const ayat = await ayatPasal("1");
    expect(ayat).toHaveLength(1);
    expect(ayat[0]!.nomor).toBeNull();
    expect(ayat[0]!.teks.split("\n").slice(0, 2)).toEqual([
      "Dalam undang undang ini yang dimaksud dengan :",
      "1. Ketenagakerjaan adalah segala hal yang berhubungan dengan tenaga kerja pada waktu sebelum, selama, dan sesudah masa kerja.",
    ]);
  });

  it("menyimpan bunyi asli sebagai Versi Pasal bersumber UU 13/2003 sendiri, Asal Teks digital", async () => {
    const [p] = await db.select().from(schema.peraturan);
    const versi = await db.select().from(schema.versiPasal);
    expect(versi).toHaveLength(193);
    expect(versi.every((v) => v.sumberPeraturanId === p!.id && v.asalTeks === "digital")).toBe(true);
    expect(versi.find((v) => v.rujukan === "Pasal 156")?.halaman).toEqual([61, 62]);
  });

  it("menautkan 193 Penjelasan, satu ke tiap Versi Pasal", async () => {
    const versi = await db.select({ id: schema.versiPasal.id }).from(schema.versiPasal);
    const pj = await db.select().from(schema.penjelasan);
    expect(new Set(pj.map((x) => x.versiPasalId))).toEqual(new Set(versi.map((v) => v.id)));
    expect(await penjelasanPasal("1")).toBe("Cukup jelas");
    expect(await penjelasanPasal("193")).toBe("Cukup jelas"); // tanpa "TAMBAHAN LEMBARAN NEGARA ..."
    expect((await penjelasanPasal("51")).split("\n").slice(0, 2)).toEqual([
      "Ayat (1)",
      "Pada prinsipnya perjanjian kerja dibuat secara tertulis, namun melihat kondisi masyarakat yang beragam dimungkinkan perjanjian kerja secara lisan.",
    ]);
  });
});

// Gagasan cek-bocor dari prototype #2: sisa header, nomor halaman, footer, atau kata sambung di teks yang tersimpan.
const POLA_BOCOR: [string, RegExp][] = [
  ["header PRESIDEN", /(^|\n)PRESIDEN( REPUBLIK INDONESIA)?(\n|$)|\bREPUBLIK INDONESIA$/m],
  ["nomor halaman", /(^|\s)[-_~]\s?\d{1,3}\s?[-_~](\s|$)/],
  ["footer salinan", /SK\s*No\.?\s*\d{4,}/i],
  ["kata sambung", /…|\.\.\.|(\.\s){2,}/],
  ["SALINAN", /\bSALINAN\b/],
  ["penutup Lembaran Negara", /TAMBAHAN LEMBARAN NEGARA/],
];

describe("cek-bocor UU 13/2003", () => {
  it("tidak ada header, nomor halaman, footer, atau kata sambung di teks Ayat dan Penjelasan", async () => {
    const teks = [
      ...(await db.select({ t: schema.ayat.teks }).from(schema.ayat)),
      ...(await db.select({ t: schema.penjelasan.teks }).from(schema.penjelasan)),
    ].map((r) => r.t);
    expect(teks.length).toBeGreaterThan(193);
    const temuan = teks.flatMap((t) =>
      POLA_BOCOR.flatMap(([nama, re]) => {
        const m = t.match(re);
        return m ? [`${nama}: …${t.slice(Math.max(0, m.index! - 40), m.index! + 40)}…`] : [];
      }),
    );
    expect(temuan).toEqual([]);
  });
});

describe("snapshot Seam A UU 13/2003", () => {
  // Dibekukan 6 Nov 2026 setelah pengembang mencocokkan Pasal 1, 156, 193, dan Penjelasan Pasal 151 dengan PDF resmi.
  // Bila snapshot berubah, tinjau ulang dengan scripts/sampel-tinjauan.ts sebelum memperbaruinya (vitest -u).
  it("isi database sama dengan snapshot yang sudah ditinjau", async () => {
    const isi = await bacaIsi(db, "UU", "13", 2003);
    await expect(JSON.stringify(isi, null, 2) + "\n").toMatchFileSnapshot("__snapshots__/uu-13-2003.isi.json");
  });
});

describe("ingest ulang UU 13/2003", () => {
  it("tidak menggandakan data dan isinya tetap sama", async () => {
    const sebelum = await bacaIsi(db, "UU", "13", 2003);
    const jumlahSebelum = await jumlahBaris();
    await jalankan();
    expect(await jumlahBaris()).toEqual(jumlahSebelum);
    expect(await bacaIsi(db, "UU", "13", 2003)).toEqual(sebelum);
  });
});

async function jumlahBaris() {
  const s = schema;
  const n = async (t: Parameters<typeof db.$count>[0]) => db.$count(t);
  return {
    peraturan: await n(s.peraturan), berkas: await n(s.berkasSumber), pasal: await n(s.pasal),
    versi: await n(s.versiPasal), ayat: await n(s.ayat), penjelasan: await n(s.penjelasan), tinjauan: await n(s.catatanTinjauan),
  };
}

async function penjelasanPasal(nomor: string) {
  const [ps] = await db.select().from(schema.pasal).where(eq(schema.pasal.nomor, nomor));
  const [v] = await db.select().from(schema.versiPasal).where(eq(schema.versiPasal.pasalId, ps!.id));
  const [pj] = await db.select().from(schema.penjelasan).where(eq(schema.penjelasan.versiPasalId, v!.id));
  return pj?.teks ?? "";
}

async function ayatPasal(nomor: string) {
  const [ps] = await db.select().from(schema.pasal).where(eq(schema.pasal.nomor, nomor));
  const [v] = await db.select().from(schema.versiPasal).where(eq(schema.versiPasal.pasalId, ps!.id));
  return db.select().from(schema.ayat).where(eq(schema.ayat.versiPasalId, v!.id)).orderBy(schema.ayat.urutan);
}
