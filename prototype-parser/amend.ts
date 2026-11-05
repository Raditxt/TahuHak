// PROTOTYPE — pengenal pola perubahan. Ini bagian yang paling layak diangkat ke modul ingestion.
// Masukan: kalimat pembuka satu "angka" perubahan (mis. "Ketentuan Pasal 156 diubah sehingga berbunyi sebagai berikut:").
// Keluaran: daftar perubahan yang dikenali, atau null bila polanya tidak dikenali (→ tinjauan manual).

export type Pola = {
  jenis: "ubah" | "sisip" | "hapus";
  pasal: string;            // Pasal yang disentuh. Untuk sisip Pasal: Pasal baru (bila disebut), atau "?" bila nanti diambil dari judul di isi.
  ayat?: string[];          // hanya untuk cakupan ayat-saja
  cakupan: "pasal-utuh" | "ayat-saja";
  sisipSetelah?: string;    // sisip Pasal: "Di antara Pasal X dan Pasal Y" → X
  jumlahSisip?: number;
};

// Perbaiki salah baca OCR yang umum di nomor: "16O" → "160", "(l)" → "(1)", "Pasa1" → "Pasal".
export function normalNomor(s: string): string {
  return s
    .replace(/['`’]/g, "")
    .replace(/\bPasa[l1I|]?(?=\s?\d)/g, "Pasal")          // "Pasa125" → "Pasal25", "Pasa1 5" → "Pasal 5"
    .replace(/\bPasal(\d)/g, "Pasal $1")                  // "Pasal25" → "Pasal 25"
    .replace(/\bPasal [Ll|](\d)/g, "Pasal 1$1")           // "Pasal L7" → "Pasal 17"
    .replace(/\b(\d+)[O](\d*[A-Z]?)\b/g, "$10$2")         // "16O" → "160", "4O2A" → "402A"
    .replace(/\b[O](\d+)\b/g, "0$1")
    .replace(/\b(\d+)[Ll|](\d*[A-Z]?)\b/g, "$11$2")       // "L42"/"1l" → angka
    .replace(/\b[Ll](\d+[A-Z]?)\b/g, "1$1")               // "L42" → "142", "l7A" → "17A"
    .replace(/\bd[il1I]:?ub[a-z]{1,3}\b/g, "diubah")      // "diubatr", "dlubah", "di:ubah"
    .replace(/\bdisisipkan(\d)/g, "disisipkan $1")
    .replace(/\(\s*[lI|]\s*\)/g, "(1)")
    .replace(/\(\s*(\d+[a-z]?)\s*\)/g, "($1)")
    .replace(/\s+/g, " ")
    .trim();
}

const ANGKA_KATA: Record<string, number> = { satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10 };
const PSL = String.raw`(\d+[A-Z]?)`;
const AYT = String.raw`\((\d+[a-z]?)\)`;

function daftarAyat(s: string): string[] {
  return [...s.matchAll(/\((\d+[a-z]?)\)/g)].map((m) => m[1]);
}

export function kenaliPola(kalimatMentah: string): Pola[] | null {
  const k = normalNomor(kalimatMentah.replace(/^[0-9LlIO|]{1,3}\s*\.?\s+(?=[A-Z])/, "")); // buang nomor angka di depan (toleran OCR)
  let m: RegExpMatchArray | null;

  // 1. "Pasal 43 dihapus." / "Pasal 161 dan Pasal 162 dihapus."
  if ((m = k.match(new RegExp(String.raw`^((?:Pasal ${PSL}(?:,| dan)?\s*)+)dihapus\b`)))) {
    return [...m[1].matchAll(/Pasal (\d+[A-Z]?)/g)].map((x) => ({ jenis: "hapus", pasal: x[1], cakupan: "pasal-utuh" }));
  }
  // 2. "Ketentuan ayat (3) Pasal 59 dihapus." / "Ketentuan Pasal 59 ayat (3) dihapus."
  if ((m = k.match(new RegExp(String.raw`^Ketentuan ((?:ayat ${AYT}(?:,| dan)?\s*)+)Pasal ${PSL} dihapus\b`)))) {
    return [{ jenis: "hapus", pasal: m[m.length - 1], ayat: daftarAyat(m[1]), cakupan: "ayat-saja" }];
  }
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} ((?:ayat ${AYT}(?:,| dan)?\s*)+)dihapus\b`)))) {
    return [{ jenis: "hapus", pasal: m[1], ayat: daftarAyat(m[2]), cakupan: "ayat-saja" }];
  }
  // 3. "Ketentuan ayat (1) dan ayat (3) Pasal 79 diubah sehingga berbunyi ..." (hanya Ayat ditulis ulang)
  if ((m = k.match(new RegExp(String.raw`^Ketentuan ((?:ayat ${AYT}(?:,| dan)?\s*)+)Pasal ${PSL} diubah\b`)))) {
    return [{ jenis: "ubah", pasal: m[m.length - 1], ayat: daftarAyat(m[1]), cakupan: "ayat-saja" }];
  }
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} ((?:ayat ${AYT}(?:,| dan)?\s*)+)diubah\b`)))) {
    return [{ jenis: "ubah", pasal: m[1], ayat: daftarAyat(m[2]), cakupan: "ayat-saja" }];
  }
  // 4. "Ketentuan Pasal 156 diubah sehingga berbunyi sebagai berikut:" (Pasal ditulis ulang utuh)
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} diubah\b`)))) {
    return [{ jenis: "ubah", pasal: m[1], cakupan: "pasal-utuh" }];
  }
  // 5. "Di antara ayat (2) dan ayat (3) Pasal 88 disisipkan 1 (satu) ayat, yakni ayat (2a)" (sisip Ayat)
  if ((m = k.match(new RegExp(String.raw`^Di ?antara ayat ${AYT} dan ayat ${AYT} Pasal ${PSL} disisipkan .*?ayat`)))) {
    const baru = daftarAyat(k.slice(m[0].length));
    return [{ jenis: "sisip", pasal: m[3], ayat: baru.length ? baru : ["?"], cakupan: "ayat-saja" }];
  }
  // 6. "Ketentuan Pasal 92 ditambah 1 (satu) ayat, yakni ayat (4)" (tambah Ayat di ujung)
  if ((m = k.match(new RegExp(String.raw`^Ketentuan Pasal ${PSL} ditambah .*?ayat`)))) {
    const baru = daftarAyat(k.slice(m[0].length));
    return [{ jenis: "sisip", pasal: m[1], ayat: baru.length ? baru : ["?"], cakupan: "ayat-saja" }];
  }
  // 7. "Di antara Pasal 154 dan Pasal 155 disisipkan 1 (satu) pasal, yakni Pasal 154A ..."
  if ((m = k.match(new RegExp(String.raw`^Di ?antara (?:ketentuan )?Pasal ${PSL} dan Pasal ${PSL} disisipkan\s*(\d+|\w+)?\s*(?:\((\w+)\))?\s*pasal`, "i")))) {
    const jumlah = Number(m[3]) || ANGKA_KATA[(m[4] ?? m[3] ?? "").toLowerCase()] || 1;
    const base = m[1];
    // OCR: "828" = 82B, "9O" = 9 + huruf? → hanya 8→B yang aman diperbaiki.
    const disebut = [...k.slice(m[0].length).matchAll(/Pasal (\d+[A-Z]?)/g)].map((x) => x[1]).map((x) => (x === base + "8" ? base + "B" : x)).filter((x) => /[A-Z]$/.test(x));
    const nama = disebut.length ? disebut : Array.from({ length: jumlah }, () => "?");
    return nama.map((p) => ({ jenis: "sisip", pasal: p, cakupan: "pasal-utuh", sisipSetelah: m![1], jumlahSisip: jumlah }));
  }
  return null;
}

// Apakah baris ini pembuka sebuah angka perubahan bernomor `harap`? Toleran terhadap OCR ("L7.", "2 Ketentuan", "31 . Di").
export function nomorAngka(baris: string, harap: number): boolean {
  const m = baris.match(/^([0-9LlIO|]{1,3})\s*\.?\s+(Ketentuan|Di ?antara|Pasal|Judul|Penjelasan|BAB|Bab|Paragraf|Bagian|Lampiran)\b/);
  if (!m) return false;
  const n = Number(m[1].replace(/[LlI|]/g, "1").replace(/O/g, "0"));
  return n === harap;
}
