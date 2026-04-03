const { Markup } = require('telegraf');
const db = require('../../db/database');

const queueSessions = new Map();
const KEY = (id) => `queue_${id}`;

function queueCommand(bot) {

  // /queue — tambah GSuite ke antrian
  bot.command('queue', (ctx) => {
    queueSessions.set(KEY(ctx.chat.id), { step: 'gsuite_email' });
    return ctx.reply(
      `📥 *Tambah Antrian GSuite → CC*\n\n` +
      `Masukkan *email GSuite* yang baru dibeli:`,
      { parse_mode: 'Markdown' }
    );
  });

  // /queuelist — lihat antrian
  bot.command('queuelist', (ctx) => {
    const items = db.prepare(`
      SELECT * FROM cc_queue WHERE status != 'selesai' ORDER BY ready_date ASC
    `).all();
    const done = db.prepare(`SELECT COUNT(*) as c FROM cc_queue WHERE status = 'selesai'`).get().c;

    if (items.length === 0) {
      return ctx.reply(`📭 Tidak ada antrian aktif.\n_(${done} sudah selesai)_`, { parse_mode: 'Markdown' });
    }

    const today = new Date().toISOString().split('T')[0];
    const rows = items.map(q => {
      const isReady = q.ready_date <= today;
      const emoji = q.status === 'siap' || isReady ? '🟢' : '🟡';
      const statusText = isReady ? 'SIAP DAFTAR!' : `Siap: ${q.ready_date}`;
      return (
        `${emoji} [${q.id}] \`${q.gsuite_email}\`\n` +
        `   📱 Device: ${q.device_notes || '-'}\n` +
        `   ⏰ ${statusText} | Beli: ${q.date_bought}`
      );
    }).join('\n\n');

    return ctx.reply(
      `📋 *Antrian GSuite → CC (${items.length} aktif | ${done} selesai)*\n\n${rows}\n\n` +
      `Gunakan /queuedone [id] setelah berhasil daftar CC.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /queuedone [id] — tandai sudah didaftarkan CC
  bot.command('queuedone', (ctx) => {
    const args = ctx.message.text.split(' ');
    const id = parseInt(args[1]);
    if (!id || isNaN(id)) {
      return ctx.reply('❌ Format: /queuedone [id]\nContoh: /queuedone 3');
    }
    const item = db.prepare(`SELECT * FROM cc_queue WHERE id = ?`).get(id);
    if (!item) return ctx.reply(`❌ Antrian ID ${id} tidak ditemukan.`);

    db.prepare(`UPDATE cc_queue SET status = 'selesai' WHERE id = ?`).run(id);
    return ctx.reply(
      `✅ *Antrian selesai!*\n\n` +
      `📧 \`${item.gsuite_email}\`\n` +
      `📱 Device: ${item.device_notes || '-'}\n\n` +
      `Jangan lupa /import atau /add akun CC member-nya!`,
      { parse_mode: 'Markdown' }
    );
  });

  // /queuedel [id atau email] — hapus antrian
  bot.command('queuedel', (ctx) => {
    const args = ctx.message.text.split(' ');
    const input = args[1];
    if (!input) {
      return ctx.reply(
        '❌ Format: /queuedel [id atau email]\n' +
        'Contoh:\n  /queuedel 3\n  /queuedel malinda@p-ttz.top'
      );
    }

    let item;
    // Cek apakah input adalah ID (angka) atau email
    if (/^\d+$/.test(input)) {
      item = db.prepare(`SELECT * FROM cc_queue WHERE id = ?`).get(parseInt(input));
    } else {
      // Cari by email (partial match)
      item = db.prepare(`SELECT * FROM cc_queue WHERE gsuite_email = ? OR gsuite_email LIKE ?`)
        .get(input, `%${input}%`);
    }

    if (!item) {
      return ctx.reply(`❌ Antrian tidak ditemukan untuk: *${input}*`, { parse_mode: 'Markdown' });
    }

    db.prepare(`DELETE FROM cc_queue WHERE id = ?`).run(item.id);
    return ctx.reply(
      `🗑 *Antrian dihapus!*\n\n` +
      `📧 \`${item.gsuite_email}\`\n` +
      `📱 Device: ${item.device_notes || '-'}\n` +
      `📅 Dibeli: ${item.date_bought}`,
      { parse_mode: 'Markdown' }
    );
  });


  // Session handler
  bot.on('text', (ctx, next) => {
    const chatId = ctx.chat.id;
    const session = queueSessions.get(KEY(chatId));
    if (!session) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      queueSessions.delete(KEY(chatId));
      return next();
    }

    if (session.step === 'gsuite_email') {
      if (!text.includes('@')) return ctx.reply('❌ Format email tidak valid. Coba lagi:');
      session.gsuite_email = text;
      session.step = 'gsuite_pass';
      queueSessions.set(KEY(chatId), session);
      return ctx.reply('🔑 Password GSuite? (ketik *skip* kalau tidak mau simpan)', { parse_mode: 'Markdown' });
    }

    if (session.step === 'gsuite_pass') {
      session.gsuite_pass = text.toLowerCase() === 'skip' ? null : text;
      session.step = 'device_notes';
      queueSessions.set(KEY(chatId), session);
      return ctx.reply(
        '📱 *Catatan device* yang dipakai untuk daftar CC:\n(contoh: `HP Samsung A54`, `Redmi Note 12`, `Emulator 1`)',
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'device_notes') {
      session.device_notes = text;
      session.step = 'wait_days';
      queueSessions.set(KEY(chatId), session);
      return ctx.reply(
        '⏳ Tunggu berapa hari sebelum daftar CC?\nKetik *1* atau *2* (rekomen 2 hari biar aman):',
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'wait_days') {
      const days = parseInt(text);
      if (isNaN(days) || days < 1 || days > 7) {
        return ctx.reply('❌ Masukkan angka antara 1-7:');
      }

      const today = new Date().toISOString().split('T')[0];
      const readyDate = new Date();
      readyDate.setDate(readyDate.getDate() + days);
      const readyDateStr = readyDate.toISOString().split('T')[0];

      session.date_bought = today;
      session.ready_date = readyDateStr;
      session.wait_days = days;
      session.step = 'notes';
      queueSessions.set(KEY(chatId), session);
      return ctx.reply(
        '💬 Ada catatan tambahan? Ketik *skip* kalau tidak ada.',
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'notes') {
      session.notes = text.toLowerCase() === 'skip' ? null : text;
      queueSessions.delete(KEY(chatId));

      db.prepare(`
        INSERT INTO cc_queue (gsuite_email, gsuite_pass, device_notes, date_bought, ready_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        session.gsuite_email,
        session.gsuite_pass,
        session.device_notes,
        session.date_bought,
        session.ready_date,
        session.notes
      );

      return ctx.reply(
        `✅ *GSuite ditambahkan ke antrian!*\n\n` +
        `📧 \`${session.gsuite_email}\`\n` +
        `📱 Device: ${session.device_notes}\n` +
        `📅 Dibeli: ${session.date_bought}\n` +
        `🟢 Siap daftar CC: *${session.ready_date}* (${session.wait_days} hari lagi)\n\n` +
        `Bot akan ingatkan kamu saat sudah siap!`,
        { parse_mode: 'Markdown' }
      );
    }
  });
}

module.exports = { queueCommand };
