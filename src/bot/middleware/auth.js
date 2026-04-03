const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

function adminOnly(ctx, next) {
  const chatId = String(ctx.chat?.id || ctx.from?.id);
  if (chatId !== String(ADMIN_CHAT_ID)) {
    return ctx.reply('⛔ Akses ditolak.');
  }
  return next();
}

module.exports = { adminOnly };
