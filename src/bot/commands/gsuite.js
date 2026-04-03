const db = require('../../db/database');

const gsuiteSessions = new Map();
const GSUITE_KEY = (chatId) => `gsuite_${chatId}`;

function gsuiteCommand(bot) {
  // /addgsuite — catat penggunaan gsuite
  bot.command('addgsuite', (ctx) => {
    gsuiteSessions.set(GSUITE_KEY(ctx.chat.id), { step: 'email' });
    return ctx.reply(
      '📧 *Catat GSuite*\n\nMasukkan *email GSuite* yang dipakai:',
      { parse_mode: 'Markdown' }
    );
  });

  // /listgsuite — lihat log
  bot.command('listgsuite', (ctx) => {
    const logs = db.prepare(`SELECT * FROM gsuite_log ORDER BY id DESC LIMIT 30`).all();
    if (logs.length === 0) {
      return ctx.reply('📭 Belum ada log GSuite.');
    }
    const rows = logs
      .map((l) => `• \`${l.email}\` — ${l.used_for || '-'} (${l.used_at})`)
      .join('\n');
    return ctx.reply(`📋 *Log GSuite (30 terbaru):*\n\n${rows}`, { parse_mode: 'Markdown' });
  });

  // Handler session /addgsuite
  bot.on('text', (ctx, next) => {
    const chatId = ctx.chat.id;
    const session = gsuiteSessions.get(GSUITE_KEY(chatId));
    if (!session) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      gsuiteSessions.delete(GSUITE_KEY(chatId));
      return next();
    }

    if (session.step === 'email') {
      if (!text.includes('@')) {
        return ctx.reply('❌ Format email tidak valid. Coba lagi:');
      }
      session.email = text;
      session.step = 'used_for';
      gsuiteSessions.set(GSUITE_KEY(chatId), session);
      return ctx.reply(
        '📝 Dipakai untuk keperluan apa? (contoh: head-batch-1, renew-april)\nKetik *skip* untuk lewati.',
        { parse_mode: 'Markdown' }
      );
    }

    if (session.step === 'used_for') {
      const usedFor = text.toLowerCase() === 'skip' ? null : text;
      const today = new Date().toISOString().split('T')[0];

      db.prepare(`INSERT INTO gsuite_log (email, used_for, used_at) VALUES (?, ?, ?)`).run(
        session.email, usedFor, today
      );

      gsuiteSessions.delete(GSUITE_KEY(chatId));
      return ctx.reply(
        `✅ *GSuite dicatat!*\n\n📧 \`${session.email}\`\n📝 ${usedFor || '-'}\n📅 ${today}`,
        { parse_mode: 'Markdown' }
      );
    }
  });
}

module.exports = { gsuiteCommand };
