CREATE TYPE "public"."cakupan_perubahan" AS ENUM('pasal-utuh', 'ayat-saja');--> statement-breakpoint
CREATE TYPE "public"."jenis_perubahan" AS ENUM('ubah', 'sisip', 'hapus');--> statement-breakpoint
CREATE TYPE "public"."jenis_relasi" AS ENUM('mengubah');--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'perubahan-tak-dikenali';--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'penjelasan-diubah';--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'sisip-bab';--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'angka-tidak-urut';--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'judul-isi-beda';--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'ocr-ragu';--> statement-breakpoint
CREATE TABLE "ayat_perubahan" (
	"id" serial PRIMARY KEY NOT NULL,
	"catatan_perubahan_id" integer NOT NULL,
	"urutan" integer NOT NULL,
	"nomor" text,
	"teks" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catatan_perubahan" (
	"id" serial PRIMARY KEY NOT NULL,
	"pasal_id" integer NOT NULL,
	"pengubah_peraturan_id" integer NOT NULL,
	"versi_pasal_id" integer,
	"rujukan" text NOT NULL,
	"halaman" integer[] NOT NULL,
	"jenis" "jenis_perubahan" NOT NULL,
	"cakupan" "cakupan_perubahan" NOT NULL,
	"ayat_terdampak" text[] NOT NULL,
	CONSTRAINT "catatan_perubahan_pasal_id_pengubah_peraturan_id_rujukan_unique" UNIQUE("pasal_id","pengubah_peraturan_id","rujukan")
);
--> statement-breakpoint
CREATE TABLE "relasi_peraturan" (
	"id" serial PRIMARY KEY NOT NULL,
	"sumber_peraturan_id" integer NOT NULL,
	"sasaran_peraturan_id" integer NOT NULL,
	"jenis" "jenis_relasi" NOT NULL,
	CONSTRAINT "relasi_peraturan_sumber_peraturan_id_sasaran_peraturan_id_jenis_unique" UNIQUE("sumber_peraturan_id","sasaran_peraturan_id","jenis")
);
--> statement-breakpoint
ALTER TABLE "ayat_perubahan" ADD CONSTRAINT "ayat_perubahan_catatan_perubahan_id_catatan_perubahan_id_fk" FOREIGN KEY ("catatan_perubahan_id") REFERENCES "public"."catatan_perubahan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catatan_perubahan" ADD CONSTRAINT "catatan_perubahan_pasal_id_pasal_id_fk" FOREIGN KEY ("pasal_id") REFERENCES "public"."pasal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catatan_perubahan" ADD CONSTRAINT "catatan_perubahan_pengubah_peraturan_id_peraturan_id_fk" FOREIGN KEY ("pengubah_peraturan_id") REFERENCES "public"."peraturan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catatan_perubahan" ADD CONSTRAINT "catatan_perubahan_versi_pasal_id_versi_pasal_id_fk" FOREIGN KEY ("versi_pasal_id") REFERENCES "public"."versi_pasal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relasi_peraturan" ADD CONSTRAINT "relasi_peraturan_sumber_peraturan_id_peraturan_id_fk" FOREIGN KEY ("sumber_peraturan_id") REFERENCES "public"."peraturan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relasi_peraturan" ADD CONSTRAINT "relasi_peraturan_sasaran_peraturan_id_peraturan_id_fk" FOREIGN KEY ("sasaran_peraturan_id") REFERENCES "public"."peraturan"("id") ON DELETE cascade ON UPDATE no action;