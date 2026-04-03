const { Markup } = require('telegraf');
const db = require('../../db/database');

function deleteAllCommand(bot) {
  bot.command('deleteall', (ctx) => {
    const total = db.prepare(`SELECT COUNT(*) as c FROM members`).get().c;
    if (total === 0) {
      return ctx.reply('📭 Tidak ada member di database.');
    }
    return ctx.reply(
      `⚠️ *Hapus SEMUA Member?*\n\n` +
      `Ini akan menghapus *${total} member* secara permanen!\n` +
      `Data tidak bisa dikembalikan.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`🗑 Ya, Hapus Semua ${total} Member`, 'deleteall_confirm')],
          [Markup.button.callback('❌ Batal', 'deleteall_cancel')],
        ]),
      }
    );
  });

  bot.action('deleteall_confirm', async (ctx) => {
    const total = db.prepare(`SELECT COUNT(*) as c FROM members`).get().c;
    db.prepare(`DELETE FROM members`).run();
    db.prepare(`DELETE FROM sqlite_sequence WHERE name='members'`).run(); // reset auto-increment ID
    await ctx.answerCbQuery('Semua member dihapus!');
    return ctx.editMessageText(
      `✅ *${total} member berhasil dihapus.*\n\nDatabase bersih. Gunakan /import atau /add untuk menambah member baru.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.action('deleteall_cancel', async (ctx) => {
    await ctx.answerCbQuery('Dibatalkan');
    return ctx.editMessageText('❌ *Hapus semua dibatalkan.*', { parse_mode: 'Markdown' });
  });
}

module.exports = { deleteAllCommand };
