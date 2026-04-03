const cron = require('node-cron');
const db = require('../db/database');

function getDaysLeft(nextRenew) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renew = new Date(nextRenew);
  renew.setHours(0, 0, 0, 0);
  return Math.ceil((renew - today) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function sendDailyReminders(bot) {
  const adminId = process.env.ADMIN_CHAT_ID;
  const today = new Date().toISOString().split('T')[0];
  const members = db.prepare(`SELECT * FROM members WHERE status = 'aktif' ORDER BY next_renew ASC`).all();

  const toRenewNow = [];   // hari ini / sudah lewat → auto-increment
  const warningSoon = [];  // 1-2 hari lagi
  const warningEarly = []; // 3 hari lagi

  for (const m of members) {
    const days = getDaysLeft(m.next_renew);
    if (days <= 0) {
      toRenewNow.push({ ...m, days });
    } else if (days <= 2) {
      warningSoon.push({ ...m, days });
    } else if (days === 3) {
      warningEarly.push({ ...m, days });
    }
  }

  // Auto-process members yang sudah waktunya direnew
  if (toRenewNow.length > 0) {
    for (const m of toRenewNow) {
      const newCount = m.renew_count + 1;
      const newStatus = newCount >= m.max_renew ? 'selesai' : 'aktif';
      const newNextRenew = newStatus === 'aktif' ? addDays(m.next_renew, 7) : null;

      db.prepare(`
        UPDATE members
        SET last_renew = ?, renew_count = ?, next_renew = COALESCE(?, next_renew), status = ?
        WHERE id = ?
      `).run(today, newCount, newNextRenew, newStatus, m.id);
    }
  }

  // Kirim notif jika ada yang perlu diperhatikan
  if (toRenewNow.length === 0 && warningSoon.length === 0 && warningEarly.length === 0) return;

  const dateLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  let msg = `🔔 *Daily Reminder CC Pro*\n📆 ${dateLabel}\n\n`;

  if (toRenewNow.length > 0) {
    msg += `🔴 *RENEW SEKARANG (${toRenewNow.length} member):*\n`;
    msg += `_Bot sudah otomatis update jadwal berikutnya._\n\n`;
    for (const m of toRenewNow) {
      const newCount = m.renew_count + 1;
      const newStatus = newCount >= m.max_renew ? 'selesai' : 'aktif';
      if (newStatus === 'selesai') {
        msg += `⚫ [${m.id}] *${m.label}*\n   📧 \`${m.email}\`\n   🏁 *Ini renew ke-${newCount} (TERAKHIR). Akun selesai setelah ini.*\n\n`;
      } else {
        const nextDate = addDays(m.next_renew, 7);
        msg += `🔴 [${m.id}] *${m.label}*\n   📧 \`${m.email}\`\n   📊 Renew ke-${newCount}/${m.max_renew} | Berikutnya: *${nextDate}*\n\n`;
      }
    }
  }

  if (warningSoon.length > 0) {
    msg += `🟡 *Renew dalam 1-2 hari (${warningSoon.length} member):*\n`;
    for (const m of warningSoon) {
      msg += `• [${m.id}] ${m.label} — \`${m.email}\`\n  ⏰ ${m.days} hari lagi (${m.next_renew})\n`;
    }
    msg += '\n';
  }

  if (warningEarly.length > 0) {
    msg += `⚪ *Renew 3 hari lagi (${warningEarly.length} member):*\n`;
    for (const m of warningEarly) {
      msg += `• [${m.id}] ${m.label} — \`${m.email}\`\n`;
    }
  }

  try {
    await bot.telegram.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ Gagal kirim reminder:', err.message);
  }

  // Cek antrian GSuite yang sudah siap daftar CC
  await sendQueueReminders(bot);
}

async function sendQueueReminders(bot) {
  const adminId = process.env.ADMIN_CHAT_ID;
  const today = new Date().toISOString().split('T')[0];

  // Antrian yang ready_date <= hari ini dan belum selesai
  const readyItems = db.prepare(`
    SELECT * FROM cc_queue
    WHERE ready_date <= ? AND status = 'menunggu'
    ORDER BY ready_date ASC
  `).all(today);

  if (readyItems.length === 0) return;

  // Update status jadi 'siap'
  db.prepare(`
    UPDATE cc_queue SET status = 'siap'
    WHERE ready_date <= ? AND status = 'menunggu'
  `).run(today);

  let msg =
    `📱 *GSuite Siap Daftar CC Trial!*\n` +
    `📆 ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n` +
    `✅ *${readyItems.length} akun siap didaftarkan:*\n\n`;

  for (const q of readyItems) {
    msg +=
      `🟢 [${q.id}] \`${q.gsuite_email}\`\n` +
      `   📱 Device: *${q.device_notes || '-'}*\n` +
      (q.notes ? `   💬 ${q.notes}\n` : '') +
      `   ✅ Setelah daftar CC → /queuedone ${q.id}\n\n`;
  }

  msg += `_Buka CapCut → daftar trial pakai akun GSuite di atas!_`;

  try {
    await bot.telegram.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ Gagal kirim queue reminder:', err.message);
  }
}

function startScheduler(bot) {
  // Jalan setiap hari jam 08:00 WIB
  cron.schedule('0 8 * * *', () => {
    console.log('⏰ Running daily reminder...');
    sendDailyReminders(bot);
  }, {
    timezone: 'Asia/Jakarta',
  });

  console.log('✅ Scheduler aktif — reminder jam 08:00 WIB setiap hari');
}

function registerTestAlert(bot) {
  bot.command('testalert', async (ctx) => {
    const adminId = process.env.ADMIN_CHAT_ID;

    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    const addD = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

    const dateLabel = today.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    // Simulasi pesan notifikasi — TIDAK mengubah DB
    const msg =
      `🔔 *Daily Reminder CC Pro*\n` +
      `📆 ${dateLabel}\n` +
      `_⚠️ INI ADALAH PREVIEW — bukan data asli_\n\n` +

      `🔴 *RENEW SEKARANG (2 member):*\n` +
      `_Bot sudah otomatis update jadwal berikutnya._\n\n` +
      `🔴 [12] *April-05*\n` +
      `   📧 \`polly27@pawgpt.nl\`\n` +
      `   📊 Renew ke-1/5 | Berikutnya: *${addD(7)}*\n\n` +
      `⚫ [13] *April-06*\n` +
      `   📧 \`josiane@chennuo.xyz\`\n` +
      `   🏁 *Ini renew ke-5 (TERAKHIR). Akun selesai setelah ini.*\n\n` +

      `🟡 *Renew dalam 1-2 hari (2 member):*\n` +
      `• [14] April-07 — \`anastasia@ship79.com\`\n` +
      `  ⏰ 1 hari lagi (${addD(1)})\n` +
      `• [15] April-08 — \`opal77@ibande.xyz\`\n` +
      `  ⏰ 2 hari lagi (${addD(2)})\n\n` +

      `⚪ *Renew 3 hari lagi (1 member):*\n` +
      `• [16] April-09 — \`jade@niceminute.com\``;

    try {
      await bot.telegram.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
      await ctx.reply('✅ Preview notifikasi sudah dikirim ke chat kamu!');
    } catch (err) {
      await ctx.reply('❌ Gagal kirim preview: ' + err.message);
    }
  });
}


module.exports = { startScheduler, sendDailyReminders, registerTestAlert };
