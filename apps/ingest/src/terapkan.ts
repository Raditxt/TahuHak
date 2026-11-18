// Penerapan Parser Perubahan ke database (#7, ADR-0001): rencana perubahan → Versi Pasal baru, Pasal Sisipan,
// Catatan Perubahan, Ayat Perubahan, dan relasi "mengubah". Bunyi lama tidak pernah ditimpa atau disambung.
import { and, asc, desc, eq, inArray, ne, notExists, sql } from "drizzle-orm";
import { schema, type Db } from "@tahuhak/db";
import { bacaSasaran, namaPeraturan, uraiPengubah, type RencanaPerubahan, type Sasaran } from "./perubahan.ts";
import type { BarisHal } from "./struktur.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Asal = "digital" | "ocr";
const s = schema;

/** Id sumber di apps/ingest/sumber/ untuk sebuah Peraturan, mis. "uu-6-2023". */
const idSumber = (x: Sasaran) => `${x.jenis.toLowerCase()}-${x.nomor}-${x.tahun}`;

/** Urutan Pasal asli diberi jarak supaya Pasal Sisipan (154A, 154B, ...) muat di antaranya. */
export const JARAK_URUTAN = 100;

/** Buang semua hasil penerapan sebelumnya oleh Peraturan Pengubah ini, supaya ingest ulang tidak menggandakan. */
export async function bersihkanPenerapan(tx: Tx, pengubahId: number) {
  const versiLain = tx
    .select({ x: sql`1` })
    .from(s.versiPasal)
    .where(and(eq(s.versiPasal.pasalId, s.pasal.id), ne(s.versiPasal.sumberPeraturanId, pengubahId)));
  const sisipanSendiri = tx
    .select({ id: s.versiPasal.pasalId })
    .from(s.versiPasal)
    .where(eq(s.versiPasal.sumberPeraturanId, pengubahId));
  // Pasal Sisipan yang hanya punya Versi Pasal dari Peraturan Pengubah ini lahir dari penerapan sebelumnya.
  await tx
    .delete(s.pasal)
    .where(and(eq(s.pasal.sisipan, true), ne(s.pasal.peraturanId, pengubahId), inArray(s.pasal.id, sisipanSendiri), notExists(versiLain)));
  const pasalLain = tx.select({ id: s.pasal.id }).from(s.pasal).where(ne(s.pasal.peraturanId, pengubahId));
  await tx.delete(s.versiPasal).where(and(eq(s.versiPasal.sumberPeraturanId, pengubahId), inArray(s.versiPasal.pasalId, pasalLain)));
  await tx.delete(s.catatanPerubahan).where(eq(s.catatanPerubahan.pengubahPeraturanId, pengubahId));
  await tx.delete(s.relasiPeraturan).where(eq(s.relasiPeraturan.sumberPeraturanId, pengubahId));
}

type Tinjauan = { jenis: (typeof s.jenisTinjauan.enumValues)[number]; versiPasalId: number | null; pesan: string };

/** Nomor Ayat yang berbeda antara dua versi (berubah, baru, atau hilang), urut menurut nomor. */
function ayatBerbeda(lama: { nomor: string | null; teks: string }[], baru: { nomor: string | null; teks: string }[]): string[] {
  const rapi = (t: string) => t.replace(/\s+/g, " ").trim();
  const pl = new Map(lama.filter((a) => a.nomor).map((a) => [a.nomor!, rapi(a.teks)]));
  const pb = new Map(baru.filter((a) => a.nomor).map((a) => [a.nomor!, rapi(a.teks)]));
  const semua = [...new Set([...pl.keys(), ...pb.keys()])];
  return semua
    .filter((n) => pl.get(n) !== pb.get(n))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
}

export type HasilTerapkan = { dilewati: string[] };

/**
 * Terapkan satu Pasal pengubah milik Peraturan `pengubahId`. Pasal pengubah yang menyasar Peraturan yang belum diingest
 * dilewati dan dikembalikan di `dilewati`.
 */
export async function terapkanPengubah(
  tx: Tx,
  o: { pengubahId: number; rujukanPasal: string; versiPengubahId: number | null; isi: BarisHal[]; asal: Asal },
): Promise<HasilTerapkan> {
  const urai = uraiPengubah(o.isi, o.rujukanPasal);
  if (!urai.sasaran) return { dilewati: [] };
  const sx = urai.sasaran;
  const [sasaran] = await tx
    .select()
    .from(s.peraturan)
    .where(and(eq(s.peraturan.jenis, sx.jenis), eq(s.peraturan.nomor, sx.nomor), eq(s.peraturan.tahun, sx.tahun)));
  if (!sasaran) {
    // Sisip BAB tetap dicatat walau sasarannya belum diingest: Pasal yang disisipkannya tidak tercatat di tempat lain.
    // Jenis tinjauan lain akan muncul lagi saat sasaran diingest dan Peraturan Pengubah diingest ulang.
    const sisipBab = urai.tinjauan.filter((t) => t.jenis === "sisip-bab");
    if (sisipBab.length) {
      await tx.insert(s.catatanTinjauan).values(sisipBab.map((t) => ({ peraturanId: o.pengubahId, versiPasalId: o.versiPengubahId, jenis: t.jenis, pesan: t.pesan })));
    }
    return { dilewati: [`${o.rujukanPasal}: ${namaPeraturan(sx)} belum diingest`] };
  }
  if (sasaran.id === o.pengubahId) return { dilewati: [] };

  await tx
    .insert(s.relasiPeraturan)
    .values({ sumberPeraturanId: o.pengubahId, sasaranPeraturanId: sasaran.id, jenis: "mengubah" })
    .onConflictDoNothing();

  const tinjauan: Tinjauan[] = urai.tinjauan.map((t) => ({ jenis: t.jenis, versiPasalId: o.versiPengubahId, pesan: t.pesan }));
  const daftarPasal = await tx
    .select()
    .from(s.pasal)
    .where(and(eq(s.pasal.peraturanId, sasaran.id), eq(s.pasal.bagian, "batang")));
  const pasalPerNomor = new Map(daftarPasal.map((p) => [p.nomor, p]));

  for (const r of urai.rencana) {
    const label = `${r.rujukan} (Pasal ${r.pasal})`;
    let ps = pasalPerNomor.get(r.pasal);
    if (!ps && r.jenis === "sisip" && r.cakupan === "pasal-utuh") {
      const setelah = pasalPerNomor.get(r.sisipSetelah!);
      if (!setelah) {
        tinjauan.push({ jenis: "judul-isi-beda", versiPasalId: o.versiPengubahId, pesan: `${label}: Pasal ${r.sisipSetelah} tidak ada di ${namaPeraturan(sx)}` });
        continue;
      }
      const huruf = r.pasal.slice(r.sisipSetelah!.length);
      const [baru] = await tx
        .insert(s.pasal)
        .values({ peraturanId: sasaran.id, bagian: "batang", nomor: r.pasal, urutan: setelah.urutan + huruf.charCodeAt(0) - 64, sisipan: true })
        .returning();
      ps = baru!;
      pasalPerNomor.set(r.pasal, ps);
    }
    if (!ps) {
      tinjauan.push({ jenis: "judul-isi-beda", versiPasalId: o.versiPengubahId, pesan: `${label}: Pasal ${r.pasal} tidak ada di ${namaPeraturan(sx)}` });
      continue;
    }
    await terapkanRencana(tx, o, ps.id, r, label, tinjauan);
  }

  if (tinjauan.length) {
    await tx.insert(s.catatanTinjauan).values(tinjauan.map((t) => ({ peraturanId: o.pengubahId, versiPasalId: t.versiPasalId, jenis: t.jenis, pesan: t.pesan })));
  }
  return { dilewati: [] };
}

async function terapkanRencana(
  tx: Tx,
  o: { pengubahId: number; asal: Asal; versiPengubahId: number | null },
  pasalId: number,
  r: RencanaPerubahan,
  label: string,
  tinjauan: Tinjauan[],
) {
  // Versi sebelumnya: Versi Pasal terakhir yang bukan dari Peraturan Pengubah ini.
  const [lama] = await tx
    .select()
    .from(s.versiPasal)
    .where(and(eq(s.versiPasal.pasalId, pasalId), ne(s.versiPasal.sumberPeraturanId, o.pengubahId)))
    .orderBy(desc(s.versiPasal.id))
    .limit(1);
  const ayatLama = lama ? await tx.select().from(s.ayat).where(eq(s.ayat.versiPasalId, lama.id)).orderBy(asc(s.ayat.urutan)) : [];

  let versiPasalId: number | null = null;
  let ayatTerdampak: string[];
  if (r.cakupan === "pasal-utuh" && r.jenis !== "hapus") {
    const [v] = await tx
      .insert(s.versiPasal)
      .values({ pasalId, sumberPeraturanId: o.pengubahId, rujukan: r.rujukan, halaman: r.halaman, asalTeks: o.asal, perluTinjauan: r.tidakUrut.length > 0 })
      .onConflictDoNothing()
      .returning();
    if (!v) {
      tinjauan.push({ jenis: "judul-isi-beda", versiPasalId: o.versiPengubahId, pesan: `${label}: Pasal ini sudah diubah oleh angka lain di Peraturan Pengubah yang sama` });
      return;
    }
    versiPasalId = v.id;
    if (r.ayat.length) await tx.insert(s.ayat).values(r.ayat.map((a, i) => ({ versiPasalId: v.id, urutan: i + 1, nomor: a.nomor, teks: a.teks })));
    ayatTerdampak = r.jenis === "sisip" ? r.ayat.flatMap((a) => (a.nomor ? [a.nomor] : [])) : ayatBerbeda(ayatLama, r.ayat);
    for (const t of r.tidakUrut) tinjauan.push({ jenis: "ayat-tidak-urut", versiPasalId: v.id, pesan: `${label}: ${t}` });
  } else if (r.cakupan === "pasal-utuh") {
    ayatTerdampak = ayatLama.flatMap((a) => (a.nomor ? [a.nomor] : []));
  } else {
    ayatTerdampak = r.ayatDisebut ?? [];
    for (const t of r.tidakUrut) tinjauan.push({ jenis: "ayat-tidak-urut", versiPasalId: null, pesan: `${label}: ${t}` });
  }
  for (const t of r.ragu) tinjauan.push({ jenis: "ocr-ragu", versiPasalId, pesan: `${label}: ${t}` });

  const [c] = await tx
    .insert(s.catatanPerubahan)
    .values({ pasalId, pengubahPeraturanId: o.pengubahId, versiPasalId, rujukan: r.rujukan, halaman: r.halaman, jenis: r.jenis, cakupan: r.cakupan, ayatTerdampak })
    .onConflictDoNothing()
    .returning();
  if (c && r.cakupan === "ayat-saja" && r.ayat.length) {
    await tx.insert(s.ayatPerubahan).values(r.ayat.map((a, i) => ({ catatanPerubahanId: c.id, urutan: i + 1, nomor: a.nomor, teks: a.teks })));
  }
}

/**
 * Peraturan Pengubah yang sudah ada di database dan menyasar Peraturan ini, tetapi belum diterapkan (belum ada relasinya),
 * misalnya karena Peraturan ini diingest sesudahnya. Penerapan otomatis untuk urutan ini belum ada; ingest tidak boleh diam.
 */
export async function peringatanBelumDiterapkan(tx: Tx, ini: { id: number } & Sasaran): Promise<string[]> {
  const calon = await tx
    .select({ teks: s.ayat.teks, nomor: s.pasal.nomor, bagian: s.pasal.bagian, pid: s.peraturan.id, jenis: s.peraturan.jenis, pnomor: s.peraturan.nomor, tahun: s.peraturan.tahun })
    .from(s.ayat)
    .innerJoin(s.versiPasal, eq(s.versiPasal.id, s.ayat.versiPasalId))
    .innerJoin(s.pasal, and(eq(s.pasal.id, s.versiPasal.pasalId), eq(s.pasal.peraturanId, s.versiPasal.sumberPeraturanId)))
    .innerJoin(s.peraturan, eq(s.peraturan.id, s.pasal.peraturanId))
    .where(and(ne(s.peraturan.id, ini.id), eq(s.ayat.urutan, 1), sql`${s.ayat.teks} ilike '%ketentuan%'`));
  const relasi = new Set(
    (await tx.select().from(s.relasiPeraturan).where(eq(s.relasiPeraturan.sasaranPeraturanId, ini.id))).map((r) => r.sumberPeraturanId),
  );
  const pesan = new Map<number, string>();
  for (const c of calon) {
    const sx = bacaSasaran(c.teks.split("\n")[0]!);
    if (!sx || sx.jenis !== ini.jenis || sx.nomor !== ini.nomor || sx.tahun !== ini.tahun || relasi.has(c.pid) || pesan.has(c.pid)) continue;
    const pengubah = { jenis: c.jenis, nomor: c.pnomor, tahun: c.tahun };
    const rujukan = c.bagian === "lampiran" ? `Lampiran, Pasal ${c.nomor}` : `Pasal ${c.nomor}`;
    pesan.set(
      c.pid,
      `${namaPeraturan(pengubah)} (${rujukan}) mengubah ${namaPeraturan(ini)} tetapi belum diterapkan; jalankan ulang: pnpm ingest ${idSumber(pengubah)}`,
    );
  }
  return [...pesan.values()];
}
