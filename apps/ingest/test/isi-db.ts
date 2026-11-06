// Membaca isi database Seam A menjadi JSON polos (tanpa id serial), untuk perbandingan dan snapshot.
import { asc, eq } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";

export async function bacaIsi(db: Db, jenis: string, nomor: string, tahun: number) {
  const s = schema;
  const p = (await db.select().from(s.peraturan)).find((x) => x.jenis === jenis && x.nomor === nomor && x.tahun === tahun);
  if (!p) return null;
  const berkas = await db.select().from(s.berkasSumber).where(eq(s.berkasSumber.peraturanId, p.id));
  const pasal = await db.select().from(s.pasal).where(eq(s.pasal.peraturanId, p.id)).orderBy(asc(s.pasal.urutan));
  const versi = await db.select().from(s.versiPasal);
  const ayat = await db.select().from(s.ayat).orderBy(asc(s.ayat.urutan));
  const pj = await db.select().from(s.penjelasan);
  const tinjauan = await db.select().from(s.catatanTinjauan).where(eq(s.catatanTinjauan.peraturanId, p.id)).orderBy(asc(s.catatanTinjauan.id));
  const rujukanVersi = new Map(versi.map((v) => [v.id, v.rujukan]));
  return {
    peraturan: { jenis: p.jenis, nomor: p.nomor, tahun: p.tahun, judul: p.judul, asalTeks: p.asalTeks },
    berkas: berkas.map((b) => ({ url: b.url, halamanDetail: b.halamanDetail, sha256: b.sha256, ukuran: b.ukuran })),
    pasal: pasal.map((ps) => ({
      nomor: ps.nomor,
      sisipan: ps.sisipan,
      versi: versi
        .filter((v) => v.pasalId === ps.id)
        .map((v) => ({
          rujukan: v.rujukan,
          halaman: v.halaman,
          asalTeks: v.asalTeks,
          perluTinjauan: v.perluTinjauan,
          ayat: ayat.filter((a) => a.versiPasalId === v.id).map((a) => ({ nomor: a.nomor, teks: a.teks })),
          penjelasan: pj.find((x) => x.versiPasalId === v.id)?.teks ?? null,
        })),
    })),
    tinjauan: tinjauan.map((t) => ({ jenis: t.jenis, versi: t.versiPasalId ? rujukanVersi.get(t.versiPasalId) : null, pesan: t.pesan })),
  };
}

export type IsiDb = NonNullable<Awaited<ReturnType<typeof bacaIsi>>>;
