const db = require('./database');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      label       TEXT NOT NULL,
      email       TEXT NOT NULL,
      password    TEXT,
      start_date  TEXT NOT NULL,
      last_renew  TEXT,
      next_renew  TEXT NOT NULL,
      renew_count INTEGER DEFAULT 0,
      max_renew   INTEGER DEFAULT 5,
      status      TEXT DEFAULT 'aktif',
      notes       TEXT,
      created_at  TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS gsuite_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      email     TEXT NOT NULL,
      used_for  TEXT,
      used_at   TEXT NOT NULL DEFAULT (date('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS cc_queue (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      gsuite_email  TEXT NOT NULL,
      gsuite_pass   TEXT,
      device_notes  TEXT,
      date_bought   TEXT NOT NULL,
      ready_date    TEXT NOT NULL,
      status        TEXT DEFAULT 'menunggu',
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS cc_ready (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      profile      TEXT NOT NULL,
      team_url     TEXT,
      date_added   TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      notes        TEXT,
      created_at   TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migrasi: tambah kolom password kalau belum ada (untuk DB yang sudah ada)
  try {
    db.exec(`ALTER TABLE members ADD COLUMN password TEXT`);
    console.log('🔄 Migrasi: kolom password ditambahkan');
  } catch (_) { /* sudah ada, skip */ }

  // Migrasi: cc_ready schema lama (punya kolom email) → hapus & buat ulang dengan schema baru
  try {
    const cols = db.prepare(`PRAGMA table_info(cc_ready)`).all();
    const hasOldSchema = cols.some(c => c.name === 'email');
    if (hasOldSchema) {
      db.exec(`DROP TABLE cc_ready`);
      db.exec(`
        CREATE TABLE cc_ready (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          profile      TEXT NOT NULL,
          team_url     TEXT,
          date_added   TEXT NOT NULL DEFAULT (date('now', 'localtime')),
          notes        TEXT,
          created_at   TEXT DEFAULT (datetime('now', 'localtime'))
        )
      `);
      console.log('🔄 Migrasi: cc_ready diperbarui ke schema baru (profile-based)');
    }
  } catch (_) { /* skip */ }

  console.log('✅ Database schema initialized');
}

module.exports = { initSchema };
