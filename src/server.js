// SiAntre: server utama
const express = require('express');
const { pool } = require('./db');

const app = express();
app.use(express.json());
app.use('/api', require('./routes/tiket'));

app.get('/halo', (req, res) => {
  res.send('Halo dari SiAntre!');
});

app.get('/api/layanan', async (req, res) => {
  const { rows } = await pool.query('SELECT id, code, name, avg_minutes FROM services ORDER BY code');
  res.json(rows);
});

// Penanganan error terakhir: catat di server, kirim pesan umum ke pengguna
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
});

app.listen(3000);