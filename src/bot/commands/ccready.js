const { Markup } = require('telegraf');
const db = require('../../db/database');

const sessions = new Map();
const KEY = (id) => `ccready_${id}`;

function ccReadyCommand(bot) {

  // /ccready — tambah CC Head baru
  bot.command('ccready', (ctx) => {
    sessions.set(KEY(ctx.chat.id), { step: 'profile' });
    return ctx.reply(
      `📱 *Tambah CC Head Baru*\n\n` +
      `Masukkan *profil/device* yang dipakai:\n` +
      `(contoh: \`Samsung A54 - Profile 2\`, \`Redmi Note 12\`, \`Emulator 1\`)`,
      { parse_mode: 'Markdown' }
    );
  });

  // /ccreadylist — lihat semua CC Head
  bot.command('ccreadylist', (ctx) => {
    const args = ctx.message.text.split(' ');
    const filterDate = args[1] || null;

    let query = `SELECT * FROM cc_ready`;
    let params = [];

    if (filterDate) {
      query += ` WHERE date_added = ?`;
      params.push(filterDate);
    }
    query += ` ORDER BY date_added DESC, id DESC`;

    const items = db.prepare(query).all(...params);
    const total = db.prepare(`SELECT COUNT(*) as c FROM cc_ready`).get().c;

    if (items.length === 0) {
      const msg = filterDate
        ? `📭 Tidak ada CC Head dengan tanggal *${filterDate}*.`
        : `📭 Belum ada CC Head. Gunakan /ccready untuk menambah.`;
      return ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    const rows = items.map(h =>
      `📱 [${h.id}] *${h.profile}*\n` +
      `   📅 ${h.date_added}` +
      (h.team_url ? `\n   🔗 [Link Tim](${h.team_url})` : '') +
      (h.notes ? `\n   💬 ${h.notes}` : '') +
      `\n   /ccreadydel ${h.id}`
    ).join('\n\n');

    const header = filterDate
      ? `📦 *CC Head — tanggal ${filterDate} (${items.length} item):*\n\n`
      : `📦 *Semua CC Head (${total} total):*\n\n`;

    return ctx.reply(header + rows, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  });

  // /ccreadydel [id] — hapus CC Head
  bot.command('ccreadydel', (ctx) => {
    const input = ctx.message.text.split(' ')[1];
    if (!input) {
      return ctx.reply(
        `❌ Format: /ccreadydel [id]\nContoh: /ccreadydel 3\n\n` +
        `Gunakan /ccreadylist untuk melihat ID.`
      );
    }

    const id = parseInt(input);
    if (isNaN(id)) return ctx.reply('❌ ID harus berupa angka.');

    const item = db.prepare(`SELECT * FROM cc_ready WHERE id = ?`).get(id);
    if (!item) return ctx.reply(`❌ CC Head ID ${id} tidak ditemukan.`);

    return ctx.reply(
      `⚠️ *Hapus CC Head?*\n\n` +
      `📱 ${item.profile}\n` +
      `📅 ${item.date_added}\n` +
      (item.team_url ? `🔗 ${item.team_url}\n` : '') +
      `\nData tidak bisa dikembalikan!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`🗑 Ya, Hapus`, `ccreadydel_confirm:${id}`)],
          [Markup.button.callback('❌ Batal', 'ccreadydel_cancel')],
        ]),
      }
    );
  });

  // /ccreadydeldate [tanggal] — hapus semua CC Head berdasarkan tanggal
  bot.command('ccreadydeldate', (ctx) => {
    const input = ctx.message.text.split(' ')[1];
    let targetDate;

    if (!input || input.toLowerCase() === 'hari ini') {
      targetDate = new Date().toISOString().split('T')[0];
    } else {
      const parsed = new Date(input);
      if (isNaN(parsed.getTime())) {
        return ctx.reply('❌ Format: /ccreadydeldate [YYYY-MM-DD] atau /ccreadydeldate hari ini');
      }
      targetDate = parsed.toISOString().split('T')[0];
    }

    const items = db.prepare(`SELECT * FROM cc_ready WHERE date_added = ?`).all(targetDate);
    if (items.length === 0) {
      return ctx.reply(`📭 Tidak ada CC Head dengan tanggal *${targetDate}*.`, { parse_mode: 'Markdown' });
    }

    const preview = items.slice(0, 4).map(h => `• [${h.id}] ${h.profile}`).join('\n');
    const more = items.length > 4 ? `\n  _...dan ${items.length - 4} lainnya_` : '';

    return ctx.reply(
      `⚠️ *Hapus CC Head tanggal ${targetDate}?*\n\n` +
      `Total: *${items.length} item*\n\n${preview}${more}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`🗑 Ya, Hapus ${items.length} Item`, `ccreadydeldate_confirm:${targetDate}`)],
          [Markup.button.callback('❌ Batal', 'ccreadydel_cancel')],
        ]),
      }
    );
  });

  // Actions
  bot.action(/ccreadydel_confirm:(\d+)/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    const item = db.prepare(`SELECT * FROM cc_ready WHERE id = ?`).get(id);
    if (!item) { await ctx.answerCbQuery('Tidak ditemukan'); return ctx.editMessageText('❌ Item sudah tidak ada.'); }

    db.prepare(`DELETE FROM cc_ready WHERE id = ?`).run(id);
    await ctx.answerCbQuery('Dihapus!');
    return ctx.editMessageText(
      `🗑 *CC Head dihapus!*\n\n📱 ${item.profile}\n📅 ${item.date_added}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.action(/ccreadydeldate_confirm:(.+)/, async (ctx) => {
    const targetDate = ctx.match[1];
    const result = db.prepare(`DELETE FROM cc_ready WHERE date_added = ?`).run(targetDate);
    await ctx.answerCbQuery('Dihapus!');
    return ctx.editMessageText(
      `🗑 *${result.changes} CC Head dihapus!*\n📅 Tanggal: ${targetDate}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.action('ccreadydel_cancel', async (ctx) => {
    await ctx.answerCbQuery('Dibatalkan');
    return ctx.editMessageText('❌ *Hapus dibatalkan.*', { parse_mode: 'Markdown' });
  });

  // Session text handler
  bot.on('text', (ctx, next) => {
    const chatId = ctx.chat.id;
    const session = sessions.get(KEY(chatId));
    if (!session) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) { sessions.delete(KEY(chatId)); return next(); }

    if (session.step === 'profile') {
      session.profile = text;
      session.step = 'team_url';
      sessions.set(KEY(chatId), session);
      return ctx.reply(
        `🔗 *URL Tim CC Head* (opsional):\n` +
        `Paste link invite tim, atau ketik *skip*`,
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'team_url') {
      session.team_url = text.toLowerCase() === 'skip' ? null : text;
      session.step = 'date_added';
      sessions.set(KEY(chatId), session);
      return ctx.reply(
        `📅 Tanggal mulai?\nKetik *"hari ini"* atau format *YYYY-MM-DD*`,
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'date_added') {
      let dateAdded;
      if (text.toLowerCase() === 'hari ini') {
        dateAdded = new Date().toISOString().split('T')[0];
      } else {
        const parsed = new Date(text);
        if (isNaN(parsed.getTime())) {
          return ctx.reply('❌ Format tidak valid. Gunakan YYYY-MM-DD atau "hari ini":');
        }
        dateAdded = parsed.toISOString().split('T')[0];
      }
      session.date_added = dateAdded;
      session.step = 'notes';
      sessions.set(KEY(chatId), session);
      return ctx.reply(`💬 Catatan tambahan? (ketik *skip* untuk lewati)`, { parse_mode: 'Markdown' });
    }

    if (session.step === 'notes') {
      session.notes = text.toLowerCase() === 'skip' ? null : text;
      sessions.delete(KEY(chatId));

      db.prepare(`
        INSERT INTO cc_ready (profile, team_url, date_added, notes)
        VALUES (?, ?, ?, ?)
      `).run(session.profile, session.team_url, session.date_added, session.notes);

      const total = db.prepare(`SELECT COUNT(*) as c FROM cc_ready`).get().c;

      return ctx.reply(
        `✅ *CC Head berhasil ditambahkan!*\n\n` +
        `📱 *${session.profile}*\n` +
        `📅 ${session.date_added}\n` +
        (session.team_url ? `🔗 ${session.team_url}\n` : '') +
        (session.notes ? `💬 ${session.notes}\n` : '') +
        `\n📦 Total CC Head tersimpan: *${total}*`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    }
  });
}

module.exports = { ccReadyCommand };
