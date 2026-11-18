// Membaca isi database Seam A menjadi JSON polos (tanpa id serial), untuk perbandingan dan snapshot.
import { asc, eq } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";

/**
 * `perubahan: true` menambah sumber setiap Versi Pasal, Catatan Perubahan setiap Pasal, dan Relasi Peraturan
 * (untuk Peraturan sasaran setelah Parser Perubahan, #7). Tanpa opsi itu bentuknya sama seperti snapshot lama.
 */
export async function bacaIsi(db: Db, jenis: string, nomor: string, tahun: number, opsi: { perubahan?: boolean } = {}) {
  const s = schema;
  const p = (await db.select().from(s.peraturan)).find((x) => x.jenis === jenis && x.nomor === nomor && x.tahun === tahun);
  if (!p) return null;
  const berkas = await db.select().from(s.berkasSumber).where(eq(s.berkasSumber.peraturanId, p.id));
  const pasal = await db.select().from(s.pasal).where(eq(s.pasal.peraturanId, p.id)).orderBy(asc(s.pasal.urutan));
  const versi = await db.select().from(s.versiPasal).orderBy(asc(s.versiPasal.id));
  const ayat = await db.select().from(s.ayat).orderBy(asc(s.ayat.urutan));
  const pj = await db.select().from(s.penjelasan);
  const tinjauan = await db.select().from(s.catatanTinjauan).where(eq(s.catatanTinjauan.peraturanId, p.id)).orderBy(asc(s.catatanTinjauan.id));
  const rujukanVersi = new Map(versi.map((v) => [v.id, v.rujukan]));
  const semuaPeraturan = await db.select().from(s.peraturan);
  const nama = (id: number) => {
    const x = semuaPeraturan.find((q) => q.id === id)!;
    return `${x.jenis} ${x.nomor}/${x.tahun}`;
  };
  const catatan = opsi.perubahan ? await db.select().from(s.catatanPerubahan).orderBy(asc(s.catatanPerubahan.id)) : [];
  const ayatBaru = opsi.perubahan ? await db.select().from(s.ayatPerubahan).orderBy(asc(s.ayatPerubahan.urutan)) : [];
  const relasi = opsi.perubahan ? await db.select().from(s.relasiPeraturan).orderBy(asc(s.relasiPeraturan.id)) : [];
  // Antrean tinjauan Parser Perubahan disimpan di Peraturan Pengubah; ambil yang berasal dari Pasal Pengubah yang menyasar Peraturan ini.
  const catatanIni = catatan.filter((c) => pasal.some((ps) => ps.id === c.pasalId));
  const pasalPengubah = new Set(catatanIni.map((c) => `${c.pengubahPeraturanId}|${c.rujukan.replace(/ angka \d+$/, "")}`));
  const tinjauanPengubah = opsi.perubahan
    ? (await db.select().from(s.catatanTinjauan).orderBy(asc(s.catatanTinjauan.id))).filter((t) =>
        [...pasalPengubah].some((k) => {
          const [id, rujukanPasal] = k.split("|");
          return t.peraturanId === Number(id) && t.pesan.startsWith(`${rujukanPasal} angka `);
        }),
      )
    : [];
  const perubahanPasal = (pasalId: number) => ({
    catatanPerubahan: catatan
      .filter((c) => c.pasalId === pasalId)
      .map((c) => ({
        pengubah: nama(c.pengubahPeraturanId),
        rujukan: c.rujukan,
        halaman: c.halaman,
        jenis: c.jenis,
        cakupan: c.cakupan,
        versi: c.versiPasalId ? rujukanVersi.get(c.versiPasalId) : null,
        ayatTerdampak: c.ayatTerdampak,
        ayatBaru: ayatBaru.filter((a) => a.catatanPerubahanId === c.id).map((a) => ({ nomor: a.nomor, teks: a.teks })),
      })),
  });
  return {
    peraturan: { jenis: p.jenis, nomor: p.nomor, tahun: p.tahun, judul: p.judul, asalTeks: p.asalTeks },
    ...(opsi.perubahan
      ? {
          relasi: relasi
            .filter((r) => r.sumberPeraturanId === p.id || r.sasaranPeraturanId === p.id)
            .map((r) => ({ sumber: nama(r.sumberPeraturanId), jenis: r.jenis, sasaran: nama(r.sasaranPeraturanId) })),
        }
      : {}),
    berkas: berkas.map((b) => ({
      url: b.url,
      halamanDetail: b.halamanDetail,
      sha256: b.sha256,
      ukuran: b.ukuran,
      penilaianTeks: b.penilaianTeks,
      kataAnehPer1000: b.kataAnehPer1000,
    })),
    pasal: pasal.map((ps) => ({
      bagian: ps.bagian,
      nomor: ps.nomor,
      sisipan: ps.sisipan,
      versi: versi
        .filter((v) => v.pasalId === ps.id)
        .map((v) => ({
          ...(opsi.perubahan ? { sumber: nama(v.sumberPeraturanId) } : {}),
          rujukan: v.rujukan,
          halaman: v.halaman,
          asalTeks: v.asalTeks,
          perluTinjauan: v.perluTinjauan,
          ayat: ayat.filter((a) => a.versiPasalId === v.id).map((a) => ({ nomor: a.nomor, teks: a.teks })),
          penjelasan: pj.find((x) => x.versiPasalId === v.id)?.teks ?? null,
        })),
      ...(opsi.perubahan ? perubahanPasal(ps.id) : {}),
    })),
    tinjauan: tinjauan.map((t) => ({ jenis: t.jenis, versi: t.versiPasalId ? rujukanVersi.get(t.versiPasalId) : null, pesan: t.pesan })),
    ...(opsi.perubahan
      ? {
          tinjauanPerubahan: tinjauanPengubah.map((t) => ({
            pengubah: nama(t.peraturanId),
            jenis: t.jenis,
            versi: t.versiPasalId ? rujukanVersi.get(t.versiPasalId) : null,
            pesan: t.pesan,
          })),
        }
      : {}),
  };
}

export type IsiDb = NonNullable<Awaited<ReturnType<typeof bacaIsi>>>;
