// Membuat akun admin dan petugas contoh: node db/pengguna.js
const bcrypt = require('bcrypt');
const { pool } = require('../src/db');
(async () => {
  const akun = [['pakrahmat', 'admin', null], ['dina', 'petugas', 1], ['yoga', 'petugas', 2]];
  for (const [u, role, loket] of akun) {
    const hash = await bcrypt.hash('rahasia123', 12);
    await pool.query(
      `INSERT INTO users (username, password_hash, role, counter_id) VALUES (?, ?, ?, ?) AS baru
       ON DUPLICATE KEY UPDATE password_hash = baru.password_hash`, [u, hash, role, loket]);
  }
  console.log('Akun contoh dibuat'); await pool.end();
})();
