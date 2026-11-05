# PROTOTYPE — parser Peraturan (issue #2)

**Kode buangan.** Hidup hanya di branch `prototype/parser`, tidak di `main`. Yang diangkat ke modul ingestion hanyalah verdict (komentar di issue #2) dan logika yang terbukti benar (`amend.ts`, aturan pembersih di `clean.ts`).

Pertanyaan yang dijawab: apakah pdfjs → pembersih header/watermark → parser struktur regex → parser perubahan (+ OCR di laptop untuk scan) menghasilkan Pasal/Ayat dan daftar perubahan yang benar dari UU 13/2003, UU 6/2023, PP 35/2021, dan Perda Kota Makassar 2/1983?

## Menjalankan

```bash
npm i                  # pdfjs-dist
# unduh PDF ke pdf/ sesuai sources.json (PDF tidak di-commit)
./ocr.sh               # OCR ulang Perda di laptop → ocr/perda-mks-1983.ocr.pdf (lihat prasyarat di skrip)
bun run parse.ts       # → out/<id>.json + ringkasan di konsol
bun run cek-bocor.ts   # header/nomor halaman/footer/kata sambung yang bocor ke teks Pasal
bun run laporan.ts     # → out/laporan.html (buka dengan klik dua kali)
bun test               # tes pengenal pola perubahan (satu-satunya tes yang diizinkan di Seam A)
```

## Berkas

| Berkas | Isi |
|---|---|
| `extract.ts` | pdfjs → baris per halaman (sambung item terpotong, kelompokkan y untuk teks OCR miring), tanda teks tak terlihat (render mode 3 = lapisan OCR) |
| `clean.ts` | buang header (semua baris di atas nomor halaman), nomor halaman versi OCR, footer `SK No`, kata sambung di kaki halaman, baris berulang di tepi halaman |
| `amend.ts` | **pengenal pola perubahan** + normalisasi salah baca OCR pada nomor; kandidat terkuat untuk diangkat |
| `parse.ts` | zona (batang tubuh / Penjelasan / Lampiran / Penjelasan Lampiran), parser Pasal/Ayat, Pasal-di-dalam-Pasal, Penjelasan, perubahan, detektor kualitas |
| `out/*.json` | hasil parse (`*.pages.json` adalah cache ekstraksi, tidak di-commit) |
