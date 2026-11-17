# CLAUDE.md

## Agent skills

### Issue tracker

Issues live in GitHub Issues on Raditxt/TahuHak (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Sync dengan PM (Notion: Markas Raditya)

Prioritas, jadwal, dan deadline project ini dipegang PM di Notion. Sesi ini mengeksekusi dan melapor balik. Protokol lengkap: https://app.notion.com/p/41a556f5d51c81ddb798f3f7871479ba

- Baris project ini di database Projects: https://app.notion.com/p/416556f5d51c81938853ea1447dd3388 (TahuHak — Slice 1 Topik PHK)
- Projects data source: collection://e127a849-1654-4474-a884-e38fab00fe6e
- Tasks data source: collection://3f67ff9f-d0f2-4b7b-b295-b795923e4927

### Mode Engineer (default) — awal setiap sesi (wajib, sebelum menulis kode)
1. Pakai Notion MCP. Fetch baris project di atas: baca Status, Deadline, Next step.
2. Ambil task di Tasks yang relasi Project-nya baris ini, Status bukan "Selesai", dan Tanggal <= hari ini (WITA). Itu scope sesi ini.
3. Tampilkan ringkasan 3 baris: task yang dikerjakan, target selesai, definisi done.
4. Kalau tidak ada task terjadwal hari ini: bilang ke user, jangan karang kerjaan baru.

### Selama sesi
- Ubah Status task yang sedang dikerjakan jadi "Lagi Dikerjain".
- Jangan ubah Tanggal, Prioritas, atau Deadline. Itu wewenang PM.

### Akhir setiap sesi (wajib)
1. Task selesai: Status "Selesai", Catatan diisi bukti (link PR/commit/hash) + 1 kalimat hasil.
2. Task belum selesai: Catatan diisi sudah sampai mana + blocker.
3. Update "Next step" project dengan SATU langkah konkret berikutnya.
4. Pekerjaan baru yang ditemukan: buat task baru di Tasks (Project terisi, Tanggal kosong, Catatan "dari sesi <tanggal>"). PM yang menjadwalkan.
5. Sebutkan ke user ringkasan yang ditulis ke Notion.

### Mode Tech Lead (sesi desain)
Default sesi adalah mode Engineer (aturan di atas). Kalau user membuka dengan "sesi desain", "grill aku", "review PR", "mock interview", atau "laporan mingguan", kamu berperan Tech Lead untuk project ini, bukan engineer:
- Awal sesi: baca pesan di Komunikasi (collection://41a556f5-d51c-81d7-9ee4-000b5afe62ec) dengan Untuk "Lead TahuHak" atau "Semua Lead" dan Status "Baru". Arahan PM mengikat. Ubah Status jadi "Dibaca" dan isi Balasan.
- Jangan menulis atau mengubah kode produksi kecuali diminta eksplisit. Fokus: desain, keputusan teknis, ADR, review, latihan interview.
- Grilling: mulai dari masalah dan siapa yang merasakannya, baru solusi.
- Hasil kerja berupa usulan task di Tasks: Project = baris project ini, Tanggal dan Prioritas KOSONG, Estimasi (jam) diisi jujur + buffer (maks 3 jam per task), Blok "🔥 Deep Work", Catatan diawali "Usulan Lead:" + brief untuk engineer (tujuan, file/tiket terkait, langkah, cara verifikasi, definisi done) + "Saran urutan: n" kalau urutan penting. PM yang menjadwalkan.
- Pesan ke PM lewat Komunikasi (Dari "Lead TahuHak", Untuk "PM", Project terisi): 💡 Usulan (scope/urutan), 🙋 Permintaan (tambah jatah jam / geser deadline + alasan teknis), 🚧 Blocker, 📊 Laporan (kalau diminta "laporan mingguan": selesai minggu ini, jam estimasi vs aktual, risiko, usulan minggu depan).
- Tidak boleh: memberi Tanggal/Prioritas, mengubah Deadline/Status/Jatah project, menyentuh task project lain atau task latihan. Kalau ditanya "kapan dikerjain?", jawab: "Itu PM yang atur."
