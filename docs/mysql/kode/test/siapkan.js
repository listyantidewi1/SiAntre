// Membuat ulang database test dari schema.sql dan seed.sql, supaya setiap test mulai dari keadaan yang sama
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { pool } = require('../src/db');
const baca = (berkas) => fs.readFileSync(path.join(__dirname, '..', 'db', berkas), 'utf8');

async function siapkan() {
  // Sambungan khusus yang boleh menjalankan banyak perintah sekaligus, hanya untuk memuat berkas .sql
  const url = new URL(process.env.DATABASE_URL); const nama = url.pathname.slice(1); url.pathname = '/';
  const admin = await mysql.createConnection({ uri: url.href, multipleStatements: true });
  await admin.query(`DROP DATABASE IF EXISTS ${nama}; CREATE DATABASE ${nama}; USE ${nama};`);
  await admin.query(baca('schema.sql'));
  await admin.query(baca('seed.sql')); // mulai tanpa tiket
  await admin.end();
  const hash = await bcrypt.hash('rahasia123', 4);
  await pool.query("INSERT INTO users (username, password_hash, role, counter_id) VALUES ('uji', ?, 'petugas', 1)", [hash]);
}

async function tutup() {
  await pool.end();
}

module.exports = { siapkan, tutup };
