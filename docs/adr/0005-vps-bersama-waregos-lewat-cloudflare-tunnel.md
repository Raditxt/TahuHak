# VPS bersama Waregos, akses lewat Cloudflare Tunnel

TahuHak berjalan di VPS yang dipakai bersama proyek lain. Penghuni utamanya **Waregos**, sistem kasir dan stok untuk toko keluarga yang menyimpan buku toko sungguhan. Aturan pertamanya: **Waregos harus tetap aman dan berjalan, apa pun yang terjadi pada TahuHak.** ADR ini menggantikan bagian VPS, Caddy, dan anggaran sumber daya di ADR-0003, serta bagian Deploy di spec #3.

## Server

- Biznet Gio NEO Lite **MS 4.2**: 2 vCPU, 4 GB RAM, 60 GB SSD, bayar bulanan, Ubuntu 24.04 LTS, Docker + Docker Compose.
- Status pembelian belum diisi di brief. Isi tanggal aktifnya di sini begitu server berjalan.
- Akses publik **hanya lewat Cloudflare Tunnel** (cloudflared). Tidak ada port aplikasi yang dibuka ke internet, dan HTTPS diurus Cloudflare. Caddy tidak dipakai.
- Swap 2 GB sebagai jaring pengaman, bukan tambahan RAM.

## Jatah sumber daya server

| Penghuni | RAM dicadangkan | Catatan |
|---|---|---|
| Sistem + Docker | ~600 MB | |
| Waregos (Postgres + API Fastify + cloudflared) | ~1,2 GB | prioritas tertinggi |
| Cadangan lonjakan (backup, migrasi, restart) | ~600 MB | jangan dipakai |
| Sisa untuk proyek lain | ~1,5 GB total | dibagi semua proyek selain Waregos |

## Keputusan

**1. TahuHak dibatasi 1 GB RAM total.** Batas ini dipasang sebagai `mem_limit` di setiap kontainer, dengan `memswap_limit` sama dengan `mem_limit` supaya TahuHak tidak memakan swap. Sisa sekitar 0,5 GB tetap untuk proyek lain. Angka awal per kontainer di bawah ini perkiraan dan diganti hasil ukur:

| Kontainer TahuHak | Batas RAM |
|---|---|
| web (Next.js) | 450 MB |
| Postgres milik TahuHak, terpisah dari Postgres Waregos (`shared_buffers` kecil, `max_connections` kecil) | 400 MB |
| cloudflared milik TahuHak | 100 MB |
| **Total** | **≤ 1 GB** |

**2. Bila memori habis, TahuHak yang dikorbankan, bukan Waregos.** Kontainer TahuHak diberi `oom_score_adj` tinggi dan bobot CPU lebih rendah dari Waregos. Total `cpus` TahuHak dibatasi 1,0. TahuHak tidak boleh memakai cadangan lonjakan, dan tidak boleh menyentuh kontainer, jaringan, atau volume Waregos. TahuHak memakai tunnel dan cloudflared sendiri supaya konfigurasi Waregos tidak ikut diubah.

**3. Tidak ada model lokal di VPS untuk saat ini.** llama-server 4B (~3 GB) di ADR-0003 dan ADR-0004 tidak muat. Model generatif 0,5B mungkin muat secara RAM, tetapi inferensinya berebut 2 vCPU dengan Waregos. Karena itu Penerjemah memakai jalur yang di ADR-0004 tadinya hanya cadangan, yaitu **Padanan Istilah + full-text search**. Ini sejalan dengan langkah 3 di daftar alternatif ADR-0003. Model embedding kecil (sekitar 100–300 MB) untuk memilih Topik baru akan dipertimbangkan kalau hasil set uji Topik PHK menunjukkan perlu, dan hanya bila tetap muat dalam batas 1 GB.

**4. Ingestion dijalankan di laptop, bukan di VPS.** Ekstraksi pdfjs UU 6/2023 (1.127 halaman) terlalu berat untuk jatah 1 GB. CLI ingestion berjalan di laptop pengembang, sama seperti OCR (ADR-0003). Hasilnya diimpor ke Postgres TahuHak di VPS dengan satu perintah. VPS tidak punya job ingestion atau penjelajahan terjadwal.

**5. Backup.** `pg_dump` harian Postgres TahuHak dikirim ke penyimpanan gratis di luar VPS. Jadwalnya tidak bertabrakan dengan backup Waregos.

## Cloudflare sebagai pemroses transit

Dengan Cloudflare Tunnel, TLS berakhir di Cloudflare. Artinya isi permintaan, termasuk Pertanyaan Pengguna yang dikirim lewat POST, melewati Cloudflare dalam bentuk terbaca. Risiko ini **diterima dengan dua syarat**:

- Tidak ada fitur Cloudflare yang mencatat atau menyimpan isi permintaan yang dinyalakan untuk TahuHak. Contohnya: Logpush yang memuat isi atau header permintaan, Workers yang mencatat body, dan pencatatan payload WAF.
- Cloudflare disebut sebagai pemroses di Kebijakan Privasi.

Log aplikasi tetap sepenuhnya di tangan pengembang. Cloudflare hanya pemroses transit dan tidak menjadi penyimpan Pertanyaan Pengguna (ADR-0002).

## Considered Options

- **VPS sendiri (Hostinger KVM 2, 8 GB) seperti di ADR-0003**: tidak diambil. TahuHak menumpang di server yang sudah ada.
- **Model generatif 0,5B di VPS**: ditolak untuk sekarang karena berebut CPU dengan Waregos, dan sisa RAM untuk proyek lain menjadi hampir nol.
- **Ingestion di VPS pada jam sepi**: ditolak karena lonjakan memori saat ekstraksi bisa memakan cadangan Waregos.
- **Memakai Postgres atau cloudflared milik Waregos**: ditolak. Kegagalan atau migrasi TahuHak tidak boleh bisa menyentuh Waregos.

## Consequences

- Bagian llama-server di spec #3 dan ADR-0004 tidak berlaku untuk deploy ini. Penerjemah tetap berupa antarmuka yang bisa diganti, jadi model bisa ditambahkan nanti tanpa mengubah Perakit Jawaban.
- Perbandingan kandidat model di set uji bergeser menjadi: tanpa model vs model embedding kecil. Yang diukur adalah ketepatan, RAM, dan latensi di VPS.
- Impor data dari laptop ke VPS menjadi bagian alur rilis.
- Bila proyek lain masuk ke VPS, batas 1 GB ditinjau ulang bersama jatah mereka.
