// Parser Perubahan (#7), bagian pengenal pola: kalimat pembuka satu angka perubahan → pola perubahan, atau null (tinjauan manual).
// Diangkat dari prototype #2 (amend.ts: kenaliPola, nomorAngka). normalNomor sudah ada di nomor-ocr.ts.
import { normalNomor } from "./nomor-ocr.ts";

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

/**
 * Koreksi OCR pada isi Pasal kutipan (baris sesudah judul "Pasal N"). Hanya di awal baris Ayat/butir, dan hanya bila
 * nomor/huruf hasil koreksi adalah yang diharapkan berikutnya. Teks janggal di luar konteks itu tidak diganti, dikembalikan di `ragu`.
 */
export function normalIsi(_baris: string[]): HasilNormalIsi {
  throw new Error("normalIsi belum diimplementasikan (#7)");
}
