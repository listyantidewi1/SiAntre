// Pemesanan slot jam: lihat slot, pesan, dan check-in saat datang.
const express = require('express');
const crypto = require('crypto');
const { pool, transaksi } = require('../db');
const { buatTiket } = require('./tiket');

const router = express.Router();

// Slot yang belum lewat, beserta jumlah pemesanan yang masih aktif
router.get('/slot', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT sl.id, sl.starts_at, sl.quota, s.name AS layanan,
            (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = sl.id AND b.status <> 'cancelled') AS terisi
       FROM slots sl JOIN services s ON s.id = sl.service_id
      WHERE sl.starts_at > NOW()
      ORDER BY sl.starts_at LIMIT 40`
  );
  res.json(rows);
});

router.post('/booking', async (req, res) => {
  const slotId = Number(req.body.slot_id);
  const nama = String(req.body.name || '').trim();
  const hp = String(req.body.phone || '').replace(/[^0-9+]/g, '');
  if (!slotId || nama.length < 2 || hp.length < 9) {
    return res.status(400).json({ error: 'Nama dan nomor HP wajib diisi dengan benar' });
  }
  const hasil = await transaksi(async (db) => {
    // Kunci slot: pemesan lain menunggu sampai kita selesai menghitung kuota
    const [slot] = await db.query('SELECT quota FROM slots WHERE id = ? AND starts_at > NOW() FOR UPDATE', [slotId]);
    if (slot.length === 0) return { status: 404, error: 'Slot tidak ditemukan' };
    const [rows] = await db.query(
      "SELECT COUNT(*) AS terisi FROM bookings WHERE slot_id = ? AND status <> 'cancelled'", [slotId]);
    if (rows[0].terisi >= slot[0].quota) return { status: 409, error: 'Slot sudah penuh' };
    const kode = crypto.randomBytes(6).toString('base64url');
    await db.query('INSERT INTO bookings (slot_id, name, phone, code) VALUES (?, ?, ?, ?)', [slotId, nama, hp, kode]);
    return { status: 201, code: kode };
  });
  res.status(hasil.status).json(hasil);
});

// Pelanggan yang memesan datang: ubah pemesanan menjadi tiket antrean
router.post('/booking/:kode/checkin', async (req, res) => {
  const tiket = await transaksi(async (db) => {
    // Kunci pemesanannya dulu, baru ubah statusnya (pengganti UPDATE ... FROM ... RETURNING)
    const [rows] = await db.query(
      `SELECT b.id, sl.service_id FROM bookings b JOIN slots sl ON sl.id = b.slot_id
        WHERE b.code = ? AND b.status = 'booked' FOR UPDATE`,
      [req.params.kode]
    );
    if (rows.length === 0) return null;
    await db.query("UPDATE bookings SET status = 'checked_in' WHERE id = ?", [rows[0].id]);
    return buatTiket(db, rows[0].service_id);
  });
  if (!tiket) return res.status(409).json({ error: 'Pemesanan tidak ditemukan atau sudah dipakai' });
  res.status(201).json({ label: tiket.label, code: tiket.code });
});

module.exports = router;