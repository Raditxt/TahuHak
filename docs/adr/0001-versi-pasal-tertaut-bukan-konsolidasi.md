# Versi Pasal tertaut, bukan teks konsolidasi

Pasal yang diubah (mis. Pasal 156 UU 13/2003 yang diubah oleh Pasal 81 angka 47 UU 6/2023) disimpan sebagai beberapa Versi Pasal, masing-masing persis seperti bunyinya di Peraturan sumber, dan ditautkan ke Peraturan Pengubah-nya. Kami tidak membuat teks konsolidasi sendiri karena teks gabungan buatan sendiri tidak resmi, rawan salah, dan bertentangan dengan pengaman "teks asli pasal selalu tampil". UI menampilkan Versi Terkini dengan keterangan "telah diubah oleh…", dan AI wajib mengutip Versi Terkini.

Kalau yang berubah hanya sebagian Ayat:

- **Peraturan Pengubah menulis ulang seluruh Pasal** (bentuk yang lazim): teks itu menjadi Versi Pasal baru. Sistem membuat Catatan Perubahan otomatis yang menunjukkan Ayat mana yang berbeda dari versi sebelumnya.
- **Peraturan Pengubah hanya menulis Ayat yang berubah**: tidak dibuat Versi Pasal baru dan Ayat baru tidak disambung ke teks lama. Bunyi lama tetap tampil bersama Catatan Perubahan yang memuat bunyi Ayat baru dan sumbernya.

## Consequences

Parser harus mengenali pola perubahan di Peraturan Pengubah ("Ketentuan Pasal X diubah sehingga berbunyi…", "Di antara Pasal X dan Pasal Y disisipkan…", "Pasal X dihapus") dan memetakannya ke Pasal di Peraturan yang diubah. Ini bagian ingestion yang paling sulit dan harus diuji lebih dulu.
