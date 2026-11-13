// Parser Perubahan (#7): isi Pasal pengubah → rencana perubahan atas Pasal Peraturan sasaran, tanpa menyentuh database.
// Pengenal pola: kalimat pembuka satu angka perubahan → pola perubahan, atau null (tinjauan manual).
// Diangkat dari prototype #2 (amend.ts: kenaliPola, nomorAngka). normalNomor sudah ada di nomor-ocr.ts.
import { bacaJudul, normalNomor } from "./nomor-ocr.ts";
import { sambungBaris, type AyatHasil, type BarisHal } from "./struktur.ts";

export type Pola = {
  jenis: "ubah" | "sisip" | "hapus";
  /** Pasal yang disentuh. Untuk sisip Pasal: Pasal baru bila disebut, atau "?" bila nanti diambil dari judul di isi. */
  pasal: string;
  /** Hanya untuk cakupan ayat-saja. */
  ayat?: string[];
  cakupan: "pasal-utuh" | "ayat-saja";
  /** Sisip Pasal: "Di antara Pasal X dan Pasal Y" → X. */
  sisipSetelah?: string;
  jumlahSisip?: number;
};

const ANGKA_KATA: Record<string, number> = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };
const PSL = String.raw`(\d+[A-Z]?)`;
const AYT = String.raw`\((\d+[a-z]?)\)`;

function daftarAyat(s: string): string[] {
  return [...s.matchAll(/\((\d+[a-z]?)\)/g)].map((m) => m[1]!);
}

/** Kenali pola kalimat pembuka angka perubahan (mis. "47. Ketentuan Pasal 156 diubah sehingga berbunyi sebagai berikut:"). */
export function kenaliPola(kalimatMentah: string): Pola[] | null {
  const k = normalNomor(kalimatMentah.replace(/^[0-9LlIO|]{1,3}\s*\.?\s+(?=[A-Z])/, "")); // buang nomor angka di depan (toleran OCR)
  let m: RegExpMatchArray | null;

  // "Pasal 43 dihapus." / "Pasal 161 dan Pasal 162 dihapus."
  if ((m = k.match(new RegExp(String.raw`^((?:Pasal ${PSL}(?:,| dan)?\s*)+)dihapus\b`)))) {
    return [...m[1]!.matchAll(/Pasal (\d+[A-Z]?)/g)].map((x) => ({ jenis: "hapus", pasal: x[1]!, cakupan: "pasal-utuh" }));
  }
  // "Ketentuan ayat (3) Pasal 59 dihapus." / "Ketentuan Pasal 59 ayat (3) dihapus."
  if ((m = k.match(new RegExp(String.raw`^Ketentuan ((?:ayat ${AYT}(?:,| dan)?\s*)+)Pasal ${PSL} dihapus\b`)))) {
    return [{ jenis: "hapus", pasal: m[m.length - 1]!, ayat: daftarAyat(m[1]!), cakupan: "ayat-saja" }];
  }
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} ((?:ayat ${AYT}(?:,| dan)?\s*)+)dihapus\b`)))) {
    return [{ jenis: "hapus", pasal: m[1]!, ayat: daftarAyat(m[2]!), cakupan: "ayat-saja" }];
  }
  // "Ketentuan ayat (1) dan ayat (3) Pasal 79 diubah sehingga berbunyi ..." (hanya Ayat ditulis ulang)
  if ((m = k.match(new RegExp(String.raw`^Ketentuan ((?:ayat ${AYT}(?:,| dan)?\s*)+)Pasal ${PSL} diubah\b`)))) {
    return [{ jenis: "ubah", pasal: m[m.length - 1]!, ayat: daftarAyat(m[1]!), cakupan: "ayat-saja" }];
  }
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} ((?:ayat ${AYT}(?:,| dan)?\s*)+)diubah\b`)))) {
    return [{ jenis: "ubah", pasal: m[1]!, ayat: daftarAyat(m[2]!), cakupan: "ayat-saja" }];
  }
  // "Ketentuan Pasal 156 diubah sehingga berbunyi sebagai berikut:" (Pasal ditulis ulang utuh)
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} diubah\b`)))) {
    return [{ jenis: "ubah", pasal: m[1]!, cakupan: "pasal-utuh" }];
  }
  // "Di antara ayat (2) dan ayat (3) Pasal 88 disisipkan 1 (satu) ayat, yakni ayat (2a)" (sisip Ayat)
  if ((m = k.match(new RegExp(String.raw`^Di ?antara ayat ${AYT} dan ayat ${AYT} Pasal ${PSL} disisipkan .*?ayat`)))) {
    const baru = daftarAyat(k.slice(m[0].length));
    return [{ jenis: "sisip", pasal: m[3]!, ayat: baru.length ? baru : ["?"], cakupan: "ayat-saja" }];
  }
  // "Ketentuan Pasal 92 ditambah 1 (satu) ayat, yakni ayat (4)" (tambah Ayat di ujung)
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} ditambah .*?ayat`)))) {
    const baru = daftarAyat(k.slice(m[0].length));
    return [{ jenis: "sisip", pasal: m[1]!, ayat: baru.length ? baru : ["?"], cakupan: "ayat-saja" }];
  }
  // "Di antara Pasal 154 dan Pasal 155 disisipkan 1 (satu) pasal, yakni Pasal 154A ..."
  if ((m = k.match(new RegExp(String.raw`^Di ?antara (?:ketentuan )?Pasal ${PSL} dan Pasal ${PSL} disisipkan\s*(\d+|\w+)?\s*(?:\((\w+)\))?\s*pasal`, "i")))) {
    const jumlah = Number(m[3]) || ANGKA_KATA[(m[4] ?? m[3] ?? "").toLowerCase()] || 1;
    const setelah = m[1]!;
    // OCR: "828" = 82B. Hanya 8→B yang aman diperbaiki.
    const disebut = [...k.slice(m[0].length).matchAll(/Pasal (\d+[A-Z]?)/g)]
      .map((x) => (x[1] === setelah + "8" ? setelah + "B" : x[1]!))
      .filter((x) => /[A-Z]$/.test(x));
    const nama = disebut.length ? disebut : Array.from({ length: jumlah }, () => "?");
    return nama.map((p) => ({ jenis: "sisip", pasal: p, cakupan: "pasal-utuh", sisipSetelah: setelah, jumlahSisip: jumlah }));
  }
  return null;
}

/** Apakah baris ini pembuka angka perubahan bernomor `harap`? Toleran OCR ("L7.", "2 Ketentuan", "31 . Di"). */
export function nomorAngka(baris: string, harap: number): boolean {
  const m = baris.match(/^([0-9LlIO|]{1,3})\s*\.?\s+(Ketentuan|Di ?antara|Pasal|Judul|Penjelasan|BAB|Bab|Paragraf|Bagian|Lampiran)\b/);
  if (!m) return false;
  return Number(m[1]!.replace(/[LlI|]/g, "1").replace(/O/g, "0")) === harap;
}

export type HasilNormalIsi = { baris: string[]; ragu: string[] };

const hurufBerikut = (c: string) => String.fromCharCode(c.charCodeAt(0) + 1);

/** Judul Ayat rusak OCR: ")" dibaca "1"/"l"/"t" ("(21", "(41"), "(" dibaca "l" ("l2l"), atau ")" hilang ("(21" = Ayat 21). */
const AYAT_RUSAK_TUTUP = /^[(lI|](\d{1,2})[1lI|\]t]$/;
const AYAT_TANPA_TUTUP = /^\((\d{1,2})$/;

/** Salah baca OCR yang tidak aman dikoreksi di tengah teks: hanya ditandai. */
const POLA_RAGU = [
  /\bPasal\s?[tlI|]\d+[A-Z]?\b/g, // "Pasal t4"
  /\bPasal\s?\d+[lIO]\b/g, // "Pasal 7l"
  /\(\d+[1lI|](?=[,\sA-Za-z])/g, // "ayat (21," "ayat (21Undang"
  /\([lI|]{1,2}(?=[,\s])/g, // "ayat (ll,"
  /\d+o\/o/g, // "25o/o"
  /\d[\d.,]*O[\dO.,]*/g, // "2OO3", "Rp1OO.OOO"
];

function cariRagu(l: string): string[] {
  const temu: { i: number; teks: string }[] = [];
  for (const pola of POLA_RAGU) {
    for (const m of l.matchAll(pola)) {
      // Awal baris sudah dinilai sebagai judul Ayat/butir.
      if (m.index === 0) continue;
      const cuplikan = l.slice(Math.max(0, m.index - 15), m.index + m[0].length + 15).trim();
      temu.push({ i: m.index, teks: `"${cuplikan}" mungkin salah baca OCR ("${m[0]}")` });
    }
  }
  return temu.sort((a, b) => a.i - b.i).map((t) => t.teks);
}

/**
 * Koreksi OCR pada isi Pasal kutipan (baris sesudah judul "Pasal N"). Hanya di awal baris Ayat/butir, dan hanya bila
 * nomor/huruf hasil koreksi adalah yang diharapkan berikutnya. Teks janggal di luar konteks itu tidak diganti, dikembalikan di `ragu`.
 * Butir "a" yang menempel sesudah titik dua ("berikut: a- ...") dipindah ke baris sendiri.
 */
export function normalIsi(baris: string[], ayatPertama = 1): HasilNormalIsi {
  const out: string[] = [];
  const ragu: string[] = [];
  let harapAyat = ayatPertama;
  let harapHuruf: string | null = null;
  const antre = [...baris];
  while (antre.length) {
    let l = antre.shift()!;
    const tok = l.match(/^(\S+)(\s[\s\S]*)?$/);
    const t = tok?.[1] ?? "";
    const rapi = t.match(/^\((\d+)([a-z]?)\)$/);
    if (rapi) {
      if (!rapi[2]) harapAyat = Number(rapi[1]) + 1; // Ayat sisipan "(2a)" tidak menggeser urutan
      harapHuruf = null;
    } else if (tok?.[2] && (AYAT_RUSAK_TUTUP.test(t) || AYAT_TANPA_TUTUP.test(t))) {
      const calon = [t.match(AYAT_RUSAK_TUTUP)?.[1], t.match(AYAT_TANPA_TUTUP)?.[1]].filter((x) => x !== undefined).map(Number);
      if (calon.includes(harapAyat)) {
        l = `(${harapAyat})${tok[2]}`;
        harapAyat++;
        harapHuruf = null;
      } else ragu.push(`"${l.slice(0, 30)}" mungkin judul Ayat salah baca OCR, diharapkan (${harapAyat})`);
    }

    const butir = l.match(/^([a-z])([-.,])\s+(.*)$/);
    if (butir) {
      if (butir[2] === ".") harapHuruf = hurufBerikut(butir[1]!);
      else if (butir[1] === harapHuruf) {
        l = `${butir[1]}. ${butir[3]}`;
        harapHuruf = hurufBerikut(butir[1]!);
      } else ragu.push(`"${l.slice(0, 30)}" mungkin butir salah baca OCR, diharapkan huruf ${harapHuruf ?? "a"}`);
    }

    const pecah = l.match(/^(.*?:)\s+a[-.,]\s+(\S.*)$/);
    if (pecah) {
      l = pecah[1]!;
      antre.unshift(`a. ${pecah[2]}`);
      harapHuruf = "a";
    } else if (/:\s*$/.test(l)) harapHuruf = "a";
    ragu.push(...cariRagu(l));
    out.push(l);
  }
  return { baris: out, ragu };
}

/** Pecah baris kutipan yang sudah dinormalkan menjadi Ayat. `ayatPertama`: nomor Ayat yang diharapkan muncul pertama. */
function pecahKutipan(baris: string[], ayatPertama = 1): { ayat: AyatHasil[]; tidakUrut: string[] } {
  const ayat: { nomor: string | null; lines: string[] }[] = [];
  const tidakUrut: string[] = [];
  let sebelum = ayatPertama - 1;
  for (const l of baris) {
    const m = l.match(/^\((\d+)([a-z]?)\)\s*(.*)$/);
    const lanjutanRujukan = /\bayat$/.test(ayat.at(-1)?.lines.at(-1) ?? "");
    if (m && !lanjutanRujukan) {
      const n = Number(m[1]);
      const harap = m[2] ? sebelum : sebelum + 1;
      if (n !== harap) tidakUrut.push(`Ayat (${m[1]}${m[2]}) muncul, diharapkan (${harap})`);
      if (!m[2]) sebelum = n;
      ayat.push({ nomor: m[1]! + m[2]!, lines: m[3] ? [m[3]] : [] });
    } else {
      if (!ayat.length) ayat.push({ nomor: null, lines: [] });
      ayat.at(-1)!.lines.push(l);
    }
  }
  return { ayat: ayat.map((a) => ({ nomor: a.nomor, teks: sambungBaris(a.lines) })), tidakUrut };
}

export type Sasaran = { jenis: string; nomor: string; tahun: number };
const JENIS_PERATURAN: Record<string, string> = {
  "Undang-Undang": "UU",
  "Peraturan Pemerintah Pengganti Undang-Undang": "Perppu",
  "Peraturan Pemerintah": "PP",
};
const angkaOcr = (x: string) => x.replace(/O/g, "0").replace(/[lI]/g, "1").replace(/T/g, "7").replace(/S/g, "5");

/** Peraturan yang diubah, dari kalimat pembuka Pasal pengubah ("Beberapa ketentuan dalam Undang-Undang Nomor 13 Tahun 2003 ... diubah sebagai berikut:"). */
export function bacaSasaran(pembuka: string): Sasaran | null {
  const p = pembuka.replace(/Undang-\s+Undang/g, "Undang-Undang");
  if (!/(ketentuan|pengaturan baru)\b/i.test(p) || !/diubah|mengubah/.test(p) || !/berikut\s*:?\s*$/.test(p)) return null;
  const m = p.match(/(Undang-Undang|Peraturan Pemerintah Pengganti Undang-Undang|Peraturan Pemerintah) Nomor ([0-9OlI]+) Tahun ([0-9OlITS]{4})/);
  if (!m) return null;
  return { jenis: JENIS_PERATURAN[m[1]!]!, nomor: angkaOcr(m[2]!), tahun: Number(angkaOcr(m[3]!)) };
}

export const namaPeraturan = (x: Sasaran) => `${x.jenis} ${x.nomor}/${x.tahun}`;

export type JenisTinjauanPerubahan = "perubahan-tak-dikenali" | "penjelasan-diubah" | "sisip-bab" | "angka-tidak-urut" | "judul-isi-beda";

/** Satu perubahan atas satu Pasal sasaran. */
export type RencanaPerubahan = {
  rujukan: string; // "Lampiran, Pasal 81 angka 47"
  halaman: number[];
  jenis: Pola["jenis"];
  cakupan: Pola["cakupan"];
  pasal: string;
  sisipSetelah?: string;
  /** pasal-utuh ubah/sisip: Ayat Versi Pasal baru. ayat-saja ubah/sisip: Ayat Perubahan. */
  ayat: AyatHasil[];
  /** Hanya ayat-saja: Ayat yang disebut kalimat pembuka. */
  ayatDisebut?: string[];
  ragu: string[];
  tidakUrut: string[];
};

export type HasilUrai = {
  sasaran: Sasaran | null;
  rencana: RencanaPerubahan[];
  tinjauan: { jenis: JenisTinjauanPerubahan; pesan: string }[];
};

const AKHIR_PEMBUKA = /(berikut\s*:?|:|dihapus\.?)\s*$/;

/** Judul "Pasal N" di awal baris kutipan, boleh diikuti teks Pasal di baris yang sama ("Pasal 191A Pada saat ..."). */
function judulKutipan(l: string): { nomor: string; sisa: string } | null {
  const m = l.match(/^(Pa[s5$]a[il1IJ|]?)\s*([\dOolIi|]{1,4}[A-Z]?)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  const n = bacaJudul(`Pasal ${m[2]}`)?.nomor;
  return n ? { nomor: n, sisa: m[3] ?? "" } : null;
}

/** Isi Pasal pengubah (per baris) → Peraturan sasaran, rencana perubahan per Pasal, dan angka yang perlu tinjauan manual. */
export function uraiPengubah(isi: BarisHal[], rujukanPasal: string): HasilUrai {
  const tinjauan: HasilUrai["tinjauan"] = [];
  const rencana: RencanaPerubahan[] = [];

  // Kalimat pembuka Pasal pengubah, lalu angka-angka perubahan yang harus urut.
  let i = 0;
  const pembuka: string[] = [];
  while (i < isi.length) {
    pembuka.push(isi[i]!.teks);
    i++;
    if (/berikut\s*:?\s*$/.test(isi[i - 1]!.teks)) break;
  }
  const sasaran = bacaSasaran(pembuka.join(" "));
  const angka: { nomor: number; baris: BarisHal[] }[] = [];
  // OCR kadang menelan pergantian baris: "... kebendaan. 37 Pasal 96 dihapus. 38 Pasal 97 dihapus."
  // Hanya dipecah di nomor angka yang diharapkan berikutnya, sesudah akhir kalimat, dan diikuti kata kerja perubahan.
  const tempel = (teks: string, n: number) =>
    teks.match(new RegExp(String.raw`^(.*?[.;:])\s+(${n}\s*\.?\s+(?:Ketentuan|Di ?antara|Pasal \S+ dihapus)[\s\S]*)$`));
  const antre = isi.slice(i);
  while (antre.length) {
    let b = antre.shift()!;
    const baru = nomorAngka(b.teks, angka.length + 1);
    const t = angka.length || baru ? tempel(b.teks, angka.length + (baru ? 2 : 1)) : null;
    if (t) {
      antre.unshift({ teks: t[2]!, halaman: b.halaman });
      b = { teks: t[1]!, halaman: b.halaman };
    }
    if (baru) angka.push({ nomor: angka.length + 1, baris: [b] });
    else angka.at(-1)?.baris.push(b);
  }

  for (const a of angka) {
    const rujukan = `${rujukanPasal} angka ${a.nomor}`;
    const halaman = [...new Set(a.baris.flatMap((b) => b.halaman))];
    // Kalimat pembuka angka bisa terpotong ke baris berikutnya ("... Pasal88D," + "Pasal 88E, dan Pasal 88F sehingga ...").
    let k = 1;
    let kalimat = a.baris[0]!.teks;
    while (!AKHIR_PEMBUKA.test(kalimat) && k < Math.min(a.baris.length, 3)) kalimat += " " + a.baris[k++]!.teks;
    const isiAngka = a.baris.slice(k).map((b) => b.teks);
    const pola = kenaliPola(kalimat);
    if (!pola) {
      const jenis: JenisTinjauanPerubahan = /\bPenjelasan\b/.test(kalimat)
        ? "penjelasan-diubah"
        : /disisipkan.*\bbab\b/i.test(kalimat) || /^\S+\s+Di ?antara BAB\b/.test(kalimat)
          ? "sisip-bab"
          : "perubahan-tak-dikenali";
      tinjauan.push({ jenis, pesan: `${rujukan}: ${kalimat}` });
      continue;
    }
    const dasar = { rujukan, halaman, ragu: [] as string[], tidakUrut: [] as string[] };

    if (pola[0]!.jenis === "hapus") {
      for (const p of pola) rencana.push({ ...dasar, jenis: "hapus", cakupan: p.cakupan, pasal: p.pasal, ayat: [], ...(p.ayat ? { ayatDisebut: p.ayat } : {}) });
      continue;
    }

    if (pola[0]!.cakupan === "ayat-saja") {
      const p = pola[0]!;
      const pertama = parseInt(p.ayat![0]!, 10) || 1;
      const norm = normalIsi(isiAngka, pertama);
      const { ayat, tidakUrut } = pecahKutipan(norm.baris, pertama);
      if (ayat.map((x) => x.nomor).join() !== p.ayat!.join()) {
        tinjauan.push({
          jenis: "judul-isi-beda",
          pesan: `${rujukan}: Ayat di isi (${ayat.map((x) => x.nomor).join(", ")}) tidak sama dengan kalimat pembuka (${p.ayat!.join(", ")})`,
        });
        continue;
      }
      rencana.push({ ...dasar, jenis: p.jenis, cakupan: "ayat-saja", pasal: p.pasal, ayat, ayatDisebut: p.ayat!, ragu: norm.ragu, tidakUrut });
      continue;
    }

    // Pasal utuh: isi dibagi per judul "Pasal N" kutipan, sesuai Pasal yang disebut kalimat pembuka.
    const sisip = pola[0]!.jenis === "sisip";
    const harap = pola.map((p) => p.pasal);
    const bagian: { nomor: string; baris: string[] }[] = [];
    for (const l of isiAngka) {
      const j = judulKutipan(l);
      const berikut = harap[bagian.length];
      const cocok =
        j !== null &&
        berikut !== undefined &&
        !/^(ayat\b|,)/.test(j.sisa) &&
        (berikut === "?"
          ? sisip && new RegExp(`^${pola[0]!.sisipSetelah}[A-Z]$`).test(j.nomor) && (!bagian.length || j.nomor > bagian.at(-1)!.nomor)
          : j.nomor === berikut);
      if (cocok) bagian.push({ nomor: j.nomor, baris: j.sisa ? [j.sisa] : [] });
      else if (bagian.length) bagian.at(-1)!.baris.push(l);
    }
    if (bagian.length !== harap.length) {
      tinjauan.push({
        jenis: "judul-isi-beda",
        pesan: `${rujukan}: judul Pasal di isi (${bagian.map((b) => b.nomor).join(", ") || "tidak ada"}) tidak sama dengan kalimat pembuka (${harap.join(", ")})`,
      });
      continue;
    }
    for (const b of bagian) {
      const norm = normalIsi(b.baris);
      const { ayat, tidakUrut } = pecahKutipan(norm.baris);
      rencana.push({
        ...dasar,
        jenis: pola[0]!.jenis,
        cakupan: "pasal-utuh",
        pasal: b.nomor,
        ...(sisip ? { sisipSetelah: pola[0]!.sisipSetelah! } : {}),
        ayat,
        ragu: norm.ragu,
        tidakUrut,
      });
    }
  }
  return { sasaran, rencana, tinjauan };
}
