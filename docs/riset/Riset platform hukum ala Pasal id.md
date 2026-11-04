# Bangun "P3K hukum" di atas celah pasal.id

**Jawaban singkat:** celah paling jelas adalah layanan gratis yang dimulai dari *masalah sehari-hari*, bukan dari nomor undang-undang. Alurnya kira-kira "saya dipecat tanpa pesangon" → pasal yang relevan → penjelasan bahasa awam → langkah selanjutnya → ke mana minta bantuan di kota saya. Pasal.id sudah sangat kuat sebagai *infrastruktur data* hukum: sekitar 3,97 juta pasal terstruktur, MCP server, dan status berlaku/dicabut. Tapi pasal.id masih berbasis dokumen dan kata kunci, tidak menjelaskan pasal dalam bahasa awam, dan tidak merujuk pengguna ke bantuan hukum ([pasal.id](https://pasal.id); [GitHub](https://github.com/ilhamfp/pasal)). Kebutuhannya nyata. Indeks Akses terhadap Keadilan 2021 mencatat skor literasi hukum masyarakat hanya **15,8**. Selain itu, **67,8%** responden tidak tahu soal bantuan hukum gratis dan **47,9%** tidak tahu harus ke mana ([MaPPI FHUI](https://mappifhui.org/wp-content/uploads/2023/09/Indeks-Akses-Terhadap-Keadilan-di-Indonesia-Tahun-2021.pdf); [Bappenas](https://ditkumlasi.bappenas.go.id/download/file/A2J_2021_Infografis.pdf)). Dari sisi legal, teks peraturan dan putusan pengadilan **tidak dilindungi hak cipta** (UU 28/2014 Pasal 42). Yang dibatasi adalah *mengambil data dari pasal.id* (ToS melarang ekstraksi massal) dan *memakai kode pasal.id* (AGPL-3.0 mewajibkan source code terbuka). Karena itu jalur paling aman adalah mengambil data sendiri dari sumber resmi atau minta lisensi ke pasal.id. Secara teknis, rekomendasinya adalah meniru fondasi pasal.id (Postgres FTS `indonesian`, satu pasal sebagai unit) lalu menambahkan apa yang tidak dimiliki pasal.id: *query rewriting* dari bahasa awam ke istilah hukum, pencarian semantik (pgvector + RRF), dan jawaban yang wajib bersitasi. Semuanya untuk MVP 50–150 UU yang muat di Supabase Free.

> **Cara membaca laporan ini.** Fakta terverifikasi diberi sitasi `([Sumber](URL))`. Bagian berlabel **[Estimasi]** atau **[Rekomendasi]** adalah hitungan atau pendapat analis, bukan fakta bersumber. Item berlabel **⚠ Perlu verifikasi** wajib kamu cek sendiri sebelum dipakai di produk atau laporan.

## Pasal.id menjawab "pasal X bunyinya apa", belum menjawab "saya harus apa"

**Fakta terverifikasi.** Pasal.id memakai tagline "Hukum Indonesia, terbuka untuk semua", gratis, dengan batas **1 peraturan/hari tanpa akun** dan tak terbatas setelah login. Halamannya menampilkan **1.901 UU, 5.026 PP, 2.669 Perpres, 24.647 Permen, 50.220 Perda**, sekitar **3,97 juta pasal**, dan klaim "100.000+ peraturan" ([pasal.id](https://pasal.id)). README di GitHub masih menyebut 40.143 peraturan, jadi kemungkinan sudah usang ([GitHub](https://github.com/ilhamfp/pasal)). Fitur yang paling menonjol justru ditujukan untuk agen AI dan developer: MCP server v2 dengan enam tool (`search_legal`, `resolve_law`, `get_law_context`, `read_law`, `search_court_decisions`, `report_issue`). Batasnya **300 pembacaan teks penuh/akun/hari** dan wajib punya akun ([pasal.id/hubungkan](https://pasal.id/hubungkan)). Plugin-nya menyasar penulis, penyusun kontrak, dan peneliti. Tidak ada fitur khusus untuk orang awam ([pasal.id/hubungkan/plugin](https://pasal.id/hubungkan/plugin)). Pasal.id bahkan menyebut dirinya "Indonesia's open legal platform for humans and AI agents" dan sudah masuk Stanford CodeX Legal Tech Index ([pasal.id/tentang-tim](https://pasal.id/en/tentang-tim); [Stanford CodeX](https://techindex.law.stanford.edu/companies/pasal-id)).

Pemain lain terbagi ke empat kelompok, dan belum ada yang mengisi posisi "gratis + berbasis situasi + rujukan lokal":

| Kelompok | Contoh | Model & harga (terverifikasi) | Celah untuk orang awam |
|---|---|---|---|
| Repositori pemerintah | peraturan.go.id, JDIH BPK, JDIHN, JDIH daerah | Gratis, PDF-sentris; peraturan.go.id sedang "dalam perbaikan" ([peraturan.go.id](https://peraturan.go.id)) | Harus tahu nomor/jenis aturan; "Tematik" BPK untuk tema kebijakan pejabat ([BPK](https://peraturan.bpk.go.id/Tematik?id=13)) |
| Incumbent | Hukumonline | Klinik (Q&A) gratis; Pusat Data & AI "AIlex" ada di Pro berbayar ([hukumonline](https://www.hukumonline.com/produk)) | Klinik berupa artikel panjang, tidak interaktif, tanpa rujukan lokal |
| Marketplace pengacara | Justika, Hukumku, LawOnGo, Kontrak Hukum | Konsultasi telepon Justika mulai **Rp299.000/30 menit** (data 2020) ([Teknologi.id](https://teknologi.id/business/justika-com-halodoc-nya-dunia-hukum-indonesia)) | Berbayar; harga 2025–2026 belum terverifikasi |
| Alat riset AI | Meridian Hukum, AsistenHukum, veritask | Meridian: Basic gratis terbatas, Pro **Rp180.000/bln**, Max Rp540.000/bln ([Meridian](https://meridianhukum.com/harga)) | Berorientasi riset/profesional |

Ada satu preseden menarik: chatbot **LIA** (2018) dari Hukumonline jalan di Facebook Messenger dengan bahasa informal, tapi hanya mencakup tiga topik (nikah, cerai, waris) ([DailySocial](https://en.dailysocial.id/post/lawonline-chatbot-lia)). Tidak ditemukan bukti LIA masih aktif. Bot hukum berbasis WhatsApp di 2024–2026 juga tidak ditemukan.

**Kenapa ini penting.** Data akses keadilan cocok sekali dengan fitur yang bisa kamu bangun. Sebanyak **46,0%** responden tidak paham istilah hukum, sehingga penjelasan bahasa awam relevan. Sebanyak **47,9%** tidak tahu harus ke mana, sehingga direktori rujukan relevan. Kemampuan menavigasi proses hukum skornya hanya **24,4**, sehingga *checklist* langkah selanjutnya juga relevan ([Bappenas](https://ditkumlasi.bappenas.go.id/download/file/A2J_2021_Infografis.pdf); [MaPPI FHUI](https://mappifhui.org/wp-content/uploads/2023/09/Indeks-Akses-Terhadap-Keadilan-di-Indonesia-Tahun-2021.pdf)). Konteks makronya ikut mendukung. Skor Rule of Law Index WJP 2026 Indonesia turun ke **0,51 (peringkat 75/143)**, terendah dalam satu dekade ([Databoks](https://databoks.katadata.co.id/en/demographics/statistics/6adad4504019c/indonesias-rule-of-law-index-declines-in-2026-reaching-its-lowest-level-in-the-last-10-years)). Anggaran bantuan hukum negara sekitar **Rp56 miliar (2024)** hanya menjangkau sekitar **9.000** perkara litigasi ([Hukumonline](https://www.hukumonline.com/berita/a/pro-bono-di-tengah-defisit-layanan-bantuan-hukum-lt69cc8f659c33b/?page=all)). Contoh volume masalah sehari-hari: OJK menerima **11.653 aduan pinjol ilegal** pada Januari–Agustus 2025 ([Kontan](https://keuangan.kontan.co.id/news/ojk-terima-lebih-dari-11600-pengaduan-pinjol-ilegal-hingga-agustus-2025)).

**[Rekomendasi] Positioning.** Pasal.id lebih baik diperlakukan sebagai *pelengkap atau sumber referensi*, bukan musuh. Kalimat diferensiasinya: *"Pasal.id menjawab 'pasal X bunyinya apa?' untuk orang yang sudah tahu yang dicari. Project ini menjawab 'saya punya masalah Y: pasal mana yang melindungi saya, artinya apa, dan saya harus ke mana di kota saya?'"* Ada tiga sudut tambahan yang realistis untuk mahasiswa. Pertama, fokus regional Sulsel/Makassar, karena Perda dan Perwali Makassar masih tersebar sebagai PDF mentah ([JDIH Makassar](https://jdih.makassarkota.go.id/public/dokumen/2025sk73270601.pdf)). Kedua, direktori rujukan lokal (LBH Makassar, Posbakum, Disnaker, OJK, BPSK, UPTD PPA). Ini relevan karena daftar kontak LBH saat ini hanya berupa *listicle* statis ([GoodStats](https://data.goodstats.id/statistic/daftar-kontak-lembaga-bantuan-hukum-di-berbagai-kota-indonesia-xHE76)), sementara BPHN sedang mendorong Posbakum di desa dan kelurahan. Ketiga, kueri pertama tanpa login. **⚠ Belum diverifikasi:** apakah Klinik Hukumonline sudah punya *topic hub* terstruktur (misalnya PHK atau pinjol) yang sebagian mengisi celah ini. Cek manual sebelum mengklaim "belum ada yang melakukan".

## Teks hukumnya bebas, tapi database dan kode pasal.id tidak

**Fakta terverifikasi: hak cipta.** UU 28/2014 **Pasal 42** berbunyi "Tidak ada Hak Cipta atas hasil karya berupa: … b. peraturan perundang-undangan; … d. putusan pengadilan atau penetapan hakim". Pasal 41 juga mengecualikan "data" dari perlindungan ([UU 28/2014 di pasal.id](https://pasal.id/en/peraturan/uu/uu-no-28-tahun-2014); [PDF resmi](https://peraturan.go.id/files/uu28-2014pjl.pdf)). Yang sering keliru dikutip, yaitu Pasal 13, sebenarnya mengatur potret pelaku pertunjukan dan tidak relevan di sini. Di sisi lain, Pasal 59 huruf i menyebut "kompilasi Ciptaan atau data" sebagai kategori yang dilindungi. ToS pasal.id memakai logika yang sama: teks peraturan bebas hak cipta (dengan mengutip Pasal 42 huruf b dengan benar), tetapi "data terstruktur dan organisasi database merupakan hasil karya Pasal.id" ([pasal.id/ketentuan](https://pasal.id/ketentuan)). **[Inferensi]** Indonesia tidak punya *sui generis database right* seperti di Uni Eropa. Perlindungan kompilasi datang dari hak cipta (orisinalitas seleksi dan susunan) ditambah kontrak (ToS). **⚠ Perlu verifikasi:** teks Pasal 40 ayat (1) tentang kompilasi belum terkutip dari PDF resmi.

**Fakta terverifikasi: ToS pasal.id (berlaku 5 Okt 2026).** API `/api/v1` "hanya menyediakan metadata penemuan" dan "tidak menyediakan teks peraturan". Teks hanya bisa dibaca lewat MCP dengan batas harian per akun. Ada tiga hal yang dilarang: "mengekstraksi konten secara otomatis dan massal" tanpa lisensi tertulis, "membangun basis data atau dataset pesaing dari konten Pasal.id tanpa lisensi", dan memakai banyak akun atau token untuk mengakali limit. Akses massal harus lewat perjanjian (halo@pasal.id) ([pasal.id/ketentuan](https://pasal.id/ketentuan)). Teks lengkap ToS (dibagikan langsung oleh pengguna) mempertegas cakupannya: larangan ekstraksi berlaku untuk **teks peraturan, pasal, putusan, ringkasan, maupun hubungan antarperaturan**, lewat **situs web, server MCP, endpoint basis data, atau saluran lain mana pun**. Selain itu, setiap orang hanya boleh punya **satu akun**, dan sengketa diselesaikan di PN Jakarta Pusat. **[Inferensi penting]** Kalau backend aplikasi publikmu memanggil MCP pasal.id atas nama banyak pengguna, praktik itu bisa dianggap mengakali limit atau membangun dataset pesaing. Jadi kalau mau memakai pasal.id sebagai sumber, **minta izin tertulis dulu**. Mengirim email ke pengembangnya juga bisa membuka peluang kolaborasi.

**Fakta terverifikasi: AGPL-3.0.** Repo `ilhamfp/pasal` berlisensi AGPL-3.0. Menurut Section 13, kalau kamu memodifikasi kode lalu menjalankannya sebagai layanan jaringan, kamu wajib menawarkan *Corresponding Source* kepada semua pengguna yang berinteraksi dengannya ([OSI](https://opensource.org/license/agpl-v3); [GitHub](https://github.com/ilhamfp/pasal)). **[Inferensi]** Fork dari pasal.id berarti seluruh layanan turunannya harus open source dengan tautan source yang terlihat. Ini bukan masalah besar untuk project portofolio, malah bisa jadi nilai plus. Ada dua hal yang perlu dibedakan. AGPL mengatur *kode*, bukan database pasal.id. Menjalankan scraper dari repo itu ke sumber resmi adalah hal yang berbeda dari menyedot data dari pasal.id. Kalau ingin tetap bebas memilih lisensi, tulis ulang dari nol dengan hanya meniru *ide* arsitekturnya (ide tidak dilindungi menurut Pasal 41).

**Fakta terverifikasi: sumber data resmi.** Tidak ditemukan API publik atau unduhan massal resmi untuk peraturan.go.id, JDIH BPK, JDIHN, maupun Direktori Putusan MA. Detailnya per sumber:

- **peraturan.go.id** berbentuk PDF dengan pola URL seperti `peraturan.go.id/files/uu28-2014pjl.pdf`.
- **JDIH BPK** punya halaman HTML `/Details/{id}` dan PDF `/Download/{id}/...`, termasuk Perda Sulsel ([BPK](https://peraturan.bpk.go.id/Details/336422)). Menurut registry pasal.id, situs ini mengembalikan 403 ke klien non-browser sehingga butuh *headless browser* ([source_registry.py](https://github.com/ilhamfp/pasal/blob/main/scripts/crawler/source_registry.py)).
- **JDIHN** punya dasar hukum Perpres 33/2012 dan standar Permenkumham 8/2019 dengan "URL Integrasi", tapi tidak ada spesifikasi API publik ([slide standar JDIH](https://jdih.balikpapan.go.id/jdih/common/dokumen/standarpengelolaanjdih.pdf)).
- **Putusan MA** tersedia per halaman di `putusan3.mahkamahagung.go.id/direktori/putusan/{hash}.html`. Publikasinya diwajibkan antara lain oleh UU 48/2009 Pasal 52, PERMA 7/2022, dan SK KMA 2-144/2022 ([hukumonline klinik](https://www.hukumonline.com/klinik/a/dasar-hukum-publikasi-putusan-pengadilan-lt6638ffb83d39b/)).

Pasal.id sendiri menyebut BPK JDIH (69 jenis peraturan), JDIH MK, dan JDIHN untuk Perda sebagai sumbernya, dengan jendela kesegaran 168 jam ([pasal.id/kebijakan-editorial](https://pasal.id/kebijakan-editorial)). **⚠ Perlu verifikasi:** robots.txt dan syarat penggunaan semua portal pemerintah di atas *belum bisa dicek* (proxy riset diblokir 403). Cek manual. Lakukan *polite scraping*: rate limit, cache, User-Agent yang menyebut nama project, dan selalu tautkan balik ke URL resmi.

**Fakta terverifikasi: dataset terbuka, dengan lisensi yang berantakan.**

| Dataset | Isi | Lisensi tercatat | Catatan |
|---|---|---|---|
| [Azzindani/ID_REG_DB_2511](https://huggingface.co/datasets/Azzindani/ID_REG_DB_2511/blob/main/README.md) | ~748.558 peraturan, SQLite + embedding 1024-d + FTS5, ~10,5 GB | CC-BY-4.0 | Contoh di README menunjuk nama file 2510, jadi cek path-nya |
| [horelulus/ID_Regulations](https://huggingface.co/datasets/horelulus/ID_Regulations/blob/main/README.md) | ~250.000 PDF peraturan | Apache-2.0 | "Research and development only", tanpa jaminan akurasi |
| [ir-nlp-csui/indo-law](https://github.com/ir-nlp-csui/indo-law) | 22.630 putusan pidana (XML) | AGPL-3.0 **+** larangan menyebarkan ulang tanpa izin | **Kontradiktif** |
| [OTF peraturan.go.id](https://github.com/Open-Technology-Foundation/peraturan.go.id) | 5.817 dokumen markdown + FAISS | File LICENSE: GPL-3.0; README: "Proprietary" | **Kontradiktif** |
| [IDTheftCase (Mendeley)](https://data.mendeley.com/datasets/48x9xm7rkf/3) | Putusan pencurian, berlabel NER | CC BY 4.0 | Footer Mendeley membatasi TDM/AI |
| [IndoLER](https://huggingface.co/datasets/SEACrowd/indoler/blob/main/indoler.py) | NER pada 993 putusan MA | Tidak diketahui | — |

**⚠ Perlu verifikasi:** baca file lisensi setiap dataset sebelum dipakai atau didistribusikan ulang, terutama yang kontradiktif. **[Rekomendasi]** Karena teks hukumnya sendiri bebas hak cipta, mengunduh ulang dari sumber resmi lebih bersih secara hukum daripada mencerminkan (*mirror*) dataset orang lain. Dataset pihak ketiga cukup dipakai untuk eksperimen lokal.

## Boleh menjelaskan hukum, tapi jangan berlagak advokat dan hati-hati data cerita pengguna

**Fakta terverifikasi: UU Advokat dan bantuan hukum.** UU 18/2003 mendefinisikan "jasa hukum" (konsultasi, bantuan, kuasa, pembelaan untuk klien) sebagai ranah advokat. Pasal 31 yang dulu memidana orang yang "bertindak seolah-olah sebagai advokat" sudah **dinyatakan tidak mengikat oleh Putusan MK 006/PUU-II/2004**. Alasan MK: pasal itu mengancam orang yang sekadar menjelaskan hukum dan membatasi hak atas informasi (Pasal 28F UUD 1945) ([hukumonline klinik](https://www.hukumonline.com/klinik/a/bolehkah-bukan-advokat-memberikan-pendapat-hukum-lt5b99112ba52db/); [putusan di pasal.id](https://pasal.id/peraturan/putusan-mk/puu-mk-6-2004)). Non-advokat boleh menyampaikan pandangan hukum sebagai kebebasan berekspresi. Di sisi lain, UU 16/2011 tentang Bantuan Hukum (dikuatkan MK 88/PUU-X/2012) mengizinkan paralegal, dosen, dan mahasiswa hukum memberi bantuan hukum bagi orang miskin melalui lembaga bantuan hukum ([hukumonline](https://www.hukumonline.com/berita/a/mk-tolak-pengujian-uu-bantuan-hukum-lt52b321672cdcb/)). **[Inferensi]** Platform *informasi* hukum (pencarian, penjelasan pasal, ringkasan bahasa awam) berada di zona aman. Fitur yang menyerupai representasi klien, nasihat personal berbayar, atau mengaku sebagai advokat yang berisiko. Karena itu pola standarnya adalah disclaimer "bukan nasihat hukum" plus rujukan ke LBH atau advokat, seperti yang dilakukan pasal.id ([pasal.id/ketentuan](https://pasal.id/ketentuan)). **⚠ Belum diteliti:** sikap kode etik atau PERADI terhadap AI yang memberi nasihat hukum.

**Fakta terverifikasi: UU PDP (UU 27/2022).** Ini risiko yang paling sering terlewat. Pasal 4(2) menggolongkan **catatan kejahatan, data anak, data kesehatan, dan data keuangan pribadi** sebagai data pribadi *spesifik*. Padahal cerita pengguna tentang masalah hukumnya hampir pasti memuat data seperti itu. Dasar pemrosesan bisa berupa "persetujuan yang sah secara eksplisit" (Pasal 20). Kegagalan perlindungan data wajib diberitahukan **paling lambat 3×24 jam** (Pasal 46). Ada juga kewajiban pejabat pelindungan data dalam kondisi tertentu (Pasal 53, yang sebagian dimaknai ulang oleh MK 151/PUU-XXII/2024) ([UU 27/2022 di pasal.id](https://pasal.id/peraturan/uu/uu-no-27-tahun-2022)). UU ini memuat sanksi administratif dan pidana ([hukumonline](https://www.hukumonline.com/berita/a/catatan-atp-law-firm-terhadap-sanksi-pemidanaan-dan-administratif-dalam-uu-pdp-lt65fd0333866d8/)). **⚠ Perlu verifikasi:** besaran denda persisnya (Pasal 57 dan 67–73) belum dicek dari teks primer.

**[Rekomendasi] Desain privasi untuk MVP:**

- Jangan simpan teks cerita pengguna secara default. Proses saja lalu buang, dan simpan log anonim hanya untuk evaluasi dengan opt-in eksplisit.
- Tampilkan peringatan sebelum kolom input, misalnya "jangan tulis nama, NIK, atau nomor HP".
- Lakukan *redaction* sederhana (regex untuk NIK, nomor HP, email) sebelum teks dikirim ke API LLM, karena mengirim ke LLM pihak ketiga memunculkan isu transfer data lintas negara.

**Fakta terverifikasi: cara pasal.id sendiri menangani privasi** (Kebijakan Privasi berlaku 2 Okt 2026 dan Penilaian Dampak Pelindungan Data/DPIA ditinjau 2 Okt 2026, dibagikan langsung oleh pengguna). Dokumen ini berguna sebagai contoh nyata kepatuhan UU PDP untuk proyek sejenis:

- **Data yang dikumpulkan sangat minim:** profil OAuth (nama, email, foto), bookmark dan masukan, cookie anonim `pasal_visited` (reset harian, maksimal 48 jam) untuk membatasi kunjungan artikel, serta catatan operasional API/MCP.
- **Kueri hukum ikut tersimpan.** Pada koneksi MCP standar, kueri, argumen tool, dan potongan respons disimpan untuk diagnosis dan **dikirim ke Google Gemini** untuk pemeriksaan kualitas. Salinan diagnostik dihapus setelah 90 hari, tetapi catatan operasional dan kueri pencarian belum punya batas kedaluwarsa otomatis. Jalur plugin OpenAI tidak mencatat kueri mentah secara rutin.
- **Pengguna diminta tidak menulis identitas, alamat, atau rincian perkara rahasia** bila istilah hukum umum sudah cukup. DPIA-nya terang-terangan menyatakan bahwa pemeriksaan kualitas tidak bebas risiko hanya karena topiknya hukum.
- **Lokasi dan pemroses pihak ketiga:** Supabase wilayah Singapura (transfer lintas batas diungkapkan), Railway, Vercel, Google/Facebook, dan Gemini.
- **Hak subjek data:** kelola dan hapus akun lewat `/akun`, permintaan lain lewat privasi@pasal.id dengan target respons 72 jam. Ekspor otomatis belum tersedia, dan pencabutan token tidak otomatis menghapus catatan lama.
- **Notifikasi pelanggaran** dalam 72 jam sesuai Pasal 46 UU PDP. DPIA ditinjau tahunan atau saat ada perubahan signifikan.

**[Rekomendasi] Pelajaran untuk proyekmu.** Proyekmu justru lebih berisiko daripada pasal.id karena alurnya mengundang orang *menceritakan masalahnya*, bukan sekadar mengetik kata kunci. Jadi:

- Tiru struktur dokumennya: Kebijakan Privasi + DPIA singkat yang jujur menyebut risiko tersisa. Ini juga nilai plus untuk portofolio.
- Tetapkan masa simpan untuk *semua* jenis log sejak awal, termasuk log kueri. Celah "belum ada batas kedaluwarsa" di pasal.id jangan ditiru.
- Kalau kueri dikirim ke LLM pihak ketiga, sebutkan penyedianya dan wilayah pemrosesannya secara eksplisit, seperti pasal.id menyebut Gemini dan Singapura.
- Sediakan mode tanpa login dan tanpa penyimpanan untuk pertanyaan pertama.

**Fakta terverifikasi: PSE dan regulasi AI.**

- **PSE lingkup privat**, termasuk startup dan individu yang memproses data pribadi pengguna, wajib terdaftar lewat OSS sampai pse.komdigi.go.id (dasar: PP 71/2019, Permenkominfo 5/2020 jo. 10/2021), dan yang tidak terdaftar bisa diblokir ([izin.co.id](https://izin.co.id/blog/apa-itu-pse-kominfo/)). Komdigi bahkan pernah mengancam memblokir OpenAI dan Duolingo pada Nov 2025 ([Bisnis](https://teknologi.bisnis.com/read/20251118/101/1929787/komdigi-ancam-putus-akses-25-pse-yang-belum-terdaftar-ada-duolinggo-hingga-openai)).
- **Regulasi AI.** Yang berlaku baru **SE Menkominfo 9/2023** tentang Etika AI, yang tidak mengikat. Isinya antara lain meminta AI tidak dijadikan pengambil keputusan atas hal yang menyangkut kemanusiaan dan meminta transparansi ([detik](https://inet.detik.com/law-and-policy/d-7103666/kominfo-terbitkan-surat-edaran-etika-penggunaan-ai-di-indonesia)). Dua Perpres AI (Peta Jalan AI Nasional dan Etika AI) per **4 Sep 2026** masih "menunggu tanda tangan Presiden" ([Kontan](https://nasional.kontan.co.id/news/dua-perpres-ai-tinggal-tunggu-tanda-tangan-prabowo)). Perpres Etika AI disebut membagi penggunaan AI ke tiga kategori: dilarang, diawasi ketat, dan risiko rendah.

**⚠ Perlu verifikasi:** apakah Perpres AI sudah terbit antara September dan November 2026 (cek jdih.setneg.go.id). **[Spekulasi]** Chatbot nasihat hukum bisa masuk kategori "diawasi ketat". Ini satu lagi alasan untuk memposisikan produk sebagai *informasi*, bukan *nasihat*. **[Rekomendasi]** Untuk tahap demo atau portofolio, pendaftaran PSE mungkin belum mendesak. Kalau sudah dibuka untuk publik luas dan menyimpan data pengguna, rencanakan pendaftarannya.

## Di balik layar pasal.id: Postgres FTS, satu pasal sebagai unit, dan *flywheel* koreksi

**Fakta terverifikasi (dari kode repo pada commit `485e519`, 1 Mar 2026; repo publik kemungkinan tertinggal dari produksi).** Pasal.id adalah monorepo dengan tiga bagian ([README](https://github.com/ilhamfp/pasal/blob/main/README.md)):

1. **Pipeline Python.** httpx + BeautifulSoup untuk scraping, PyMuPDF untuk ekstraksi teks (komentar kodenya menyebut "~100x faster than pdfplumber"), dan parser struktur berbasis regex.
2. **Supabase Postgres.**
3. **Next.js 16** (App Router, React 19, Tailwind v4, shadcn/ui) di Vercel, plus **FastMCP** di Railway.

Detail pipeline:

- **Antrian job.** Job disimpan di tabel `crawl_jobs` dan diklaim secara atomik dengan `FOR UPDATE SKIP LOCKED` ([process.py](https://github.com/ilhamfp/pasal/blob/main/scripts/worker/process.py)).
- **Klasifikasi PDF.** Klasifier mengambil sampel 10 halaman pertama dan memberi label `born_digital`, `scanned_clean`, atau `image_only`. PDF image-only diparkir sebagai `needs_ocr`, karena repo tidak menjalankan OCR penuh ([classify_pdf.py](https://github.com/ilhamfp/pasal/blob/main/scripts/parser/classify_pdf.py)).
- **Pembersihan teks.** Koreksi OCR memakai regex deterministik (`Pasal l`→`Pasal 1`, `FRESIDEN`→`PRESIDEN`) dan juga menghapus header/footer serta watermark ([ocr_correct.py](https://github.com/ilhamfp/pasal/blob/main/scripts/parser/ocr_correct.py)).
- **Parsing struktur.** Parser mencocokkan baris demi baris dengan pola `^BAB\s+[IVXLCDM]+$`, `^Pasal[ \t]+(\d+[A-Z]?)$` (sufiks huruf menangkap pasal sisipan seperti 5A), dan `^\((\d+)\)` untuk ayat. Bagian PENJELASAN dipisah ([parse_structure.py](https://github.com/ilhamfp/pasal/blob/main/scripts/parser/parse_structure.py)).

**Konflik:** halaman kebijakan editorial yang live menyebut parser LiteParse/Unstructured dan verifikasi Gemini 3 Flash ([pasal.id/kebijakan-editorial](https://pasal.id/kebijakan-editorial)). Kemungkinan pipeline produksi sudah berubah setelah commit publik terakhir.

**Skema data (terverifikasi):**

- `works`: satu baris per peraturan. Kolomnya antara lain `frbr_uri` ala Akoma Ntoso (`/akn/id/act/uu/2003/13`), `status` (berlaku/diubah/dicabut/tidak_berlaku), `subject_tags`, dan URL sumber ([002](https://github.com/ilhamfp/pasal/blob/main/packages/supabase/migrations/002_works_table.sql)).
- `document_nodes`: pohon bab/bagian/paragraf/pasal/ayat/penjelasan dengan `parent_id`, `path LTREE`, `pdf_page`, dan flag `human_verified` ([003](https://github.com/ilhamfp/pasal/blob/main/packages/supabase/migrations/003_document_nodes.sql)).
- `work_relationships`: relasi dua arah (mengubah/diubah_oleh, mencabut/dicabut_oleh, dan lain-lain). Di repo, relasi ini masih **diisi manual** untuk demo, misalnya UU 6/2023 → UU 13/2003 ([004](https://github.com/ilhamfp/pasal/blob/main/packages/supabase/migrations/004_work_relationships.sql)).
- `revisions` (append-only) dan `apply_revision()`: membentuk jejak audit.

Pelajaran penting dari migrasi 038: tabel salinan `legal_chunks` sebesar **1,7 GB** dihapus karena menggandakan beban vacuum, lalu FTS dipasang langsung di `document_nodes` ([038](https://github.com/ilhamfp/pasal/blob/main/packages/supabase/migrations/038_eliminate_legal_chunks.sql)). Repo juga tidak berisi kode yang mengkonsolidasikan amandemen ke teks UU induk. Situs live sendiri mengakui rantai perubahan pada UU perubahan yang kompleks "mungkin belum sempurna" ([pasal.id/metodologi](https://pasal.id/metodologi)).

**Pencarian (terverifikasi): murni kata kunci, tanpa vektor.** Kolom tsvector dibentuk dengan `to_tsvector('indonesian', …)`, yaitu stemmer Snowball bawaan Postgres, ditambah indeks trigram. Fungsi `search_legal_chunks()` bekerja dalam tiga lapis:

1. *Fast path* identitas. Kueri seperti "uu 10 2011" langsung mendapat skor 1000.
2. FTS pada judul (works).
3. FTS pada isi, dengan fallback `websearch_to_tsquery` → `plainto_tsquery` → `ILIKE`.

Ranking memberi bonus untuk hierarki yang lebih tinggi dan tahun yang lebih baru ([CLAUDE.md](https://github.com/ilhamfp/pasal/blob/main/CLAUDE.md); [043](https://github.com/ilhamfp/pasal/blob/main/packages/supabase/migrations/043_search_performance.sql)). Tidak ada pgvector atau embedding, dan situs live menegaskan "Search is keyword-based full-text search, not semantic search" ([pasal.id/kebijakan-editorial](https://pasal.id/kebijakan-editorial)). Penerjemahan bahasa awam ke istilah hukum *diserahkan ke LLM pemanggil* lewat instruksi MCP: "Use specific legal terms: 'pemutusan hubungan kerja' not 'fired from job'". Setiap respons dibungkus disclaimer ([server.py](https://github.com/ilhamfp/pasal/blob/main/apps/mcp-server/server.py)). Halaman topik di repo hanya berisi 4 topik yang dikurasi manual, dengan pemetaan seperti "Apa hak saya jika di-PHK?" → `searchQuery: "pemutusan hubungan kerja"`, Pasal 156 UU 13/2003 ([topics.ts](https://github.com/ilhamfp/pasal/blob/main/apps/web/src/data/topics.ts)).

**Kualitas (terverifikasi).** Situs live menampilkan lima tingkat bukti verifikasi, dari "Ditinjau manusia" sampai "Bukti pemeriksaan terbatas". Lencana ini menyatakan akurasi *teks*, bukan validitas hukum ([pasal.id/metodologi](https://pasal.id/metodologi)). Di repo, koreksi dari pengguna diperiksa LLM dengan membandingkan teks hasil parsing dengan gambar halaman PDF. Koreksi dengan confidence ≥0,85 diterapkan otomatis, sisanya masuk antrian admin ([correction_worker.py](https://github.com/ilhamfp/pasal/blob/main/scripts/agent/correction_worker.py)). Satu fakta yang memotivasi: pasal.id dimulai sebagai MVP hackathon dengan **20 UU dan sekitar 1.630 pasal, tanpa test dan tanpa CI** ([HUMAN-NOTES.md](https://github.com/ilhamfp/pasal/blob/main/old-docs/HUMAN-NOTES.md)).

**[Inferensi]** Pencarian kata kunci murni sudah cukup kalau pemanggilnya LLM yang paham istilah hukum. Untuk orang awam yang mengetik "dipecat", hasilnya lemah. Di situlah peluang teknis project kamu.

## Stack yang direkomendasikan: tiru fondasinya, tambahkan jembatan bahasa awam

**Fakta terverifikasi yang menjadi dasar rekomendasi:**

- **Stemmer.** Postgres punya stemmer Snowball `indonesian` sejak commit September 2018 ([pgsql-committers](https://www.postgresql.org/message-id/E1g4YQa-0003tf-Gr@gemulon.postgresql.org)), jadi kamu tidak perlu Sastrawi di dalam database. Catatan: kamus Kateglo yang ikut di PySastrawi berlisensi **CC-BY-NC-SA 3.0**, yang bisa jadi masalah kalau project dikomersialkan ([PySastrawi](https://github.com/har07/PySastrawi)).
- **Hybrid search.** Supabase mendokumentasikan pola hybrid search dengan RRF (`rrf_k = 50`), GIN untuk FTS, dan HNSW untuk vektor. Contohnya memakai config `'english'`, jadi **ganti ke `'indonesian'`** di sisi dokumen dan kueri ([Supabase docs](https://supabase.com/docs/guides/ai/hybrid-search)).
- **Model embedding.** Di benchmark MIRACL-id, multilingual-e5-large mencapai nDCG@10 **76,16** dan e5-small 74,80 ([LazarusNLP](https://lazarusnlp.github.io/indonesian-sentence-embeddings)). bge-m3 berlisensi MIT, konteks 8k, dan menyediakan dense + sparse ([HF](https://huggingface.co/BAAI/bge-m3)). Gemini `gemini-embedding-001` berharga **$0,15/1 juta token**, mendukung truncation ke 768 dimensi, dan punya free tier ([Google](https://developers.googleblog.com/en/gemini-embedding-available-gemini-api/)).
- **Riset QA hukum Indonesia.** Faisal dkk. (2024) memakai BM25 + reranker BERT yang sadar granularitas (bab/pasal/ayat) dan menaikkan *exact match* sekitar 20% di atas baseline ([UI](https://dara.ui.ac.id/research-output/5f903619-3c0d-4a4e-b41d-c6936ef9bba1)). Christian dkk. (2025) menemukan *single retrieval* jauh lebih baik daripada multi-step untuk LLM kecil berbahasa Indonesia (F1 0,411 vs 0,118) ([arXiv](https://arxiv.org/html/2510.21068v1)). Suharyadi & Saputra (2025) menemukan ensemble BM25+FAISS dengan *keyword boosting* memberi jawaban terbaik ([JNEST](https://journal.iistr.org/index.php/JNEST/article/view/1042)).
- **Biaya layanan.** Supabase Free memberi DB 500 MB dan storage 1 GB, tapi project di-*pause* setelah 1 minggu tidak aktif. Pro berharga $25/bulan untuk disk 8 GB ([Supabase pricing](https://supabase.com/pricing)). Gemini 3.1 Flash-Lite berharga **$0,25 input / $1,50 output per 1 juta token** dan punya free tier ([Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)).

**[Rekomendasi] Arsitektur MVP:**

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | Next.js di Vercel Hobby (PWA, mobile-first) | Sama dengan pasal.id. ⚠ Syarat Hobby melarang penggunaan komersial, cek kalau mau monetisasi |
| Database | Supabase Free: Postgres + FTS `indonesian` + pgvector (`halfvec` 768-d) + Storage PDF | Satu tempat untuk keyword, vektor, dan file |
| Ingestion | Skrip Python lokal atau GitHub Actions (PyMuPDF + parser regex ala `parse_structure.py`) | Tidak perlu worker yang selalu hidup |
| Unit indeks | 1 baris = 1 pasal, dengan judul UU + BAB/Bagian di-*prepend* saat embedding; ayat sebagai anak | Mengikuti temuan granularitas Faisal dkk. |
| Retrieval | FTS (kueri asli OR istilah hasil ekspansi) + vektor, digabung dengan RRF; reranker hanya kalau eval menunjukkan perlu | Hybrid lebih baik dari salah satunya |
| Jembatan bahasa awam | (1) Tabel kurasi `istilah_awam(term, legal_term, topic)` sekitar 200 baris (dipecat→PHK, pinjol→pinjaman daring/LPBBTI); (2) satu panggilan LLM murah yang mengembalikan JSON `{legal_terms, likely_laws, topic}` | Inilah pembeda utama dari pasal.id |
| Generasi jawaban | Gemini Flash-Lite, *single-shot*, prompt "jawab hanya dari pasal yang diberikan" | Murah dan sejalan dengan temuan Christian dkk. |
| Grounding | ID stabil `[UU-13-2003/Pasal-156]`; post-validasi bahwa setiap sitasi ada di set hasil retrieval (kalau tidak, buang atau tandai); tampilkan lencana status dan peringatan "sudah diubah oleh…" | Prinsip *cite-or-don't-answer* |
| Format jawaban | Jawaban singkat bahasa awam → "Dasar hukum" (kutipan pasal) → Langkah selanjutnya → Ke mana (LBH/Posbakum/Disnaker/OJK/BPSK Makassar) → disclaimer | Menjawab langsung temuan A2J |
| Keamanan | Pemicu eskalasi (pidana, kekerasan, tenggat waktu) → arahkan ke LBH/hotline; redaksi PII; tidak menyimpan cerita secara default | Risiko UU Advokat dan UU PDP |

**[Estimasi, hitungan analis, bukan angka bersumber]**

- **Ukuran MVP.** 100 UU dengan rata-rata ~200 pasal menghasilkan kira-kira 20–40 ribu node, atau sekitar 40–80 MB teks. Embedding sekitar 20 ribu pasal × ~400 token = 8 juta token, kira-kira **$1,2** dengan Gemini embedding (atau gratis dalam kuota). Vektor 768-d butuh sekitar 60 MB (setengahnya kalau pakai `halfvec`). **Total muat di bawah 500 MB.**
- **Biaya per pertanyaan.** Sekitar 4 ribu token input + 600 token output di Flash-Lite ≈ **$0,002**, jadi 10 ribu pertanyaan ≈ $20.
- **Korpus penuh.** 937 ribu pasal ≈ 375 juta token ≈ $56 sekali embed, dengan vektor sekitar 1,4–2,9 GB. Ini butuh Supabase Pro.
- **⚠ Kalibrasi ulang.** Rata-rata token per pasal masih asumsi, jadi ukur di korpus hasil parsing-mu sendiri.

**[Rekomendasi] Lingkup MVP (4–8 minggu).** Pilih **10–20 topik sehari-hari** dengan alur lengkap "Situasi → Pasal → Penjelasan → Langkah → Ke mana", dengan fokus rujukan Makassar/Sulsel. Untuk korpus awal sekitar 60–150 UU, kandidat daftar di bawah ini **berasal dari pengetahuan umum analis, bukan dari sumber yang sudah dicek**:

| Topik | Kandidat peraturan | Status |
|---|---|---|
| PHK / pesangon / kontrak | UU 13/2003 + UU 6/2023 (Cipta Kerja) + PP 35/2021 | ⚠ Verifikasi nomor & status amandemen |
| Pidana umum | KUHP baru UU 1/2023 dan KUHP lama | ⚠ Verifikasi tanggal berlaku KUHP baru (catatan riset menyebut Januari 2026) |
| Perdata / waris / kontrak | KUHPerdata (BW, Staatsblad) | ⚠ Bukan PDF UU biasa di peraturan.go.id, butuh sumber terpisah |
| Belanja online / penipuan | UU 8/1999 Perlindungan Konsumen; UU 11/2008 ITE + UU 19/2016 + UU 1/2024 | ⚠ Verifikasi |
| Pinjol / data pribadi | UU 4/2023 P2SK + POJK 10/2022 (LPBBTI); UU 27/2022 PDP | UU PDP terverifikasi ([pasal.id](https://pasal.id/peraturan/uu/uu-no-27-tahun-2022)); sisanya ⚠ |
| Keluarga / KDRT / anak | UU 1/1974 + UU 16/2019 Perkawinan; UU 23/2004 PKDRT; UU 35/2014 Perlindungan Anak | ⚠ Verifikasi |
| Lalu lintas, tanah, administrasi | UU 22/2009 LLAJ; UU 5/1960 UUPA; UU 24/2013 Adminduk | ⚠ Verifikasi |
| Jaminan sosial, pekerja migran, bantuan hukum | UU 40/2004 SJSN + UU 24/2011 BPJS; UU 18/2017 PPMI; UU 16/2011 Bantuan Hukum | UU 16/2011 terverifikasi ([hukumonline](https://www.hukumonline.com/berita/a/mk-tolak-pengujian-uu-bantuan-hukum-lt52b321672cdcb/)); sisanya ⚠ |
| Lokal | Perda/Perwali Makassar & Perda Sulsel (via JDIH BPK / JDIH Makassar) | Sumber terverifikasi ([BPK](https://peraturan.bpk.go.id/Details/336422)) |

**[Rekomendasi] Evaluasi.** Ini yang membuat project-mu terlihat seperti kerja *AI engineer*, bukan sekadar wrapper. Susun 100–200 pertanyaan bahasa awam dengan label emas (UU, pasal), memakai pasangan Q&A di `topics.ts` pasal.id sebagai template. Ukur Recall@5/10 dan MRR untuk retrieval. Untuk jawaban, ukur *citation precision*, *faithfulness* (LLM-as-judge + cek manual), dan ketepatan eskalasi. Lalu lakukan ablation: FTS saja vs vektor saja vs hybrid vs hybrid + rewriting. Belum ada benchmark publik QA pasal hukum Indonesia dengan label emas yang bisa diunduh, jadi dataset eval buatanmu sendiri justru bisa menjadi kontribusi.

**Fitur yang sebaiknya ditunda:** konsolidasi teks amandemen otomatis (pasal.id sendiri belum menyelesaikannya), cakupan seluruh 100 ribu+ peraturan, OCR untuk PDF hasil scan, bot WhatsApp, dan dukungan bahasa daerah (Bugis/Makassar). Tidak ditemukan tools hukum berbahasa daerah, jadi ini *niche* yang menarik untuk fase kedua.

## Kesimpulan

Nilai project ini tidak terletak pada jumlah peraturan di database. Di sana pasal.id sudah unggul jauh, dan dengan ToS serta AGPL-nya kamu tidak bisa sekadar menyalin. Nilainya ada pada **lapisan terjemahan dari kehidupan sehari-hari ke hukum**, yaitu tabel istilah awam, *query rewriting*, jawaban bersitasi yang tervalidasi, dan rujukan lokal. Lapisan inilah yang secara eksplisit tidak dibangun pasal.id: mereka menyerahkannya ke LLM pemanggil. Data A2J menunjukkan orang Indonesia sebenarnya *tahu* mereka punya hak, tapi tidak bisa menghubungkannya ke pasal dan prosedur yang spesifik. Kebetulan, celah itu tepat sasaran untuk skill seorang AI engineer, dan bisa dibuktikan secara kuantitatif lewat dataset evaluasi buatan sendiri.

Langkah strategis yang paling murah dan paling berdampak: **kirim email ke tim pasal.id (halo@pasal.id)** sebelum menulis scraper. Jelaskan bahwa kamu membangun lapisan untuk orang awam di atas data mereka, dengan Makassar sebagai pilot. Kalau mereka memberi lisensi, kamu menghemat berminggu-minggu kerja parsing PDF dan bisa fokus ke retrieval dan UX. Kalau tidak, jalur cadangannya jelas: ambil sendiri sekitar 100 UU dari peraturan.go.id dan JDIH BPK, karena teks hukum bebas hak cipta. Dalam kedua skenario, perlakukan cerita pengguna sebagai data pribadi spesifik sejak hari pertama, dan pantau terbitnya Perpres AI yang bisa mengubah aturan main untuk chatbot hukum.
