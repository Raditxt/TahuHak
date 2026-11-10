# TahuHak

> 🚧 **Sedang dibangun.** Belum ada versi yang bisa dipakai publik. Repo ini memuat kode dan dokumentasi yang sedang dikerjakan.

TahuHak adalah web app gratis untuk membantu warga Indonesia menemukan **pasal yang relevan dengan masalah sehari-hari**, lalu memahaminya dengan bahasa awam.

Mesin pencari peraturan biasanya menjawab pertanyaan "Pasal X bunyinya apa?". TahuHak ingin menjawab pertanyaan yang lebih sering muncul: *"Saya punya masalah ini. Pasal mana yang mengaturnya, apa artinya, dan saya harus ke mana?"*

Contoh pertanyaannya: *"Saya di-PHK, pesangon saya berapa?"*, *"Ditagih pinjol sambil diteror, boleh tidak?"*, atau *"Jukir minta tarif di luar aturan, Perda-nya bilang apa?"*

## Yang ingin dicapai

- **Topik terkurasi.** Satu Topik untuk satu situasi sehari-hari (misalnya PHK, pinjol, penipuan online) beserta pasal-pasal yang berlaku.
- **"Ceritakan masalahmu".** Pengguna mengetik masalahnya dengan kata-kata sendiri, lalu TahuHak mencocokkannya ke Topik dan pasal yang relevan.
- **Peraturan nasional dan daerah.** Selain UU, PP, Perpres, dan peraturan sejenis, **Perda Sulawesi Selatan dan Kota Makassar** juga dibahas dengan kedudukan yang setara.
- **Gratis dan tanpa iklan.**

## Prinsip

TahuHak memberi **pengetahuan awal yang berbasis fakta**. TahuHak tidak memberi nasihat hukum, jadi setiap jawaban menyarankan pengguna memastikan langkahnya ke lembaga bantuan hukum atau ahli hukum.

Untuk menjaga akurasi:

1. **Teks asli pasal selalu ditampilkan** di samping penjelasan bahasa awamnya.
2. **Jawaban dirakit dari bahan yang sudah diperiksa, tidak dikarang AI.** Kalau tidak ada pasal yang cocok, jawabannya "tidak ditemukan" ([ADR-0004](docs/adr/0004-jawaban-dirakit-bukan-dikarang.md)).
3. **Setiap pasal diberi label status** (berlaku, diubah, atau dicabut) beserta tanggal sumbernya. Riwayat perubahan pasal disimpan dan saling ditautkan ([ADR-0001](docs/adr/0001-versi-pasal-tertaut-bukan-konsolidasi.md)).
4. **Ada tombol "Laporkan kesalahan"** di setiap pasal dan penjelasan.

Soal privasi: **pertanyaan dan cerita pengguna tidak disimpan.** Setelah diproses, isinya langsung dibuang ([ADR-0002](docs/adr/0002-batas-privasi-pertanyaan-pengguna.md)).

## Status

Slice pertama yang sedang dikerjakan adalah Topik **"Di-PHK, pesangon berapa?"**, dibangun utuh dari database sampai tampilan.

| Bagian | Status |
|---|---|
| Riset, keputusan produk, glosarium, ADR | ✅ Selesai |
| Ingestion UU 13/2003 (Ketenagakerjaan) | ✅ Selesai |
| Ingestion UU 6/2023 (Cipta Kerja) dan PP 35/2021 | ✅ Selesai |
| Parser perubahan (UU 6/2023 → pasal UU 13/2003) | 🔨 Berikutnya |
| Penentu status pasal, Putusan MK | ⏳ Belum |
| Pencarian dan perakit jawaban | ⏳ Belum |
| Halaman web (Pasal, Topik, beranda) | ⏳ Belum |
| Deploy | ⏳ Belum |

Setelah Topik PHK selesai, rencananya berlanjut ke Topik nasional lain (utang dan pinjol), lalu Perda Sulsel dan Makassar. Urutan Topik diambil dari [riset data aduan publik](docs/riset/) dan survei ke warga.

Progres per tiket bisa dilihat di [Issues](https://github.com/Raditxt/TahuHak/issues). Tiket dikelompokkan dengan label `divisi: data`, `be`, `fe`, `devops`, `qa`, dan `konten`.

## Cara kerja (rencana)

```
PDF resmi (JDIH BPK, peraturan.go.id, JDIH Sulsel/Makassar)
   │  ingestion (di laptop): ekstraksi teks / OCR → parser pasal, ayat, Penjelasan
   ▼
Postgres: Peraturan · Pasal · Versi Pasal · Status · Topik
   │
   ├─ Halaman Pasal & Topik (Next.js)
   └─ "Ceritakan masalahmu" → Penerjemah (Padanan Istilah) → full-text search
                              → Perakit Jawaban → pasal + penjelasan + rujukan bantuan hukum
```

## Teknologi

- **TypeScript** di semua bagian, dengan monorepo **pnpm**
- **Next.js** untuk web dan **Node.js** untuk CLI ingestion (pdfjs)
- **PostgreSQL** dengan **Drizzle ORM** dan full-text search
- **Vitest** untuk tes
- **Docker Compose** di VPS bersama, akses publik lewat **Cloudflare Tunnel** ([ADR-0005](docs/adr/0005-vps-bersama-waregos-lewat-cloudflare-tunnel.md))

## Menjalankan di lokal

Yang dibutuhkan: Node.js, pnpm 10, dan Docker.

```bash
pnpm install
pnpm db:up                 # Postgres dev di port 54329
pnpm ingest uu-13-2003     # ambil, urai, dan simpan UU 13/2003 ke database
pnpm test
```

Daftar sumber yang bisa di-ingest ada di `apps/ingest/sumber/`. Untuk saat ini repo baru berisi pipeline ingestion. Aplikasi web-nya belum ada.

## Struktur repo

```
apps/ingest/      CLI ingestion: unduh PDF, ekstrak teks, urai pasal
packages/db/      skema database (Drizzle) dan migrasi
docs/adr/         keputusan arsitektur (ADR)
docs/riset/       riset platform hukum dan data aduan
GLOSSARY.md       istilah domain: Peraturan, Pasal, Versi Pasal, Topik, Uraian Awam, …
```

Dua titik masuk yang paling berguna untuk memahami proyek ini adalah [`GLOSSARY.md`](GLOSSARY.md) dan [`docs/keputusan-produk.md`](docs/keputusan-produk.md).

## Sumber data dan legalitas

Teks peraturan perundang-undangan tidak dilindungi hak cipta (UU 28/2014 Pasal 42). Semua data diambil langsung dari sumber resmi pemerintah beserta URL dan berkas aslinya. TahuHak terinspirasi dari [pasal.id](https://pasal.id), tetapi tidak memakai data maupun kodenya.

## Lisensi

- Kode: **AGPL-3.0**
- Konten buatan TahuHak (Uraian Awam, isi Topik): **CC BY 4.0**

## Pembuat

Dibuat sendirian oleh [Raditya Mulya Akbar](https://github.com/Raditxt), mahasiswa Informatika di Politeknik Negeri Ujung Pandang, Makassar.

---

*TahuHak bukan kantor hukum dan tidak memberikan nasihat hukum. Untuk kasus nyata, hubungi LBH, posbakum, atau advokat.*