// Skema Seam A (issue #4, #6, #7): Peraturan, Berkas Sumber, Pasal, Versi Pasal, Ayat, Penjelasan, Catatan Tinjauan,
// Relasi Peraturan, Catatan Perubahan, Ayat Perubahan.
// Istilah mengikuti GLOSSARY.md. Teks Pasal disimpan per Versi Pasal (ADR-0001), bukan di Pasal.
import { boolean, integer, pgEnum, pgTable, real, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const asalTeks = pgEnum("asal_teks", ["digital", "ocr"]);
/** digital: teks asli PDF. ocr-layak: lapisan OCR bawaan dipakai apa adanya. perlu-ocr: masuk antrean OCR laptop (ADR-0003). */
export const penilaianTeks = pgEnum("penilaian_teks", ["digital", "ocr-layak", "perlu-ocr"]);
/** batang: batang tubuh Peraturan. lampiran: Peraturan lain yang dilampirkan (Lampiran UU 6/2023 = teks Perppu 2/2022). */
export const bagianPasal = pgEnum("bagian_pasal", ["batang", "lampiran"]);

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
  /** Hasil Detektor Asal Teks atas berkas ini. Null hanya untuk berkas yang diambil sebelum detektor ada (#6); ingest ulang mengisinya. */
  penilaianTeks: penilaianTeks("penilaian_teks"),
  kataAnehPer1000: real("kata_aneh_per_1000"),
});

/** Identitas Pasal di Peraturan tempatnya berada (mis. Pasal 156 UU 13/2003). Bunyinya ada di Versi Pasal. */
export const pasal = pgTable(
  "pasal",
  {
    id: serial("id").primaryKey(),
    peraturanId: integer("peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
    bagian: bagianPasal("bagian").notNull().default("batang"),
    nomor: text("nomor").notNull(), // "156", "154A"
    urutan: integer("urutan").notNull(),
    sisipan: boolean("sisipan").notNull().default(false),
  },
  (t) => [unique().on(t.peraturanId, t.bagian, t.nomor)],
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

export const jenisTinjauan = pgEnum("jenis_tinjauan", [
  "pasal-loncat",
  "ayat-tidak-urut",
  "penjelasan-tak-tertaut",
  "penjelasan-tidak-ditemukan",
  "judul-pasal-ditebak",
  // Parser Perubahan (#7): angka perubahan yang tidak diterapkan otomatis.
  "perubahan-tak-dikenali", // pola tidak dikenali, mis. judul BAB/Bagian/Paragraf diubah
  "penjelasan-diubah", // apakah Penjelasan punya versi belum diputuskan
  "sisip-bab", // sisip BAB sekaligus Pasal; aturan penerapannya menunggu Peraturan sasarannya diingest
  "angka-tidak-urut",
  "judul-isi-beda", // judul Pasal di isi kutipan tidak sama dengan Pasal sasaran di kalimat pembuka
  // Teks yang mungkin salah baca OCR tetapi tidak aman dikoreksi otomatis. Tidak menyembunyikan Versi Pasal.
  "ocr-ragu",
]);

/** Hasil parse janggal yang perlu ditinjau manual. */
export const catatanTinjauan = pgTable("catatan_tinjauan", {
  id: serial("id").primaryKey(),
  peraturanId: integer("peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
  versiPasalId: integer("versi_pasal_id").references(() => versiPasal.id, { onDelete: "cascade" }),
  jenis: jenisTinjauan("jenis").notNull(),
  pesan: text("pesan").notNull(),
});

export const jenisRelasi = pgEnum("jenis_relasi", ["mengubah"]);

/** Hubungan antar-Peraturan, mis. UU 6/2023 mengubah UU 13/2003. */
export const relasiPeraturan = pgTable(
  "relasi_peraturan",
  {
    id: serial("id").primaryKey(),
    sumberPeraturanId: integer("sumber_peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
    sasaranPeraturanId: integer("sasaran_peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
    jenis: jenisRelasi("jenis").notNull(),
  },
  (t) => [unique().on(t.sumberPeraturanId, t.sasaranPeraturanId, t.jenis)],
);

export const jenisPerubahan = pgEnum("jenis_perubahan", ["ubah", "sisip", "hapus"]);
export const cakupanPerubahan = pgEnum("cakupan_perubahan", ["pasal-utuh", "ayat-saja"]);

/**
 * Keterangan pada sebuah Pasal: Ayat mana yang diubah dan oleh Peraturan Pengubah mana (satu angka perubahan).
 * "Sejak kapan" menunggu tanggal berlaku Peraturan (#10) dan diambil dari Peraturan Pengubah, tidak disimpan di sini.
 */
export const catatanPerubahan = pgTable(
  "catatan_perubahan",
  {
    id: serial("id").primaryKey(),
    pasalId: integer("pasal_id").notNull().references(() => pasal.id, { onDelete: "cascade" }),
    pengubahPeraturanId: integer("pengubah_peraturan_id").notNull().references(() => peraturan.id, { onDelete: "cascade" }),
    /** Versi Pasal yang lahir dari perubahan ini (ubah/sisip pasal-utuh). Null untuk ayat-saja dan hapus. */
    versiPasalId: integer("versi_pasal_id").references(() => versiPasal.id, { onDelete: "cascade" }),
    rujukan: text("rujukan").notNull(), // "Lampiran, Pasal 81 angka 47"
    halaman: integer("halaman").array().notNull(),
    jenis: jenisPerubahan("jenis").notNull(),
    cakupan: cakupanPerubahan("cakupan").notNull(),
    /** Nomor Ayat yang diubah/disisipkan/dihapus. Pasal-utuh: hasil perbandingan dengan versi sebelumnya. Ayat-saja: dari kalimat pembuka. */
    ayatTerdampak: text("ayat_terdampak").array().notNull(),
  },
  (t) => [unique().on(t.pasalId, t.pengubahPeraturanId, t.rujukan)],
);

/** Bunyi Ayat baru pada Catatan Perubahan ayat-saja (ubah/sisip). Meniru tabel ayat supaya bisa ikut pencarian teks (#15). */
export const ayatPerubahan = pgTable("ayat_perubahan", {
  id: serial("id").primaryKey(),
  catatanPerubahanId: integer("catatan_perubahan_id").notNull().references(() => catatanPerubahan.id, { onDelete: "cascade" }),
  urutan: integer("urutan").notNull(),
  nomor: text("nomor"),
  teks: text("teks").notNull(),
});
