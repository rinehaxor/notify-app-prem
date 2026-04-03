const { Markup } = require('telegraf');
const db = require('../../db/database');

function delCommand(bot) {
  // /del [id]
  bot.command('del', (ctx) => {
    const args = ctx.message.text.split(' ');
    const id = parseInt(args[1]);

    if (!id || isNaN(id)) {
      return ctx.reply('❌ Format salah. Gunakan: /del [id]\nContoh: /del 3');
    }

    const member = db.prepare(`SELECT * FROM members WHERE id = ?`).get(id);
    if (!member) {
      return ctx.reply(`❌ Member dengan ID *${id}* tidak ditemukan.`, { parse_mode: 'Markdown' });
    }

    return ctx.reply(
      `⚠️ *Hapus Member?*\n\n` +
      `👤 ${member.label} - \`${member.email}\`\n\n` +
      `Data akan dihapus permanen dan tidak bisa dikembalikan!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🗑 Ya, Hapus', `del_confirm_${id}`)],
          [Markup.button.callback('❌ Batal', 'del_cancel')],
        ]),
      }
    );
  });

  // Inline button konfirmasi dari /info
  bot.action(/del_confirm_(\d+)/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    const member = db.prepare(`SELECT * FROM members WHERE id = ?`).get(id);

    if (!member) {
      await ctx.answerCbQuery('Member tidak ditemukan');
      return ctx.editMessageText('❌ Member sudah tidak ada.');
    }

    db.prepare(`DELETE FROM members WHERE id = ?`).run(id);

    await ctx.answerCbQuery('Dihapus!');
    return ctx.editMessageText(
      `🗑 *Member berhasil dihapus.*\n\n👤 ${member.label} - \`${member.email}\``,
      { parse_mode: 'Markdown' }
    );
  });

  bot.action('del_cancel', async (ctx) => {
    await ctx.answerCbQuery('Dibatalkan');
    return ctx.editMessageText('❌ *Hapus member dibatalkan.*', { parse_mode: 'Markdown' });
  });
}

module.exports = { delCommand };
