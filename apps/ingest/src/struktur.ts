// Parser Struktur: baris bersih → Pasal (urut), Ayat, dan Penjelasan, ditambah catatan tinjauan untuk hasil janggal.
import type { Baris } from "./bersih.ts";

export type AyatHasil = { nomor: string | null; teks: string };
export type PasalHasil = { nomor: string; halaman: number[]; ayat: AyatHasil[]; penjelasan?: string };
export type Tinjauan = { jenis: "pasal-loncat" | "ayat-tidak-urut" | "penjelasan-tak-tertaut"; pasal?: string; pesan: string };
export type HasilStruktur = { pasal: PasalHasil[]; tinjauan: Tinjauan[] };

const JUDUL_PASAL = /^Pasal (\d+)([A-Z]?)$/;
const BAB = /^BAB [IVXLC]+$/;
const BAGIAN = /^(Bagian|Paragraf) \S+$/;
const PENUTUP = /^(Disahkan|Ditetapkan|Diundangkan) di\b|^Agar setiap orang\b/;
/** Lompatan nomor Pasal lebih besar dari ini dianggap rujukan di teks, bukan judul Pasal. */
const MAKS_LONCAT = 5;

type Nomor = { angka: number; huruf: string };
const pecahNomor = (n: string): Nomor => {
  const m = n.match(/^(\d+)([A-Z]?)$/)!;
  return { angka: Number(m[1]), huruf: m[2] ?? "" };
};

/** Hubungan nomor Pasal dengan Pasal sebelumnya: berikutnya persis, loncat sedikit, atau bukan urutan. */
function hubungan(prev: string | null, n: string): "urut" | "loncat" | "tolak" {
  const a = prev ? pecahNomor(prev) : { angka: 0, huruf: "" };
  const b = pecahNomor(n);
  if (b.angka === a.angka + 1 && !b.huruf) return "urut";
  if (b.angka === a.angka && b.huruf > a.huruf) return b.huruf.charCodeAt(0) - (a.huruf ? a.huruf.charCodeAt(0) : 64) === 1 ? "urut" : "loncat";
  if (b.angka > a.angka && b.angka - a.angka <= MAKS_LONCAT) return "loncat";
  return "tolak";
}

/** Bagi dokumen menjadi batang tubuh dan Penjelasan ("PENJELASAN" / "ATAS ..."). */
function bagiZona(baris: Baris[]): { batang: Baris[]; penjelasan: Baris[] } {
  const i = baris.findIndex((b, k) => b.teks === "PENJELASAN" && /^ATAS\b/.test(baris[k + 1]?.teks ?? ""));
  return i < 0 ? { batang: baris, penjelasan: [] } : { batang: baris.slice(0, i), penjelasan: baris.slice(i) };
}

type PasalMentah = { nomor: string; halaman: number[]; baris: string[] };

function potongPasal(batang: Baris[], tinjauan: Tinjauan[]): PasalMentah[] {
  const pasal: PasalMentah[] = [];
  let cur: PasalMentah | null = null;
  let tutup = false;
  for (let i = 0; i < batang.length; i++) {
    const { teks: t, hal } = batang[i]!;
    const m = t.match(JUDUL_PASAL);
    if (m) {
      const n = m[1]! + m[2]!;
      const prev = pasal.at(-1)?.nomor ?? null;
      const rel = hubungan(prev, n);
      if (rel !== "tolak") {
        if (rel === "loncat") tinjauan.push({ jenis: "pasal-loncat", pasal: n, pesan: `Nomor Pasal loncat dari ${prev ?? "awal"} ke ${n} (hal ${hal})` });
        cur = { nomor: n, halaman: [hal], baris: [] };
        pasal.push(cur);
        continue;
      }
    }
    if (!cur || tutup) continue;
    if (PENUTUP.test(t)) {
      tutup = true;
      continue;
    }
    // Judul BAB/Bagian/Paragraf beserta satu baris namanya bukan teks Pasal.
    if (BAB.test(t) || BAGIAN.test(t)) {
      i++;
      continue;
    }
    cur.baris.push(t);
    if (!cur.halaman.includes(hal)) cur.halaman.push(hal);
  }
  return pasal;
}

const BUTIR = /^([a-z]|\d{1,2})\.\s/;

/** Sambung baris menjadi teks: butir huruf/angka di baris baru, pemenggalan kata di akhir baris disatukan. */
export function sambungBaris(lines: string[]): string {
  let out = "";
  for (const l of lines) {
    if (!out) out = l;
    else if (BUTIR.test(l)) out += "\n" + l;
    else if (/\p{Ll}-$/u.test(out) && /^\p{Ll}/u.test(l)) {
      // "mem-" + "buat" → "membuat"; kata ulang "terputus-" + "putus" tetap berstrip.
      const depan = out.match(/(\p{L}+)-$/u)![1]!;
      out = l.startsWith(depan) ? out + l : out.slice(0, -1) + l;
    } else out += " " + l;
  }
  return out;
}

const JUDUL_AYAT = /^\((\d+)\)\s*(.*)$/;

function pecahAyat(p: PasalMentah, tinjauan: Tinjauan[]): AyatHasil[] {
  const ayat: { nomor: string | null; lines: string[] }[] = [];
  let harap = 1;
  for (const l of p.baris) {
    const m = l.match(JUDUL_AYAT);
    // "...sebagaimana dimaksud dalam ayat" + "(1) ..." adalah rujukan yang terpotong baris, bukan Ayat baru.
    const lanjutanRujukan = /\bayat$/.test(ayat.at(-1)?.lines.at(-1) ?? "");
    if (m && !lanjutanRujukan) {
      const n = Number(m[1]);
      if (n !== harap) tinjauan.push({ jenis: "ayat-tidak-urut", pasal: p.nomor, pesan: `Pasal ${p.nomor}: Ayat (${n}) muncul, diharapkan (${harap})` });
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

/** Penjelasan Pasal demi Pasal → nomor Pasal ke teksnya. */
function parsePenjelasan(zona: Baris[]): Map<string, string> {
  const mulai = zona.findIndex((b) => /PASAL DEMI PASAL$/.test(b.teks));
  const peta = new Map<string, string[][]>();
  let cur: string[][] | null = null;
  let prev: string | null = null;
  for (const { teks: t } of mulai < 0 ? [] : zona.slice(mulai + 1)) {
    if (AKHIR_PENJELASAN.test(t)) break;
    const m = t.match(JUDUL_PASAL);
    if (m && hubungan(prev, m[1]! + m[2]!) !== "tolak") {
      prev = m[1]! + m[2]!;
      cur = [];
      peta.set(prev, cur);
      continue;
    }
    if (!cur) continue;
    if (LABEL_PENJELASAN.test(t)) cur.push([t], []);
    else if (cur.length) cur.at(-1)!.push(t);
    else cur.push([t]);
  }
  return new Map([...peta].map(([n, bagian]) => [n, bagian.filter((b) => b.length).map(sambungBaris).join("\n")]));
}

export function parseStruktur(baris: Baris[]): HasilStruktur {
  const tinjauan: Tinjauan[] = [];
  const zona = bagiZona(baris);
  const penjelasan = parsePenjelasan(zona.penjelasan);
  const pasal = potongPasal(zona.batang, tinjauan).map((p) => ({
    nomor: p.nomor,
    halaman: p.halaman,
    ayat: pecahAyat(p, tinjauan),
    penjelasan: penjelasan.get(p.nomor),
  }));
  const ada = new Set(pasal.map((p) => p.nomor));
  for (const n of penjelasan.keys()) {
    if (!ada.has(n)) tinjauan.push({ jenis: "penjelasan-tak-tertaut", pesan: `Penjelasan Pasal ${n} tidak punya Pasal di batang tubuh` });
  }
  return { pasal, tinjauan };
}
