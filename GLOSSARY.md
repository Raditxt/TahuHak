# TahuHak

Bahasa domain TahuHak: membantu warga menemukan Pasal yang relevan dengan masalah sehari-hari, sebagai pengetahuan awal (bukan nasihat hukum).

## Peraturan dan isinya

**Peraturan**:
Satu produk hukum tertulis resmi (UUD, UU, Perppu, PP, Perpres, Permen, Perda) yang dikenali dari jenis, nomor, dan tahunnya.
_Avoid_: regulasi, dokumen, produk hukum

**Pasal**:
Satuan isi Peraturan yang menjadi satuan kutipan TahuHak; bisa terdiri atas beberapa Ayat.
_Avoid_: artikel, ketentuan

**Pasal Sisipan**:
Pasal bernomor dengan huruf (mis. Pasal 5A) yang disisipkan ke sebuah Peraturan oleh Peraturan Pengubah.

**Asal Teks**:
Cara teks sebuah Pasal diperoleh: **digital** (dari lapisan teks PDF resmi) atau **OCR** (dibaca mesin dari hasil scan, mungkin ada salah baca). Teks OCR selalu disertai tautan ke PDF resmi.

**Penjelasan**:
Bagian resmi sebuah Peraturan (Penjelasan Umum dan Penjelasan Pasal demi Pasal) yang ditulis pembentuk peraturan.
_Avoid_: memakai kata ini untuk teks buatan AI

**Uraian Awam**:
Teks bahasa sehari-hari buatan AI, diperiksa pengembang, yang menerangkan maksud sebuah Pasal. Bukan bagian dari Peraturan.
_Avoid_: penjelasan, tafsiran, ringkasan

## Status dan perubahan

**Status Peraturan**:
Keadaan sebuah Peraturan secara keseluruhan: berlaku, dicabut, atau belum berlaku.

**Status Pasal**:
Keadaan sebuah Pasal: berlaku, diubah, dihapus, atau dibatalkan MK. Bisa berbeda dari Status Peraturan-nya (mis. Peraturan berlaku tetapi satu Pasal-nya dibatalkan MK). "Dibatalkan MK" hanya dipakai bila **seluruh** Pasal dibatalkan; pembatalan satu Ayat atau frasa menjadi Catatan Putusan MK.

**Diubah**:
Istilah hukum untuk isi Peraturan yang direvisi oleh Peraturan Pengubah. Berbeda dari **dicabut** (seluruh Peraturan tidak berlaku lagi), **dihapus** (Pasal atau Ayat ditiadakan oleh Peraturan Pengubah), dan **dibatalkan** (dinyatakan tidak mengikat oleh putusan pengadilan).
_Avoid_: direvisi

**Versi Pasal**:
Bunyi sebuah Pasal persis seperti tertulis di satu Peraturan sumber. Pasal yang pernah diubah punya beberapa Versi Pasal; yang paling baru adalah **Versi Terkini**.
_Avoid_: teks konsolidasi, teks gabungan

**Catatan Perubahan**:
Keterangan pada sebuah Pasal yang menunjukkan Ayat mana yang diubah, oleh Peraturan Pengubah mana, dan sejak kapan. Bila Peraturan Pengubah hanya menulis ulang Ayat yang berubah, catatan ini memuat bunyi Ayat baru; teksnya tidak disambung ke bunyi lama.

**Peraturan Pengubah**:
Peraturan yang mengubah, menghapus, atau menyisipkan Pasal di Peraturan lain.

**Dasar Status**:
Bukti yang menjadi landasan sebuah Status, beserta tanggalnya. Urutan kekuatannya: teks Peraturan atau Putusan MK (terkuat), lalu metadata relasi di sumber, lalu label status di sumber (terlemah). Status yang hanya didasarkan pada label sumber disebut belum diverifikasi.
_Avoid_: sumber status

**Putusan MK**:
Putusan Mahkamah Konstitusi atas pengujian UU/Perppu, yang menjadi Dasar Status Pasal atau melahirkan Catatan Putusan MK. Bukan isi jawaban.

**Catatan Putusan MK**:
Keterangan yang wajib tampil pada Pasal atau Peraturan yang dibatalkan MK hanya sebagian (ayat atau frasa), atau dinyatakan konstitusional/inkonstitusional bersyarat. Catatan ini tidak mengubah Status Pasal.
_Avoid_: status bersyarat

## Pengguna dan konten

**Topik**:
Kategori masalah sehari-hari, disusun dari data aduan publik dan divalidasi warga, yang menjadi pintu masuk terkurasi.
_Avoid_: kategori, tema

**Padanan Istilah**:
Pasangan kurasi antara kata sehari-hari dan istilah hukum (mis. "dipecat" → "pemutusan hubungan kerja"), dipakai untuk menerjemahkan Pertanyaan Pengguna menjadi kata kunci pencarian.
_Avoid_: sinonim, kamus

**Jawaban**:
Rakitan Pasal yang relevan beserta teks, Uraian Awam, Status, Catatan Putusan MK, dan langkah selanjutnya dari Topik, ditambah disclaimer. Seluruh isinya sudah diperiksa sebelumnya; tidak ada kalimat hukum yang dikarang saat itu.
_Avoid_: jawaban AI

**Pertanyaan Pengguna**:
Pertanyaan atau cerita bebas yang diketik pengguna ke AI. Tidak pernah disimpan oleh TahuHak.
_Avoid_: query, prompt, chat

**Laporan Kesalahan**:
Laporan yang sengaja dikirim pengguna tentang Pasal, Status, atau Uraian Awam yang keliru.
_Avoid_: issue (issue adalah tiket GitHub yang dibuat pengembang dari Laporan Kesalahan yang valid)
