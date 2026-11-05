## Verdict prototype parser (issue #2)

**Pertanyaan:** apakah pdfjs → pembersih header/watermark → parser struktur berbasis regex → parser perubahan (+ OCR di laptop) bisa menghasilkan struktur Pasal/Ayat dan daftar perubahan yang benar dari empat dokumen nyata? Bagian mana yang masih harus ditinjau manual?

**Jawaban: bisa, dengan dua koreksi asumsi.** Struktur Pasal dan perubahan Pasal 81 keluar benar. Namun dua dari tiga dokumen pusat ternyata **scan**, dan Peraturan Pengubah yang menulis ulang Ayat saja **tidak muncul sekali pun** di UU 6/2023.

Kode ada di branch `prototype/parser`, folder `prototype-parser/` (README berisi cara menjalankan). Laporan untuk pengecekan manual ada di `out/laporan.html`; buka dengan klik dua kali.

### Temuan yang mengubah asumsi issue

1. **UU 6/2023 dan PP 35/2021 adalah scan berlapis OCR, bukan teks digital.** Semua halaman memakai teks tak terlihat (render mode 3), dan *creator* PP 35 adalah pemindai Canon. Berkas di peraturan.go.id adalah scan yang sama. Hanya UU 13/2003 yang digital (dibuat dari Word).
   - Akibatnya, menurut glosarium, **Asal Teks keduanya = OCR**. UI wajib menampilkan label OCR dan tautan PDF pada Pasal kandidat Topik PHK.
   - Lapisan OCR bawaannya cukup baik (3,2‰ dan 1,7‰ kata aneh), jadi tidak perlu OCR ulang. Teksnya tetap mengandung salah baca seperti "tedadi", "(21" untuk "(2)", dan "2O2O".
2. **Tidak ada perubahan "ayat-saja" di seluruh Lampiran UU 6/2023.** Ke-1.211 perubahan menulis ulang Pasal utuh, menghapus, atau menyisipkan Pasal. Jalur ayat-saja di ADR-0001 hanya teruji dengan kalimat buatan di tes. Jalur itu tetap perlu ada untuk Peraturan lain.
3. **Pemeriksa kualitas berbasis gambar tidak berguna,** karena PDF digital pun punya logo Garuda di setiap halaman. Sinyal yang tegas adalah teks tak terlihat. Kata aneh per 1000 token dipakai sebagai sinyal kedua.

### Angka per dokumen

| Dokumen | Asal Teks / mutu | Pasal | Ayat bernomor | Penjelasan tertaut | Perubahan | Peringatan |
|---|---|---|---|---|---|---|
| UU 13/2003 | digital | **193** (1–193, urut) | 403 | **193/193** | – | 0 |
| UU 6/2023 batang tubuh | OCR bawaan, layak (3,2‰) | 2 | – | 2/2 | – | – |
| UU 6/2023 Lampiran (Perppu 2/2022) | idem | **186** (1–186, urut), 88 di antaranya Pasal pengubah atas 71 Peraturan | – | – | 1.211 (932 ubah, 100 sisip, 179 hapus) | 72 |
| PP 35/2021 | OCR bawaan, layak (1,7‰) | **66** (1–66, urut) | 136 | 64/66 (Pasal 17, 19 belum) | – | 3 |
| Perda Makassar 2/1983, lapisan bawaan | perlu OCR (27,3‰) | 18 (1 judul ditebak dari urutan) | 20 | 13/18 | – | 3 |
| Perda Makassar 2/1983, setelah OCR ulang | layak (2‰) | 17 (Pasal 13 hilang) | 17 | 16/18 | – | 6 |

**Pasal 81 Lampiran UU 6/2023 → UU 13/2003:** 70 dari 71 angka dikenali, menjadi 76 entri perubahan (angka 28 menyisipkan 88A–88F).
- **Angka 47 = ubah Pasal 156 (pasal-utuh).** Teks barunya terpecah benar menjadi 5 Ayat.
- **Angka 45 = sisip Pasal 154A.**
- Angka 21 ("Judul Paragraf 1 pada BAB X diubah") masuk tinjauan manual.
- Jumlah 71 angka saya dapat dengan menelusuri baris pembuka angka di hal. 549–579. **Belum dicocokkan mata manusia ke PDF**; silakan cek lewat tab uu-6-2023 di laporan.

**Header/footer:** `cek-bocor.ts` menemukan 0 kebocoran di ketiga dokumen pusat. Yang diperiksa: header PRESIDEN (termasuk versi rusak seperti "EI{rEIEtrN"), nomor halaman (termasuk "-to2-" dan "_18_"), footer `SK No`, kata sambung kaki halaman, dan SALINAN. Dua temuan di Perda adalah titik-titik penuntun di tabel tarif Pasal 12, yaitu isi asli.

**Waktu (laptop):**
- Ekstraksi pdfjs UU 6/2023 (1.127 hal.): sekitar 65–100 detik.
- Parse kelima dokumen: sekitar 2 detik.
- OCR ulang Perda (10 hal.): 8,3 detik, dengan `ocrmypdf 17.13 --force-ocr -l ind --rasterizer pypdfium --output-type pdf` dan Tesseract 5.4 + `ind` dari tessdata_best. Ghostscript tidak tersedia di winget dan ternyata tidak diperlukan.

### Daftar kegagalan

- **Perda, OCR ulang:** isi jauh lebih baik ("membunuh hewan dan segala pekerjaan"), tetapi judul Pasal memburuk ("Pasai3", "Pasal$"), dan **Pasal 13 hilang**. Lapisan bawaan justru menangkap judul 13. Kedua lapisan saling melengkapi.
- **Salah baca OCR yang mirip kata asli tidak terdeteksi**, misalnya "jalah" untuk "ialah", "Tingkat 14" untuk "Tingkat II", dan "petugastekhnik". Untuk Perda hasil OCR ulang, `peringatan` hanya menangkap 3 kata. Ini perlu kamus bahasa Indonesia; leksikon dari dua UU ketenagakerjaan terlalu sempit (OOV 240‰ di UU 6/2023, jadi tidak dipakai menilai).
- **UU 6/2023, 13 angka tak dikenali** (semuanya bukan perubahan Pasal biasa): judul BAB/Bagian/Paragraf diubah, "Penjelasan Pasal X diubah sebagaimana tercantum…", sisip BAB, dan "Di antara Pasal 4O2 dan 403" (tanpa kata Pasal). **Dua sisip BAB juga menyisipkan Pasal** (Pasal 48 angka 29 dan Pasal 50 angka 13), jadi Pasal-Pasal itu belum tercatat.
- **UU 6/2023, peringatan lain:**
  - 12 angka tidak ditemukan berurutan karena nomornya rusak OCR.
  - 12 nama sisipan di kalimat pembuka ≠ judul di isi. Judul di isi dipakai, misalnya "disisipkan 2 Pasal" padahal isinya 88A–88F.
  - 8 judul isi ≠ target.
  - 17 Ayat tidak urut.
  - 5 Pasal pengubah yang targetnya tak terbaca (Lampiran Pasal 20, 40, 50, 55, 108).
- **PP 35/2021:** Penjelasan Pasal 17 dan 19 belum tertaut, dan Pasal 39 Ayat tidak urut.

### Perlu tinjauan manual sebelum masuk ingestion

1. Semua entri `peringatan` di `out/*.json` (UU 13: 0, PP 35: 3, UU 6: 72, Perda: 3–6).
2. Teks Pasal kandidat Topik PHK dari UU 6/2023 dan PP 35/2021 (hasil OCR), dibaca berdampingan dengan PDF. Terutama angka uang dan tabel masa kerja ("Rp4.000.000,O0", "(21").
3. Jumlah 71 angka Pasal 81 dan 88 Pasal pengubah di Lampiran.
4. Perda: gabungkan judul dari lapisan bawaan dan isi dari OCR ulang, lalu periksa Pasal 13.

### Logika yang layak diangkat ke modul ingestion (Seam A)

- **`amend.ts`, utuh:** `kenaliPola` (ubah/sisip/hapus × pasal-utuh/ayat-saja, sisip banyak Pasal), `normalNomor` (koreksi OCR pada nomor: 16O, Pasa125, L42, diubatr, 828→82B), dan `nomorAngka` (angka harus urut, toleran "L7."/"2 Ketentuan"). Ada 11 tes di `amend.test.ts`, termasuk 9 varian OCR nyata.
- **Pembersih (`clean.ts`):**
  - Semua baris di atas nomor halaman adalah header.
  - Nomor halaman dikenali dari bentuknya (diapit `-`/`_`, memuat angka).
  - Kata sambung dibuang bila mirip awal halaman berikut (Levenshtein ≤ 2).
  - Watermark hanya dicari di tepi halaman. Mencarinya di seluruh halaman sempat membuang setiap baris "berikut:".
- **Aturan Pasal-di-dalam-Pasal:** di dalam Pasal pengubah, judul "Pasal N" adalah kutipan bila didahului "…berikut:", bernomor huruf, atau disebut di kalimat pembuka angka terakhir. Batas "Di antara Pasal X **dan Pasal Y**" tidak dihitung. Judul yang diikuti "Beberapa ketentuan dalam…" selalu Pasal Perppu.
- **Perbaikan judul dipandu urutan:** judul rusak OCR yang tak terbaca atau mundur ditebak dari urutan dan dicatat di `peringatan`. Lompatan kecil tetap diterima sebagai loncat.
- **Detektor Asal Teks:** teks tak terlihat di ≥ 50% halaman berarti `ocr`. Kata aneh < 10‰ berarti layak; ≥ 10‰ berarti antrean OCR laptop.
- **Ekstraksi:** sambung item pdfjs bila celahnya < 0,15× tinggi huruf, untuk mencegah "sediki t". Kelompokkan baris dengan toleransi 45% tinggi huruf supaya teks OCR yang miring tidak mengacak urutan kata.

**Tidak layak diangkat apa adanya:** `parse.ts` sebagai satu berkas (zona, Penjelasan, dan metadata masih berupa regex tempelan), serta skor OOV.
