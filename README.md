# SiAntre

Sistem antrean dan reservasi untuk Bengkel Maju Jaya, dibangun langkah demi langkah di video **"Membangun Aplikasi dari Nol"** (kanal [@iTeachSWE](https://www.youtube.com/@iTeachSWE)). Teknologinya Node.js, Express, PostgreSQL, HTML/CSS/JavaScript murni, Docker, dan Nginx.

Isi halaman ini:

1. [Alat yang perlu dipasang](#1-alat-yang-perlu-dipasang)
2. [Memasang PostgreSQL](#2-memasang-postgresql)
3. [Menjalankan SiAntre di laptop](#3-menjalankan-siantre-di-laptop)
4. [Perbedaan perintah dengan yang ada di video](#4-perbedaan-perintah-dengan-yang-ada-di-video)
5. [Melihat kode setiap bab](#5-melihat-kode-setiap-bab)
6. [Menjalankan dengan Docker Compose (Bab 12)](#6-menjalankan-dengan-docker-compose-bab-12)
7. [Catatan kecil yang sering membuat macet](#7-catatan-kecil-yang-sering-membuat-macet)
8. [Kalau ingin memakai MySQL](#8-kalau-ingin-memakai-mysql)

## 1. Alat yang perlu dipasang

| Alat | Dipakai untuk | Alamat unduh |
| --- | --- | --- |
| Node.js (pilih versi LTS) | Menjalankan server | https://nodejs.org |
| PostgreSQL | Database | https://www.postgresql.org/download/ |
| VS Code | Menulis kode | https://code.visualstudio.com |
| Git | Menyimpan riwayat kode | https://git-scm.com/downloads |
| Docker Desktop | Hanya untuk Bab 12 (deploy) | https://www.docker.com/products/docker-desktop/ |

Semuanya gratis. Node.js, VS Code, dan Git cukup dipasang dengan menekan Next sampai selesai. PostgreSQL punya dua langkah yang perlu diperhatikan, jadi dijelaskan tersendiri di bawah ini.

Setelah terpasang, buka terminal baru lalu periksa:

```
node --version
git --version
psql --version
```

Kalau ketiganya menjawab dengan nomor versi, kamu siap mulai.

## 2. Memasang PostgreSQL

Pilih salah satu cara. Untuk pemula di Windows, Cara A paling sesuai dengan video.

### Cara A: Windows, dengan penginstal

1. Buka https://www.postgresql.org/download/windows/ lalu klik **Download the installer**. Pilih versi terbaru untuk Windows x86-64.
2. Jalankan berkas yang terunduh. Di halaman **Select Components**, biarkan semua tercentang. Yang wajib ada adalah *PostgreSQL Server* dan *Command Line Tools*, karena `psql` ada di situ.
3. Di halaman **Password**, buat kata sandi untuk pengguna `postgres`. **Catat kata sandi ini.** Kamu akan memakainya setiap kali menyambung ke database.
4. Di halaman **Port**, biarkan `5432`.
5. Lanjutkan dengan Next sampai selesai. Di halaman terakhir, hilangkan centang *Stack Builder*, karena kita tidak memerlukannya.

Sesudah itu, buka terminal baru dan ketik `psql --version`. Kalau muncul pesan bahwa `psql` tidak dikenali, artinya Windows belum tahu letak programnya. Tambahkan foldernya ke PATH:

1. Tekan tombol Windows, ketik **environment variables**, lalu buka *Edit the system environment variables*.
2. Klik **Environment Variables**, pilih **Path** di bagian atas, lalu klik **Edit**.
3. Klik **New** dan isi `C:\Program Files\PostgreSQL\18\bin`. Ganti angka `18` dengan nomor versi yang kamu pasang.
4. Klik OK di semua jendela, lalu **tutup dan buka kembali** terminal dan VS Code.

Sekarang masuk ke database:

```
psql -U postgres
```

Ketik kata sandi yang tadi kamu buat. Saat mengetik kata sandi, layar memang tidak menampilkan apa pun, jadi ketik saja lalu tekan Enter. Kalau muncul tulisan `postgres=#`, PostgreSQL sudah siap. Ketik `\q` untuk keluar.

### Cara B: macOS

Cara termudah adalah [Postgres.app](https://postgresapp.com): unduh, pindahkan ke folder Applications, buka, lalu klik **Initialize**. Ikuti petunjuk di situsnya untuk menambahkan `psql` ke terminal. Kalau kamu memakai Homebrew, `brew install postgresql@17` lalu `brew services start postgresql@17` juga bisa.

### Cara C: Linux (Ubuntu atau Debian)

```
sudo apt install postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'rahasia'"
```

Baris kedua memberi kata sandi kepada pengguna `postgres`, supaya aplikasi bisa menyambung.

### Cara D: lewat Docker, tanpa memasang PostgreSQL

Kalau Docker Desktop sudah terpasang, satu perintah ini menjalankan PostgreSQL dengan kata sandi `rahasia`:

```
docker run --name siantre-db -e POSTGRES_PASSWORD=rahasia -p 5432:5432 -d postgres:16-alpine
```

Program `psql` ada di dalam container, jadi cara masuknya sedikit berbeda:

```
docker exec -it siantre-db psql -U postgres
```

Untuk menjalankan berkas SQL, kirim isinya ke perintah itu:

```
# Windows PowerShell
Get-Content db/schema.sql | docker exec -i siantre-db psql -U postgres -d antrean

# macOS atau Linux
docker exec -i siantre-db psql -U postgres -d antrean < db/schema.sql
```

Besok-besok, nyalakan lagi dengan `docker start siantre-db`.

## 3. Menjalankan SiAntre di laptop

Langkah ini memakai kode yang sudah jadi. Kalau kamu sedang mengikuti video dari awal, kamu akan mengetik semuanya sendiri, dan bagian ini berguna sebagai contekan.

**1. Ambil kodenya dan pasang pustakanya.**

```
git clone https://github.com/listyantidewi1/SiAntre.git
cd SiAntre
npm install
```

**2. Buat database.**

```
psql -U postgres -c "CREATE DATABASE antrean"
```

**3. Isi tabel dan data contoh.** Urutannya penting: `seed.sql` mengosongkan tabel terlebih dulu, sehingga `slot.sql` harus dijalankan sesudahnya.

```
psql -U postgres -d antrean -f db/schema.sql
psql -U postgres -d antrean -f db/seed.sql
psql -U postgres -d antrean -f db/slot.sql
```

**4. Beri tahu aplikasi alamat databasenya.** Ganti `KATASANDI` dengan kata sandi PostgreSQL kamu.

```
# Windows PowerShell
$env:DATABASE_URL = "postgres://postgres:KATASANDI@localhost/antrean"
$env:SESSION_SECRET = "tulis-kalimat-acak-yang-panjang"

# macOS atau Linux
export DATABASE_URL=postgres://postgres:KATASANDI@localhost/antrean
export SESSION_SECRET=tulis-kalimat-acak-yang-panjang
```

Nilai ini hanya berlaku di jendela terminal tersebut. Kalau kamu membuka terminal baru, ketik lagi.

**5. Buat akun contoh, lalu jalankan servernya.**

```
node db/pengguna.js
node src/server.js
```

Buka http://localhost:3000 di browser. Akun yang tersedia: `pakrahmat` (admin), `dina` dan `yoga` (petugas loket), semuanya dengan kata sandi `rahasia123`.

| Halaman | Alamat |
| --- | --- |
| Ambil nomor dan pesan jadwal (untuk pelanggan) | http://localhost:3000 |
| Layar TV ruang tunggu | http://localhost:3000/tv.html |
| Loket petugas (perlu login) | http://localhost:3000/petugas.html |
| Laporan (perlu login sebagai admin) | http://localhost:3000/laporan.html |

**6. Menjalankan test (Bab 11).** Test memakai database terpisah bernama `antrean_test`.

```
psql -U postgres -c "CREATE DATABASE antrean_test"
npm test
```

Kalau PostgreSQL kamu memakai kata sandi, buka `test/api.test.js` dan ubah baris kedua menjadi `postgres://postgres:KATASANDI@localhost/antrean_test`.

## 4. Perbedaan perintah dengan yang ada di video

Video direkam di komputer yang PostgreSQL-nya tidak meminta kata sandi. Di komputermu, terutama di Windows, PostgreSQL meminta kata sandi. Konsepnya sama persis, hanya cara menulis perintahnya yang sedikit berbeda:

| Di video | Di komputermu |
| --- | --- |
| `psql` | `psql -U postgres` |
| `psql antrean -f db/schema.sql` | `psql -U postgres -d antrean -f db/schema.sql` |
| `psql antrean -c "..."` | `psql -U postgres -d antrean -c "..."` |
| `createdb antrean_test` | `createdb -U postgres antrean_test` |
| `postgres://postgres@localhost/antrean` | `postgres://postgres:KATASANDI@localhost/antrean` |
| `DATABASE_URL=... node src/server.js` (satu baris) | Di PowerShell dua baris: `$env:DATABASE_URL = "..."` lalu `node src/server.js` |

Supaya tidak perlu mengetik `-U postgres` dan kata sandi berulang kali, kamu boleh menyimpannya untuk jendela terminal itu:

```
# Windows PowerShell
$env:PGUSER = "postgres"
$env:PGPASSWORD = "KATASANDI"
```

Setelah itu, perintah seperti `psql antrean -f db/schema.sql` berjalan sama seperti di video.

## 5. Melihat kode setiap bab

Setiap bab punya tag, dari `bab-01` sampai `bab-12`. Kalau kodemu berbeda dengan yang ada di video dan kamu ingin membandingkan, lihat kode pada akhir bab itu:

```
git checkout bab-06     # kode pada akhir Bab 6
git checkout main       # kembali ke kode terakhir
```

Folder `uji/` berisi skrip percobaan yang dipakai di video, misalnya `uji/serbu.js` yang mengambil 20 nomor antrean sekaligus.

## 6. Menjalankan dengan Docker Compose (Bab 12)

```
cp .env.example .env      # lalu isi nilainya
docker compose up -d
```

Dengan cara ini, PostgreSQL berjalan di dalam Docker bersama aplikasi dan Nginx. Cara ini dipakai untuk memasang aplikasi di server pada Bab 12. Untuk Bab 3 sampai Bab 11, video memakai PostgreSQL yang terpasang di laptop seperti di bagian 2.

## 7. Catatan kecil yang sering membuat macet

**Pengguna Windows: pakai Git Bash supaya perintahnya sama dengan video.** Video direkam di terminal bergaya Linux. Git untuk Windows sudah membawa terminal serupa yang bernama Git Bash. Di VS Code, klik panah kecil di samping tanda `+` pada panel terminal, lalu pilih **Git Bash**. Di terminal itu, perintah seperti `curl ... -d '{"service_id": 1}'` dan `DATABASE_URL=... node src/server.js` bisa diketik persis seperti di video.

**Kalau tetap memakai PowerShell,** ada dua hal yang berbeda:

- Ketik `curl.exe`, bukan `curl`. Di PowerShell, `curl` adalah nama lain untuk perintah yang berbeda.
- Tanda kutip di dalam JSON perlu diberi garis miring terbalik:

```
curl.exe -i -X POST localhost:3000/api/tiket -H "Content-Type: application/json" -d '{\"service_id\": 1}'
```

**Menjalankan skrip uji serbuan (Bab 5 sampai 7).** Server harus sedang berjalan di terminal lain.

```
node uji/serbu.js           # Bab 5: 20 orang mengambil nomor bersamaan
node uji/dua-loket.js       # Bab 6: dua loket memanggil 50 kali bersamaan
node uji/pesan-serbu.js     # Bab 7: 10 orang memesan slot berkuota 2
```

Sebelum uji dua loket, isi dulu antreannya dengan `psql -U postgres -d antrean -f uji/isi-antrean.sql`. Skrip `uji/dua-loket.js` ditulis di Bab 6, sebelum ada login. Sejak Bab 8, loket hanya bisa dipakai setelah login, sehingga skrip itu akan ditolak dengan status 401. Itu perilaku yang benar. Untuk mengulang ujinya, pindah dulu ke kode Bab 6 dengan `git checkout bab-06`.

**Database untuk test (Bab 11).** `npm test` memerlukan database bernama `antrean_test`. Buat sekali saja dengan `createdb -U postgres antrean_test`. Test akan mengosongkan dan mengisi ulang database itu setiap kali dijalankan, jadi jangan arahkan ke database `antrean` yang berisi datamu.

**Backup otomatis setiap malam di server (Bab 12).** Skrip `deploy/backup.sh` membuat satu berkas backup dan menghapus yang lebih tua dari tujuh hari. Supaya berjalan sendiri setiap pukul 02.00, masuk ke server, ketik `crontab -e`, lalu tambahkan satu baris ini (sesuaikan letak foldernya):

```
0 2 * * * /home/deploy/siantre/deploy/backup.sh
```

Periksa besok paginya dengan `ls backup/`. Backup yang hanya disimpan di server yang sama akan ikut hilang kalau servernya rusak, jadi salin juga ke tempat lain.

## 8. Kalau ingin memakai MySQL

Untuk pemula, cara termudah adalah tetap mengikuti PostgreSQL seperti di video. Semua konsepnya (desain tabel, transaksi, kunci baris, REST API) tetap berlaku di MySQL 8, tetapi kodenya tidak bisa langsung dipakai.

Kami sudah mengubah seluruh SiAntre ke MySQL 8 dan mengujinya. Hasilnya ada di sini:

- **[Tutorial langkah demi langkah: SiAntre dengan MySQL](docs/mysql/README.md)**, lengkap dengan gambar, kode sebelum dan sesudah, serta dua jebakan yang kami temui.
- **[Kode versi MySQL](docs/mysql/kode/)**, yaitu berkas-berkas yang berubah dan siap disalin.

Ringkasan perbedaannya:

| Bagian | PostgreSQL (di repo ini) | MySQL 8 |
| --- | --- | --- |
| Pustaka | `pg` | `mysql2` |
| Parameter query | `$1, $2` | `?` |
| Hasil query | `hasil.rows` | `const [rows] = ...` |
| Nomor otomatis | `serial` | `INT AUTO_INCREMENT` |
| Waktu | `timestamptz`, `AT TIME ZONE` | `DATETIME(6)`, `CONVERT_TZ()` |
| Kolom `text` yang `UNIQUE` | `text` | `VARCHAR(n)` |
| Foreign key | `REFERENCES` di samping kolom | baris `FOREIGN KEY (...)` tersendiri |
| Hasil setelah INSERT atau UPDATE | `RETURNING` | `insertId`, `affectedRows`, atau `SELECT` tambahan |
| Sudah ada, lewati atau perbarui | `ON CONFLICT` | `ON DUPLICATE KEY UPDATE` atau `INSERT IGNORE` |
| Ubah tipe | `::int`, `::date` | `CAST(... AS ...)` |
| Daftar nilai | `= ANY($1)` | `IN (?)` |
| Deret untuk slot dan data contoh | `generate_series`, blok `DO $$` | CTE rekursif atau perulangan di JavaScript |
| Memanggil antrean | `UPDATE ... (SELECT ... SKIP LOCKED) RETURNING` | `SELECT ... SKIP LOCKED` lalu `UPDATE`, **dan wajib ada index antrean** |
| Docker Compose | image `postgres`, `pg_isready` | image `mysql`, `mysqladmin ping -h 127.0.0.1` |
