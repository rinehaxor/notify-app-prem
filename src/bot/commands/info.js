const { Markup } = require('telegraf');
const db = require('../../db/database');

function getDaysLeft(nextRenew) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renew = new Date(nextRenew);
  renew.setHours(0, 0, 0, 0);
  return Math.ceil((renew - today) / (1000 * 60 * 60 * 24));
}

function infoCommand(bot) {
  bot.command('info', (ctx) => {
    const args = ctx.message.text.split(' ');
    const id = parseInt(args[1]);

    if (!id || isNaN(id)) {
      return ctx.reply('❌ Format salah. Gunakan: /info [id]\nContoh: /info 3');
    }

    const member = db.prepare(`SELECT * FROM members WHERE id = ?`).get(id);
    if (!member) {
      return ctx.reply(`❌ Member dengan ID *${id}* tidak ditemukan.`, { parse_mode: 'Markdown' });
    }

    return sendInfo(ctx, member);
  });
}

function sendInfo(ctx, member) {
  const days = getDaysLeft(member.next_renew);
  let statusText = '';
  let statusEmoji = '';

  if (member.status === 'selesai') {
    statusEmoji = '⚫';
    statusText = 'SELESAI (tidak bisa direnew lagi)';
  } else if (days < 0) {
    statusEmoji = '🔴';
    statusText = `TELAT ${Math.abs(days)} hari!`;
  } else if (days === 0) {
    statusEmoji = '🔴';
    statusText = 'Harus direnew HARI INI!';
  } else if (days <= 2) {
    statusEmoji = '🟡';
    statusText = `${days} hari lagi`;
  } else {
    statusEmoji = '🟢';
    statusText = `${days} hari lagi`;
  }

  const text =
    `${statusEmoji} *Detail Member #${member.id}*\n\n` +
    `👤 Label: *${member.label}*\n` +
    `📧 Email: \`${member.email}\`\n` +
    `🔑 Password: \`${member.password || '-'}\`\n` +
    `📅 Mulai: ${member.start_date}\n` +
    `🔁 Last renew: ${member.last_renew || '-'}\n` +
    `⏰ Next renew: *${member.next_renew}* (${statusText})\n` +
    `📊 Progress: ${member.renew_count}/${member.max_renew}x\n` +
    `📝 Status: ${member.status}\n` +
    (member.notes ? `💬 Catatan: ${member.notes}\n` : '') +
    `🕐 Dibuat: ${member.created_at}`;

  const buttons = [
    [Markup.button.callback(`🗑 Hapus Member`, `del_confirm_${member.id}`)],
  ];

  return ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons),
  });
}

module.exports = { infoCommand };
