-- Jadwal servis besar seminggu ke depan: setiap 2 jam, 08.00-16.00 WIB (versi MySQL 8)
INSERT IGNORE INTO slots (service_id, starts_at, quota)
WITH RECURSIVE
  hari (n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM hari WHERE n < 7),
  jam (j)  AS (SELECT 8 UNION ALL SELECT j + 2 FROM jam  WHERE j < 16)
SELECT 3,
       CONVERT_TZ(TIMESTAMP(CURRENT_DATE + INTERVAL n DAY) + INTERVAL j HOUR, '+07:00', '+00:00'),
       2
  FROM hari, jam
 WHERE WEEKDAY(CURRENT_DATE + INTERVAL n DAY) <> 6                    -- Minggu libur
   AND (CURRENT_DATE + INTERVAL n DAY) NOT IN ('2026-12-25');         -- tanggal libur
