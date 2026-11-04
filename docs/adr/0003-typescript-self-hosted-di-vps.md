# TypeScript penuh, self-hosted di satu VPS

Seluruh sistem ditulis dalam TypeScript (monorepo pnpm: web Next.js, CLI ingestion Node, skema Drizzle bersama) dan berjalan di satu VPS milik pengembang (Hostinger KVM 2) lewat Docker Compose + Caddy, dengan PostgreSQL (+ pgvector bila nanti perlu) dan Better Auth di Postgres yang sama. Rancangan awal di `docs/keputusan-produk.md` adalah Supabase + Vercel + ingestion Python. Itu diganti karena tiga hal: pengembang ingin satu bahasa, VPS sudah dibayar sehingga tidak ada biaya tambahan, dan log tetap sepenuhnya di tangan sendiri sesuai ADR-0002. Riset sumber (4 Nov 2026) menunjukkan peraturan.go.id, JDIH BPK, JDIH Sulsel, dan JDIH Makassar bisa diambil dengan HTTP biasa, jadi headless browser tidak diperlukan.

## Considered Options

- **Supabase + Vercel**: ditolak. Free tier Supabase (500 MB, proyek di-pause bila tidak aktif) tidak cukup untuk seluruh Perda plus peraturan nasional, dan Vercel Hobby menambah satu tempat lagi yang menyimpan log request.
- **Ingestion dengan Python** (PyMuPDF lebih kuat untuk PDF): ditolak demi satu bahasa.

## OCR tidak dijalankan di VPS

OCR (`ocrmypdf --force-ocr -l ind`) untuk Perda hasil scan dijalankan **sekali di laptop pengembang**, lalu teks hasilnya diunggah ke VPS. VPS tidak punya job OCR terjadwal. Kalau penjelajahan bulanan menemukan PDF scan baru, PDF itu ditandai masuk antrean OCR untuk diproses di laptop.

## Anggaran sumber daya KVM 2 (2 vCPU, 8 GB RAM, 100 GB NVMe)

Perkiraan RAM saat puncak: OS + Docker + Caddy sekitar 0,6 GB, Postgres sekitar 1,5 GB, Next.js sekitar 0,5 GB, `llama-server` dibatasi 3 GB (model 4B Q4 sekitar 2,5 GB ditambah KV cache), dan job ingestion malam sekitar 0,5 GB. Totalnya sekitar 6,1 GB, jadi **muat** dengan ruang sisa sekitar 2 GB, ditambah swap 2 GB sebagai pengaman. Hambatan sebenarnya adalah **CPU**: inferensi memakai kedua vCPU selama 5–20 detik. Karena itu kontainer model dibatasi `cpus: 1.5` agar web dan database selalu kebagian CPU, dan latensinya diukur sebelum rilis.

Kalau hasil ukur tidak memuaskan, alternatifnya berurutan dari yang paling ringan perubahannya:

1. Pakai model generatif yang lebih kecil (1–1,5B).
2. Ganti LLM generatif dengan **model embedding kecil** (sekitar 100–500 MB) untuk memilih Topik berdasarkan kemiripan. Kata kuncinya cukup dari Padanan Istilah.
3. Lepas model sama sekali dan pakai Padanan Istilah + FTS saja (sudah menjadi jalur cadangan di ADR-0004).

## Consequences

Backup (`pg_dump` harian ke penyimpanan di luar VPS), uptime, dan pembaruan keamanan menjadi tanggung jawab pengembang. Tidak ada preview deploy otomatis. Web, database, model lokal, dan job ingestion berbagi 2 vCPU, jadi ingestion dijadwalkan di jam sepi.
