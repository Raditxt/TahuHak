// PROTOTYPE — dibuang. Menjawab issue #2: apakah pdfjs → pembersih → parser struktur regex → parser perubahan
// menghasilkan Pasal/Ayat dan daftar perubahan yang benar dari empat dokumen nyata?
// Jalankan: bun run parse.ts   (hasil: out/<id>.json dan ringkasan di konsol)
import { readFileSync, writeFileSync } from "node:fs";
import { ekstrak } from "./extract.ts";
import { bersihkan, type Baris } from "./clean.ts";
import { kenaliPola, nomorAngka, normalNomor } from "./amend.ts";

type Ayat = { nomor: string | null; teks: string };
type Pasal = { nomor: string; ayat: Ayat[]; penjelasan?: string; halaman: number[]; mengubah?: string; _baris?: Baris[] };
type Perubahan = {
  jenis: "ubah" | "sisip" | "hapus";
  target: { peraturan: string; pasal: string; ayat?: string };
  rujukan: string;
  cakupan: "pasal-utuh" | "ayat-saja";
  teksBaru?: string;
  ayatBaru?: Ayat[];   // hanya untuk pasal-utuh: Versi Pasal baru yang sudah dipecah per Ayat
  halaman: number[];
};
type Kualitas = { token: number; porsiLapisanOcr: number; anehPer1000: number; oovPer1000: number; nilai: "digital" | "ocr-bawaan-layak" | "perlu-ocr"; contoh: string[] };
type HasilParse = {
  peraturan: { jenis: string; nomor: string; tahun: number; judul: string; asalTeks: "digital" | "ocr" };
  kualitas: Kualitas;
  pembersihan: Record<string, number>;
  pasal: Pasal[];
  lampiran?: { pasal: Pasal[] };
  perubahan: Perubahan[];
  peringatan: string[];
};

// ---------- nomor Pasal ----------
const pecah = (n: string) => { const m = n.match(/^(\d+)([A-Z]?)$/)!; return [Number(m[1]), m[2]] as const; };
function lanjutan(prev: string | null, n: string): "urut" | "loncat" | "mundur" {
  if (!prev) return n === "1" ? "urut" : "loncat";
  const [a, as] = pecah(prev), [b, bs] = pecah(n);
  if (b === a && bs > as) return bs.charCodeAt(0) - (as ? as.charCodeAt(0) : 64) === 1 ? "urut" : "loncat";
  if (b === a + 1 && !bs) return "urut";
  if (b > a) return "loncat";
  return "mundur";
}
const JUDUL_PASAL = /^Pasal (\d+[A-Z]?)$/;
// Judul Pasal toleran OCR: "Pasal24", "Pasal 1O8", "Pasal 1 1 1", "Pasa1 5", "Pasai3", "Pasal$", "Pasal S".
const PETA_OCR: Record<string, string> = { O: "0", o: "0", l: "1", I: "1", i: "1", "|": "1", J: "1", S: "5", s: "5", $: "5", T: "7", Z: "2", G: "6" };
type Judul = { nomor: string | null; rusak: boolean };
function judulMentah(s: string): Judul | null {
  const m = s.match(/^(Pa[s5$]a[il1IJ|]?)\s*([\dOolIi|JSs$TZG][\dOolIi|JSs$TZG ]{0,6}[A-Z]?)$/);
  if (!m) return null;
  const raw = m[2].replace(/\s+/g, "");
  const huruf = raw.match(/^(.*?\d.*?)([A-Z])$/) && !/[OISTZG]$/.test(raw) ? raw.slice(-1) : "";
  const inti = huruf ? raw.slice(0, -1) : raw;
  const n = [...inti].map((c) => PETA_OCR[c] ?? c).join("") + huruf;
  const rusak = m[1] !== "Pasal" || inti !== inti.replace(/[^\d]/g, "");
  return /^\d+[A-Z]?$/.test(n) ? { nomor: n, rusak } : { nomor: null, rusak: true };
}
const judulPasal = (s: string) => judulMentah(s)?.nomor ?? null;
function harapBerikut(prev: string | null): string { return prev ? String(pecah(prev)[0] + 1) : "1"; }
const BAB = /^BAB\s*[IVXLCvxlm]+\b|^BAB$/;
const BAGIAN = /^(Bagian|Paragraf) [A-Z][a-z]+$|^Paragraf \d+$/;
const PENUTUP = /^(Disahkan|Ditetapkan|Diundangkan) di\b|^Agar (setiap orang|supaya)/;

// ---------- teks & ayat ----------
function sambung(lines: string[]): string {
  let out = "";
  for (const l of lines) {
    if (!out) { out = l; continue; }
    if (/^([a-z]|\d{1,2})\s*[.)]\s/.test(l)) out += "\n" + l;           // butir huruf/angka di baris baru
    else if (/[a-z]-$/.test(out) && /^[a-z]/.test(l)) out = out.slice(0, -1) + l; // pemenggalan kata
    else out += " " + l;
  }
  return out;
}
function pecahAyat(lines: string[], ctx: string, peringatan: string[]): Ayat[] {
  const ayat: { nomor: string | null; lines: string[] }[] = [];
  let harap = 1;
  for (const raw of lines) {
    const l = normalNomor(raw);
    let m = l.match(/^\((\d+[a-z]?)\)\s*(.*)$/);
    // OCR: "(41 Lembaga..." = "(4) Lembaga..."
    if (!m) { const o = l.match(/^\((\d)[1lI\]|]\s+(.*)$/); if (o && Number(o[1]) === harap) m = o; }
    const sebelum = ayat.length ? ayat[ayat.length - 1].lines.at(-1) ?? "" : "";
    if (m && ayat.length && (parseInt(m[1]) < harap && !/[a-z]$/.test(m[1]) || /\sayat\s*$/.test(sebelum))) m = null; // "...dalam ayat / (1) huruf a"
    if (m) {
      const n = m[1];
      const nn = parseInt(n);
      if (nn !== harap && !/[a-z]$/.test(n)) peringatan.push(`${ctx}: Ayat (${n}) tidak urut, diharapkan (${harap})`);
      ayat.push({ nomor: n, lines: m[2] ? [m[2]] : [] });
      if (!/[a-z]$/.test(n)) harap = nn + 1;
    } else {
      if (!ayat.length) ayat.push({ nomor: null, lines: [] });
      ayat[ayat.length - 1].lines.push(raw);
    }
  }
  // teks sebelum ayat (1) yang hanya sepotong biasanya tidak ada; bila ada, gabung sebagai Ayat tanpa nomor.
  return ayat.map((a) => ({ nomor: a.nomor, teks: sambung(a.lines) })).filter((a) => a.teks || a.nomor);
}

// ---------- zona dokumen ----------
type Zona = { nama: "batang" | "penjelasan" | "lampiran" | "penjelasanLampiran"; baris: Baris[] };
function bagiZona(baris: Baris[]): Zona[] {
  const zona: Zona[] = [{ nama: "batang", baris: [] }];
  let adaLampiran = false;
  for (let i = 0; i < baris.length; i++) {
    const t = baris[i].teks.trim();
    const t2 = baris[i + 1]?.teks.trim() ?? "";
    if (/^PENJELASAN$/.test(t) && /^ATAS$/.test(t2)) { zona.push({ nama: adaLampiran ? "penjelasanLampiran" : "penjelasan", baris: [] }); continue; }
    if (/^LAMPIRAN$/.test(t) && /^(UNDANG|PERATURAN)/.test(t2)) { adaLampiran = true; zona.push({ nama: "lampiran", baris: [] }); continue; }
    zona[zona.length - 1].baris.push(baris[i]);
  }
  return zona;
}

// ---------- parser struktur ----------
function parsePasal(baris: Baris[], ctx: string, peringatan: string[], modeLampiran = false): Pasal[] {
  const pasal: Pasal[] = [];
  let cur: Pasal | null = null;
  let tutup = false;
  let sebutTerakhir = new Set<string>();
  for (let i = 0; i < baris.length; i++) {
    const b = baris[i];
    const t = b.teks;
    if (/^[0-9LlIO|]{1,3}\s*\.?\s+(Ketentuan|Di ?antara)/.test(t)) sebutTerakhir = new Set([...normalNomor(sambung([t, baris[i + 1]?.teks ?? ""])).replace(/Di ?antara (ketentuan )?Pasal \S+ dan Pasal \S+/, "").matchAll(/Pasal (\d+[A-Z]?)/g)].map((m) => m[1]));
    const jm = judulMentah(t);
    let n = jm?.nomor ?? null;
    if (jm && !cur?.mengubah) {
      const prevN = pasal.length ? pasal[pasal.length - 1].nomor : null;
      const harap = harapBerikut(prevN);
      // Judul rusak OCR yang nomornya tidak urut/tak terbaca: tebak dari urutan.
      const relN = n ? lanjutan(prevN, n) : "mundur";
      if (jm.rusak && n !== harap && (relN === "mundur" || (relN === "loncat" && pecah(n!)[0] - pecah(prevN ?? "0")[0] > 3))) {
        peringatan.push(`${ctx}: judul rusak "${t}" (hal ${b.hal}) dibaca sebagai Pasal ${harap} dari urutan`);
        n = harap;
      }
    }
    if (n) {
      const prev = pasal.length ? pasal[pasal.length - 1].nomor : null;
      const rel = lanjutan(prev, n);
      // Di dalam Pasal yang mengubah Peraturan lain, judul "Pasal N" hampir selalu kutipan (Pasal di dalam Pasal).
      // Judul hanya diterima sebagai Pasal sendiri bila urut DAN didahului BAB/Bagian/Paragraf atau diikuti "Beberapa ketentuan".
      if (cur?.mengubah) {
        // Kutipan bila: didahului kalimat "...berikut:", atau nomornya disebut di kalimat pembuka angka terakhir,
        // atau bernomor huruf (Perppu tidak punya Pasal sisipan). Selain itu judul yang urut = Pasal Perppu berikutnya.
        const sebelumnya = baris[i - 1]?.teks ?? "";
        const pembukaPengubah = /^(Beberapa )?ketentuan dalam (Undang|Peraturan)/i.test(baris[i + 1]?.teks ?? "");
        const disebut = sebutTerakhir.has(n) && !pembukaPengubah;
        if (rel !== "urut" || /berikut\s*:?\s*$/.test(sebelumnya) || disebut || /[A-Z]$/.test(n)) {
          if (rel === "urut" && !/berikut\s*:?\s*$/.test(sebelumnya)) peringatan.push(`${ctx}: judul "Pasal ${n}" (hal ${b.hal}) urut tapi dianggap kutipan di dalam Pasal ${cur.nomor}; perlu dicek`);
          sebutTerakhir.delete(n); // sudah dipakai sebagai kutipan; judul bernomor sama berikutnya bisa Pasal Perppu
          cur._baris!.push(b);
          continue;
        }
      } else if (rel === "mundur" || (rel === "loncat" && pecah(n)[0] - pecah(prev ?? "0")[0] > 5)) {
        peringatan.push(`${ctx}: judul "Pasal ${n}" (hal ${b.hal}) setelah Pasal ${prev} ditolak (bukan urutan)`);
        cur?._baris!.push(b);
        continue;
      } else if (rel === "loncat") {
        peringatan.push(`${ctx}: nomor Pasal loncat ${prev} → ${n} (hal ${b.hal})`);
      }
      cur = { nomor: n, ayat: [], halaman: [b.hal], _baris: [] };
      pasal.push(cur);
      tutup = false;
      if (modeLampiran) {
        // Pasal pengubah: kalimat pembukanya (sampai "berikut:") menyebut "ketentuan dalam Undang-Undang/Peraturan ... diubah".
        const pembuka: string[] = [];
        for (let j = i + 1; j < Math.min(baris.length, i + 30); j++) { pembuka.push(baris[j].teks); if (/berikut\s*:?\s*$/.test(baris[j].teks)) break; }
        const p = sambung(pembuka).replace(/Undang-\s+Undang/g, "Undang-Undang");
        // Variasi nyata: "Beberapa ketentuan dalam UU…", "Untuk …, beberapa ketentuan dalam UU…", "Ketentuan Pasal 9 UU…",
        // "Ketentuan Pasal 48 dalam UU…", "Perppu ini mengubah, menghapus, atau menetapkan pengaturan baru yang diatur dalam UU…".
        const sebutUU = /(ketentuan|pengaturan baru)\b.{0,60}?(Undang-Undang|Peraturan Pemerintah) Nomor/i.test(p);
        if (sebutUU && /diubah|mengubah/.test(p) && /berikut\s*:?\s*$/.test(p)) {
          const target = p.match(/(Undang-Undang|Peraturan Pemerintah) Nomor ([\dOlIt]+) Tahun ([\dOolIT]{4})/);
          const ocrAngka = (x: string) => x.replace(/[Oo]/g, "0").replace(/[lI]/g, "1").replace(/[Tt]/g, "7");
          cur.mengubah = target ? `${target[1] === "Undang-Undang" ? "UU" : "PP"} ${ocrAngka(target[2])}/${ocrAngka(target[3])}` : "?";
        }
      }
      continue;
    }
    if (!cur || tutup) continue;
    if (PENUTUP.test(t)) { tutup = true; continue; }
    if (!cur.mengubah) {
      // Judul BAB/Bagian/Paragraf dan satu baris judulnya tidak masuk teks Pasal.
      if (BAB.test(t)) { i++; if (baris[i + 1] && /^[A-Z ,&-]+$/.test(baris[i + 1].teks) && !judulPasal(baris[i + 1].teks)) i++; continue; }
      if (BAGIAN.test(t)) { i++; continue; }
    }
    cur._baris!.push(b);
    if (!cur.halaman.includes(b.hal)) cur.halaman.push(b.hal);
  }
  for (const p of pasal) {
    if (!p.mengubah) p.ayat = pecahAyat(p._baris!.map((x) => x.teks), `${ctx} Pasal ${p.nomor}`, peringatan);
    else p.ayat = [{ nomor: null, teks: `[Pasal pengubah ${p.mengubah}; isinya diurai di "perubahan"]` }];
  }
  return pasal;
}

// ---------- penjelasan Pasal demi Pasal ----------
function parsePenjelasan(baris: Baris[]): Map<string, string> {
  const peta = new Map<string, string[]>();
  let mulai = baris.findIndex((b) => /PASAL\s*DEMI\s*PASAL/i.test(b.teks));
  if (mulai < 0) mulai = 0;
  let cur: string | null = null;
  let prev: string | null = null;
  for (const b of baris.slice(mulai + 1)) {
    const t = normalNomor(b.teks);
    // Gaya Perda lama: "Pasal 9 s/d 14 : Cukup Jelas." / "Pasal 15 : teks"
    // Gaya Perda lama: "Pasal 2 s/d3 : Cukup jelas." / "Pasal 4 ayat (1) : teks" / "Pasal 1 1 Cukup jelas." (titik dua dibaca "1")
    const perda = t.match(/^Pasal (\d+)(?:\s*s\/d\s*(\d+))?\s*(ayat \(\d+\))?\s*(?::|1 (?=[A-Z]))\s*(.*)$/);
    if (perda) {
      const a = Number(perda[1]), z = Number(perda[2] ?? perda[1]);
      for (let k = a; k <= z; k++) {
        const isi = (perda[3] ? perda[3] + ": " : "") + perda[4];
        peta.set(String(k), [...(perda[3] && peta.has(String(k)) ? peta.get(String(k))! : []), isi]);
      }
      cur = String(z); prev = cur; continue;
    }
    const n = judulPasal(b.teks);
    if (n && lanjutan(prev, n) !== "mundur") { cur = n; prev = n; peta.set(n, []); continue; }
    if (cur && !/^TAMBAHAN LEMBARAN/.test(t)) peta.get(cur)!.push(b.teks);
  }
  return new Map([...peta].map(([k, v]) => [k, v.join("\n")]));
}

// ---------- parser perubahan ----------
function parsePerubahan(p: Pasal, peringatan: string[]): Perubahan[] {
  const L = p._baris!;
  const mulai = L.findIndex((b) => /berikut\s*:?\s*$/.test(b.teks)) + 1;
  const awalAngka: number[] = [];
  let harap = 1;
  for (let i = mulai; i < L.length; i++) {
    if (nomorAngka(L[i].teks, harap)) { awalAngka.push(i); harap++; }
    else if (nomorAngka(L[i].teks, harap + 1)) { peringatan.push(`Lampiran Pasal ${p.nomor}: angka ${harap} tidak ditemukan (hal ${L[i].hal})`); awalAngka.push(i); harap += 2; }
  }
  const out: Perubahan[] = [];
  awalAngka.forEach((s, k) => {
    const e = awalAngka[k + 1] ?? L.length;
    const blok = L.slice(s, e);
    let akhirIntro = blok.findIndex((b) => /berikut\s*:?\s*$|dihapus\.?\s*$/.test(b.teks));
    if (akhirIntro < 0 || akhirIntro > 4) akhirIntro = 0;
    const intro = sambung(blok.slice(0, akhirIntro + 1).map((x) => x.teks));
    const isi = blok.slice(akhirIntro + 1);
    const angka = k + 1;
    const rujukan = `Lampiran, Pasal ${p.nomor} angka ${angka}`;
    const halaman = [...new Set(blok.map((b) => b.hal))];
    const pola = kenaliPola(intro);
    if (!pola) { peringatan.push(`${rujukan}: pola tidak dikenali → tinjauan manual: "${intro.slice(0, 90)}"`); return; }
    // Pecah isi menurut judul Pasal (untuk sisip banyak Pasal).
    const potong: { nomor: string; baris: Baris[] }[] = [];
    for (const b of isi) {
      const n = judulPasal(b.teks);
      if (n) potong.push({ nomor: n, baris: [] });
      else if (potong.length) potong[potong.length - 1].baris.push(b);
    }
    const teksDari = (bs: Baris[]) => sambung(bs.map((x) => x.teks));
    // OCR membaca huruf B sebagai 8 ("828" = 82B): perbaiki bila nomor dasarnya sama dengan Pasal sisipan lain di angka ini.
    if (pola[0].jenis === "sisip") for (const pt of potong) {
      const base = pola[0].sisipSetelah;
      if (base && new RegExp(`^${base}8$`).test(pt.nomor)) { peringatan.push(`${rujukan}: judul "${pt.nomor}" dibaca sebagai ${base}B (OCR 8→B)`); pt.nomor = base + "B"; }
    }
    if (pola[0].jenis === "sisip" && pola[0].cakupan === "pasal-utuh") {
      if (potong.length !== pola.length) peringatan.push(`${rujukan}: disebut sisip ${pola.length} Pasal, di isi ada ${potong.length} judul Pasal (${potong.map((x) => x.nomor).join(", ")})`);
      potong.forEach((pt, j) => {
        const nama = pola[j]?.pasal && pola[j].pasal !== "?" ? pola[j].pasal : pt.nomor;
        if (nama !== pt.nomor) peringatan.push(`${rujukan}: nama sisipan ${nama} ≠ judul ${pt.nomor}`);
        out.push({ jenis: "sisip", target: { peraturan: p.mengubah!, pasal: pt.nomor }, rujukan, cakupan: "pasal-utuh", teksBaru: teksDari(pt.baris), halaman });
      });
      return;
    }
    for (const x of pola) {
      const r: Perubahan = { jenis: x.jenis, target: { peraturan: p.mengubah!, pasal: x.pasal, ...(x.ayat ? { ayat: x.ayat.join(",") } : {}) }, rujukan, cakupan: x.cakupan, halaman };
      if (x.jenis !== "hapus") {
        if (x.cakupan === "pasal-utuh") {
          if (potong[0]?.nomor !== x.pasal) peringatan.push(`${rujukan}: judul isi "${potong[0]?.nomor}" ≠ target Pasal ${x.pasal}`);
          r.teksBaru = teksDari(potong[0]?.baris ?? isi);
          r.ayatBaru = pecahAyat((potong[0]?.baris ?? isi).map((x) => x.teks), rujukan, peringatan);
        } else r.teksBaru = teksDari(isi);
      }
      out.push(r);
    }
  });
  return out;
}

// ---------- kualitas teks ----------
const kata = (s: string) => s.split(/\s+/).map((w) => w.replace(/^[("'“]+|[)"'”.,;:!?]+$/g, "")).filter(Boolean);
function aneh(w: string): boolean {
  return /[{}|~\\^`•·»«©®□■¡]/.test(w)
    || /^\d*[0-9][OolI][0-9OolI]*$|^[OolI][0-9]+$/.test(w) && /\d/.test(w)      // 2O2O, 16O, l0
    || /[A-Z]{2,}[a-z]+[A-Z]/.test(w)                                           // PRESiDEN
    || /^[a-z]{3,}[A-Z][a-z]{2,}/.test(w);                                      // PeraturanDaerah → kata menempel
}
function nilaiKualitas(teks: string, leksikon: Set<string>, porsiLapisanOcr: number): Kualitas {
  const ws = kata(teks);
  const contoh = new Map<string, number>();
  let nAneh = 0, nOov = 0, nKandidat = 0;
  for (const w of ws) {
    if (aneh(w)) { nAneh++; contoh.set(w, (contoh.get(w) ?? 0) + 1); continue; }
    if (/^[a-z]{5,}$/.test(w)) { nKandidat++; if (!leksikon.has(w)) { nOov++; contoh.set(w, (contoh.get(w) ?? 0) + 1); } }
  }
  const anehPer1000 = +(1000 * nAneh / ws.length).toFixed(1);
  const oovPer1000 = +(1000 * nOov / Math.max(1, nKandidat)).toFixed(1);
  // Sinyal utama: teks tak terlihat (render mode 3) di sebagian besar halaman = scan berlapis OCR.
  // Sinyal kedua (hanya untuk scan): kata aneh per 1000 token. Ambang 10‰ dari angka dokumen ini (lihat verdict).
  // OOV dicatat tapi tidak dipakai menilai: leksikon dari 2 dokumen ketenagakerjaan terlalu sempit untuk omnibus.
  const nilai = porsiLapisanOcr < 0.5 ? "digital" : anehPer1000 < 10 ? "ocr-bawaan-layak" : "perlu-ocr";
  return { token: ws.length, porsiLapisanOcr: +porsiLapisanOcr.toFixed(2), anehPer1000, oovPer1000, nilai,contoh: [...contoh.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([w, n]) => `${w}×${n}`) };
}

// ---------- metadata ----------
function meta(baris: Baris[], asalTeks: "digital" | "ocr") {
  const awal = baris.slice(0, 30).map((b) => normalNomor(b.teks));
  const jenisBaris = awal.find((t) => /^(UNDANG-UNDANG|PERATURAN PEMERINTAH|PERATURAN\s*DAERAH)/i.test(t)) ?? "?";
  const jenis = /UNDANG/.test(jenisBaris) ? "UU" : /PEMERINTAH/.test(jenisBaris) ? "PP" : /DAERAH/.test(jenisBaris) ? "Perda" : "?";
  const ocrAngka = (x: string) => [...x].map((c) => PETA_OCR[c] ?? c).join("");
  const nt0 = awal.join(" ").match(/NOMOR\s*:?\s*([\dOolIi|JSs$TZG]+)\s+TAHUN\s*:?\s*([\dOolIi|JSs$TZG]{4})/);
  const nt = nt0 ? [nt0[0], ocrAngka(nt0[1]), ocrAngka(nt0[2])] : null;
  const iT = awal.findIndex((t) => t === "TENTANG");
  const iR = awal.findIndex((t) => /^DENGAN RAHMAT/i.test(t));
  const judul = iT >= 0 ? awal.slice(iT + 1, iR > iT ? iR : iT + 4).join(" ") : "?";
  return { jenis, nomor: nt?.[1] ?? "?", tahun: Number(nt?.[2] ?? 0), judul, asalTeks };
}

// ---------- main ----------
async function parseDokumen(id: string, file: string, asalTeks: "digital" | "ocr", leksikon: Set<string>): Promise<HasilParse> {
  const hal = await ekstrak(id, file);
  const { baris, dibuang, barisBerulang } = bersihkan(hal);
  const peringatan: string[] = barisBerulang.map((t) => `baris berulang dibuang sebagai watermark/header: "${t}"`);
  // Kata mencurigakan hasil OCR, dengan halamannya (maks 40 per dokumen) → tinjauan manual.
  if (hal.some((h) => h.teksTakTerlihat)) {
    const dicatat: string[] = [];
    for (const b of baris) for (const w of kata(b.teks)) if (aneh(w) && dicatat.length < 40) dicatat.push(`"${w}" hal ${b.hal}`);
    if (dicatat.length) peringatan.push(`kata mencurigakan (OCR): ${dicatat.join(", ")}`);
  }
  const zona = bagiZona(baris);
  const z = (n: Zona["nama"]) => zona.filter((x) => x.nama === n).flatMap((x) => x.baris);
  const porsi = hal.filter((h) => h.teksTakTerlihat).length / hal.length;
  const kualitas = nilaiKualitas(baris.map((b) => b.teks).join(" "), leksikon, porsi);
  asalTeks = porsi >= 0.5 ? "ocr" : "digital";
  const pasal = parsePasal(z("batang"), "batang", peringatan);
  const penj = parsePenjelasan(z("penjelasan"));
  for (const p of pasal) if (penj.has(p.nomor)) p.penjelasan = penj.get(p.nomor);
  const tanpaPenj = pasal.filter((p) => !p.penjelasan).map((p) => p.nomor);
  if (z("penjelasan").length && tanpaPenj.length) peringatan.push(`Pasal tanpa Penjelasan tertaut: ${tanpaPenj.join(", ")}`);
  let lampiran: HasilParse["lampiran"];
  const perubahan: Perubahan[] = [];
  if (z("lampiran").length) {
    const lp = parsePasal(z("lampiran"), "lampiran", peringatan, true);
    for (const p of lp) if (p.mengubah) perubahan.push(...parsePerubahan(p, peringatan));
    lampiran = { pasal: lp };
  }
  const bersih = (ps: Pasal[]) => ps.map(({ _baris, ...r }) => r);
  return {
    peraturan: meta(baris, asalTeks), kualitas, pembersihan: dibuang,
    pasal: bersih(pasal), ...(lampiran ? { lampiran: { pasal: bersih(lampiran.pasal) } } : {}),
    perubahan, peringatan,
  };
}

const src = JSON.parse(readFileSync("sources.json", "utf8"));
const dok: { id: string; file: string; asal: "digital" | "ocr" }[] = [
  ...src.dokumen.map((d: any) => ({ id: d.id, file: d.file, asal: "digital" as const })),
  { id: "perda-mks-1983-ocr", file: "ocr/perda-mks-1983.ocr.pdf", asal: "ocr" },
];
// Leksikon dari dua dokumen yang teksnya paling bersih; kata harus muncul ≥ 2 kali.
const frek = new Map<string, number>();
for (const id of ["uu-13-2003", "pp-35-2021"]) {
  const h = await ekstrak(id, `pdf/${id}.pdf`);
  for (const w of kata(h.flatMap((x) => x.baris).join(" "))) if (/^[a-z]{5,}$/.test(w)) frek.set(w, (frek.get(w) ?? 0) + 1);
}
const leksikon = new Set([...frek].filter(([, n]) => n >= 2).map(([w]) => w));

for (const d of dok) {
  const r = await parseDokumen(d.id, d.file, d.asal, leksikon);
  writeFileSync(`out/${d.id}.json`, JSON.stringify(r, null, 2));
  const per81 = r.perubahan.filter((x) => x.rujukan.includes("Pasal 81 "));
  console.log(`\n=== ${d.id} — ${r.peraturan.jenis} ${r.peraturan.nomor}/${r.peraturan.tahun}: ${r.peraturan.judul.slice(0, 70)}`);
  console.log(`asal: ${r.peraturan.asalTeks}  kualitas: ${r.kualitas.nilai} (lapisan OCR ${r.kualitas.porsiLapisanOcr}, aneh ${r.kualitas.anehPer1000}‰, oov ${r.kualitas.oovPer1000}‰)  dibuang: ${JSON.stringify(r.pembersihan)}`);
  console.log(`pasal batang: ${r.pasal.length} [${r.pasal[0]?.nomor}…${r.pasal.at(-1)?.nomor}]  berpenjelasan: ${r.pasal.filter((p) => p.penjelasan).length}`);
  if (r.lampiran) console.log(`pasal lampiran: ${r.lampiran.pasal.length} [${r.lampiran.pasal[0]?.nomor}…${r.lampiran.pasal.at(-1)?.nomor}]  pengubah: ${r.lampiran.pasal.filter((p) => p.mengubah).length}  perubahan total: ${r.perubahan.length}  dari Pasal 81: ${per81.length}`);
  console.log(`peringatan: ${r.peringatan.length}`);
}
