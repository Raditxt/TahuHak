// Skema awal (issue #4): Peraturan, Berkas Sumber, Pasal, Versi Pasal, Ayat, Penjelasan, Catatan Tinjauan.
// Istilah mengikuti GLOSSARY.md. Teks Pasal disimpan per Versi Pasal (ADR-0001), bukan di Pasal.
import { boolean, integer, pgEnum, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const asalTeks = pgEnum("asal_teks", ["digital", "ocr"]);

export const peraturan = pgTable(
  "peraturan",
  {
    id: serial("id").primaryKey(),
    jenis: text("jenis").notNull(), // "UU", "PP", "Perda", ...
    nomor: text("nomor").notNull(),
    tahun: integer("tahun").notNull(),
    judul: text("judul").notNull(),
    asalTeks: asalTeks("asal_teks").notNull(),
  },
  (t) => [unique().on(t.jenis, t.nomor, t.tahun)],
);

/** PDF asli yang diambil Pengambil Sumber. Berkasnya di disk (data/sumber/), bukan di database (ADR-0005: Postgres 400 MB). */
export const berkasSumber = pgTable("berkas_sumber", {
  id: serial("id").primaryKey(),
  peraturanId: integer("peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  halamanDetail: text("halaman_detail"),
  diambilPada: timestamp("diambil_pada", { withTimezone: true }).notNull(),
  sha256: text("sha256").notNull().unique(),
  path: text("path").notNull(),
  ukuran: integer("ukuran").notNull(),
});

/** Identitas Pasal di Peraturan tempatnya berada (mis. Pasal 156 UU 13/2003). Bunyinya ada di Versi Pasal. */
export const pasal = pgTable(
  "pasal",
  {
    id: serial("id").primaryKey(),
    peraturanId: integer("peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
    nomor: text("nomor").notNull(), // "156", "154A"
    urutan: integer("urutan").notNull(),
    sisipan: boolean("sisipan").notNull().default(false),
  },
  (t) => [unique().on(t.peraturanId, t.nomor)],
);

/** Bunyi Pasal persis seperti di satu Peraturan sumber. Untuk bunyi asli, sumbernya Peraturan itu sendiri. */
export const versiPasal = pgTable(
  "versi_pasal",
  {
    id: serial("id").primaryKey(),
    pasalId: integer("pasal_id").notNull().references(() => pasal.id, { onDelete: "cascade" }),
    sumberPeraturanId: integer("sumber_peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
    rujukan: text("rujukan").notNull(), // "Pasal 156" atau "Lampiran, Pasal 81 angka 47"
    halaman: integer("halaman").array().notNull(),
    asalTeks: asalTeks("asal_teks").notNull(),
    /** Ditandai bila hasil parse janggal. Tidak boleh tampil ke pengguna sampai ditinjau. */
    perluTinjauan: boolean("perlu_tinjauan").notNull().default(false),
  },
  (t) => [unique().on(t.pasalId, t.sumberPeraturanId)],
);

export const ayat = pgTable("ayat", {
  id: serial("id").primaryKey(),
  versiPasalId: integer("versi_pasal_id").notNull().references(() => versiPasal.id, { onDelete: "cascade" }),
  urutan: integer("urutan").notNull(),
  nomor: text("nomor"), // null untuk Pasal tanpa Ayat bernomor
  teks: text("teks").notNull(),
});

/** Penjelasan Pasal demi Pasal, tertaut ke Versi Pasal dari Peraturan yang sama. */
export const penjelasan = pgTable("penjelasan", {
  id: serial("id").primaryKey(),
  versiPasalId: integer("versi_pasal_id").notNull().unique().references(() => versiPasal.id, { onDelete: "cascade" }),
  teks: text("teks").notNull(),
});

export const jenisTinjauan = pgEnum("jenis_tinjauan", ["pasal-loncat", "ayat-tidak-urut", "penjelasan-tak-tertaut"]);

/** Hasil parse janggal yang perlu ditinjau manual. */
export const catatanTinjauan = pgTable("catatan_tinjauan", {
  id: serial("id").primaryKey(),
  peraturanId: integer("peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
  versiPasalId: integer("versi_pasal_id").references(() => versiPasal.id, { onDelete: "cascade" }),
  jenis: jenisTinjauan("jenis").notNull(),
  pesan: text("pesan").notNull(),
});
