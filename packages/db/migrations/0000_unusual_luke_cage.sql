CREATE TYPE "public"."asal_teks" AS ENUM('digital', 'ocr');--> statement-breakpoint
CREATE TYPE "public"."jenis_tinjauan" AS ENUM('pasal-loncat', 'ayat-tidak-urut', 'penjelasan-tak-tertaut');--> statement-breakpoint
CREATE TABLE "ayat" (
	"id" serial PRIMARY KEY NOT NULL,
	"versi_pasal_id" integer NOT NULL,
	"urutan" integer NOT NULL,
	"nomor" text,
	"teks" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "berkas_sumber" (
	"id" serial PRIMARY KEY NOT NULL,
	"peraturan_id" integer NOT NULL,
	"url" text NOT NULL,
	"halaman_detail" text,
	"diambil_pada" timestamp with time zone NOT NULL,
	"sha256" text NOT NULL,
	"path" text NOT NULL,
	"ukuran" integer NOT NULL,
	CONSTRAINT "berkas_sumber_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "catatan_tinjauan" (
	"id" serial PRIMARY KEY NOT NULL,
	"peraturan_id" integer NOT NULL,
	"versi_pasal_id" integer,
	"jenis" "jenis_tinjauan" NOT NULL,
	"pesan" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pasal" (
	"id" serial PRIMARY KEY NOT NULL,
	"peraturan_id" integer NOT NULL,
	"nomor" text NOT NULL,
	"urutan" integer NOT NULL,
	"sisipan" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pasal_peraturan_id_nomor_unique" UNIQUE("peraturan_id","nomor")
);
--> statement-breakpoint
CREATE TABLE "penjelasan" (
	"id" serial PRIMARY KEY NOT NULL,
	"versi_pasal_id" integer NOT NULL,
	"teks" text NOT NULL,
	CONSTRAINT "penjelasan_versi_pasal_id_unique" UNIQUE("versi_pasal_id")
);
--> statement-breakpoint
CREATE TABLE "peraturan" (
	"id" serial PRIMARY KEY NOT NULL,
	"jenis" text NOT NULL,
	"nomor" text NOT NULL,
	"tahun" integer NOT NULL,
	"judul" text NOT NULL,
	"asal_teks" "asal_teks" NOT NULL,
	CONSTRAINT "peraturan_jenis_nomor_tahun_unique" UNIQUE("jenis","nomor","tahun")
);
--> statement-breakpoint
CREATE TABLE "versi_pasal" (
	"id" serial PRIMARY KEY NOT NULL,
	"pasal_id" integer NOT NULL,
	"sumber_peraturan_id" integer NOT NULL,
	"rujukan" text NOT NULL,
	"halaman" integer[] NOT NULL,
	"asal_teks" "asal_teks" NOT NULL,
	"perlu_tinjauan" boolean DEFAULT false NOT NULL,
	CONSTRAINT "versi_pasal_pasal_id_sumber_peraturan_id_unique" UNIQUE("pasal_id","sumber_peraturan_id")
);
--> statement-breakpoint
ALTER TABLE "ayat" ADD CONSTRAINT "ayat_versi_pasal_id_versi_pasal_id_fk" FOREIGN KEY ("versi_pasal_id") REFERENCES "public"."versi_pasal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "berkas_sumber" ADD CONSTRAINT "berkas_sumber_peraturan_id_peraturan_id_fk" FOREIGN KEY ("peraturan_id") REFERENCES "public"."peraturan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catatan_tinjauan" ADD CONSTRAINT "catatan_tinjauan_peraturan_id_peraturan_id_fk" FOREIGN KEY ("peraturan_id") REFERENCES "public"."peraturan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catatan_tinjauan" ADD CONSTRAINT "catatan_tinjauan_versi_pasal_id_versi_pasal_id_fk" FOREIGN KEY ("versi_pasal_id") REFERENCES "public"."versi_pasal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pasal" ADD CONSTRAINT "pasal_peraturan_id_peraturan_id_fk" FOREIGN KEY ("peraturan_id") REFERENCES "public"."peraturan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penjelasan" ADD CONSTRAINT "penjelasan_versi_pasal_id_versi_pasal_id_fk" FOREIGN KEY ("versi_pasal_id") REFERENCES "public"."versi_pasal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versi_pasal" ADD CONSTRAINT "versi_pasal_pasal_id_pasal_id_fk" FOREIGN KEY ("pasal_id") REFERENCES "public"."pasal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versi_pasal" ADD CONSTRAINT "versi_pasal_sumber_peraturan_id_peraturan_id_fk" FOREIGN KEY ("sumber_peraturan_id") REFERENCES "public"."peraturan"("id") ON DELETE cascade ON UPDATE no action;