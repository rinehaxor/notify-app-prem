const { Markup } = require('telegraf');
const db = require('../../db/database');

const PAGE_SIZE = 10;

function getDaysLeft(nextRenew) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renew = new Date(nextRenew);
  renew.setHours(0, 0, 0, 0);
  return Math.ceil((renew - today) / (1000 * 60 * 60 * 24));
}

function getStatusEmoji(member) {
  if (member.status === 'selesai') return '⚫';
  const days = getDaysLeft(member.next_renew);
  if (days <= 0) return '🔴';
  if (days <= 2) return '🟡';
  return '🟢';
}

function formatMemberRow(member) {
  const emoji = getStatusEmoji(member);
  const days = getDaysLeft(member.next_renew);
  let daysText = '';

  if (member.status === 'selesai') {
    daysText = 'SELESAI';
  } else if (days < 0) {
    daysText = `TELAT ${Math.abs(days)} hari!`;
  } else if (days === 0) {
    daysText = 'HARI INI!';
  } else {
    daysText = `${days} hari lagi`;
  }

  return (
    `${emoji} [${member.id}] *${member.label}*\n` +
    `   📧 \`${member.email}\`\n` +
    `   🔁 Renew: ${member.next_renew} · ${daysText} · (${member.renew_count}/${member.max_renew}x)`
  );
}

function buildListMessage(members, page, total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const header = `📋 *Daftar Member CC Pro*\nTotal: ${total} member | Halaman ${page}/${totalPages}\n\n`;
  const rows = members.map(formatMemberRow).join('\n\n');
  return header + rows;
}

function buildPaginationButtons(page, total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const buttons = [];
  if (page > 1) buttons.push(Markup.button.callback('◀️ Prev', `list_page:${page - 1}`));
  if (page < totalPages) buttons.push(Markup.button.callback('▶️ Next', `list_page:${page + 1}`));
  return buttons;
}

async function sendList(ctx, page = 1) {
  const offset = (page - 1) * PAGE_SIZE;
  const total = db.prepare(`SELECT COUNT(*) as count FROM members`).get().count;
  
  if (total === 0) {
    return ctx.reply('📭 Belum ada member. Gunakan /add untuk menambahkan.');
  }

  const members = db.prepare(`
    SELECT * FROM members
    ORDER BY 
      CASE WHEN status = 'selesai' THEN 1 ELSE 0 END ASC,
      next_renew ASC
    LIMIT ? OFFSET ?
  `).all(PAGE_SIZE, offset);

  const text = buildListMessage(members, page, total);
  const buttons = buildPaginationButtons(page, total);

  const opts = {
    parse_mode: 'Markdown',
    ...(buttons.length > 0 ? Markup.inlineKeyboard([buttons]) : {}),
  };

  return ctx.reply(text, opts);
}

function listCommand(bot) {
  bot.command('list', (ctx) => sendList(ctx, 1));

  bot.action(/list_page:(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    const offset = (page - 1) * PAGE_SIZE;
    const total = db.prepare(`SELECT COUNT(*) as count FROM members`).get().count;
    const members = db.prepare(`
      SELECT * FROM members
      ORDER BY 
        CASE WHEN status = 'selesai' THEN 1 ELSE 0 END ASC,
        next_renew ASC
      LIMIT ? OFFSET ?
    `).all(PAGE_SIZE, offset);

    const text = buildListMessage(members, page, total);
    const buttons = buildPaginationButtons(page, total);
    const opts = {
      parse_mode: 'Markdown',
      ...(buttons.length > 0 ? Markup.inlineKeyboard([buttons]) : {}),
    };

    await ctx.answerCbQuery();
    return ctx.editMessageText(text, opts);
  });
}

module.exports = { listCommand };
