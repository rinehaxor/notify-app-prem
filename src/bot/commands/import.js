const { Markup } = require('telegraf');
const db = require('../../db/database');

const importSessions = new Map();

function importCommand(bot) {
  bot.command('import', (ctx) => {
    importSessions.set(ctx.chat.id, { step: 'accounts' });
    return ctx.reply(
      `📥 *Import Bulk Member*\n\n` +
      `Paste semua akun kamu dengan format:\n` +
      `\`email|password\`\n` +
      `(satu akun per baris)\n\n` +
      `Contoh:\n` +
      `\`\`\`\nbudi@gmail.com|password123\nani@gmail.com|pass456\n\`\`\``,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('text', (ctx, next) => {
    const chatId = ctx.chat.id;
    const session = importSessions.get(chatId);
    if (!session) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      importSessions.delete(chatId);
      return next();
    }

    if (session.step === 'accounts') {
      // Parse akun dari teks
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = [];
      const invalid = [];

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length === 2 && parts[0].includes('@')) {
          parsed.push({ email: parts[0].trim(), password: parts[1].trim() });
        } else {
          invalid.push(line);
        }
      }

      if (parsed.length === 0) {
        return ctx.reply('❌ Tidak ada akun valid yang ditemukan. Pastikan format: `email|password`', { parse_mode: 'Markdown' });
      }

      session.accounts = parsed;
      session.step = 'label_prefix';
      importSessions.set(chatId, session);

      let preview = parsed.slice(0, 3).map(a => `• \`${a.email}\``).join('\n');
      if (parsed.length > 3) preview += `\n  _...dan ${parsed.length - 3} lainnya_`;

      const invalidNote = invalid.length > 0
        ? `\n\n⚠️ *${invalid.length} baris dilewati* (format salah)`
        : '';

      return ctx.reply(
        `✅ *${parsed.length} akun siap diimport:*\n\n${preview}${invalidNote}\n\n` +
        `Masukkan *label prefix* untuk batch ini:\n(contoh: \`April\`, \`Batch1\`)\n\nBot akan buat label: April-01, April-02, dst.`,
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'label_prefix') {
      session.labelPrefix = text;
      session.step = 'max_renew';
      importSessions.set(chatId, session);
      return ctx.reply(
        `🔁 *Berapa kali maksimal renew?*
(default: 5 = \~1 bulan lebih | masukkan angka 1-10)
Contoh: ketik *4* untuk 4x renew (\~28 hari)`,
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'max_renew') {
      const num = parseInt(text);
      if (isNaN(num) || num < 1 || num > 10) {
        return ctx.reply('❌ Masukkan angka antara 1–10:');
      }
      session.maxRenew = num;
      session.step = 'start_date';
      importSessions.set(chatId, session);
      return ctx.reply(
        `📅 Tanggal mulai untuk semua akun ini?\nKetik *"hari ini"* atau format *YYYY-MM-DD*`,
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'start_date') {
      let startDate;
      if (text.toLowerCase() === 'hari ini') {
        startDate = new Date().toISOString().split('T')[0];
      } else {
        const parsed = new Date(text);
        if (isNaN(parsed.getTime())) {
          return ctx.reply('❌ Format tanggal tidak valid. Gunakan YYYY-MM-DD atau "hari ini":');
        }
        startDate = parsed.toISOString().split('T')[0];
      }

      session.startDate = startDate;
      session.step = 'confirm';
      importSessions.set(chatId, session);

      const nextRenew = new Date(startDate);
      nextRenew.setDate(nextRenew.getDate() + 7);
      session.nextRenew = nextRenew.toISOString().split('T')[0];

      return ctx.reply(
        `📋 *Konfirmasi Import:*\n\n` +
        `👥 Jumlah akun: *${session.accounts.length}*\n` +
        `🏷 Label: ${session.labelPrefix}-01 ~ ${session.labelPrefix}-${String(session.accounts.length).padStart(2, '0')}\n` +
        `📅 Mulai: *${session.startDate}*\n` +
        `🔁 Renew pertama: *${session.nextRenew}*\n` +
        `📊 Max renew: *${session.maxRenew}x* (~${session.maxRenew * 7} hari)\n\n` +
        `Import sekarang?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Ya, Import Semua', 'import_confirm')],
            [Markup.button.callback('❌ Batal', 'import_cancel')],
          ]),
        }
      );
    }
  });

  bot.action('import_confirm', (ctx) => {
    const chatId = ctx.chat.id;
    const session = importSessions.get(chatId);
    if (!session) return ctx.answerCbQuery('Session expired');

    const insert = db.prepare(`
      INSERT INTO members (label, email, password, start_date, next_renew, max_renew)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((accounts) => {
      accounts.forEach((acc, i) => {
        const label = `${session.labelPrefix}-${String(i + 1).padStart(2, '0')}`;
        insert.run(label, acc.email, acc.password, session.startDate, session.nextRenew, session.maxRenew);
      });
    });

    try {
      insertMany(session.accounts);
      importSessions.delete(chatId);
      ctx.answerCbQuery('✅ Import berhasil!');
      return ctx.editMessageText(
        `✅ *${session.accounts.length} member berhasil diimport!*\n\n` +
        `🏷 Label: ${session.labelPrefix}-01 ~ ${session.labelPrefix}-${String(session.accounts.length).padStart(2, '0')}\n` +
        `📅 Mulai: *${session.startDate}*\n` +
        `🔁 Renew pertama: *${session.nextRenew}*\n` +
        `📊 Max renew: *${session.maxRenew}x*\n\n` +
        `Gunakan /list untuk melihat semua member.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      importSessions.delete(chatId);
      ctx.answerCbQuery('Error');
      return ctx.reply('❌ Gagal import: ' + err.message);
    }
  });

  bot.action('import_cancel', (ctx) => {
    importSessions.delete(ctx.chat.id);
    ctx.answerCbQuery('Dibatalkan');
    return ctx.editMessageText('❌ *Import dibatalkan.*', { parse_mode: 'Markdown' });
  });
}

module.exports = { importCommand };
