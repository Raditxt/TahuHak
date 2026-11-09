CREATE TYPE "public"."bagian_pasal" AS ENUM('batang', 'lampiran');--> statement-breakpoint
CREATE TYPE "public"."penilaian_teks" AS ENUM('digital', 'ocr-layak', 'perlu-ocr');--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'penjelasan-tidak-ditemukan';--> statement-breakpoint
ALTER TYPE "public"."jenis_tinjauan" ADD VALUE 'judul-pasal-ditebak';--> statement-breakpoint
ALTER TABLE "pasal" DROP CONSTRAINT "pasal_peraturan_id_nomor_unique";--> statement-breakpoint
ALTER TABLE "berkas_sumber" ADD COLUMN "penilaian_teks" "penilaian_teks";--> statement-breakpoint
ALTER TABLE "berkas_sumber" ADD COLUMN "kata_aneh_per_1000" real;--> statement-breakpoint
ALTER TABLE "pasal" ADD COLUMN "bagian" "bagian_pasal" DEFAULT 'batang' NOT NULL;--> statement-breakpoint
ALTER TABLE "pasal" ADD CONSTRAINT "pasal_peraturan_id_bagian_nomor_unique" UNIQUE("peraturan_id","bagian","nomor");