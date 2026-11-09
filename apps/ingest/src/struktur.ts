// Parser Struktur: baris bersih → Pasal (urut), Ayat, dan Penjelasan, ditambah catatan tinjauan untuk hasil janggal.
// Dokumen bisa punya Lampiran yang memuat Peraturan lain (UU 6/2023 melampirkan Perppu 2/2022); Pasal-nya
// disimpan sebagai bagian "lampiran" dari Peraturan yang sama.
import type { Baris } from "./bersih.ts";
import { bacaJudul, normalNomor } from "./nomor-ocr.ts";

export type Bagian = "batang" | "lampiran";
export type AyatHasil = { nomor: string | null; teks: string };
export type PasalHasil = { bagian: Bagian; nomor: string; halaman: number[]; ayat: AyatHasil[]; penjelasan?: string };
export type JenisTinjauan = "pasal-loncat" | "ayat-tidak-urut" | "penjelasan-tak-tertaut" | "penjelasan-tidak-ditemukan" | "judul-pasal-ditebak";
export type Tinjauan = { jenis: JenisTinjauan; bagian?: Bagian; pasal?: string; pesan: string };
export type HasilStruktur = { pasal: PasalHasil[]; tinjauan: Tinjauan[] };

const BAB = /^BAB [IVXLC]+$/;
const BAGIAN = /^(Bagian|Paragraf) \S+$/;
const PENUTUP = /^(Disahkan|Ditetapkan|Diundangkan) di\b|^Agar s\S* orang\b/;
/** Lompatan nomor Pasal lebih besar dari ini dianggap rujukan di teks, bukan judul Pasal. */
const MAKS_LONCAT = 5;
/** Judul rusak OCR yang meloncat lebih jauh dari ini dari urutan dianggap salah baca, lalu nomornya ditebak dari urutan. */
const MAKS_LONCAT_RUSAK = 3;

type Nomor = { angka: number; huruf: string };
const pecahNomor = (n: string): Nomor => {
  const m = n.match(/^(\d+)([A-Z]?)$/)!;
  return { angka: Number(m[1]), huruf: m[2] ?? "" };
};
const berikutnya = (prev: string | null) => String((prev ? pecahNomor(prev).angka : 0) + 1);

/** Hubungan nomor Pasal dengan Pasal sebelumnya: berikutnya persis, loncat sedikit, atau bukan urutan. */
function hubungan(prev: string | null, n: string): "urut" | "loncat" | "tolak" {
  const a = prev ? pecahNomor(prev) : { angka: 0, huruf: "" };
  const b = pecahNomor(n);
  if (b.angka === a.angka + 1 && !b.huruf) return "urut";
  if (b.angka === a.angka && b.huruf > a.huruf) return b.huruf.charCodeAt(0) - (a.huruf ? a.huruf.charCodeAt(0) : 64) === 1 ? "urut" : "loncat";
  if (b.angka > a.angka && b.angka - a.angka <= MAKS_LONCAT) return "loncat";
  return "tolak";
}

type Zona = { batang: Baris[]; penjelasan: Baris[]; lampiran: Baris[] };

/**
 * Bagi dokumen menjadi batang tubuh, Penjelasan ("PENJELASAN" / "ATAS ..."), dan Lampiran ("LAMPIRAN" / "UNDANG-UNDANG ...").
 * Penjelasan milik Peraturan di Lampiran (Penjelasan Perppu) tidak diurai di sini.
 */
function bagiZona(baris: Baris[]): Zona {
  const zona: Zona = { batang: [], penjelasan: [], lampiran: [] };
  let cur: Baris[] | null = zona.batang;
  for (let i = 0; i < baris.length; i++) {
    const t = baris[i]!.teks;
    const t2 = baris[i + 1]?.teks ?? "";
    if (t === "PENJELASAN" && /^ATAS\b/.test(t2)) cur = cur === zona.batang ? zona.penjelasan : null;
    else if (t === "LAMPIRAN" && /^(UNDANG|PERATURAN)/.test(t2)) cur = zona.lampiran;
    cur?.push(baris[i]!);
  }
  return zona;
}

type PasalMentah = { nomor: string; halaman: number[]; baris: string[]; pengubah: boolean };

/**
 * Pasal pengubah: kalimat pembukanya (sampai "berikut:") menyebut ketentuan dalam Undang-Undang/Peraturan lain yang diubah.
 * Variasi nyata: "Beberapa ketentuan dalam UU…", "Untuk …, beberapa ketentuan dalam UU…", "Ketentuan Pasal 9 UU…",
 * "Perppu ini mengubah, menghapus, atau menetapkan pengaturan baru yang diatur dalam UU…".
 */
function isPengubah(baris: Baris[], mulai: number): boolean {
  const pembuka: string[] = [];
  for (let j = mulai; j < Math.min(baris.length, mulai + 30); j++) {
    pembuka.push(baris[j]!.teks);
    if (/berikut\s*:?\s*$/.test(baris[j]!.teks)) break;
  }
  const p = pembuka.join(" ").replace(/Undang-\s+Undang/g, "Undang-Undang");
  return /(ketentuan|pengaturan baru)\b.{0,60}?(Undang-Undang|Peraturan Pemerintah) Nomor/i.test(p) && /diubah|mengubah/.test(p) && /berikut\s*:?\s*$/.test(p);
}

/** Awal satu angka perubahan ("47. Ketentuan Pasal 156 …", "45. Di antara Pasal 154 dan Pasal 155 …"), toleran OCR. */
const AWAL_ANGKA = /^[0-9LlIO|]{1,3}\s*\.?\s+(Ketentuan|Di ?antara)/;

/** Nomor Pasal yang disebut kalimat pembuka angka perubahan. Batas "Di antara Pasal X dan Pasal Y" bukan Pasal yang dikutip. */
function disebutPembuka(t: string, berikut: string): Set<string> {
  const k = normalNomor(`${t} ${berikut}`).replace(/Di ?antara (ketentuan )?Pasal \S+ dan Pasal \S+/, "");
  return new Set([...k.matchAll(/Pasal (\d+[A-Z]?)/g)].map((m) => m[1]!));
}

function potongPasal(baris: Baris[], bagian: Bagian, tinjauan: Tinjauan[]): PasalMentah[] {
  const pasal: PasalMentah[] = [];
  let cur: PasalMentah | null = null;
  let tutup = false;
  let disebut = new Set<string>();
  for (let i = 0; i < baris.length; i++) {
    const { teks: t, hal } = baris[i]!;
    if (cur?.pengubah && AWAL_ANGKA.test(t)) disebut = disebutPembuka(t, baris[i + 1]?.teks ?? "");
    const judul = bacaJudul(t);
    if (judul) {
      const prev = pasal.at(-1)?.nomor ?? null;
      let n = judul.nomor;
      let rel = n ? hubungan(prev, n) : "tolak";
      if (cur?.pengubah) {
        // Pasal di dalam Pasal: judul di dalam Pasal pengubah hampir selalu kutipan Pasal milik Peraturan yang diubah.
        // Judul hanya menjadi Pasal berikutnya bila urut, tidak didahului "...berikut:", tidak disebut di kalimat pembuka
        // angka terakhir, dan tidak bernomor huruf.
        const pembukaPengubah = /^(Beberapa )?ketentuan dalam (Undang|Peraturan)/i.test(baris[i + 1]?.teks ?? "");
        const kutipan =
          rel !== "urut" || /berikut\s*:?\s*$/.test(baris[i - 1]?.teks ?? "") || (disebut.has(n!) && !pembukaPengubah) || /[A-Z]$/.test(n!);
        if (kutipan) {
          // Kutipan sudah terpakai; judul bernomor sama sesudahnya bisa Pasal milik Lampiran sendiri.
          if (n) disebut.delete(n);
          cur.baris.push(t);
          if (!cur.halaman.includes(hal)) cur.halaman.push(hal);
          continue;
        }
      } else if (judul.rusak && n !== berikutnya(prev) && (rel === "tolak" || pecahNomor(n!).angka - pecahNomor(prev ?? "0").angka > MAKS_LONCAT_RUSAK)) {
        n = berikutnya(prev);
        rel = "urut";
        tinjauan.push({ jenis: "judul-pasal-ditebak", bagian, pasal: n, pesan: `Judul rusak "${t}" (hal ${hal}) dibaca sebagai Pasal ${n} dari urutan` });
      }
      if (rel !== "tolak") {
        if (rel === "loncat") tinjauan.push({ jenis: "pasal-loncat", bagian, pasal: n!, pesan: `Nomor Pasal loncat dari ${prev ?? "awal"} ke ${n} (hal ${hal})` });
        cur = { nomor: n!, halaman: [hal], baris: [], pengubah: bagian === "lampiran" && isPengubah(baris, i + 1) };
        pasal.push(cur);
        tutup = false;
        disebut = new Set();
        continue;
      }
    }
    if (!cur || tutup) continue;
    if (PENUTUP.test(t)) {
      tutup = true;
      continue;
    }
    // Judul BAB/Bagian/Paragraf beserta satu baris namanya bukan teks Pasal, kecuali di dalam kutipan Pasal pengubah.
    if (!cur.pengubah && (BAB.test(t) || BAGIAN.test(t))) {
      i++;
      continue;
    }
    cur.baris.push(t);
    if (!cur.halaman.includes(hal)) cur.halaman.push(hal);
  }
  return pasal;
}

const BUTIR = /^([a-z]|\d{1,2})\.\s/;

/**
 * Sambung baris menjadi teks: butir huruf/angka (dan baris yang cocok `pisah`) di baris baru,
 * pemenggalan kata di akhir baris disatukan.
 */
export function sambungBaris(lines: string[], pisah?: RegExp): string {
  let out = "";
  for (const l of lines) {
    if (!out) out = l;
    else if (BUTIR.test(l) || (pisah?.test(l) && !/\bayat$/.test(out))) out += "\n" + l;
    else if (/\p{Ll}-$/u.test(out) && /^\p{Ll}/u.test(l)) {
      // "mem-" + "buat" → "membuat"; kata ulang "terputus-" + "putus" tetap berstrip.
      const depan = out.match(/(\p{L}+)-$/u)![1]!;
      out = l.startsWith(depan) ? out + l : out.slice(0, -1) + l;
    } else out += " " + l;
  }
  return out;
}

/** Di Pasal pengubah, angka perubahan, judul Pasal kutipan, Ayat kutipan, dan judul BAB/Bagian kutipan mulai di baris baru. */
const BARIS_BARU_PENGUBAH = new RegExp(
  [
    String.raw`\d{1,3}\s*\.\s`, // angka perubahan "47. "
    AWAL_ANGKA.source.slice(1), // angka perubahan tanpa titik atau rusak OCR: "2 Ketentuan", "L7. Ketentuan"
    String.raw`Pa[s5]a\S*\s*\d`, // judul Pasal kutipan
    String.raw`\(\s*\d+[a-z]?\s*[)1lI\]|t]\s`, // Ayat kutipan, termasuk "(41" dan "(2t"
    String.raw`l\d{1,2}l\s`, // Ayat kutipan rusak OCR: "l2l"
    String.raw`(BAB|Bagian|Paragraf)\s`,
  ]
    .map((p) => `(?:${p})`)
    .join("|")
    .replace(/^/, "^(?:") + ")",
);

const JUDUL_AYAT = /^\((\d+)\)\s*(.*)$/;

function pecahAyat(p: PasalMentah, bagian: Bagian, tinjauan: Tinjauan[]): AyatHasil[] {
  // Pasal pengubah disimpan utuh sebagai satu Ayat tanpa nomor; isinya (angka perubahan) diurai Parser Perubahan.
  if (p.pengubah) return [{ nomor: null, teks: sambungBaris(p.baris, BARIS_BARU_PENGUBAH) }];
  const ayat: { nomor: string | null; lines: string[] }[] = [];
  let harap = 1;
  for (const l of p.baris) {
    let m = l.match(JUDUL_AYAT);
    // OCR membaca ")" sebagai "1"/"l": "(21 Dalam hal..." = "(2) Dalam hal...". Hanya diterima bila nomornya yang diharapkan.
    const ocr = m ? null : l.match(/^\((\d)[1lI\]|]\s+(.*)$/);
    if (ocr && Number(ocr[1]) === harap) m = ocr;
    // "...sebagaimana dimaksud dalam ayat" + "(1) ..." adalah rujukan yang terpotong baris, bukan Ayat baru.
    const lanjutanRujukan = /\bayat$/.test(ayat.at(-1)?.lines.at(-1) ?? "");
    if (m && !lanjutanRujukan) {
      const n = Number(m[1]);
      if (n !== harap) tinjauan.push({ jenis: "ayat-tidak-urut", bagian, pasal: p.nomor, pesan: `Pasal ${p.nomor}: Ayat (${n}) muncul, diharapkan (${harap})` });
      harap = n + 1;
      ayat.push({ nomor: m[1]!, lines: m[2] ? [m[2]] : [] });
    } else {
      if (!ayat.length) ayat.push({ nomor: null, lines: [] });
      ayat.at(-1)!.lines.push(l);
    }
  }
  return ayat.map((a) => ({ nomor: a.nomor, teks: sambungBaris(a.lines) }));
}

/** Label rincian di Penjelasan Pasal demi Pasal; masing-masing di baris sendiri. */
const LABEL_PENJELASAN = /^(Ayat \(\d+\)|Huruf [a-z]|Angka \d+)$/;
const AKHIR_PENJELASAN = /^TAMBAHAN LEMBARAN NEGARA\b/;
/** "II. PASAL DEMI PASAL", toleran OCR ("PASAL DEMT PASAL"). */
const PASAL_DEMI_PASAL = /PASAL\s*DEM\S\s*PASAL$/;

/** Penjelasan Pasal demi Pasal → nomor Pasal ke teksnya. `null` bila dokumen tidak punya Penjelasan Pasal demi Pasal. */
function parsePenjelasan(zona: Baris[]): Map<string, string> | null {
  const mulai = zona.findIndex((b) => PASAL_DEMI_PASAL.test(b.teks));
  if (mulai < 0) return null;
  const peta = new Map<string, string[][]>();
  let cur: string[][] | null = null;
  let prev: string | null = null;
  for (const { teks: t } of zona.slice(mulai + 1)) {
    if (AKHIR_PENJELASAN.test(t)) break;
    const n = bacaJudul(t)?.nomor;
    if (n && hubungan(prev, n) !== "tolak") {
      prev = n;
      cur = [];
      peta.set(n, cur);
      continue;
    }
    if (!cur) continue;
    if (LABEL_PENJELASAN.test(t)) cur.push([t], []);
    else if (cur.length) cur.at(-1)!.push(t);
    else cur.push([t]);
  }
  return new Map([...peta].map(([n, bagian]) => [n, bagian.filter((b) => b.length).map((b) => sambungBaris(b)).join("\n")]));
}

export function parseStruktur(baris: Baris[]): HasilStruktur {
  const tinjauan: Tinjauan[] = [];
  const zona = bagiZona(baris);
  const penjelasan = parsePenjelasan(zona.penjelasan);
  const batang = potongPasal(zona.batang, "batang", tinjauan).map((p) => ({
    bagian: "batang" as const,
    nomor: p.nomor,
    halaman: p.halaman,
    ayat: pecahAyat(p, "batang", tinjauan),
    penjelasan: penjelasan?.get(p.nomor),
  }));
  const lampiran = potongPasal(zona.lampiran, "lampiran", tinjauan).map((p) => ({
    bagian: "lampiran" as const,
    nomor: p.nomor,
    halaman: p.halaman,
    ayat: pecahAyat(p, "lampiran", tinjauan),
  }));
  if (penjelasan) {
    const ada = new Set(batang.map((p) => p.nomor));
    for (const n of penjelasan.keys()) {
      if (!ada.has(n)) tinjauan.push({ jenis: "penjelasan-tak-tertaut", pesan: `Penjelasan Pasal ${n} tidak punya Pasal di batang tubuh` });
    }
    for (const p of batang) {
      if (p.penjelasan === undefined) {
        tinjauan.push({ jenis: "penjelasan-tidak-ditemukan", bagian: "batang", pasal: p.nomor, pesan: `Pasal ${p.nomor}: Penjelasan Pasal demi Pasal tidak ditemukan` });
      }
    }
  }
  return { pasal: [...batang, ...lampiran], tinjauan };
}
