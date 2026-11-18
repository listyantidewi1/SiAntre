// Koneksi ke MySQL. Alamat database diambil dari environment variable.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  timezone: 'Z',        // waktu disimpan dan dibaca dalam UTC
  dateStrings: ['DATE'], // kolom DATE dibaca sebagai teks '2026-11-18', bukan objek Date
});

// Menjalankan beberapa query sebagai satu transaksi: semua berhasil, atau tidak sama sekali.
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

module.exports = { pool, transaksi };
