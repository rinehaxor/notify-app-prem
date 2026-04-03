const { Markup } = require('telegraf');
const db = require('../../db/database');

const ddSessions = new Map();

function deleteDateCommand(bot) {
  bot.command('deletedate', (ctx) => {
    ddSessions.set(ctx.chat.id, { step: 'date' });
    const today = new Date().toISOString().split('T')[0];
    return ctx.reply(
      `🗑 *Hapus Member Berdasarkan Tanggal Mulai*\n\n` +
      `Masukkan tanggal yang ingin dihapus:\n` +
      `Ketik *"hari ini"* atau format *YYYY-MM-DD*\n` +
      `(contoh: \`${today}\`)`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('text', (ctx, next) => {
    const chatId = ctx.chat.id;
    const session = ddSessions.get(chatId);
    if (!session) return next();

    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
      ddSessions.delete(chatId);
      return next();
    }

    if (session.step === 'date') {
      let targetDate;
      if (text.toLowerCase() === 'hari ini') {
        targetDate = new Date().toISOString().split('T')[0];
      } else {
        const parsed = new Date(text);
        if (isNaN(parsed.getTime())) {
          return ctx.reply('❌ Format tanggal tidak valid. Gunakan YYYY-MM-DD atau "hari ini":');
        }
        targetDate = parsed.toISOString().split('T')[0];
      }

      const members = db.prepare(`
        SELECT * FROM members WHERE start_date = ?
      `).all(targetDate);

      ddSessions.delete(chatId);

      if (members.length === 0) {
        return ctx.reply(`📭 Tidak ada member dengan tanggal mulai *${targetDate}*.`, { parse_mode: 'Markdown' });
      }

      // Preview 5 pertama
      const preview = members.slice(0, 5)
        .map(m => `• [${m.id}] ${m.label} — \`${m.email}\``)
        .join('\n');
      const more = members.length > 5 ? `\n  _...dan ${members.length - 5} lainnya_` : '';

      return ctx.reply(
        `⚠️ *Hapus member dengan tanggal mulai: ${targetDate}?*\n\n` +
        `Total: *${members.length} member*\n\n` +
        `${preview}${more}\n\n` +
        `Data tidak bisa dikembalikan!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(`🗑 Ya, Hapus ${members.length} Member`, `deletedate_confirm:${targetDate}`)],
            [Markup.button.callback('❌ Batal', 'deletedate_cancel')],
          ]),
        }
      );
    }
  });

  bot.action(/deletedate_confirm:(.+)/, async (ctx) => {
    const targetDate = ctx.match[1];
    const result = db.prepare(`DELETE FROM members WHERE start_date = ?`).run(targetDate);
    await ctx.answerCbQuery('Dihapus!');
    return ctx.editMessageText(
      `✅ *${result.changes} member berhasil dihapus.*\n📅 Tanggal mulai: ${targetDate}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.action('deletedate_cancel', async (ctx) => {
    await ctx.answerCbQuery('Dibatalkan');
    return ctx.editMessageText('❌ *Hapus dibatalkan.*', { parse_mode: 'Markdown' });
  });
}

module.exports = { deleteDateCommand };
