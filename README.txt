RESTIFY - VERSI SUPABASE

ISI FOLDER
- index.html
- css/style.css
- js/app.js

CARA MEMASANG
1. Cadangkan folder proyek Restify yang sekarang.
2. Salin index.html ke folder utama proyek.
3. Salin style.css ke folder css/ dan app.js ke folder js/ (timpa file lama setelah membuat cadangan).
4. Buka lewat server lokal atau hosting web; jangan membuka index.html dengan file://.

FITUR YANG DIUBAH
- Lagu utama dibaca dan disimpan melalui tabel public.tracks di Supabase.
- Link YouTube dinormalisasi dan anti-duplikat menggunakan video_id.
- Pencarian hanya memfilter judul lagu yang sudah tersimpan di daftar aktif; tidak menggunakan YouTube Search API atau Invidious.
- Genre dihapus dari UI dan data baru.
- Playlist dibaca dan disimpan melalui tabel public.playlists.
- Lagu dan playlist lama dari localStorage dicoba untuk dimigrasikan ke Supabase ketika aplikasi pertama kali memuat data.
- Dua lagu bawaan dimasukkan jika belum ada.

PENTING
- Supabase URL dan publishable key sudah dimasukkan ke js/app.js.
- Pastikan tabel tracks memiliki kolom video_id dan indeks unik untuk video_id seperti SQL yang dijalankan.
- Akses data dipengaruhi pengaturan RLS dan grants Supabase. Jika muncul error permission/RLS, atur kebijakan tabel sebelum digunakan.
- Login nama panggilan dan identitas owner masih berjalan di sisi browser seperti versi lama; itu bukan autentikasi yang aman untuk aplikasi publik. Publishable key memang boleh ada di frontend, tetapi jangan pernah memasukkan service_role/secret key.
- Pemutaran tetap menggunakan YouTube IFrame Player API, bukan mengunduh atau menyimpan file audio/video.
