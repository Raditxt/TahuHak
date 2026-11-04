# Batas privasi Pertanyaan Pengguna

Keputusan produk #11 ("tidak disimpan sama sekali") dirumuskan ulang agar bisa dipenuhi secara teknis, karena penyedia LLM, log server, dan penghitungan kuota tak terhindarkan menyentuh data permintaan. Aturannya:

- TahuHak tidak menulis Pertanyaan Pengguna ke database, log aplikasi, maupun analitik miliknya.
- Penyedia LLM hanya yang menjamin input tidak dipakai untuk pelatihan dan retensinya minimal. Tingkat gratis yang melatih model dengan input dilarang.
- Kuota tanpa login dihitung dari hash IP harian yang dibuang setelah 24 jam.
- Pengecualian sempit: kalau sebuah Pertanyaan Pengguna tidak menemukan Pasal apa pun, sebagian kata kuncinya boleh disimpan untuk memperkaya Padanan Istilah. Ceritanya tidak pernah disimpan. Penyaringannya dua tahap:
  1. Nama diri, angka, dan segala bentuk nomor (telepon, NIK, rekening, nomor perkara, plat kendaraan) dibuang.
  2. Dari sisanya, hanya token yang cocok dengan Padanan Istilah atau kamus kata umum bahasa Indonesia yang disimpan. Token lain dibuang.
- Laporan Kesalahan boleh disimpan karena dikirim pengguna dengan sadar. Formulirnya memperingatkan agar tidak menulis data pribadi.

Rumusan ini menjadi dasar Kebijakan Privasi dan DPIA. Setiap pilihan vendor (LLM, hosting, logging) harus lolos aturan ini.
