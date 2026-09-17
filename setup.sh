#!/usr/bin/env bash
# Klinika AI Voice Agent — bir buyruqli ishga tushirish.
#
# Ishlatish:
#   chmod +x setup.sh
#   ./setup.sh
#
# Skript .env fayllarini yaratadi (agar yo'q bo'lsa), paketlarni o'rnatadi,
# bazani tayyorlaydi va uchala qismni ishga tushiradi.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m!  %s\033[0m\n' "$1"; }
die() { printf '\033[1;31mXATO: %s\033[0m\n' "$1" >&2; exit 1; }

command -v node >/dev/null || die "Node.js o'rnatilmagan. https://nodejs.org dan 20+ versiyani o'rnating."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ kerak (hozir: $(node -v))."

# ── .env fayllari ───────────────────────────────────────────
if [ ! -f backend/.env ]; then
  say "backend/.env yaratilmoqda"
  cp backend/.env.example backend/.env
  warn "backend/.env ni oching va DATABASE_URL, DIRECT_DATABASE_URL, TELEGRAM_BOT_TOKEN ni to'ldiring."
  warn "So'ng shu skriptni qayta ishga tushiring."
  exit 0
fi

# DIRECT_DATABASE_URL yo'q bo'lsa — DATABASE_URL dan "-pooler" ni olib tashlab yasaymiz
if ! grep -q '^DIRECT_DATABASE_URL=..*' backend/.env; then
  DB_LINE="$(grep '^DATABASE_URL=' backend/.env | head -1 | cut -d= -f2-)"
  if [ -n "$DB_LINE" ]; then
    DIRECT="${DB_LINE//-pooler/}"
    say "DIRECT_DATABASE_URL avtomatik qo'shilmoqda (migratsiya uchun)"
    printf '\nDIRECT_DATABASE_URL=%s\n' "$DIRECT" >> backend/.env
  fi
fi

[ -f miniapp/.env ] || cp miniapp/.env.example miniapp/.env
[ -f admin/.env ] || cp admin/.env.example admin/.env

# ── Paketlar ────────────────────────────────────────────────
for dir in backend miniapp admin; do
  if [ ! -d "$dir/node_modules" ]; then
    say "$dir — paketlar o'rnatilmoqda"
    (cd "$dir" && npm install --no-audit --no-fund)
  fi
done

# ── Baza ────────────────────────────────────────────────────
say "Baza tayyorlanmoqda (migratsiya + boshlang'ich ma'lumotlar)"
(cd backend && npx prisma migrate deploy && npx prisma generate >/dev/null && npm run seed)

# ── Ishga tushirish ─────────────────────────────────────────
say "Ishga tushmoqda"
mkdir -p .logs
(cd backend && npm run dev > "$ROOT/.logs/backend.log" 2>&1 &)
(cd miniapp && npm run dev > "$ROOT/.logs/miniapp.log" 2>&1 &)
(cd admin && npm run dev > "$ROOT/.logs/admin.log" 2>&1 &)

sleep 6
printf '\n'
say "Tayyor"
cat <<'INFO'
  Backend       http://localhost:4000/health
  Mini App      http://localhost:5173
  Admin panel   http://localhost:5174

  Loglar:       .logs/backend.log, .logs/miniapp.log, .logs/admin.log
  To'xtatish:   pkill -f "vite" ; pkill -f "src/index.js"

  Keyingi qadam — Telegramda botingizga /start yozing.
  Mini App tugmasi ishlashi uchun ngrok kerak: SETUP.md, 6-bo'lim.
INFO
