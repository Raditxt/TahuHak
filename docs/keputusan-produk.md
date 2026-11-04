# TahuHak — Keputusan Produk

> Konteks awal untuk Claude Code. Diputuskan lewat sesi riset dan grilling di claude.ai (3–4 Nov 2026).
> Ronde teknis diselesaikan lewat `/grill-with-docs` pada 4 Nov 2026. Istilah ada di `GLOSSARY.md`, keputusan besar di `docs/adr/`.

## Visi

TahuHak membantu warga Indonesia menemukan pasal dan peraturan yang relevan dengan masalah sehari-hari mereka, supaya punya landasan hukum dan kesadaran hukum yang lebih baik.

Posisinya sebagai **pengetahuan awal yang berbasis fakta**, bukan nasihat hukum. Setiap jawaban mengarahkan pengguna untuk memvalidasi ke bantuan hukum atau ahli hukum.

Terinspirasi pasal.id, tapi bukan tiruan. Pasal.id menjawab "pasal X bunyinya apa" untuk orang yang sudah tahu yang dicari. TahuHak menjawab "saya punya masalah Y: pasal mana yang relevan, artinya apa, dan saya harus ke mana".

## Keputusan yang sudah terkunci

| # | Topik | Keputusan |
| --- | --- | --- |
| 1 | Tujuan | Produk publik sungguhan, sekaligus portofolio pribadi |
| 2 | Pengguna | Warga Indonesia secara umum |
| 3 | Pintu masuk | Hybrid: topik terkurasi + tanya bebas ke AI |
| 4 | Kanal | Web app (mobile-friendly) |
| 5 | Cakupan | Peraturan nasional + **semua** Perda Provinsi Sulawesi Selatan dan Kota Makassar yang berlaku, diperlakukan setara dengan UU (diparsing per pasal, bisa muncul di jawaban AI) |
| 6 | Tim | Solo, sekitar 6 jam/hari |
| 7 | Pemilihan topik | Kategori disusun dari data aduan publik, lalu divalidasi lewat Google Form ke warga. Jumlah topik saat rilis mengikuti data |
| 8 | Pemeriksa isi | Pengembang + AI, dengan disclaimer untuk memvalidasi ke bantuan hukum atau ahli hukum |
| 9 | Biaya | Gratis. Donasi (Saweria/Trakteer) ada tapi tidak ditonjolkan |
| 10 | Login & kuota | Tanya AI bisa tanpa login dengan kuota harian kecil, lebih banyak setelah login. Halaman topik dan baca pasal bebas |
| 11 | Privasi | Pertanyaan/cerita pengguna **tidak disimpan sama sekali**: diproses lalu dibuang |
| 12 | Situasi darurat | Dijawab seperti biasa + disclaimer |
| 13 | Sumber data | Diambil sendiri dari sumber resmi (peraturan.go.id, JDIH BPK, JDIH Sulsel, JDIH Kota Makassar). Kode ditulis sendiri, bukan fork pasal.id |

## Pengaman akurasi (semua wajib)

1. **Teks asli pasal selalu tampil** berdampingan dengan penjelasan bahasa awam.
2. **AI wajib bersitasi**: setiap klaim menunjuk pasal yang ada di database, dicek otomatis setelah jawaban dibuat. Tidak ada pasal yang cocok → jawab "tidak ditemukan".
3. **Label status** di setiap pasal/peraturan: berlaku / diubah / dicabut, plus tanggal sumber.
4. **Tombol "Laporkan kesalahan"** di setiap pasal dan penjelasan. Laporan masuk ke database (bukan issue publik) karena bisa memuat data pribadi.
5. **Label asal penjelasan**: "dibuat AI, diperiksa pengembang".

## Batasan legal (dari riset)

- Teks peraturan dan putusan pengadilan tidak dilindungi hak cipta (UU 28/2014 Pasal 42 huruf b dan d).
- **Jangan mengambil data dari pasal.id.** ToS-nya (berlaku 5 Okt 2026) melarang ekstraksi otomatis/massal lewat situs, MCP, atau saluran lain, dan melarang membangun dataset pesaing.
- **Jangan menyalin kode pasal.id** (AGPL-3.0). Meniru ide arsitektur boleh.
- Memberi *informasi* hukum aman (Pasal 31 UU Advokat dibatalkan MK 006/PUU-II/2004). Jangan mengaku advokat atau mewakili klien.
- UU PDP 27/2022: cerita masalah hukum hampir pasti memuat data pribadi spesifik. Karena itu keputusan #11.
- Perlu Kebijakan Privasi dan DPIA singkat sebelum rilis publik. Pendaftaran PSE dipertimbangkan saat dibuka luas.
- Scraping sumber resmi: cek `robots.txt`, beri jeda 1–3 detik antar-request, simpan PDF asli + URL sumber.

## Pelajaran teknis dari pasal.id (untuk referensi, bukan untuk disalin)

- Satu pasal = satu unit data. Struktur pohon BAB → Bagian → Paragraf → Pasal → Ayat, plus Penjelasan.
- Postgres full-text search dengan konfigurasi `indonesian`; tanpa pencarian semantik.
- Relasi antarperaturan (mengubah / diubah oleh / mencabut / dicabut oleh) disimpan terpisah dari teks.
- Pasal sisipan seperti "Pasal 5A" harus didukung parser.
- JDIH BPK sering menolak request non-browser (403), kemungkinan butuh headless browser.

## Pertanyaan terbuka (ronde teknis)

- [x] Repo: **publik, kode AGPL-3.0**
- [x] Privasi #11 dirumuskan ulang: lihat `docs/adr/0002-batas-privasi-pertanyaan-pengguna.md`
- [x] Cakupan nasional: UUD 1945, UU/Perppu, PP, Perpres; Permen hanya bila Topik membutuhkan. Ingestion nasional **mengikuti Topik**. Perda tetap #5 (semua yang berlaku)
- [x] Status di dua tingkat (Status Peraturan + Status Pasal), Putusan MK sebagai sumber status. Istilah: lihat `GLOSSARY.md`
- [x] Pasal yang diubah: Versi Pasal tertaut, bukan konsolidasi (`docs/adr/0001-versi-pasal-tertaut-bukan-konsolidasi.md`)
- [x] Issue tracker: **GitHub Issues** (laporan pengguna tetap masuk database sendiri dulu, hanya yang valid dan bebas data pribadi dijadikan issue)
- [x] LLM: **self-hosted di VPS, tanpa API berbayar**, karena tidak ada anggaran. Arsitektur jawaban harus menyesuaikan dengan inferensi CPU (2 vCPU)
- [x] Pencarian: **FTS Postgres + query rewriting dulu**. Vektor hanya ditambah bila recall@10 di set uji kurang, dan model embedding-nya juga self-hosted
- [x] Stack: TypeScript penuh (Next.js, ingestion Node, Drizzle, Postgres, Better Auth), self-hosted di VPS Hostinger KVM 2. Lihat `docs/adr/0003-typescript-self-hosted-di-vps.md`
- [x] Lisensi konten buatan sendiri (Uraian Awam, Topik, padanan istilah): **CC BY 4.0**
- [x] Status dan relasi: hierarki bukti 3 lapis (teks Peraturan/Putusan MK > metadata relasi BPK/JDIH > label sumber). Dasar Status wajib tampil. Daftar Putusan MK diambil dari mkri.id karena daftar BPK bolong. Pembatalan sebagian/bersyarat menjadi Catatan Putusan MK
- [x] #5 diperjelas: **semua** Perda diambil (berlaku maupun dicabut), sumber kanonik JDIH daerah, BPK sekunder, dedup per (daerah, jenis, nomor, tahun), Perwali dibuang. Hanya yang berlaku dipakai untuk menjawab
- [x] Data aduan untuk Topik: **sudah ada di `docs/riset/Data aduan untuk kategori topik.md`** (12 kategori, sub-situasi dalam bahasa warga, draf Google Form). Dipakai sebagai dasar Topik dan set uji
- [x] Jawaban **dirakit** dari bahan yang sudah diperiksa, bukan dikarang LLM per pertanyaan, dan tetap memuat disclaimer untuk membaca sumber lengkap (`docs/adr/0004-jawaban-dirakit-bukan-dikarang.md`). Uraian Awam ditulis pengembang dengan Claude Code saat pengembangan, per Topik (tidak ada GPU lokal)
- [x] Parser: pdfjs → deteksi kualitas → `ocrmypdf --force-ocr -l ind` (sekali jalan di laptop pengembang, hasilnya diunggah ke VPS; VPS tidak menjalankan OCR) → buang header/watermark → parser struktur regex (BAB…Ayat, sisipan, Penjelasan) → parser perubahan → validasi urutan, yang janggal ditinjau manual. Label Asal Teks (digital/OCR) beserta tautan PDF resmi
- [x] Padanan Istilah yang dikurasi menjadi lapisan pertama penerjemah, sekaligus kamus sinonim FTS. Model lokal hanya cadangan. Kata kunci dari pertanyaan yang gagal disimpan tanpa cerita (pengecualian sempit di ADR-0002)
- [x] Urutan: **Topik PHK sampai tuntas dulu** (UU 13/2003, UU 6/2023, PP 35/2021), lalu Topik nasional lain sesuai data aduan, lalu semua Perda. Data aduan dan set uji disusun paralel
- [x] Ayat yang diubah: Pasal yang ditulis ulang utuh menjadi Versi Pasal baru dan diberi Catatan Perubahan otomatis. Pengubah yang hanya menulis Ayat dicatat sebagai Catatan Perubahan, tanpa disambung ke teks lama (ADR-0001)
- [x] Disclaimer 3 lapis: banner "informasi awal, bukan nasihat hukum" di atas Jawaban; per Pasal tautan teks lengkap, PDF resmi, Dasar Status beserta tanggal cek, dan label OCR; langkah selanjutnya berisi daftar bantuan hukum gratis yang dikurasi per Topik
- [x] Model lokal: `llama-server` (llama.cpp), output dikunci JSON schema, model 1–4B dipilih lewat set uji, batas waktu sekitar 20 detik dengan cadangan Padanan Istilah + FTS, antrean satu per satu
- [x] Pembaruan data: mkri.id dicek mingguan, keempat JDIH dicek bulanan, Peraturan diambil ulang seketika bila ada Laporan Kesalahan. Tanggal cek ditampilkan sebagai "dicek terakhir". Semua lewat cron malam di VPS
- [x] Evaluasi: set uji 60–100 pertanyaan dari data aduan + ~15 di luar cakupan, kunci jawaban berupa Pasal, dibuat **sebelum** memilih LLM/embedding. Metrik: recall@10, presisi sitasi, ketepatan "tidak ditemukan", rubrik Uraian Awam. Kunci jawaban divalidasi sekali oleh mahasiswa hukum/relawan LBH
- [x] Domain: `tahuhak.id` (masih tersedia per 4 Nov 2026). **Ditunda**, beli sebelum rilis publik