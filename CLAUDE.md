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

### Awal setiap sesi (wajib, sebelum menulis kode)
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
