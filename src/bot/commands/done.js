const { Markup } = require('telegraf');
const db = require('../../db/database');

function doneCommand(bot) {
  // /done [id]
  bot.command('done', (ctx) => {
    const args = ctx.message.text.split(' ');
    const id = parseInt(args[1]);

    if (!id || isNaN(id)) {
      return ctx.reply('❌ Format salah. Gunakan: /done [id]\nContoh: /done 3');
    }

    return processDone(ctx, id);
  });

  // Inline button dari /info
  bot.action(/done_(\d+)/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    await ctx.answerCbQuery();
    return processDone(ctx, id, true);
  });
}

function processDone(ctx, id, isEdit = false) {
  const member = db.prepare(`SELECT * FROM members WHERE id = ?`).get(id);

  if (!member) {
    const msg = `❌ Member dengan ID *${id}* tidak ditemukan.`;
    return isEdit ? ctx.editMessageText(msg, { parse_mode: 'Markdown' }) : ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  if (member.status === 'selesai') {
    const msg = `⚫ Member *${member.label}* sudah selesai (5x renew).`;
    return isEdit ? ctx.editMessageText(msg, { parse_mode: 'Markdown' }) : ctx.reply(msg, { parse_mode: 'Markdown' });
  }

  const today = new Date().toISOString().split('T')[0];
  const nextRenew = new Date();
  nextRenew.setDate(nextRenew.getDate() + 7);
  const nextRenewStr = nextRenew.toISOString().split('T')[0];

  const newCount = member.renew_count + 1;
  const newStatus = newCount >= member.max_renew ? 'selesai' : 'aktif';

  db.prepare(`
    UPDATE members
    SET last_renew = ?, next_renew = ?, renew_count = ?, status = ?
    WHERE id = ?
  `).run(today, nextRenewStr, newCount, newStatus, id);

  let msg = '';
  if (newStatus === 'selesai') {
    msg =
      `✅ *Renew ke-${newCount} berhasil dicatat!*\n\n` +
      `👤 ${member.label} - \`${member.email}\`\n` +
      `📅 Direnew: *${today}*\n\n` +
      `🏁 *Ini adalah renew terakhir (${newCount}/${member.max_renew}x).*\n` +
      `Member ini sudah SELESAI. Akun tidak bisa direnew lagi.`;
  } else {
    msg =
      `✅ *Renew ke-${newCount} berhasil dicatat!*\n\n` +
      `👤 ${member.label} - \`${member.email}\`\n` +
      `📅 Direnew: *${today}*\n` +
      `🔁 Renew berikutnya: *${nextRenewStr}*\n` +
      `📊 Progress: ${newCount}/${member.max_renew}x`;
  }

  return isEdit
    ? ctx.editMessageText(msg, { parse_mode: 'Markdown' })
    : ctx.reply(msg, { parse_mode: 'Markdown' });
}

module.exports = { doneCommand };
