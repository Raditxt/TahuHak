// Salah baca OCR pada nomor Pasal dan Ayat. Diangkat dari prototype #2 (amend.ts: normalNomor, judulMentah).

/** Perbaiki salah baca OCR yang umum di nomor: "16O" → "160", "(l)" → "(1)", "Pasa125" → "Pasal 25". */
export function normalNomor(s: string): string {
  return s
    .replace(/['`’]/g, "")
    .replace(/\bPasa[l1I|]?(?=\s?\d)/g, "Pasal")
    .replace(/\bPasal(\d)/g, "Pasal $1")
    .replace(/\bPasal [Ll|](\d)/g, "Pasal 1$1")
    .replace(/\b(\d+)[O](\d*[A-Z]?)\b/g, "$10$2")
    .replace(/\b[O](\d+)\b/g, "0$1")
    .replace(/\b(\d+)[Ll|](\d*[A-Z]?)\b/g, "$11$2")
    .replace(/\b[Ll](\d+[A-Z]?)\b/g, "1$1")
    .replace(/\bd[il1I]:?ub[a-z]{1,3}\b/g, "diubah")
    .replace(/\bdisisipkan(\d)/g, "disisipkan $1")
    .replace(/\(\s*[lI|]\s*\)/g, "(1)")
    .replace(/\(\s*(\d+[a-z]?)\s*\)/g, "($1)")
    .replace(/\s+/g, " ")
    .trim();
}

/** Huruf yang dibaca OCR sebagai pengganti angka di nomor judul Pasal. */
const PETA_OCR: Record<string, string> = { O: "0", o: "0", l: "1", I: "1", i: "1", "|": "1", J: "1", S: "5", s: "5", $: "5", T: "7", Z: "2", G: "6" };
const KAR_NOMOR = String.raw`[\dOolIi|JSs$TZG]`;
const POLA_JUDUL = new RegExp(String.raw`^(Pa[s5$]a[il1IJ|]?)\s*(${KAR_NOMOR}[\dOolIi|JSs$TZG ]{0,6}[A-Z]?)$`);

/** Judul "Pasal N" yang dibaca toleran OCR. `rusak`: bunyinya bukan "Pasal <angka>" yang bersih. `nomor` null bila tak terbaca. */
export type Judul = { nomor: string | null; rusak: boolean };

export function bacaJudul(s: string): Judul | null {
  const bersih = s.match(/^Pasal (\d+[A-Z]?)$/);
  if (bersih) return { nomor: bersih[1]!, rusak: false };
  const m = s.match(POLA_JUDUL);
  if (!m) return null;
  const mentah = m[2]!.replace(/\s+/g, "");
  // Huruf sisipan di akhir ("154A"), kecuali huruf yang lebih mungkin angka salah baca.
  const huruf = /\d.*[A-Z]$/.test(mentah) && !/[OISTZG]$/.test(mentah) ? mentah.slice(-1) : "";
  const inti = huruf ? mentah.slice(0, -1) : mentah;
  const nomor = [...inti].map((c) => PETA_OCR[c] ?? c).join("") + huruf;
  return /^\d+[A-Z]?$/.test(nomor) ? { nomor, rusak: true } : { nomor: null, rusak: true };
}
