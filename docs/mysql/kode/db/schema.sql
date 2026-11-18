-- SiAntre: skema database (versi MySQL 8)

CREATE TABLE services (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        CHAR(1)      NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  avg_minutes INT          NOT NULL CHECK (avg_minutes > 0)
);

CREATE TABLE counters (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE counter_services (
  counter_id INT NOT NULL,
  service_id INT NOT NULL,
  PRIMARY KEY (counter_id, service_id),
  FOREIGN KEY (counter_id) REFERENCES counters (id),
  FOREIGN KEY (service_id) REFERENCES services (id)
);

CREATE TABLE tickets (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  service_id   INT         NOT NULL,
  service_date DATE        NOT NULL DEFAULT (CURRENT_DATE),
  number       INT         NOT NULL,
  label        VARCHAR(10) NOT NULL,
  status       VARCHAR(10) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'called', 'serving',
                      'done', 'skipped', 'cancelled')),
  created_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  code         VARCHAR(20) UNIQUE,
  counter_id   INT,
  UNIQUE (service_id, service_date, number),
  FOREIGN KEY (service_id) REFERENCES services (id),
  FOREIGN KEY (counter_id) REFERENCES counters (id)
);

-- Index antrean: dipakai saat memanggil tiket berikutnya (lihat src/routes/loket.js)
CREATE INDEX tickets_antre ON tickets (service_date, status, created_at, id);

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'petugas')),
  counter_id    INT,
  FOREIGN KEY (counter_id) REFERENCES counters (id)
);

CREATE TABLE ticket_events (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id  INT         NOT NULL,
  status     VARCHAR(10) NOT NULL,
  user_id    INT,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (ticket_id) REFERENCES tickets (id),
  FOREIGN KEY (user_id)   REFERENCES users (id)
);

CREATE TABLE slots (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT      NOT NULL,
  starts_at  DATETIME NOT NULL,
  quota      INT      NOT NULL CHECK (quota > 0),
  UNIQUE (service_id, starts_at),
  FOREIGN KEY (service_id) REFERENCES services (id)
);

CREATE TABLE bookings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  slot_id    INT          NOT NULL,
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  status     VARCHAR(12)  NOT NULL DEFAULT 'booked',
  created_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  code       VARCHAR(20)  UNIQUE,
  FOREIGN KEY (slot_id) REFERENCES slots (id)
);
