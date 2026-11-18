-- Data dasar untuk Bengkel Maju Jaya (versi MySQL 8)
-- Kosongkan dulu, supaya berkas ini bisa dijalankan ulang
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE ticket_events;
TRUNCATE TABLE tickets;
TRUNCATE TABLE counter_services;
TRUNCATE TABLE counters;
TRUNCATE TABLE services;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO services (code, name, avg_minutes) VALUES
  ('A', 'Ganti oli cepat', 10),
  ('B', 'Servis ringan', 30),
  ('C', 'Servis besar', 90);

INSERT INTO counters (name) VALUES ('Loket 1'), ('Loket 2');

-- Loket 1 melayani A dan B, Loket 2 melayani A dan C
INSERT INTO counter_services VALUES (1, 1), (1, 2), (2, 1), (2, 3);
