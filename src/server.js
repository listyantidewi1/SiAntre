// SiAntre: server utama
const express = require('express');
const { pool } = require('./db');

const app = express();

app.get('/halo', (req, res) => {
  res.send('Halo dari SiAntre!');
});

app.get('/api/layanan', async (req, res) => {
  const { rows } = await pool.query('SELECT id, code, name, avg_minutes FROM services ORDER BY code');
  res.json(rows);
});

app.listen(3000);