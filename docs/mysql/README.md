# SiAntre dengan MySQL: tutorial langkah demi langkah

Video "Membangun Aplikasi dari Nol" memakai PostgreSQL. Halaman ini menunjukkan cara mengubah SiAntre supaya berjalan di **MySQL 8**, satu langkah demi satu langkah, dengan kode sebelum dan sesudahnya.

Semua yang ada di sini sudah kami jalankan sungguhan di MySQL 8.4: test otomatis, serbuan 20 pengambil nomor, rebutan slot, dan dua loket yang memanggil bersamaan. Hasilnya ada di [Langkah 9](#langkah-9-uji-semuanya).

> **Saran untuk pemula:** ikuti dulu video sampai selesai dengan PostgreSQL. Setelah aplikasinya jadi, baru kerjakan tutorial ini sebagai latihan. Kamu akan melihat sendiri bagian mana yang benar-benar bergantung pada database.

> **Memakai XAMPP atau Laragon?** XAMPP berisi MariaDB, bukan MySQL. Keduanya mirip, tetapi tutorial ini hanya diuji di MySQL 8.4. Di MariaDB, setidaknya `db/pengguna.js` perlu ditulis berbeda (lihat Langkah 6), dan kamu memerlukan MariaDB 10.6 ke atas supaya `SKIP LOCKED` tersedia.

## Gambaran besar

![Peta perubahan](gambar/peta-perubahan.png)

Yang berubah hanya berkas yang berbicara dengan database. Semua halaman web, siaran real time, Dockerfile, dan konfigurasi Nginx tidak disentuh. Inilah keuntungan memisahkan lapisan seperti yang dibahas di Bab 2.

Kalau kamu hanya ingin hasil akhirnya, semua berkas yang berubah ada di folder [`kode/`](kode/). Salin isinya ke atas folder proyek, lalu lompat ke [Langkah 1](#langkah-1-siapkan-mysql-dan-ganti-pustaka) untuk menyiapkan database.

| Langkah | Yang dikerjakan | Bab di video |
| --- | --- | --- |
| 1 | Menyiapkan MySQL dan mengganti pustaka | Bab 3 dan 4 |
| 2 | `src/db.js`: cara menyambung dan transaksi | Bab 4 dan 5 |
| 3 | Bentuk hasil query dan tanda parameter | Bab 4 sampai 11 |
| 4 | Hidup tanpa `RETURNING` | Bab 5 dan 6 |
| 5 | **Jebakan 1:** `SKIP LOCKED` mengunci seluruh antrean | Bab 6 |
| 6 | `schema.sql` dan data contoh | Bab 3 dan 7 |
| 7 | Laporan: selisih waktu dan zona waktu | Bab 11 |
| 8 | **Jebakan 2:** health check di Docker Compose | Bab 12 |
| 9 | Menguji semuanya | Bab 11 |

## Langkah 1: siapkan MySQL dan ganti pustaka

**Jalankan MySQL.** Kalau Docker Desktop sudah terpasang, ini cara tercepat:

```
docker run --name siantre-mysql -e MYSQL_ROOT_PASSWORD=rahasia -e MYSQL_DATABASE=antrean -p 3306:3306 -d mysql:8.4
```

Perintah itu menjalankan MySQL 8.4 dengan kata sandi `rahasia` dan langsung membuat database `antrean`. Tunggu kira-kira setengah menit sampai MySQL siap. Kalau kamu memasang MySQL sendiri dari https://dev.mysql.com/downloads/installer/, buat databasenya dengan `CREATE DATABASE antrean;`.

**Ganti pustakanya.** Di folder proyek:

```
npm uninstall pg
npm install mysql2
```

**Ganti alamat databasenya.** Awalannya berubah dari `postgres://` menjadi `mysql://`, dan penggunanya `root`:

```
# Windows PowerShell
$env:DATABASE_URL = "mysql://root:rahasia@localhost/antrean"

# macOS atau Linux
export DATABASE_URL=mysql://root:rahasia@localhost/antrean
```

## Langkah 2: `src/db.js`

Berkas ini satu-satunya tempat aplikasi menyambung ke database, sehingga perubahannya kecil.

Sebelum (PostgreSQL):

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function transaksi(kerja) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hasil = await kerja(client);
    await client.query('COMMIT');
    return hasil;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

Sesudah (MySQL):

```js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  timezone: 'Z',         // waktu disimpan dan dibaca dalam UTC
  dateStrings: ['DATE'], // kolom DATE dibaca sebagai teks '2026-11-18', bukan objek Date
});

async function transaksi(kerja) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const hasil = await kerja(db);
    await db.commit();
    return hasil;
  } catch (err) {
    await db.rollback();
    throw err;
  } finally {
    db.release();
  }
}
```

Polanya sama persis: pinjam satu sambungan, mulai transaksi, kerjakan, lalu commit, atau rollback kalau ada yang gagal. Hanya nama fungsinya yang berbeda.

Dua pengaturan tambahan itu penting:

- `timezone: 'Z'` membuat semua waktu disimpan dalam UTC. PostgreSQL mengurus hal ini lewat tipe `timestamptz`. MySQL tidak punya tipe itu, sehingga kita sendiri yang menetapkan aturannya.
- `dateStrings: ['DATE']` membuat tanggal tetap berupa teks. Tanpa ini, tanggal bisa bergeser satu hari ketika diubah menjadi objek `Date`.

## Langkah 3: bentuk hasil query dan tanda parameter

![Bentuk hasil query](gambar/hasil-query.png)

Ini perubahan yang paling sering kamu temui, karena muncul di setiap route:

| | PostgreSQL (`pg`) | MySQL (`mysql2`) |
| --- | --- | --- |
| Tanda parameter | `$1, $2, $3` | `?, ?, ?` |
| Mengambil baris | `const { rows } = await pool.query(...)` | `const [rows] = await pool.query(...)` |
| Jumlah baris | `hasil.rowCount` | `hasil.length` |
| Daftar nilai | `status = ANY($3)` | `status IN (?)` dengan array |
| Ubah ke angka | `count(*)::int` | `COUNT(*)` saja |

Parameter tetap dikirim terpisah dari teks SQL, jadi perlindungan terhadap SQL injection dari Bab 4 tetap berlaku. Jangan pernah menggantinya dengan menyambung teks.

Karena tanda `?` tidak bernomor, urutan isi array harus sama dengan urutan tanda tanya. Di PostgreSQL, `$1` boleh dipakai dua kali. Di MySQL, kamu menulis `?` dua kali dan mengirim nilainya dua kali.

Contoh dari `src/routes/auth.js`:

```js
// Sebelum
const { rows } = await pool.query(
  'SELECT id, username, password_hash, role, counter_id FROM users WHERE username = $1',
  [username]);

// Sesudah
const [rows] = await pool.query(
  'SELECT id, username, password_hash, role, counter_id FROM users WHERE username = ?',
  [username]);
```

## Langkah 4: hidup tanpa `RETURNING`

![Tanpa RETURNING](gambar/returning.png)

Di PostgreSQL, `INSERT` dan `UPDATE` bisa langsung mengembalikan baris yang diubah dengan `RETURNING`. MySQL tidak punya kata itu. Ada tiga penggantinya, dan SiAntre memakai ketiganya:

**1. `insertId` setelah INSERT.** Ini dipakai saat membuat tiket di `src/routes/tiket.js`:

```js
// Sebelum
const baru = await db.query(
  `INSERT INTO tickets (service_id, number, label, code)
   VALUES ($1, $2, $3, $4) RETURNING id, label, code, status`,
  [serviceId, nomor, label, kode]);
return baru.rows[0];

// Sesudah
const [baru] = await db.query(
  'INSERT INTO tickets (service_id, number, label, code) VALUES (?, ?, ?, ?)',
  [serviceId, nomor, label, kode]);
return { id: baru.insertId, label, code: kode, status: 'waiting' };
```

**2. `affectedRows` setelah UPDATE.** Ini dipakai saat petugas mengubah status tiket di `src/routes/loket.js`. Kalau tidak ada baris yang berubah, artinya status tiket itu memang tidak boleh diubah:

```js
const [ubah] = await db.query(
  'UPDATE tickets SET status = ? WHERE id = ? AND status IN (?)',
  [aturan.ke, id, aturan.dari]);
if (ubah.affectedRows === 0) return null;
```

**3. `SELECT ... FOR UPDATE` lalu `UPDATE`.** Ini dipakai saat check-in pemesanan di `src/routes/booking.js`. Kita mengunci barisnya dulu, baru mengubahnya, masih di dalam transaksi yang sama:

```js
const [rows] = await db.query(
  `SELECT b.id, sl.service_id FROM bookings b JOIN slots sl ON sl.id = b.slot_id
    WHERE b.code = ? AND b.status = 'booked' FOR UPDATE`,
  [req.params.kode]);
if (rows.length === 0) return null;
await db.query("UPDATE bookings SET status = 'checked_in' WHERE id = ?", [rows[0].id]);
```

Yang penting: semua langkah pengganti ini harus berada di dalam `transaksi(...)`, supaya tidak ada orang lain yang menyelip di antaranya.

## Langkah 5: jebakan `SKIP LOCKED`

Ini bagian terpenting dari seluruh tutorial. Di Bab 6, dua loket memanggil antrean bersamaan, dan `FOR UPDATE SKIP LOCKED` menjamin mereka mendapat tiket yang berbeda. MySQL 8 juga punya `SKIP LOCKED`, sehingga kelihatannya tinggal disalin. Ternyata tidak.

![Jebakan SKIP LOCKED](gambar/kunci-antrean.png)

**Apa yang terjadi.** Kami menyalin query dari Bab 6 ke MySQL, lalu menjalankan uji dua loket: 60 panggilan bersamaan untuk antrean yang panjang. Hanya 7 panggilan yang mendapat tiket. Sisanya mendapat jawaban "Antrean kosong", padahal antreannya masih panjang.

**Penyebabnya.** PostgreSQL hanya mengunci baris yang akhirnya dipilih. MySQL mengunci **setiap baris yang dibacanya** selama mencari. Untuk menemukan tiket paling awal, MySQL membaca semua tiket lalu mengurutkannya, sehingga seluruh antrean ikut terkunci. Loket kedua datang, melompati semua baris yang terkunci, dan tidak menemukan apa pun.

Kami memeriksanya langsung lewat tabel `performance_schema.data_locks`: satu panggilan mengunci 325 baris.

**Perbaikannya** ada tiga bagian, dan ketiganya diperlukan.

Pertama, buat index yang urutannya sama dengan urutan antrean. Tambahkan di `db/schema.sql`:

```sql
CREATE INDEX tickets_antre ON tickets (service_date, status, created_at, id);
```

Kedua, minta MySQL memakai index itu dengan `FORCE INDEX`, supaya ia membaca tiket sudah dalam urutan antrean dan berhenti di tiket pertama yang cocok.

Ketiga, ambil dulu daftar layanan loket itu dengan query tersendiri, lalu kirim sebagai daftar nilai. Kalau daftar itu ditulis sebagai subquery, MySQL bisa memilih jalan lain dan kembali mengunci banyak baris.

Sebelum (PostgreSQL, satu perintah):

```js
const { rows } = await db.query(
  `UPDATE tickets SET status = 'called', counter_id = $1
    WHERE id = (
      SELECT id FROM tickets
       WHERE service_date = current_date AND status = 'waiting'
         AND service_id IN (SELECT service_id FROM counter_services WHERE counter_id = $1)
       ORDER BY created_at, id
       LIMIT 1
       FOR UPDATE SKIP LOCKED
    )
    RETURNING id, label, (SELECT name FROM counters WHERE id = $1) AS loket`,
  [loket]);
```

Sesudah (MySQL, beberapa langkah di dalam satu transaksi):

```js
// Layanan apa saja yang dipegang loket ini?
const [layanan] = await db.query(
  'SELECT service_id FROM counter_services WHERE counter_id = ?', [loket]);
if (layanan.length === 0) return null;

// Langkah 1: pilih dan kunci satu tiket. Tiket yang dikunci loket lain dilompati.
const [rows] = await db.query(
  `SELECT id, label FROM tickets FORCE INDEX (tickets_antre)
    WHERE service_date = CURRENT_DATE AND status = 'waiting' AND service_id IN (?)
    ORDER BY created_at, id
    LIMIT 1
    FOR UPDATE SKIP LOCKED`,
  [layanan.map((l) => l.service_id)]);
if (rows.length === 0) return null;

// Langkah 2: ubah statusnya, masih di transaksi yang sama.
await db.query("UPDATE tickets SET status = 'called', counter_id = ? WHERE id = ?", [loket, rows[0].id]);
await db.query("INSERT INTO ticket_events (ticket_id, status) VALUES (?, 'called')", [rows[0].id]);
```

**Hasil setelah diperbaiki:** 60 panggilan bersamaan menghasilkan 60 tiket berbeda, dan setiap panggilan hanya mengunci satu baris.

Pelajarannya sama dengan pesan utama video: kode yang kelihatannya benar belum tentu benar. Query ini tidak menampilkan error apa pun. Kesalahannya baru terlihat ketika diuji dengan dua loket bersamaan, persis seperti cara kita menguji di Bab 6. Kalau kamu mengubah query ini, jalankan lagi uji dua loket di [Langkah 9](#langkah-9-uji-semuanya).

## Langkah 6: `schema.sql` dan data contoh

Berkas lengkapnya ada di [`kode/db/`](kode/db/). Berikut perbedaan yang perlu kamu pahami.

| PostgreSQL | MySQL 8 | Alasannya |
| --- | --- | --- |
| `id serial PRIMARY KEY` | `id INT AUTO_INCREMENT PRIMARY KEY` | Nama fiturnya berbeda |
| `name text NOT NULL UNIQUE` | `name VARCHAR(50) NOT NULL UNIQUE` | Kolom `TEXT` di MySQL tidak bisa langsung `UNIQUE` |
| `service_id integer REFERENCES services` | `service_id INT` ditambah baris `FOREIGN KEY (service_id) REFERENCES services (id)` | **Lihat peringatan di bawah** |
| `timestamptz DEFAULT now()` | `DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)` | Lihat catatan di bawah |
| `date DEFAULT current_date` | `DATE DEFAULT (CURRENT_DATE)` | Di MySQL, nilai bawaan berupa fungsi harus diberi kurung |
| `CHECK (...)` | `CHECK (...)` | Sama, berlaku sejak MySQL 8.0.16 |

**Peringatan tentang foreign key.** MySQL menerima tulisan `REFERENCES` di samping kolom tanpa error, tetapi **diam-diam mengabaikannya**. Tabelnya jadi, tetapi aturan foreign key tidak pernah dibuat, sehingga tiket bisa menunjuk ke layanan yang tidak ada. Di MySQL, foreign key harus ditulis sebagai baris tersendiri:

```sql
CREATE TABLE tickets (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  ...
  FOREIGN KEY (service_id) REFERENCES services (id)
);
```

**Catatan tentang `DATETIME(6)`.** Angka 6 berarti waktu disimpan sampai sepersejuta detik. Tanpa itu, MySQL membulatkan ke detik. Akibatnya, tiket yang diambil pada detik yang sama punya waktu yang persis sama, dan hitungan "berapa orang di depan saya" menjadi keliru.

**Urutan tabel.** Karena foreign key menunjuk ke tabel lain, tabel yang ditunjuk harus dibuat lebih dulu: `services` dan `counters` sebelum `tickets`.

**Data contoh.** Tiga hal berubah:

- `TRUNCATE ... RESTART IDENTITY CASCADE` tidak ada di MySQL. Gantinya, matikan pemeriksaan foreign key sebentar, kosongkan tabel satu per satu, lalu nyalakan lagi (lihat [`kode/db/seed.sql`](kode/db/seed.sql)).
- `generate_series` tidak ada. Jadwal slot dibuat dengan CTE rekursif (lihat [`kode/db/slot.sql`](kode/db/slot.sql)), dan `ON CONFLICT DO NOTHING` menjadi `INSERT IGNORE`.
- Blok `DO $$ ... $$` yang membuat 36 tiket contoh ditulis ulang sebagai skrip JavaScript, [`kode/db/contoh.js`](kode/db/contoh.js).

Di `db/pengguna.js`, `ON CONFLICT` menjadi `ON DUPLICATE KEY UPDATE`:

```js
// Sebelum
`INSERT INTO users (username, password_hash, role, counter_id) VALUES ($1, $2, $3, $4)
 ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`

// Sesudah
`INSERT INTO users (username, password_hash, role, counter_id) VALUES (?, ?, ?, ?) AS baru
 ON DUPLICATE KEY UPDATE password_hash = baru.password_hash`
```

Tulisan `AS baru` hanya ada di MySQL 8.0.19 ke atas. Di MariaDB, tulis `ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)` tanpa `AS baru`.

**Memuat semuanya ke database:**

```
# macOS atau Linux (MySQL lewat Docker)
docker exec -i siantre-mysql mysql -uroot -prahasia antrean < db/schema.sql
docker exec -i siantre-mysql mysql -uroot -prahasia antrean < db/seed.sql
docker exec -i siantre-mysql mysql -uroot -prahasia antrean < db/slot.sql

# Windows PowerShell (MySQL lewat Docker)
Get-Content db/schema.sql | docker exec -i siantre-mysql mysql -uroot -prahasia antrean
Get-Content db/seed.sql   | docker exec -i siantre-mysql mysql -uroot -prahasia antrean
Get-Content db/slot.sql   | docker exec -i siantre-mysql mysql -uroot -prahasia antrean
```

Lalu, di semua sistem:

```
node db/contoh.js
node db/pengguna.js
node src/server.js
```

Buka http://localhost:3000. Tampilannya sama persis dengan versi PostgreSQL, karena halaman web tidak tahu database apa yang ada di belakangnya.

| Layar TV | Tiket di HP |
| --- | --- |
| ![Layar TV](gambar/layar-tv.png) | ![Tiket di HP](gambar/hp.png) |

## Langkah 7: laporan

Laporan di Bab 11 menghitung selisih waktu dan mengelompokkan tiket per jam. Fungsi waktunya berbeda:

| Keperluan | PostgreSQL | MySQL 8 |
| --- | --- | --- |
| Selisih dalam detik | `extract(epoch FROM b - a)` | `TIMESTAMPDIFF(SECOND, a, b)` |
| Jam menurut WIB | `extract(hour FROM t AT TIME ZONE 'Asia/Jakarta')` | `HOUR(CONVERT_TZ(t, '+00:00', '+07:00'))` |
| Bulatkan menjadi bilangan bulat | `round(...)::int` | `CAST(ROUND(...) AS SIGNED)` |
| Tanggal pilihan atau hari ini | `coalesce($1::date, current_date)` | `COALESCE(?, CURRENT_DATE)` |

Perhatikan urutan di `TIMESTAMPDIFF`: waktu awal ditulis lebih dulu, baru waktu akhir.

`CAST(... AS SIGNED)` diperlukan karena `AVG` di MySQL menghasilkan tipe DECIMAL, dan `mysql2` mengirim DECIMAL ke JavaScript sebagai **teks**. Tanpa `CAST`, halaman laporan menerima `"23"` dan bukan `23`.

Hal yang sudah benar di versi PostgreSQL tetap benar di sini: tiket batal tidak ikut dihitung dalam rata-rata, karena `AVG` mengabaikan NULL.

![Laporan](gambar/laporan.png)

## Langkah 8: Docker Compose dan health check

Di `compose.yaml`, layanan `db` berganti image dan nama variabelnya:

```yaml
  db:
    image: mysql:8.4
    environment:
      MYSQL_DATABASE: antrean
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
    volumes:
      - data-db:/var/lib/mysql
      - ./db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
      - ./db/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$$MYSQL_ROOT_PASSWORD --silent"]
      interval: 5s
      retries: 20
```

Di layanan `app`, alamat databasenya menjadi `mysql://root:${DB_PASSWORD}@db/antrean`.

![Health check](gambar/health-check.png)

**Jebakan kedua** ada di health check. Saat pertama kali dijalankan, container MySQL menyalakan server sementara untuk memuat `schema.sql`, mematikannya, lalu menyalakan server yang sesungguhnya. Health check yang banyak beredar, yaitu `mysqladmin ping` tanpa tambahan apa pun, sudah menjawab "sehat" sejak server sementara menyala. Akibatnya, aplikasi ikut menyala terlalu cepat dan gagal menyambung dengan pesan `ECONNREFUSED`.

Tambahan `-h 127.0.0.1` memaksa pemeriksaan lewat jaringan. Server sementara tidak menerima sambungan jaringan, sehingga health check baru menjawab "sehat" setelah server sesungguhnya siap.

Terakhir, backup di `deploy/backup.sh` memakai `mysqldump` sebagai pengganti `pg_dump`:

```
docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction antrean' | gzip > backup/antrean-$(date +%F).sql.gz
```

Pilihan `--single-transaction` membuat backup diambil tanpa mengunci tabel, sehingga antrean tetap berjalan selama backup dibuat.

## Langkah 9: uji semuanya

Jangan percaya begitu saja, termasuk kepada tutorial ini. Jalankan ujinya sendiri.

**Test otomatis.** Test membuat ulang database `antrean_test` setiap kali dijalankan. Alamatnya diatur di baris kedua `test/api.test.js`.

```
npm test
```

Hasil di komputer kami:

```
✔ serbuan 20 pengambil nomor menghasilkan 20 nomor berbeda
✔ slot berkuota 2 hanya menerima 2 dari 10 pemesan
✔ loket tidak bisa dipakai tanpa login
✔ tiket yang sudah selesai tidak bisa dipanggil lagi
ℹ pass 4
ℹ fail 0
```

**Uji serbuan** dari Bab 5, 6, dan 7. Skrip di folder `uji/` berbicara dengan server lewat HTTP, sehingga `uji/serbu.js` dan `uji/pesan-serbu.js` bisa dipakai tanpa diubah.

Untuk uji dua loket, pakai [`kode/uji/dua-loket-login.js`](kode/uji/dua-loket-login.js). Skrip `uji/dua-loket.js` dari Bab 6 ditulis sebelum ada login, sehingga pada kode akhir ia ditolak dengan status 401. Skrip yang baru ini login dulu sebagai `dina` dan `yoga`, mengisi 60 tiket, lalu memanggil 60 kali bersamaan:

```
node uji/dua-loket-login.js
Tiket yang dipanggil: 60
Tiket yang berbeda  : 60
```

Rangkuman hasil di MySQL 8.4:

| Uji | Hasil di MySQL 8.4 |
| --- | --- |
| 20 orang mengambil nomor bersamaan | 20 nomor berbeda |
| 10 orang memesan slot berkuota 2 | 2 berhasil, 8 ditolak dengan pesan "Slot sudah penuh" |
| Dua loket, 60 panggilan bersamaan | 60 tiket berbeda |
| Satu panggilan mengunci berapa baris? | 1 baris (sebelum diperbaiki: 325 baris) |

## Yang belum diuji

Supaya jelas batasnya:

- Tutorial ini diuji di MySQL 8.4. MySQL 8.0 seharusnya berjalan sama. MariaDB dan MySQL 5.7 belum diuji, dan MySQL 5.7 tidak punya `SKIP LOCKED`, `CHECK`, maupun CTE.
- Layanan `db` di `compose.yaml` sudah diuji sampai sehat dan memuat `schema.sql`. Rangkaian lengkap bersama Nginx dan HTTPS di server sungguhan belum diuji untuk versi MySQL.

Kalau kamu menemukan kesalahan, silakan buka *issue* di repo ini.
