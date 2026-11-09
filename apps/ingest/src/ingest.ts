// Seam A: satu Peraturan dari sumber → isi database. Aman dijalankan ulang: baris di-upsert menurut kunci alaminya.
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { ambilPdf } from "./ambil.ts";
import { ekstrak } from "./ekstrak.ts";
import { bersihkan } from "./bersih.ts";
import { nilaiMutu, type PenilaianTeks } from "./mutu.ts";
import { parseStruktur, type Bagian } from "./struktur.ts";

export type SumberMeta = { id: string; jenis: string; nomor: string; tahun: number; judul: string; url: string; halamanDetail?: string };
export type OpsiIngest = { db: Db; fetch?: typeof fetch; dirData?: string; jedaMs?: [number, number] };
export type RingkasanIngest = { penilaian: PenilaianTeks; kataAnehPer1000: number; pasal: number; penjelasan: number; tinjauan: string[] };

const kunci = (bagian: Bagian, nomor: string) => `${bagian}:${nomor}`;
/** Rujukan Versi Pasal ke tempatnya di Peraturan sumber: "Pasal 156" atau "Lampiran, Pasal 81". */
const rujukan = (bagian: Bagian, nomor: string) => (bagian === "lampiran" ? `Lampiran, Pasal ${nomor}` : `Pasal ${nomor}`);

export async function ingest(meta: SumberMeta, opsi: OpsiIngest): Promise<RingkasanIngest> {
  const berkas = await ambilPdf(meta.url, {
    fetch: opsi.fetch ?? fetch,
    dirData: opsi.dirData ?? "data",
    jedaMs: opsi.jedaMs ?? [1000, 3000],
  });
  const halaman = await ekstrak(berkas.isi);
  const baris = bersihkan(halaman);
  const mutu = nilaiMutu(halaman, baris);
  const asal = mutu.asalTeks;
  // Lapisan OCR yang tidak layak tidak diurai: berkasnya masuk antrean OCR laptop (ADR-0003), Pasal lama dibiarkan.
  const struktur = mutu.penilaian === "perlu-ocr" ? null : parseStruktur(baris);
  const s = schema;

  await opsi.db.transaction(async (tx) => {
    const [p] = await tx
      .insert(s.peraturan)
      .values({ jenis: meta.jenis, nomor: meta.nomor, tahun: meta.tahun, judul: meta.judul, asalTeks: asal })
      .onConflictDoUpdate({ target: [s.peraturan.jenis, s.peraturan.nomor, s.peraturan.tahun], set: { judul: meta.judul, asalTeks: asal } })
      .returning();
    const peraturanId = p!.id;

    // Berkas yang sama (sha256 sama) hanya dicatat sekali; tanggal ambil diperbarui ke pengambilan terakhir.
    await tx
      .insert(s.berkasSumber)
      .values({
        peraturanId,
        url: berkas.url,
        halamanDetail: meta.halamanDetail ?? null,
        diambilPada: berkas.diambilPada,
        sha256: berkas.sha256,
        path: berkas.path,
        ukuran: berkas.isi.byteLength,
        penilaianTeks: mutu.penilaian,
        kataAnehPer1000: mutu.kataAnehPer1000,
      })
      .onConflictDoUpdate({
        target: s.berkasSumber.sha256,
        set: { diambilPada: berkas.diambilPada, url: berkas.url, path: berkas.path, penilaianTeks: mutu.penilaian, kataAnehPer1000: mutu.kataAnehPer1000 },
      });
    if (!struktur) return;

    // Pasal yang tidak lagi ditemukan di hasil parse dibuang; yang ada di-upsert.
    const kunciBaru = struktur.pasal.map((x) => kunci(x.bagian, x.nomor));
    await tx
      .delete(s.pasal)
      .where(
        and(
          eq(s.pasal.peraturanId, peraturanId),
          kunciBaru.length ? notInArray(sql<string>`${s.pasal.bagian} || ':' || ${s.pasal.nomor}`, kunciBaru) : sql`true`,
        ),
      );
    await tx.delete(s.catatanTinjauan).where(eq(s.catatanTinjauan.peraturanId, peraturanId));

    const janggal = new Set(struktur.tinjauan.flatMap((t) => (t.pasal ? [kunci(t.bagian ?? "batang", t.pasal)] : [])));
    const versiPerNomor = new Map<string, number>();
    for (const [i, x] of struktur.pasal.entries()) {
      const k = kunci(x.bagian, x.nomor);
      const [ps] = await tx
        .insert(s.pasal)
        .values({ peraturanId, bagian: x.bagian, nomor: x.nomor, urutan: i + 1, sisipan: /[A-Z]$/.test(x.nomor) })
        .onConflictDoUpdate({ target: [s.pasal.peraturanId, s.pasal.bagian, s.pasal.nomor], set: { urutan: i + 1 } })
        .returning();
      const nilaiVersi = { rujukan: rujukan(x.bagian, x.nomor), halaman: x.halaman, asalTeks: asal, perluTinjauan: janggal.has(k) };
      const [v] = await tx
        .insert(s.versiPasal)
        .values({ pasalId: ps!.id, sumberPeraturanId: peraturanId, ...nilaiVersi })
        .onConflictDoUpdate({ target: [s.versiPasal.pasalId, s.versiPasal.sumberPeraturanId], set: nilaiVersi })
        .returning();
      versiPerNomor.set(k, v!.id);
    }

    const semuaVersi = [...versiPerNomor.values()];
    if (semuaVersi.length) {
      await tx.delete(s.ayat).where(inArray(s.ayat.versiPasalId, semuaVersi));
      await tx.delete(s.penjelasan).where(inArray(s.penjelasan.versiPasalId, semuaVersi));
    }
    const ayat = struktur.pasal.flatMap((x) =>
      x.ayat.map((a, k) => ({ versiPasalId: versiPerNomor.get(kunci(x.bagian, x.nomor))!, urutan: k + 1, nomor: a.nomor, teks: a.teks })),
    );
    if (ayat.length) await tx.insert(s.ayat).values(ayat);
    const pj = struktur.pasal.flatMap((x) =>
      x.penjelasan === undefined ? [] : [{ versiPasalId: versiPerNomor.get(kunci(x.bagian, x.nomor))!, teks: x.penjelasan }],
    );
    if (pj.length) await tx.insert(s.penjelasan).values(pj);
    if (struktur.tinjauan.length) {
      await tx.insert(s.catatanTinjauan).values(
        struktur.tinjauan.map((t) => ({
          peraturanId,
          versiPasalId: t.pasal ? (versiPerNomor.get(kunci(t.bagian ?? "batang", t.pasal)) ?? null) : null,
          jenis: t.jenis,
          pesan: t.pesan,
        })),
      );
    }
  });

  return {
    penilaian: mutu.penilaian,
    kataAnehPer1000: mutu.kataAnehPer1000,
    pasal: struktur?.pasal.length ?? 0,
    penjelasan: struktur?.pasal.filter((x) => x.penjelasan !== undefined).length ?? 0,
    tinjauan: struktur?.tinjauan.map((t) => t.pesan) ?? [],
  };
}
