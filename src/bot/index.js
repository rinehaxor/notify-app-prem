const { Telegraf } = require('telegraf');
const { adminOnly } = require('./middleware/auth');
const { addCommand, handleAddSession } = require('./commands/add');
const { listCommand } = require('./commands/list');
const { infoCommand } = require('./commands/info');
const { delCommand } = require('./commands/del');
const { gsuiteCommand } = require('./commands/gsuite');
const { importCommand } = require('./commands/import');
const { deleteAllCommand } = require('./commands/deleteall');
const { deleteDateCommand } = require('./commands/deletedate');
const { queueCommand } = require('./commands/queue');
const { ccReadyCommand } = require('./commands/ccready');
const { startScheduler, registerTestAlert } = require('../scheduler/reminders');

function createBot(token) {
  const bot = new Telegraf(token);

  // Global admin guard
  bot.use(adminOnly);

  // Start / Help — dinamis dengan statistik live
  bot.start(async (ctx) => {
    const db = require('../db/database');

    const totalMember   = db.prepare(`SELECT COUNT(*) as c FROM members WHERE status = 'aktif'`).get().c;
    const selesai       = db.prepare(`SELECT COUNT(*) as c FROM members WHERE status = 'selesai'`).get().c;
    const renewHariIni  = db.prepare(`SELECT COUNT(*) as c FROM members WHERE next_renew <= date('now','localtime') AND status='aktif'`).get().c;
    const renew2Hari    = db.prepare(`SELECT COUNT(*) as c FROM members WHERE next_renew <= date('now','+2 days','localtime') AND next_renew > date('now','localtime') AND status='aktif'`).get().c;

    const queuePending  = db.prepare(`SELECT COUNT(*) as c FROM cc_queue WHERE status = 'menunggu'`).get().c;
    const queueSiap     = db.prepare(`SELECT COUNT(*) as c FROM cc_queue WHERE status = 'siap'`).get().c;
    const queueSelesai  = db.prepare(`SELECT COUNT(*) as c FROM cc_queue WHERE status = 'selesai'`).get().c;

    const stokCC        = db.prepare(`SELECT COUNT(*) as c FROM cc_ready`).get().c;

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });

    return ctx.reply(
      `👋 *CapCut Premium Notify Bot*\n` +
      `🕐 ${now}\n\n` +

      `📊 *Status Sekarang:*\n` +
      `👥 Member aktif: *${totalMember}* | Selesai: ${selesai}\n` +
      `🔴 Perlu direnew hari ini: *${renewHariIni}*\n` +
      `🟡 Renew dalam 2 hari: *${renew2Hari}*\n\n` +

      `📱 *Antrian GSuite → CC:*\n` +
      `🟡 Menunggu: *${queuePending}* | 🟢 Siap daftar: *${queueSiap}* | ✅ Selesai: ${queueSelesai}\n\n` +

      `📦 *Stok CC Head (trial ready):*\n` +
      `📱 Tersimpan: *${stokCC} head*\n\n` +

      `━━━━━━━━━━━━━━━━\n` +
      `📋 *Member Commands:*\n` +
      `/add — Tambah member satu per satu\n` +
      `/import — Import bulk (email|password)\n` +
      `/list — Lihat semua member\n` +
      `/info [id] — Detail member\n` +
      `/del [id] — Hapus member\n` +
      `/deletedate — Hapus by tanggal\n` +
      `/deleteall — Hapus semua member\n\n` +
      `📱 *Queue Commands:*\n` +
      `/queue — Tambah GSuite ke antrian\n` +
      `/queuelist — Lihat antrian aktif\n` +
      `/queuedone [id] — Tandai selesai daftar CC\n` +
      `/queuedel [id/email] — Hapus dari antrian\n\n` +
      `📦 *CC Head (Stok Trial):*\n` +
      `/ccready — Tambah CC Head\n` +
      `/ccreadylist — Lihat semua CC Head\n` +
      `/ccreadylist [tgl] — Filter by tanggal\n` +
      `/ccreadydel [id] — Hapus 1 CC Head\n` +
      `/ccreadydeldate [tgl] — Hapus by tanggal\n\n` +
      `📧 *GSuite Log:*\n` +
      `/addgsuite | /listgsuite\n\n` +
      `🧪 /testalert — Preview notifikasi`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.help((ctx) => ctx.reply('Gunakan /start untuk melihat semua command.'));

  // Register commands
  addCommand(bot);
  handleAddSession(bot);
  importCommand(bot);
  listCommand(bot);
  infoCommand(bot);
  delCommand(bot);
  deleteAllCommand(bot);
  deleteDateCommand(bot);
  queueCommand(bot);
  ccReadyCommand(bot);
  gsuiteCommand(bot);
  registerTestAlert(bot);

  // Error handler
  bot.catch((err, ctx) => {
    console.error(`❌ Error untuk ${ctx.updateType}:`, err);
  });

  return bot;
}

module.exports = { createBot };
