# TypeScript penuh, self-hosted di satu VPS

> **Diperbarui 6 Nov 2026:** server, jalur akses publik, dan anggaran sumber daya digantikan [ADR-0005](0005-vps-bersama-waregos-lewat-cloudflare-tunnel.md) (VPS bersama Waregos, Cloudflare Tunnel, batas 1 GB, tanpa model lokal, ingestion di laptop). Keputusan bahasa dan OCR di bawah tetap berlaku.

Seluruh sistem ditulis dalam TypeScript (monorepo pnpm: web Next.js, CLI ingestion Node, skema Drizzle bersama) dan berjalan di VPS lewat Docker Compose (servernya diatur ADR-0005), dengan PostgreSQL (+ pgvector bila nanti perlu) dan Better Auth di Postgres yang sama. Rancangan awal di `docs/keputusan-produk.md` adalah Supabase + Vercel + ingestion Python. Itu diganti karena tiga hal: pengembang ingin satu bahasa, tidak ada biaya platform tambahan, dan log aplikasi tetap di tangan sendiri sesuai ADR-0002. Satu-satunya pihak luar di jalur permintaan adalah Cloudflare sebagai pemroses transit (ADR-0005). Riset sumber (4 Nov 2026) menunjukkan peraturan.go.id, JDIH BPK, JDIH Sulsel, dan JDIH Makassar bisa diambil dengan HTTP biasa, jadi headless browser tidak diperlukan.

## Considered Options

- **Supabase + Vercel**: ditolak. Free tier Supabase (500 MB, proyek di-pause bila tidak aktif) tidak cukup untuk seluruh Perda plus peraturan nasional, dan Vercel Hobby menambah satu tempat lagi yang menyimpan log request.
- **Ingestion dengan Python** (PyMuPDF lebih kuat untuk PDF): ditolak demi satu bahasa.

## OCR tidak dijalankan di VPS

OCR (`ocrmypdf --force-ocr -l ind`) untuk Perda hasil scan dijalankan **sekali di laptop pengembang**, lalu teks hasilnya diunggah ke VPS. VPS tidak punya job OCR terjadwal. Kalau penjelajahan bulanan menemukan PDF scan baru, PDF itu ditandai masuk antrean OCR untuk diproses di laptop.

## Anggaran sumber daya

Anggaran awal untuk Hostinger KVM 2 (8 GB, llama-server 3 GB) sudah tidak berlaku. Anggaran yang berlaku ada di ADR-0005. Urutan alternatif model yang dulu ditulis di sini (model lebih kecil → model embedding kecil → tanpa model) tetap menjadi acuan, dan ADR-0005 memulai dari langkah terakhir: tanpa model.

## Consequences

Backup (`pg_dump` harian ke penyimpanan di luar VPS), uptime, dan pembaruan keamanan menjadi tanggung jawab pengembang. Tidak ada preview deploy otomatis. Ingestion tidak berjalan di VPS (ADR-0005).
