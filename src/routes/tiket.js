// API tiket untuk pelanggan: ambil nomor dan lihat posisi.
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

// Ambil nomor antrean baru
router.post('/tiket', async (req, res) => {
  const serviceId = Number(req.body.service_id);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    return res.status(400).json({ error: 'service_id harus berupa angka' });
  }
  const layanan = await pool.query('SELECT code FROM services WHERE id = $1', [serviceId]);
  if (layanan.rowCount === 0) {
    return res.status(404).json({ error: 'Layanan tidak ditemukan' });
  }
  // Nomor dihitung per layanan, per hari
  const { rows } = await pool.query(
    `SELECT coalesce(max(number), 0) + 1 AS nomor
       FROM tickets WHERE service_id = $1 AND service_date = current_date`,
    [serviceId]
  );
  const nomor = rows[0].nomor;
  const label = `${layanan.rows[0].code}-${String(nomor).padStart(3, '0')}`;
  const kode = crypto.randomBytes(9).toString('base64url'); // sulit ditebak
  const baru = await pool.query(
    `INSERT INTO tickets (service_id, number, label, code)
     VALUES ($1, $2, $3, $4) RETURNING id, label, code, status`,
    [serviceId, nomor, label, kode]
  );
  await pool.query("INSERT INTO ticket_events (ticket_id, status) VALUES ($1, 'waiting')", [baru.rows[0].id]);
  res.status(201).json(baru.rows[0]);
});

// Status tiket untuk halaman pelanggan (dibuka dengan kode acak, bukan id)
router.get('/tiket/:kode', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.label, t.status, s.name AS layanan, s.avg_minutes,
            (SELECT count(*) FROM tickets x
              WHERE x.service_id = t.service_id AND x.service_date = t.service_date
                AND x.status = 'waiting' AND x.created_at < t.created_at)::int AS di_depan
       FROM tickets t JOIN services s ON s.id = t.service_id
      WHERE t.code = $1`,
    [req.params.kode]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  const t = rows[0];
  res.json({ ...t, posisi: t.di_depan + 1, perkiraan_menit: t.di_depan * t.avg_minutes });
});

module.exports = router;