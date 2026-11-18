// API untuk petugas loket: memanggil dan mengubah status tiket.
const express = require('express');
const { pool, transaksi } = require('../db');
const { wajib } = require('./auth');
const { siarkan } = require('../siaran');

const router = express.Router();
const petugas = wajib('petugas', 'admin');

// Antrean yang bisa dilayani loket ini, ditambah tiket yang sedang ditangani
router.get('/loket/:id/antrean', petugas, async (req, res) => {
  const loket = Number(req.params.id);
  const [menunggu] = await pool.query(
    `SELECT t.id, t.label, s.name AS layanan
       FROM tickets t JOIN services s ON s.id = t.service_id
      WHERE t.service_date = current_date AND t.status = 'waiting'
        AND t.service_id IN (SELECT service_id FROM counter_services WHERE counter_id = ?)
      ORDER BY t.created_at, t.id LIMIT 50`,
    [loket]
  );
  const [aktif] = await pool.query(
    `SELECT t.id, t.label, t.status, s.name AS layanan
       FROM tickets t JOIN services s ON s.id = t.service_id
      WHERE t.service_date = current_date AND t.counter_id = ?
        AND t.status IN ('called', 'serving', 'skipped')
      ORDER BY t.id DESC`,
    [loket]
  );
  res.json({ menunggu, aktif });
});

// Panggil berikutnya. SKIP LOCKED: tiket yang sedang diambil loket lain dilompati, bukan ditunggu.
router.post('/loket/:id/panggil', petugas, async (req, res) => {
  const loket = Number(req.params.id);
  const tiket = await transaksi(async (db) => {
    // Layanan apa saja yang dipegang loket ini?
    const [layanan] = await db.query('SELECT service_id FROM counter_services WHERE counter_id = ?', [loket]);
    if (layanan.length === 0) return null;
    // Langkah 1: pilih dan kunci satu tiket. Tiket yang sedang dikunci loket lain dilompati.
    // FORCE INDEX: MySQL mengunci setiap baris yang dibacanya, jadi ia harus membaca urut lewat index antrean
    // dan berhenti di tiket pertama. Tanpa index ini, seluruh antrean ikut terkunci.
    const [rows] = await db.query(
      `SELECT id, label FROM tickets FORCE INDEX (tickets_antre)
        WHERE service_date = CURRENT_DATE AND status = 'waiting' AND service_id IN (?)
        ORDER BY created_at, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [layanan.map((l) => l.service_id)]
    );
    if (rows.length === 0) return null;
    // Langkah 2: ubah statusnya, masih di transaksi yang sama (MySQL tidak punya UPDATE ... RETURNING)
    await db.query("UPDATE tickets SET status = 'called', counter_id = ? WHERE id = ?", [loket, rows[0].id]);
    await db.query("INSERT INTO ticket_events (ticket_id, status) VALUES (?, 'called')", [rows[0].id]);
    const [[namaLoket]] = await db.query('SELECT name FROM counters WHERE id = ?', [loket]);
    return { id: rows[0].id, label: rows[0].label, loket: namaLoket ? namaLoket.name : null };
  });
  if (!tiket) return res.status(404).json({ error: 'Antrean kosong' });
  siarkan('panggil', { label: tiket.label, loket: tiket.loket }); // setelah commit
  siarkan('antrean', {});
  res.json(tiket);
});// Perpindahan status yang diizinkan (diagram status di bab 1)
const BOLEH = {
  ulang:   { dari: ['called', 'skipped'], ke: 'called' },
  lewati:  { dari: ['called'],            ke: 'skipped' },
  layani:  { dari: ['called'],            ke: 'serving' },
  selesai: { dari: ['serving'],           ke: 'done' },
};

// Ubah status satu tiket: ulang, lewati, layani, atau selesai
router.post('/tiket-loket/:id/:aksi', petugas, async (req, res) => {
  const aturan = BOLEH[req.params.aksi];
  if (!aturan) return res.status(400).json({ error: 'Aksi tidak dikenal' });
  const hasil = await transaksi(async (db) => {
    const id = Number(req.params.id);
    // IN (?) dengan array: mysql2 menjabarkannya menjadi IN ('called', 'skipped')
    const [ubah] = await db.query('UPDATE tickets SET status = ? WHERE id = ? AND status IN (?)', [aturan.ke, id, aturan.dari]);
    if (ubah.affectedRows === 0) return null; // tidak ada baris yang cocok: statusnya tidak boleh diubah
    await db.query('INSERT INTO ticket_events (ticket_id, status) VALUES (?, ?)', [id, aturan.ke]);
    const [[tiket]] = await db.query('SELECT id, label FROM tickets WHERE id = ?', [id]);
    return tiket;
  });
  if (!hasil) return res.status(409).json({ error: 'Status tiket tidak bisa diubah dengan aksi ini' });
  siarkan('antrean', {});
  res.json(hasil);
});

module.exports = router;