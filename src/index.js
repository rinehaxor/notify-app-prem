require('dotenv').config();
const { createBot } = require('./bot');
const { initSchema } = require('./db/schema');
const { startScheduler } = require('./scheduler/reminders');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN tidak ditemukan di .env!');
  process.exit(1);
}

if (!ADMIN_CHAT_ID) {
  console.error('❌ ADMIN_CHAT_ID tidak ditemukan di .env!');
  process.exit(1);
}

// Init database
initSchema();

// Create & start bot
const bot = createBot(BOT_TOKEN);

// Start scheduler
startScheduler(bot);

// Launch bot
bot.launch().then(() => {
  console.log('🤖 CapCut Notify Bot berjalan...');
  console.log(`👤 Admin ID: ${ADMIN_CHAT_ID}`);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
