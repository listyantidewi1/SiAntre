// Laporan untuk pemilik (dilengkapi di bab 11)
const express = require('express');
const { pool } = require('../db');
const { wajib } = require('./auth');

const router = express.Router();
router.get('/laporan', wajib('admin'), async (req, res) => {
  const tanggal = req.query.tanggal || null; // YYYY-MM-DD, kosong = hari ini
  const [perLayanan] = await pool.query(
    `WITH panggil AS (
       SELECT ticket_id, MIN(created_at) AS pertama FROM ticket_events
        WHERE status = 'called' GROUP BY ticket_id
     ), batal AS (
       SELECT ticket_id, created_at FROM ticket_events WHERE status = 'cancelled'
     )
     SELECT s.code, s.name,
            COUNT(p.ticket_id) AS dilayani,
            CAST(ROUND(AVG(TIMESTAMPDIFF(SECOND, t.created_at, p.pertama)) / 60) AS SIGNED) AS rata_tunggu_menit,
            COUNT(b.ticket_id) AS batal,
            CAST(ROUND(AVG(TIMESTAMPDIFF(SECOND, t.created_at, b.created_at)) / 60) AS SIGNED) AS rata_tunggu_batal_menit
       FROM services s
       LEFT JOIN tickets t ON t.service_id = s.id AND t.service_date = COALESCE(?, CURRENT_DATE)
       LEFT JOIN panggil p ON p.ticket_id = t.id
       LEFT JOIN batal b ON b.ticket_id = t.id
      GROUP BY s.id ORDER BY s.code`,
    [tanggal]
  );
  // Waktu disimpan dalam UTC, jadi geser dulu ke WIB (+07:00) sebelum mengambil jamnya
  const [perJam] = await pool.query(
    `SELECT HOUR(CONVERT_TZ(created_at, '+00:00', '+07:00')) AS jam, COUNT(*) AS jumlah
       FROM tickets WHERE service_date = COALESCE(?, CURRENT_DATE)
      GROUP BY jam ORDER BY jam`,
    [tanggal]
  );
  res.json({ layanan: perLayanan, per_jam: perJam });
});
module.exports = router;