# SiAntre

Sistem antrean dan reservasi untuk Bengkel Maju Jaya, dibangun langkah demi langkah di video "Membangun Aplikasi dari Nol" (kanal @iTeachSWE). Teknologinya Node.js, Express, PostgreSQL, HTML/CSS/JavaScript murni, Docker, dan Nginx.

Setiap bab punya tag, dari `bab-01` sampai `bab-12`. Untuk melihat kode pada akhir suatu bab, jalankan misalnya `git checkout bab-06`.

## Menjalankan

```
cp .env.example .env      # lalu isi nilainya
docker compose up -d
```

Database PostgreSQL ikut berjalan di dalam Docker, jadi kamu tidak perlu memasangnya sendiri.

## Kalau ingin memakai MySQL

Untuk pemula, cara termudah adalah tetap mengikuti PostgreSQL seperti di video. Semua konsepnya (desain tabel, transaksi, kunci baris, REST API) tetap berlaku di MySQL 8, tetapi kodenya tidak bisa langsung dipakai. Yang perlu kamu ubah:

| Bagian | PostgreSQL (di repo ini) | MySQL 8 |
| --- | --- | --- |
| Pustaka | `pg` | `mysql2` |
| Parameter query | `$1, $2` | `?` |
| Nomor otomatis | `serial` | `INT AUTO_INCREMENT` |
| Waktu | `timestamptz`, `AT TIME ZONE` | `DATETIME` atau `TIMESTAMP`, `CONVERT_TZ()` |
| Kolom `text` yang `UNIQUE` | `text` | `VARCHAR(n)` |
| Hasil setelah INSERT/UPDATE | `RETURNING` | `insertId`, atau `SELECT` tambahan di transaksi yang sama |
| Sudah ada, lewati atau perbarui | `ON CONFLICT` | `ON DUPLICATE KEY UPDATE` atau `INSERT IGNORE` |
| Ubah tipe | `::int`, `::date`, `::text` | `CAST(... AS ...)` |
| Daftar nilai | `= ANY($1)` | `IN (?)` |
| Deret untuk slot dan data contoh | `generate_series`, blok `DO $$` | CTE rekursif atau perulangan di JavaScript |
| Docker Compose | image `postgres` | image `mysql` |

`FOR UPDATE SKIP LOCKED` di Bab 6 dan aturan `CHECK` didukung MySQL 8, jadi bagian itu tidak berubah. Karena `UPDATE ... RETURNING` tidak ada, pemanggilan antrean di MySQL ditulis sebagai `SELECT ... FOR UPDATE SKIP LOCKED` lalu `UPDATE` di dalam satu transaksi.
