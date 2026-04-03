const { Markup } = require('telegraf');
const db = require('../../db/database');

const sessions = new Map();

function addCommand(bot) {
  bot.command('add', (ctx) => {
    sessions.set(ctx.chat.id, { step: 'label' });
    return ctx.reply(
      '➕ *Tambah Member Baru*\n\nMasukkan *label/nama* customer (contoh: Budi, Pelanggan01):',
      { parse_mode: 'Markdown' }
    );
  });
}

function handleAddSession(bot) {
  bot.on('text', (ctx, next) => {
    const chatId = ctx.chat.id;
    const session = sessions.get(chatId);
    if (!session) return next();

    const text = ctx.message.text.trim();

    if (text.startsWith('/')) {
      sessions.delete(chatId);
      return next();
    }

    if (session.step === 'label') {
      session.label = text;
      session.step = 'email';
      sessions.set(chatId, session);
      return ctx.reply('📧 Masukkan *email akun CC member*:', { parse_mode: 'Markdown' });
    }

    if (session.step === 'email') {
      if (!text.includes('@')) {
        return ctx.reply('❌ Format email tidak valid. Coba lagi:');
      }
      session.email = text;
      session.step = 'password';
      sessions.set(chatId, session);
      return ctx.reply('🔑 Masukkan *password* akun CC:', { parse_mode: 'Markdown' });
    }

    if (session.step === 'password') {
      session.password = text;
      session.step = 'start_date';
      sessions.set(chatId, session);
      return ctx.reply(
        '📅 Tanggal mulai? Ketik *"hari ini"* atau format *YYYY-MM-DD*\n(contoh: 2024-04-03)',
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
          return ctx.reply('❌ Format tanggal tidak valid. Gunakan YYYY-MM-DD atau ketik "hari ini":');
        }
        startDate = parsed.toISOString().split('T')[0];
      }

      session.start_date = startDate;
      session.step = 'confirm';
      sessions.set(chatId, session);

      const nextRenew = new Date(startDate);
      nextRenew.setDate(nextRenew.getDate() + 7);
      session.next_renew = nextRenew.toISOString().split('T')[0];

      return ctx.reply(
        `📋 *Konfirmasi Data Member:*\n\n` +
        `👤 Label: *${session.label}*\n` +
        `📧 Email: \`${session.email}\`\n` +
        `🔑 Password: \`${session.password}\`\n` +
        `📅 Mulai: *${session.start_date}*\n` +
        `🔁 Renew pertama: *${session.next_renew}*\n\n` +
        `Simpan data ini?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Ya, Simpan', 'add_confirm')],
            [Markup.button.callback('❌ Batal', 'add_cancel')],
          ]),
        }
      );
    }
  });

  bot.action('add_confirm', (ctx) => {
    const chatId = ctx.chat.id;
    const session = sessions.get(chatId);
    if (!session) return ctx.answerCbQuery('Session expired');

    try {
      db.prepare(`
        INSERT INTO members (label, email, password, start_date, next_renew)
        VALUES (?, ?, ?, ?, ?)
      `).run(session.label, session.email, session.password, session.start_date, session.next_renew);

      sessions.delete(chatId);
      ctx.answerCbQuery('✅ Tersimpan!');
      return ctx.editMessageText(
        `✅ *Member berhasil ditambahkan!*\n\n` +
        `👤 ${session.label} - \`${session.email}\`\n` +
        `📅 Renew pertama: *${session.next_renew}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      sessions.delete(chatId);
      ctx.answerCbQuery('Error');
      return ctx.reply('❌ Gagal menyimpan: ' + err.message);
    }
  });

  bot.action('add_cancel', (ctx) => {
    sessions.delete(ctx.chat.id);
    ctx.answerCbQuery('Dibatalkan');
    return ctx.editMessageText('❌ *Tambah member dibatalkan.*', { parse_mode: 'Markdown' });
  });
}

module.exports = { addCommand, handleAddSession };
