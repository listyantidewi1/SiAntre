// Membuat 36 tiket contoh hari ini dengan berbagai status: node db/contoh.js
// (Di versi PostgreSQL bagian ini ditulis sebagai blok DO $$ di seed.sql.)
const { pool, transaksi } = require('../src/db');
const STATUS = ['done', 'done', 'done', 'done', 'done', 'done', 'done', 'done', 'done', 'done',
  'done', 'done', 'skipped', 'cancelled', 'cancelled', 'serving', 'called',
  'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting',
  'waiting', 'waiting', 'done', 'done', 'cancelled', 'waiting',
  'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting'];

(async () => {
  await transaksi(async (db) => {
    const pagi = new Date(); pagi.setUTCHours(0, 30, 0, 0); // 07.30 WIB
    const menit = (m) => new Date(pagi.getTime() + m * 60000);
    for (let i = 1; i <= 36; i++) {
      const s = 1 + (i % 3), st = STATUS[i - 1], t0 = i * 8;
      const [[{ code }]] = await db.query('SELECT code FROM services WHERE id = ?', [s]);
      const [[{ nomor }]] = await db.query(
        'SELECT COALESCE(MAX(number), 0) + 1 AS nomor FROM tickets WHERE service_id = ? AND service_date = CURRENT_DATE', [s]);
      const label = `${code}-${String(nomor).padStart(3, '0')}`;
      const [baru] = await db.query(
        'INSERT INTO tickets (service_id, number, label, status, created_at) VALUES (?, ?, ?, ?, ?)',
        [s, nomor, label, st, menit(t0)]);
      const catat = (status, m) => db.query(
        'INSERT INTO ticket_events (ticket_id, status, created_at) VALUES (?, ?, ?)', [baru.insertId, status, menit(m)]);
      await catat('waiting', t0);
      if (['called', 'serving', 'done', 'skipped'].includes(st)) await catat('called', t0 + 15 + (i * 7) % 40);
      if (['serving', 'done'].includes(st)) await catat('serving', t0 + 17 + (i * 7) % 40);
      if (st === 'done') await catat('done', t0 + 40 + (i * 7) % 40);
      if (['skipped', 'cancelled'].includes(st)) await catat(st, t0 + 60 + i);
    }
  });
  console.log('36 tiket contoh dibuat'); await pool.end();
})();
