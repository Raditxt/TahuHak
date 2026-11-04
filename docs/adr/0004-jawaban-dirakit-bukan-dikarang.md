# Jawaban dirakit, bukan dikarang per pertanyaan

TahuHak tidak menyuruh LLM menulis jawaban hukum untuk setiap Pertanyaan Pengguna. LLM self-hosted yang kecil, berjalan di CPU VPS (tidak ada anggaran untuk API, lihat ADR-0003), hanya menerjemahkan cerita pengguna menjadi kata kunci hukum dan memilih Topik. Setelah itu full-text search menemukan Pasal, dan Jawaban dirakit dari bahan yang sudah diperiksa pengembang sebelumnya: teks Pasal, Uraian Awam, Status, Dasar Status, Catatan Putusan MK, dan langkah selanjutnya dari Topik. Alasannya dua. Model kecil di 2 vCPU butuh beberapa menit untuk menulis jawaban panjang dan lebih sering mengarang sitasi. Dengan cara ini juga tidak ada kalimat hukum yang dibuat saat itu juga, sehingga pengaman "AI wajib bersitasi" terpenuhi dengan sendirinya. Setiap Jawaban tetap memuat disclaimer agar pengguna membaca sumber lengkapnya dan memvalidasi ke bantuan hukum.

Keputusan ini **menggantikan** keputusan ronde 2 (Q4), yaitu Claude via API sebagai penulis jawaban yang modelnya dipilih lewat set uji. Pertimbangan biayanya ada di Q4b.

## Consequences

- Pertanyaan di luar Topik mana pun **hanya mendapat hasil pencarian Pasal**: teks Pasal, Status, dan Uraian Awam bila sudah ada, tanpa langkah selanjutnya dari Topik. Ini disengaja.

- Mutu Jawaban bergantung pada cakupan Uraian Awam dan Padanan Istilah, bukan pada kepintaran model. Uraian Awam ditulis pengembang saat pengembangan dengan Claude Code, diperiksa, lalu disimpan di repo, dikerjakan per Topik.
- Kalau model lokal gagal atau lambat, pencarian tetap berjalan dengan Padanan Istilah dan full-text search saja.
- Fitur di UI tidak lagi dibingkai sebagai "Tanya AI", karena AI hanya menerjemahkan dan memilih.
- Model lokal (instruksi, 1–4B, dipilih lewat set uji) berjalan di `llama-server` llama.cpp: 2 thread, satu permintaan per waktu, memori dibatasi sekitar 3 GB. Outputnya dikunci dengan JSON schema `{ topik, kata_kunci }`, jadi model tidak bisa mengeluarkan teks bebas.
