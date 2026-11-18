// Uji: dua petugas (dina di Loket 1, yoga di Loket 2) memanggil 30 kali bersamaan.
// Dipakai setelah Bab 8, ketika loket sudah memerlukan login. Jalankan: node uji/dua-loket-login.js
const alamat = (process.argv[2] || 'http://localhost:3000') + '/api';
const json = { 'Content-Type': 'application/json' };

async function login(username) {
  const r = await fetch(alamat + '/login', { method: 'POST', headers: json, body: JSON.stringify({ username, password: 'rahasia123' }) });
  return r.headers.get('set-cookie').split(';')[0];
}

(async () => {
  // Isi antrean dulu dengan 60 tiket
  for (let i = 0; i < 60; i++) {
    await fetch(alamat + '/tiket', { method: 'POST', headers: json, body: JSON.stringify({ service_id: 1 }) });
  }
  const dina = await login('dina'), yoga = await login('yoga');
  const semua = [];
  for (let i = 0; i < 30; i++) {
    semua.push(fetch(alamat + '/loket/1/panggil', { method: 'POST', headers: { cookie: dina } }));
    semua.push(fetch(alamat + '/loket/2/panggil', { method: 'POST', headers: { cookie: yoga } }));
  }
  const jawaban = await Promise.all((await Promise.all(semua)).map((r) => r.json()));
  const label = jawaban.filter((j) => j.label).map((j) => j.label);
  console.log('Tiket yang dipanggil:', label.length);
  console.log('Tiket yang berbeda  :', new Set(label).size);
})();
