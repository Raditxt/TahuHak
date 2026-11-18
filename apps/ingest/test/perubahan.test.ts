// Tes pengenal pola Parser Perubahan (#7): kenaliPola dan nomorAngka diangkat utuh dari prototype #2 (amend.test.ts), ditambah tes normalIsi (koreksi OCR isi Pasal kutipan). Satu-satunya tes di bawah Seam A yang memanggil fungsi parser langsung.
import { expect, test } from "vitest";
import { kenaliPola, nomorAngka, normalIsi } from "../src/perubahan.ts";

test("ubah Pasal utuh", () => {
  expect(kenaliPola("47. Ketentuan Pasal 156 diubah sehingga berbunyi sebagai berikut:")).toEqual([
    { jenis: "ubah", pasal: "156", cakupan: "pasal-utuh" },
  ]);
});

test("ubah Pasal utuh dengan nomor rusak OCR", () => {
  expect(kenaliPola("52. Ketentuan Pasal 16O diubah sehingga berbunyi sebagai berikut:")?.[0]?.pasal).toBe("160");
});

test("sisip satu Pasal, nama disebut", () => {
  expect(kenaliPola("Di antara Pasal 154 dan Pasal 155 disisipkan 1 (satu) pasal, yakni Pasal 154A sehingga berbunyi sebagai berikut:")).toEqual([
    { jenis: "sisip", pasal: "154A", cakupan: "pasal-utuh", sisipSetelah: "154", jumlahSisip: 1 },
  ]);
});

test("sisip banyak Pasal, nama tidak disebut → '?' sejumlah yang disebut", () => {
  const p = kenaliPola("28. Di antara Pasal 88 dan Pasal 89 disisipkan 6 (enam) pasal, yakni sebagai berikut:");
  expect(p?.length).toBe(6);
  expect(p?.every((x) => x.jenis === "sisip" && x.pasal === "?" && x.sisipSetelah === "88")).toBe(true);
});

test("hapus satu Pasal dan beberapa Pasal", () => {
  expect(kenaliPola("44. Pasal 154 dihapus.")).toEqual([{ jenis: "hapus", pasal: "154", cakupan: "pasal-utuh" }]);
  expect(kenaliPola("Pasal 161 dan Pasal 162 dihapus.")?.map((x) => x.pasal)).toEqual(["161", "162"]);
});

test("ubah hanya Ayat (dua urutan kata)", () => {
  expect(kenaliPola("Ketentuan ayat (3) Pasal 59 diubah sehingga berbunyi sebagai berikut:")).toEqual([
    { jenis: "ubah", pasal: "59", ayat: ["3"], cakupan: "ayat-saja" },
  ]);
  expect(kenaliPola("Ketentuan Pasal 79 ayat (2) dan ayat (5) diubah sehingga berbunyi sebagai berikut:")).toEqual([
    { jenis: "ubah", pasal: "79", ayat: ["2", "5"], cakupan: "ayat-saja" },
  ]);
});

test("hapus hanya Ayat", () => {
  expect(kenaliPola("Ketentuan ayat (4) Pasal 88 dihapus.")).toEqual([{ jenis: "hapus", pasal: "88", ayat: ["4"], cakupan: "ayat-saja" }]);
});

test("sisip Ayat", () => {
  expect(kenaliPola("Di antara ayat (2) dan ayat (3) Pasal 88 disisipkan 1 (satu) ayat, yakni ayat (2a) sehingga berbunyi sebagai berikut:")).toEqual([
    { jenis: "sisip", pasal: "88", ayat: ["2a"], cakupan: "ayat-saja" },
  ]);
  expect(kenaliPola("Ketentuan Pasal 92 ditambah 1 (satu) ayat, yakni ayat (4) sehingga berbunyi sebagai berikut:")?.[0]).toMatchObject({
    jenis: "sisip", pasal: "92", ayat: ["4"], cakupan: "ayat-saja",
  });
});

test("pola bukan Pasal → null (masuk tinjauan manual)", () => {
  expect(kenaliPola("21. Judul Paragraf 1 pada BAB X diubah sehingga berbunyi sebagai berikut:")).toBeNull();
});

test("nomor angka toleran OCR tapi harus urut", () => {
  expect(nomorAngka("L7. Di antara Pasal 61 dan Pasal 62 disisipkan 1 (satu)", 17)).toBe(true);
  expect(nomorAngka("2 Ketentuan Pasal 14 diubah sehingga berbunyi sebagai", 2)).toBe(true);
  expect(nomorAngka("31 . Di antara Pasal 90 dan Pasal 91 disisipkan 2 (dua) pasal,", 31)).toBe(true);
  // butir daftar di dalam Pasal kutipan bukan angka perubahan
  expect(nomorAngka("1. menganiaya, menghina secara kasar atau", 46)).toBe(false);
  expect(nomorAngka("1. Ketentuan Pasal 13 diubah", 46)).toBe(false);
});

test("pembuka dengan salah baca OCR yang ditemukan di UU 6/2023", () => {
  expect(kenaliPola("2 Di antara Pasal 24 dan Pasal25 disisipkan 1 (satu) pasal yakni Pasal 24A sehingga berbunyi sebagai berikut:")?.[0]).toMatchObject({ jenis: "sisip", pasal: "24A", sisipSetelah: "24" });
  expect(kenaliPola("18. Di antara Pasal 24 dan Pasa125 disisipkan 3 (tiga) pasal, yakni Pasal 24A, Pasal 24B, dan Pasal 24C")?.map((x) => x.pasal)).toEqual(["24A", "24B", "24C"]);
  expect(kenaliPola("8 Ketentuan Pasal 13 diubatr sehingga berbunyi sebagai berikut:")?.[0]?.pasal).toBe("13");
  expect(kenaliPola("21. Ketentuan Pasal 27 di:ubah sehingga berbunyi sebagai berikut:")?.[0]?.pasal).toBe("27");
  expect(kenaliPola("21. Ketentuan Pasal L42 diubah sehingga berbunyi sebagai berikut:")?.[0]?.pasal).toBe("142");
  expect(kenaliPola("2 Ketentuan' Pasal 15 diubah sehingga berbunyi sebagai berikut:")?.[0]?.pasal).toBe("15");
  expect(kenaliPola("15. Di antara Pasal L7 dan Pasal 18 disisipkan 1 (satu) pasal, yakni Pasal l7A sehingga")?.[0]?.pasal).toBe("17A");
  expect(kenaliPola("10. Di antara Pasal 4O2 dan 403 disisipkan 1 (satu) pasal yakni Pasal 4O2A")).toBeNull(); // "dan 403" tanpa kata Pasal → tinjauan manual
  expect(kenaliPola("32. Di antara Pasal 82 dan Pasal83 disisipkan 3 (tiga) pasal, yakni Pasal 82A, Pasal 828, dan Pasal 82C")?.map((x) => x.pasal)).toEqual(["82A", "82B", "82C"]);
});

test("nomor angka rusak OCR: \"7l.\" = 71", () => {
  expect(nomorAngka("7l. Di antara Pasal 191 dan Pasal 192 disisipkan 1 (satu) pasal,", 71)).toBe(true);
});

test("sisip BAB sekaligus Pasal → null (perlu tinjauan), bukan dibaca sebagai sisip Pasal biasa", () => {
  expect(kenaliPola("29. Di antara BAB VII dan BAB VIII disisipkan 2 (dua) bab dan 2 (dua) pasal, yakni BAB VIIA dan BAB VIIB sehingga berbunyi sebagai berikut:")).toBeNull();
  expect(kenaliPola("13. Di antara Pasal 49 dan BAB VIII disisipkan 1 (satu) bab dan 1 (satu) pasal, yakni BAB VIIA dan Pasal 49A sehingga berbunyi sebagai berikut:")).toBeNull();
});

// normalIsi: isi Pasal kutipan (baris sesudah judul "Pasal N") → baris terkoreksi + daftar teks ragu-ragu OCR.
// Koreksi hanya di awal baris Ayat/butir dan hanya bila cocok dengan nomor/huruf berikutnya yang diharapkan.

test("normalIsi: judul Ayat rusak OCR di awal baris dikoreksi bila cocok dengan Ayat berikutnya", () => {
  const { baris, ragu } = normalIsi([
    "(1) Ayat satu.",
    "(21 Ayat dua.",
    "(3) Ayat tiga.",
    "(41 Ayat empat.",
  ]);
  expect(baris).toEqual(["(1) Ayat satu.", "(2) Ayat dua.", "(3) Ayat tiga.", "(4) Ayat empat."]);
  expect(ragu).toEqual([]);
  expect(normalIsi(["(1) Satu.", "l2l Dua.", "(3) Tiga.", "l4l Empat."]).baris).toEqual(["(1) Satu.", "(2) Dua.", "(3) Tiga.", "(4) Empat."]);
});

test("normalIsi: butir \"a-\" sesudah titik dua menjadi \"a.\" di baris sendiri", () => {
  const { baris } = normalIsi([
    "(1) Uang pesangon diberikan dengan ketentuan sebagai berikut: a- masa kerja kurang dari 1 (satu) tahun, 1 (satu) bulan Upah;",
    "b. masa kerja 1 (satu) tahun atau lebih, 2 (dua) bulan Upah.",
  ]);
  expect(baris).toEqual([
    "(1) Uang pesangon diberikan dengan ketentuan sebagai berikut:",
    "a. masa kerja kurang dari 1 (satu) tahun, 1 (satu) bulan Upah;",
    "b. masa kerja 1 (satu) tahun atau lebih, 2 (dua) bulan Upah.",
  ]);
});

test("normalIsi: \"(21)\" yang memang Ayat 21 tidak diubah", () => {
  const ayat = Array.from({ length: 21 }, (_, i) => `(${i + 1}) Ayat ke-${i + 1}.`);
  expect(normalIsi(ayat)).toEqual({ baris: ayat, ragu: [] });
});

test("normalIsi: judul Ayat rusak yang tidak cocok dengan Ayat berikutnya tidak diubah, ditandai ragu", () => {
  const { baris, ragu } = normalIsi(["(1) Satu.", "(2) Dua.", "(21 Mungkin tiga, mungkin bukan."]);
  expect(baris.at(-1)).toBe("(21 Mungkin tiga, mungkin bukan.");
  expect(ragu).toEqual([expect.stringContaining("(21")]);
});

test("normalIsi: \"a-\" di tengah kata tidak diubah", () => {
  const isi = [
    "(1) Upah sebulan sama dengan penghasilan rata-rata dalam 12 (dua belas) bulan terakhir.",
    "(2) Pekerja/Buruh menerima upah secara kolektif dan merata-a- tanpa potongan.",
  ];
  expect(normalIsi(isi)).toEqual({ baris: isi, ragu: [] });
});

test("normalIsi: salah baca OCR di tengah teks tidak diganti, ditandai ragu", () => {
  const isi = [
    "(1) Pemerintah Pusat mengenakan sanksi administratif atas pelanggaran Pasal 6, Pasal t4 ayat (1), Pasal 7l ayat (2), atau Pasal 160 ayat (1) atau ayat (21Undang-Undang ini.",
    "(2) Bantuan untuk 1 (satu) orang tanggungan, 25o/o (dua puluh lima persen) dari Upah.",
  ];
  const { baris, ragu } = normalIsi(isi);
  expect(baris).toEqual(isi);
  expect(ragu).toEqual([
    expect.stringContaining("Pasal t4"),
    expect.stringContaining("Pasal 7l"),
    expect.stringContaining("(21Undang"),
    expect.stringContaining("25o/o"),
  ]);
});
