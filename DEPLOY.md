# 🚀 Deploy Bot ke VPS dengan PM2

## Prasyarat
- VPS sudah ada Node.js (v18+) dan Git
- PM2 sudah terinstall global

---

## Step 1 — Install PM2 (jika belum ada)

```bash
npm install -g pm2
```

---

## Step 2 — Upload Project ke VPS

### Cara A: Via Git (Recommended)

```bash
# Di VPS
git clone https://github.com/username/notify-app-prem.git
cd notify-app-prem
```

### Cara B: Via SCP / SFTP (upload manual)

```bash
# Di local machine (PowerShell/terminal)
scp -r D:\bot-sansrine\notify-app-prem user@ip-vps:/home/user/notify-app-prem
```

---

## Step 3 — Install Dependencies

```bash
cd notify-app-prem
npm install --production
```

---

## Step 4 — Buat File .env di VPS

```bash
nano .env
```

Isi dengan:
```env
BOT_TOKEN=isi_token_bot_kamu
ADMIN_CHAT_ID=isi_chat_id_kamu
TZ=Asia/Jakarta
```

Simpan: `Ctrl+X` → `Y` → `Enter`

---

## Step 5 — Jalankan dengan PM2

```bash
pm2 start src/index.js --name cc-notify-bot
```

---

## Step 6 — Simpan & Auto-start saat VPS Reboot

```bash
pm2 save
pm2 startup
```

> Jalankan perintah yang muncul setelah `pm2 startup` (biasanya ada 1 baris tambahan yang perlu di-copy paste)

---

## ✅ Cek Status Bot

```bash
# Lihat status
pm2 status

# Lihat log live
pm2 logs cc-notify-bot

# Lihat log 100 baris terakhir
pm2 logs cc-notify-bot --lines 100
```

---

## 🔄 Update Bot (setelah ada perubahan kode)

```bash
# Pull update terbaru (jika pakai Git)
git pull

# Restart bot
pm2 restart cc-notify-bot
```

---

## 🛑 Stop / Hapus Bot

```bash
pm2 stop cc-notify-bot      # Stop sementara
pm2 restart cc-notify-bot   # Restart
pm2 delete cc-notify-bot    # Hapus dari PM2
```

---

## 📋 Cheatsheet PM2

| Perintah | Fungsi |
|---|---|
| `pm2 status` | Lihat semua proses |
| `pm2 logs cc-notify-bot` | Log live |
| `pm2 restart cc-notify-bot` | Restart bot |
| `pm2 stop cc-notify-bot` | Stop bot |
| `pm2 save` | Simpan daftar proses |
| `pm2 startup` | Auto-start saat reboot |

---

## ⚠️ Penting

- File `.env` **jangan di-push ke Git** (sudah ada di `.gitignore`)
- Folder `data/` (database SQLite) **jangan di-push** — biarkan generated di VPS
- Kalau mau backup database: `scp user@ip-vps:/home/user/notify-app-prem/data/members.db ./backup.db`
