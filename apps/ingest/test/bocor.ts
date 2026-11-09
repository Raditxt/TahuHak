// Gagasan cek-bocor dari prototype #2: sisa header, nomor halaman, footer, atau kata sambung di teks yang tersimpan.
import { schema, type Db } from "@tahuhak/db";

const POLA_BOCOR: [string, RegExp][] = [
  ["header PRESIDEN", /(^|\n| )PRES[IiT1]\s?DEN( REPUBLIK INDONESIA)?(\n|$)|\bREPUBLIK INDONESIA$/m],
  ["nomor halaman", /(^|\s)[-_~]\s?[\w,.]{0,4}\d[\w,.]{0,4}\s?[-_~](\s|$)/],
  // Header rusak OCR: "EI{rEIEtrN", "INEENFF|A".
  ["header rusak OCR", /[{}[\]$|]\S*[{}[\]$|]/],
  ["footer salinan", /SK\s*No\.?\s*[\dlIOt]{4,}/i],
  ["kata sambung", /…|\.\.\.|(\.\s){2,}/],
  ["SALINAN", /\bSALINAN\b/],
  ["penutup Lembaran Negara", /TAMBAHAN LEMBARAN NEGARA/],
];

/** Semua teks Ayat dan Penjelasan di database yang memuat pola bocor, beserta potongan di sekitarnya. */
export async function cariBocor(db: Db): Promise<{ jumlahTeks: number; temuan: string[] }> {
  const teks = [
    ...(await db.select({ t: schema.ayat.teks }).from(schema.ayat)),
    ...(await db.select({ t: schema.penjelasan.teks }).from(schema.penjelasan)),
  ].map((r) => r.t);
  const temuan = teks.flatMap((t) =>
    POLA_BOCOR.flatMap(([nama, re]) => {
      const m = t.match(re);
      return m ? [`${nama}: …${t.slice(Math.max(0, m.index! - 40), m.index! + 40)}…`] : [];
    }),
  );
  return { jumlahTeks: teks.length, temuan };
}
