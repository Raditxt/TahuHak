## Verdict prototype parser (issue #2)

**Pertanyaan:** apakah pdfjs → pembersih header/watermark → parser struktur regex → parser perubahan (+ OCR di laptop) menghasilkan Pasal/Ayat dan daftar perubahan yang benar dari empat dokumen nyata?

**Jawaban: ya untuk struktur dan perubahan Pasal.** Ada dua koreksi asumsi: UU 6/2023 dan PP 35/2021 ternyata scan, dan perubahan "ayat-saja" tidak muncul sekali pun di Lampiran UU 6/2023.

Kode ada di branch `prototype/parser`, folder `prototype-parser/` (README berisi cara menjalankan). Hasil parse ada di `out/*.json`. Laporan untuk pengecekan manual ada di `out/laporan.html`; buka dengan klik dua kali. PDF tidak di-commit; URL dan tanggal ambilnya (5 Nov 2026) ada di `sources.json`.

---

### 1. Yang terbukti jalan

| Dokumen | Pasal ketemu / total | Penjelasan tertaut | Perubahan dikenali | Peringatan |
|---|---|---|---|---|
| UU 13/2003 | **193 / 193**, urut | 193 / 193 | – | 0 |
| UU 6/2023, batang tubuh | **2 / 2** | 2 / 2 | – | – |
| UU 6/2023, Lampiran (Perppu 2/2022) | **186 / 186**, urut | – | 1.211 entri dari 88 Pasal pengubah (932 ubah, 100 sisip, 179 hapus) | 72 |
| ↳ Pasal 81 → UU 13/2003 | – | – | **70 / 71 angka** → 76 entri | 7 |
| PP 35/2021 | **66 / 66**, urut | 64 / 66 | – | 3 |
| Perda Makassar 2/1983, lapisan bawaan | 18 / 18 (1 judul ditebak dari urutan) | 13 / 18 | – | 3 |
| Perda Makassar 2/1983, setelah OCR ulang | 17 / 18 (Pasal 13 hilang) | 16 / 18 | – | 6 |

- **Pasal 156 (ubah, pasal-utuh) = Pasal 81 angka 47.** Teks barunya terpecah benar menjadi 5 Ayat.
- **Pasal 154A (sisip) = Pasal 81 angka 45.**
- Sisip banyak Pasal juga benar, misalnya angka 28 → 88A–88F.
- **Pasal di dalam Pasal tertangani.** Ratusan judul "Pasal N" kutipan di Lampiran tidak dihitung sebagai Pasal Perppu, dan nomor Pasal Perppu tetap urut 1–186.
- **Header/footer:** `cek-bocor.ts` menemukan 0 kebocoran di ketiga dokumen pusat. Yang diperiksa: header PRESIDEN, termasuk versi rusak OCR seperti "EI{rEIEtrN", "INEENFFIA"; nomor halaman, termasuk "-to2-", "_18_", "-r23-"; footer `SK No`; kata sambung kaki halaman; dan SALINAN.
- **Detektor kualitas** menilai UU 13/2003 = digital, UU 6/2023 dan PP 35/2021 = OCR bawaan layak, dan Perda = perlu OCR.
- 11 tes pengenal pola lolos (`bun test`).
- **Waktu di laptop:**
  - ekstraksi pdfjs UU 6/2023 (1.127 hal.): sekitar 65–100 detik;
  - parse kelima dokumen: sekitar 2 detik;
  - OCR ulang Perda (10 hal.): 8,3 detik.

**Yang belum dicek mata manusia ke PDF:** jumlah 71 angka di Pasal 81 (saya hitung dari teks ekstraksi hal. 549–579) dan jumlah 88 Pasal pengubah.

### 2. Masalah tersisa per dokumen

**UU 13/2003:** tidak ada.

**UU 6/2023 (72 peringatan):**

| Masalah | Jumlah | Tindak lanjut |
|---|---|---|
| Angka yang bukan perubahan Pasal: judul BAB/Bagian/Paragraf diubah, "Penjelasan Pasal X diubah sebagaimana tercantum…", sisip BAB | 12 | **Aturan baru** (pola judul/Penjelasan/BAB). Dua sisip BAB juga menyisipkan Pasal (Lampiran Pasal 48 angka 29, Pasal 50 angka 13) dan Pasal-Pasal itu **belum tercatat**. Untuk slice PHK cukup tinjauan manual: angka 21 di Pasal 81 hanya mengubah judul Paragraf. |
| "Di antara Pasal 4O2 dan 403" (kata Pasal hilang di sumber) | 1 | Tinjauan manual |
| Angka tak ditemukan berurutan (nomor angka rusak OCR) | 12 | Tinjauan manual; aturan urutan sudah menandainya |
| Nama sisipan di kalimat pembuka ≠ judul di isi | 12 | Aturan sudah memakai judul di isi; cukup tinjauan manual |
| Judul di isi ≠ target Pasal | 8 | Tinjauan manual |
| Ayat tidak urut | 17 | Tinjauan manual (sebagian "(21" atau Ayat yang terbaca salah) |
| Target Peraturan tak terbaca di 5 Pasal pengubah (Lampiran Pasal 20, 40, 50, 55, 108) | 5 | Aturan kecil: perluas pola "Undang-Undang Nomor … Tahun …" |
| Salah baca OCR di teks Pasal ("tedadi", "(21", "Rp4.000.000,O0") | banyak | **Tinjauan manual wajib** untuk Pasal kandidat Topik PHK, dibaca berdampingan dengan PDF |

**PP 35/2021 (3 peringatan):** Penjelasan Pasal 17 dan 19 belum tertaut, dan Ayat Pasal 39 tidak urut. Ketiganya cukup tinjauan manual. Salah baca OCR pada angka uang perlu dicek, sama seperti UU 6/2023.

**Perda 2/1983:** judul Pasal rusak ("Pasa 1", "Pasal$", "Pasai 14") sudah diperbaiki dengan menebak dari urutan, dan tebakannya tercatat di `peringatan`. Salah baca yang mirip kata asli ("jalah" untuk "ialah", "Tingkat 14" untuk "Tingkat II", "petugastekhnik") **tidak terdeteksi**: `peringatan` hanya menangkap 3 kata. Butuh **aturan baru berupa kamus bahasa Indonesia** (gratis, mis. daftar kata hunspell id_ID). Leksikon dari dua UU ketenagakerjaan terlalu sempit (OOV 240‰ di UU 6/2023).

### 3. Keputusan OCR

**UU 6/2023: tidak perlu OCR ulang penuh.**
- Lapisan OCR bawaannya layak: 3,2‰ kata aneh, dan struktur 186/186 Pasal serta 70/71 angka keluar benar.
- OCR ulang kira-kira butuh 15 menit (0,8 detik/hal. × 1.127 hal.). Waktunya tidak masalah, tapi pengalaman di Perda menunjukkan OCR ulang bisa merusak nomor judul yang sekarang terbaca benar.
- Yang dibutuhkan adalah tinjauan manual teks Pasal kandidat Topik PHK, bukan OCR ulang.
- Hal yang sama berlaku untuk PP 35/2021 (1,7‰).

**Perda 2/1983: OCR ulang layak, tetapi tidak sebagai satu-satunya sumber.**
- Isinya jauh membaik (27,3‰ → 2‰), dan kalimatnya terbaca utuh.
- Namun judul Pasal memburuk, dan **Pasal 13 hilang**, padahal lapisan bawaan justru menangkap judul 13.
- Keputusan: **struktur (judul dan nomor Pasal) dari lapisan bawaan + perbaikan dipandu urutan; isi dari OCR ulang.** Alternatifnya, parse keduanya dan bandingkan daftar judulnya; selisih masuk tinjauan manual.
- Teks Perda tetap berlabel OCR dengan tautan ke PDF.

**Catatan alat (ADR-0003):** OCR berjalan di laptop dengan Tesseract 5.4 (winget) + `ind` dari tessdata_best + `ocrmypdf 17.13 --force-ocr -l ind --rasterizer pypdfium --output-type pdf`. Ghostscript tidak ada di winget dan ternyata **tidak diperlukan**. Lihat `ocr.sh`.

### 4. Yang diangkat dan yang dibuang

**Diangkat ke modul ingestion (Seam A):**
- **`amend.ts` + `amend.test.ts`, utuh.** Isinya:
  - `kenaliPola`: ubah/sisip/hapus × pasal-utuh/ayat-saja, sisip banyak Pasal, dan `null` untuk tinjauan manual;
  - `normalNomor`: koreksi OCR pada nomor ("16O", "Pasa125", "L42", "diubatr", "828"→82B);
  - `nomorAngka`: nomor angka harus urut, toleran "L7." dan "2 Ketentuan".
  - Tes-nya (11 tes, termasuk 9 varian OCR nyata) menjadi tes pengenal pola yang diizinkan di bawah Seam A.
- **Aturan dari `clean.ts`, ditulis ulang dengan rapi:**
  - semua baris di atas nomor halaman adalah header;
  - nomor halaman dikenali dari bentuknya (diapit `-`/`_`, memuat angka);
  - kata sambung dibuang bila mirip awal halaman berikut (Levenshtein ≤ 2);
  - watermark hanya dicari di tepi halaman.
- **Aturan sebagai spesifikasi, bukan kode:** Pasal-di-dalam-Pasal (lihat jebakan 4), perbaikan judul dipandu urutan, dan detektor Asal Teks (teks tak terlihat ≥ 50% halaman = OCR; kata aneh < 10‰ = layak).
- **Dua trik ekstraksi pdfjs:**
  - item disambung tanpa spasi bila celahnya < 0,15× tinggi huruf (mencegah "sediki t");
  - baris dikelompokkan dengan toleransi 45% tinggi huruf supaya teks OCR yang miring tidak mengacak urutan kata.

**Dibuang:**
- `parse.ts` sebagai berkas: zona, Penjelasan, dan metadata masih berupa regex tempelan;
- skor OOV;
- `laporan.ts` dan `cek-bocor.ts`. Gagasan `cek-bocor` layak menjadi bagian snapshot Seam A.

### 5. Jebakan baru yang belum ada di issue

1. **Dokumen "pusat" belum tentu digital.** UU 6/2023 (JDIH BPK dan peraturan.go.id) dan PP 35/2021 (*creator*: pemindai Canon) adalah scan berlapis OCR. Asal Teks harus dideteksi per dokumen, bukan diasumsikan dari sumbernya.
2. **Deteksi scan lewat gambar menipu.** PDF digital pun punya logo Garuda di setiap halaman. Sinyal yang tegas adalah teks tak terlihat (render mode 3).
3. **Kata sambung di kaki halaman.** Baris terakhir tiap halaman mengulang awal halaman berikut ("(2) Bagi...", "16. Ketentuan", "b. Perusahaan. . ."). Kalau tidak dibuang, isinya dobel. Kata sambung ini kadang tanpa titik dan kadang dibaca OCR berbeda dari aslinya ("12. Pasal 63" lalu "t2. Pasal 63").
4. **Batas "Di antara Pasal X dan Pasal Y" bukan kutipan.** Kalau Y dihitung sebagai Pasal yang dikutip, Pasal Perppu berikutnya yang bernomor Y tertolak dan semua Pasal sesudahnya bergeser. Bug ini sempat membuat Pasal 75–81 hilang.
5. **Pembuka Pasal pengubah bervariasi**, tidak selalu "Beberapa ketentuan dalam…":
   - "Untuk memberikan kemudahan…, beberapa ketentuan dalam UU…";
   - "Ketentuan Pasal 9 UU…" (tanpa "dalam");
   - "Perppu ini mengubah, menghapus, atau menetapkan pengaturan baru yang diatur dalam UU…".
6. **Header dan nomor halaman rusak OCR** ("EI{rEIEtrN", "-to2-", "_18_") lolos dari pencocokan teks, sehingga harus dibuang berdasarkan posisi.
7. **Watermark palsu.** Pencari baris berulang di seluruh halaman sempat membuang setiap "berikut:" (muncul di > 30% halaman), sehingga kalimat pembuka angka perubahan terpotong.
8. **Butir "1." di dalam Pasal kutipan** (mis. alasan PHK di 154A) mirip nomor angka perubahan. Nomor angka harus urut dan diikuti kata kerja perubahan.
9. **Nomor dan angka dibaca OCR jadi huruf:** "L7." = 17, "828" = 82B, "2O2I" = 2021, "4T" = 47, "(41" = "(4)", "Pasal 1 1 1" = 111.
10. **Sisip BAB sekaligus sisip Pasal** ("Di antara BAB VII dan BAB VIII disisipkan 2 bab dan 2 pasal…"). Pola sisip Pasal biasa tidak menangkapnya.
11. **Perubahan "Penjelasan Pasal X diubah sebagaimana tercantum dalam penjelasan"** adalah jenis perubahan tersendiri. Model data perlu memutuskan apakah Penjelasan punya versi.
12. **Pindah baris "…ayat / (2), …"** membuat rujukan terbaca sebagai Ayat baru. Baris "(n)" hanya dianggap Ayat bila baris sebelumnya tidak berakhir dengan "ayat".
