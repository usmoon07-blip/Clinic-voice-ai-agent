# ISHGA TUSHIRISH YO'RIQNOMASI

Hammasi **localhost** da ishlaydi. Deploy talab qilinmaydi.
Buyruqlarni terminalga tartib bilan yozing.

---

## 0. Nima kerak

| Narsa | Nima uchun | Majburiymi |
|---|---|---|
| **Node.js 20+** | backend va ikkala frontend | ✅ ha |
| **PostgreSQL** (neon.tech bepul) | ma'lumotlar bazasi | ✅ ha |
| **Telegram bot token** (@BotFather) | bot va Mini App | ✅ ha |
| **ngrok** | localhostni internetga ochish | ✅ ha (Mini App va telefon uchun) |
| **AI kaliti** (Anthropic) | Voice Agent suhbati | ⬜ yo'q bo'lsa DTMF zaxira rejimi ishlaydi |
| **Telefoniya** (Twilio yoki SIP) | telefon qo'ng'iroqlari | ⬜ faqat telefon qismi uchun |
| **TTS kaliti** (ElevenLabs) | o'zbekcha ovoz | ⬜ pastdagi ogohlantirishni o'qing |

Node versiyasini tekshirish:

```bash
node -v      # v20 yoki yuqori bo'lsin
```

---

## 1. Kalitlarni olish

### 1.1. Ma'lumotlar bazasi (Neon)

1. https://neon.tech ga kiring, bepul ro'yxatdan o'ting.
2. **Create project** → nom bering (masalan `clinic`).
3. **Connection string** ni nusxalang. U shunday ko'rinadi:
   `postgresql://user:parol@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

### 1.2. Telegram bot

1. Telegramda **@BotFather** ni oching.
2. `/newbot` → botga nom va username bering (username `_bot` bilan tugashi shart).
3. BotFather bergan **tokenni** saqlang: `123456789:AAH...`
4. Mini App URL ni keyinroq (6-qadamda) qo'shamiz.

### 1.3. AI kaliti

https://console.anthropic.com → API Keys → Create key → `sk-ant-...`

### 1.4. Telefoniya — qaysi raqam kerak

Ovozli assistentni sinash uchun **kiruvchi qo'ng'iroqni webhookka yo'naltira oladigan**
raqam kerak. Oddiy SIM-karta buni qila olmaydi. Uchta yo'l bor.

#### A) Eng tez yo'l — Twilio sinov akkaunti (bugunoq ishlaydi)

1. https://www.twilio.com/try-twilio — bepul ro'yxatdan o'ting.
2. **O'z telefon raqamingizni tasdiqlang** (Verified Caller ID). Sinov akkauntida
   raqam sotib olishdan oldin bu majburiy, va tasdiqlash faqat SMS orqali bo'ladi.
3. **Phone Numbers → Buy a number** → AQSh raqami (odatda ~$1/oy, sinov krediti hisobidan).
4. Raqamning **Voice → A call comes in** sozlamasiga ngrok manzilini qo'ying
   (7-bo'limga qarang) va o'sha raqamga qo'ng'iroq qiling.

Sinov akkauntining cheklovlari (bilib qo'ying, ular sinashga xalaqit qilmaydi):

| Cheklov | Qiymati |
|---|---|
| Raqamlar soni | 1 ta (umumiy 3 tagacha) |
| Kim qo'ng'iroq qila oladi | faqat **tasdiqlangan** raqamlardan |
| Bitta qo'ng'iroq uzunligi | 10 daqiqa |
| Bir vaqtda | 5 ta qo'ng'iroq |
| Akkaunt muddati | 30 kun |

> O'zingizning O'zbekiston raqamingizni tasdiqlab qo'ysangiz, shu raqamdan AQSh
> raqamiga qo'ng'iroq qilasiz — **xalqaro tarif operatoringiz bo'yicha hisoblanadi**.
> Buni to'lamaslik uchun B variantiga qarang.

#### B) Xalqaro to'lovsiz sinash — softphone (SIP) orqali

Twilio da **SIP Domain** yaratib, kompyuter yoki telefonga bepul softphone
(Zoiper, MicroSIP, Linphone) o'rnatasiz va qo'ng'iroqni **internet orqali** qilasiz —
mobil operator tarifi umuman ishlatilmaydi.

1. Twilio Console → **Voice → Manage → SIP Domains** → yangi domen
   (masalan `clinic-test.sip.twilio.com`).
2. **Credential Lists** → login/parol yarating va domenga biriktiring.
3. Zoiper ga kiriting: login `ism@clinic-test.sip.twilio.com`, parol — o'sha.
4. Softphone dan o'zingizning Twilio raqamingizni tering.

#### C) Real ish uchun — O'zbekiston raqami

> ⚠️ **Halol ogohlantirish:** Twilio ning O'zbekiston raqamlari inventari yo'q
> (ular UZ ga **qo'ng'iroq qilish** tarifini ko'rsatadi, bu boshqa narsa).
> Console da qidirib ko'ring — chiqmasa, quyidagilardan birini tanlang:
>
> - **Mahalliy operator SIP trunk** (Uzbektelecom, korporativ tariflar) + Asterisk.
>   Eng ishonchli va qonuniy yo'l, klinikaning mavjud raqami saqlanib qoladi.
> - **Xalqaro provayderlar** (Telnyx, AVOXI, Global Call Forwarding va h.k.)
>   O'zbekiston raqamlarini taklif qilishini e'lon qiladi — lekin ko'pincha
>   hujjat/KYC (mahalliy manzil, tashkilot guvohnomasi) talab qilinadi.
>   Buyurtma berishdan oldin **SIP/webhook ga yo'naltirish mumkinmi** deb aniq so'rang:
>   oddiy "call forwarding" bizga yaramaydi.
> - **GSM-gateway** (masalan GoIP) + klinikaning oddiy SIM kartasi — arzon,
>   lekin sifati va barqarorligi pastroq.
>
> Qaysi birini tanlasangiz ham, kod tayyor: `.env` da `TELEPHONY_PROVIDER=sip`
> qilib, ARI ma'lumotlarini kiritasiz.

Twilio uchun kalitlar: https://console.twilio.com → Account SID, Auth Token.

### 1.5. TTS (ovoz)

> ⚠️ **Muhim:** Twilio ning o'rnatilgan ovozi (`<Say>`) **o'zbek tilini bilmaydi**.
> - Rus tilida ishlatsangiz — Twilio ovozi yetarli, qo'shimcha kalit kerak emas.
> - O'zbek tilida tabiiy ovoz kerak bo'lsa — **ElevenLabs** kaliti oling
>   (https://elevenlabs.io → Profile → API key, va Voice ID ni tanlang),
>   `.env` da `TTS_PROVIDER=elevenlabs` qiling.
> - Kalit bo'lmasa tizim ishlaydi, lekin o'zbekcha matnni rus ovozi o'qiydi —
>   tushunarli, ammo talaffuz g'aliz bo'ladi.

---

## 2. Eng tez yo'l — bitta buyruq

Agar qo'lda sozlashni xohlamasangiz:

```bash
chmod +x setup.sh
./setup.sh
```

Birinchi ishga tushirishda skript `backend/.env` ni yaratadi va to'ldirishni so'raydi.
To'ldirib, skriptni qayta ishga tushirsangiz — paketlarni o'rnatadi, bazani
tayyorlaydi va uchala qismni birdan ishga tushiradi.

Qolgan bo'limlar qo'lda sozlash uchun.

---

## 2b. Backend (qo'lda)

```bash
cd backend
npm install
cp .env.example .env
```

Endi `.env` faylini oching va to'ldiring. Eng kamida:

```
DATABASE_URL=...           # Neon → Connect → Pooled connection ("-pooler" bor)
DIRECT_DATABASE_URL=...    # xuddi shu manzil, lekin "-pooler" siz
JWT_SECRET=...             # uzun tasodifiy matn
SUPERADMIN_LOGIN=admin
SUPERADMIN_PASSWORD=...    # o'zingiz o'ylab toping
TELEGRAM_BOT_TOKEN=...     # BotFather dan
ANTHROPIC_API_KEY=...      # AI kaliti (ixtiyoriy)
CLINIC_NAME=Shifo klinikasi
CLINIC_PHONE=+998712000000
CLINIC_ADDRESS=Toshkent sh., ...
```

> **Nega ikkita baza manzili?** Neon ning "pooled" ulanishi orqali jadval yaratib
> bo'lmaydi. Shuning uchun kundalik ishga `DATABASE_URL` (pooled), migratsiyaga esa
> `DIRECT_DATABASE_URL` (pooler siz) ishlatiladi. Ikkinchisini qo'lda yozmasangiz ham
> bo'ladi — `./setup.sh` uni birinchisidan avtomatik yasaydi.

Bazani yaratish va boshlang'ich ma'lumotlarni yuklash:

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Natijada 8 mutaxassislik, 8 shifokor, 15 xizmat, 7 kabinet va ish vaqtlari yaratiladi.

Backendni ishga tushirish:

```bash
npm run dev
```

Tekshirish: brauzerda http://localhost:4000/health → `{"success":true,...}`

Bazani ko'rish (ixtiyoriy):

```bash
npx prisma studio
```

---

## 3. Mini App (bemorlar uchun)

**Yangi terminal oching:**

```bash
cd miniapp
npm install
cp .env.example .env
npm run dev
```

http://localhost:5173 — brauzerda ochiladi (Telegramdan tashqarida ham test qilish uchun
`.env` dagi `VITE_DEV_TELEGRAM_ID` ishlatiladi; bu faqat `NODE_ENV=development` da ishlaydi).

---

## 4. Admin panel

**Yana bitta terminal:**

```bash
cd admin
npm install
cp .env.example .env
npm run dev
```

http://localhost:5174 → login: `.env` dagi `SUPERADMIN_LOGIN` va `SUPERADMIN_PASSWORD`.

Shifokorlar uchun ham login yaratilgan: `dr.<familiya>` / `doctor12345`
(masalan `dr.yusupova`). Ular faqat o'z navbatlarini ko'radi.

---

## 5. Salomlashuv audiosini yozish (3 soniya qoidasi)

Qo'ng'iroqqa **3 soniya ichida** javob berish uchun salomlashuv jonli TTS bilan
generatsiya qilinmaydi — oldindan yozilgan fayl qo'yiladi.

1. Telefonda yoki kompyuterda quyidagi matnni yozib oling:
   > "Assalomu alaykum, [Klinika nomi]. Men klinikaning yordamchisiman.
   > Sizga qanday yordam bera olaman? Qo'ng'iroq sifat nazorati uchun yozib olinadi."
2. Faylni `backend/public/audio/greeting-uz.mp3` nomi bilan saqlang.
3. Ruscha variantni `backend/public/audio/greeting-ru.mp3` qiling.

Fayl bo'lmasa tizim ishlaydi — matnni ovozga aylantirib o'qiydi (biroz sekinroq).

---

## 6. Ngrok — localhostni internetga ochish

```bash
# O'rnatish (https://ngrok.com/download dan ham olsa bo'ladi)
npm install -g ngrok
ngrok config add-authtoken <SIZNING_TOKENINGIZ>
```

**Ikkita tunnel kerak:** biri backend (telefon webhooklari), biri Mini App.

Terminal A:

```bash
ngrok http 4000
# Forwarding: https://abc123.ngrok-free.app -> http://localhost:4000
```

Terminal B:

```bash
ngrok http 5173
# Forwarding: https://xyz789.ngrok-free.app -> http://localhost:5173
```

Endi `backend/.env` ni yangilang va backendni qayta ishga tushiring:

```
PUBLIC_URL=https://abc123.ngrok-free.app
MINIAPP_URL=https://xyz789.ngrok-free.app
```

`miniapp/.env` ni ham yangilang:

```
VITE_API_URL=https://abc123.ngrok-free.app/api/client
```

### BotFather ga Mini App URL ni qo'shish

1. @BotFather → `/mybots` → botingizni tanlang
2. **Bot Settings → Menu Button → Configure menu button**
3. URL sifatida `https://xyz789.ngrok-free.app` ni kiriting
4. Tugma nomi: `Navbat olish`

Endi Telegramda botga `/start` yozing — "🩺 Navbat olish" tugmasi Mini Appni ochadi.

---

## 7. Telefoniyani ulash

### Twilio

1. https://console.twilio.com → **Phone Numbers → Manage → Active numbers** → raqamingizni bosing.
2. **Voice & Fax** bo'limida:
   - **A call comes in**: `Webhook`
   - URL: `https://abc123.ngrok-free.app/api/voice/incoming`
   - Method: `HTTP POST`
   - **Call status changes**: `https://abc123.ngrok-free.app/api/voice/status`
3. **Save**.
4. `.env` da `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
   `OPERATOR_PHONE_NUMBER` (eskalatsiya uchun) ni to'ldiring.
5. Ishlab chiqarishga o'tganda `TWILIO_VALIDATE_SIGNATURE=true` qiling — soxta
   so'rovlar rad etiladi.

### Asterisk / SIP

1. `.env` da `TELEPHONY_PROVIDER=sip` va ARI ma'lumotlarini to'ldiring.
2. `extensions.conf` ga qo'shing:

```
[from-trunk]
exten => _X.,1,NoOp(Klinika AI)
 same => n,Stasis(clinic-voice)
 same => n,Hangup()
```

3. ARI ulagichi `POST /api/voice/incoming` ga so'rov yuboradi va javobdagi
   `commands` massivini bajaradi (`play`, `listen`, `transfer`, `hangup`).

---

## 8. Telefonsiz sinash (eng tez yo'l)

Backend `development` rejimida bo'lsa, AI bilan matn orqali suhbatlashish mumkin:

```bash
# Suhbatni boshlash
curl -X POST localhost:4000/api/voice/simulate \
  -H 'content-type: application/json' \
  -d '{"callSid":"test-1","from":"+998901234567","start":true}'

# Gapirish
curl -X POST localhost:4000/api/voice/simulate \
  -H 'content-type: application/json' \
  -d '{"callSid":"test-1","from":"+998901234567","text":"terapevtga yozilmoqchiman"}'
```

Shoshilinch holat qanday ishlashini ko'rish:

```bash
curl -X POST localhost:4000/api/voice/simulate \
  -H 'content-type: application/json' \
  -d '{"callSid":"test-2","from":"+998901234567","text":"kokragim qattiq ogriyapti, nafasim qisilyapti"}'
```

Javobda `"action":"TRANSFER"` va 103 haqidagi matn chiqishi kerak — AI navbat olishga
umuman o'tmaydi.

---

## 9. To'liq test senariysi

1. Telefon raqamiga qo'ng'iroq qiling (yoki `simulate` dan foydalaning).
2. "Ertaga terapevtga yozilmoqchiman" deb ayting.
3. AI bo'sh vaqtlarni aytadi → birini tanlang → ismingizni ayting → tasdiqlang.
4. Admin panelni oching (http://localhost:5174) → **Navbatlar** → yangi qator
   `📞 Qo'ng'iroq` belgisi bilan turibdi.
5. **Qo'ng'iroqlar** bo'limida transkriptni o'qing.
6. Telegramda Mini Appni oching → **Mening navbatlarim** → o'sha navbat ko'rinadi.

---

## 10. Testlarni ishga tushirish

```bash
cd backend
npm test
```

54 ta test: telefon raqami formatlari, vaqt zonasi, shoshilinch holat triaji,
bandlik hisobi, bekor qilish oynasi, ikki marta band qilishning oldini olish,
idempotency, eslatmalarning bir martaligi va Voice Agent senariylari.

---

## 11. Hammasini ishga tushirish (qisqa ro'yxat)

```bash
# 1-terminal — backend
cd backend && npm run dev

# 2-terminal — Mini App
cd miniapp && npm run dev

# 3-terminal — Admin panel
cd admin && npm run dev

# 4-terminal — ngrok (backend)
ngrok http 4000

# 5-terminal — ngrok (Mini App)
ngrok http 5173
```

---

## 12. Tez-tez uchraydigan muammolar

| Muammo | Sababi va yechimi |
|---|---|
| `Environment variable not found: DATABASE_URL` | `.env` yaratilmagan yoki noto'g'ri papkada. `backend/.env` bo'lishi kerak. |
| Botga yozganda javob yo'q | `TELEGRAM_BOT_TOKEN` noto'g'ri yoki bo'sh. Backend logida ogohlantirish chiqadi. |
| Mini App "Telegram ma'lumotlari tasdiqlanmadi" deydi | Mini App Telegramdan tashqarida ochilgan. Brauzerda test qilish uchun `NODE_ENV=development` va `VITE_DEV_TELEGRAM_ID` kerak. |
| Qo'ng'iroq qilganda jim | `PUBLIC_URL` ngrok manziliga mos emas yoki Twilio webhook noto'g'ri. Twilio Console → Monitor → Logs → Errors ni ko'ring. |
| AI javob bermayapti, faqat raqamli menyu chiqyapti | `ANTHROPIC_API_KEY` yo'q yoki xato. Bu zaxira rejim — qo'ng'iroq baribir yo'qolmaydi. |
| O'zbekcha ovoz g'aliz | Twilio o'zbek tilini bilmaydi. `TTS_PROVIDER=elevenlabs` qiling. |
| Slot ko'rinyapti, lekin band qilib bo'lmayapti | Boshqa kanal (telefon/ilova) o'sha vaqtni hozirgina oldi. Bu to'g'ri xatti-harakat — ro'yxat yangilanadi. |
| Eslatmalar kelmayapti | `ENABLE_JOBS=true` ekanini va bemorda `telegramId` yoki SMS provayderi borligini tekshiring. |

---

## 13. Qabul davomiyligi qanday belgilanadi

Har bir bemorga bir xil vaqt qo'yilmaydi. Davomiylik **xizmatdan** olinadi:

| Xizmat | Birlamchi | Takroriy |
|---|---|---|
| Terapevt konsultatsiyasi | 30 daq | 15 daq |
| Kardiolog konsultatsiyasi | 40 daq | 20 daq |
| EKG | 15 daq | — |
| Qorin bo'shlig'i UTT | 25 daq | — |
| Qon tahlili | 15 daq | — |

Bu qiymatlar **admin panel → Xizmatlar** bo'limida o'zgartiriladi:
"Birlamchi qabul (daq)" va "Takroriy qabul (daq)".

**Takroriy qabul qanday aniqlanadi:** bemor shu shifokorda avval bo'lgan va o'sha navbat
"Yakunlangan" deb belgilangan bo'lsa, tizim keyingi safar avtomatik qisqa vaqtni oladi.
Bemor Mini Appda yoki telefonda vaqt tanlaganda, unga **aynan shu davomiylikka mos**
slotlar ko'rsatiladi.

**Bitta navbatni uzaytirish:** registratura "Qo'lda yozish" oynasida
"Davomiyligini uzaytirish" maydoniga masalan 60 yozsa, o'sha navbat 60 daqiqa bo'ladi
(murakkab holat uchun). Agar uzaytirilgan vaqt ish kuniga sig'masa yoki keyingi bemor
bilan to'qnashsa, tizim rad etadi.

**Slotlar qanday joylashadi:** slot qadami = xizmat davomiyligi + bufer
(sozlamalardagi "Qabullar orasidagi bufer", default 5 daqiqa). Ya'ni 30 daqiqalik
xizmatda slotlar 09:00, 09:35, 10:10 bo'lib ketadi — shifokorga hujjat to'ldirish va
kabinetni tayyorlash uchun vaqt qoladi.

---

## 14. Shoshilinch holat qanday hal qilinadi

Bemor allaqachon **klinikaga** qo'ng'iroq qilgan — uni "103 ga qo'ng'iroq qiling" deb
qaytarib yuborish yordam emas. Shuning uchun tizim uch darajali ishlaydi:

| Daraja | Nima bo'ladi |
|---|---|
| **CRITICAL** (ko'krak og'rig'i, nafas qisilishi, hushdan ketish, qon ketishi) | AI navbat olishni to'xtatadi, "telefonni qo'ymang" deydi va qo'ng'iroqni **navbatchi shifokorga ulaydi**. Bir vaqtning o'zida xodimlarga Telegram/SMS ogohlantirish ketadi. 103 faqat qo'shimcha maslahat sifatida aytiladi. |
| **URGENT** (kuchli og'riq, 38–39.4 harorat, "bugun kerak") | Navbat olish **to'xtamaydi** — AI bugungi eng yaqin vaqtni taklif qiladi, navbat "⚡ Shoshilinch" deb belgilanadi. Bugun joy bo'lmasa operatorga uzatadi. |
| **ROUTINE** | Oddiy navbat olish. |

**Agar navbatchi javob bermasa:** qo'ng'iroq jim uzilmaydi. Tizim
(a) xodimlarga "OPERATOR JAVOB BERMADI" ogohlantirishini yuboradi,
(b) qayta qo'ng'iroq so'rovini 🚨 belgisi bilan yozib qo'yadi (admin panel →
Qo'ng'iroqlar), (c) endi bemorga 103 ni aytadi — bu paytda bu chinakam zarur.

**Sozlash:** admin panel → Sozlamalar → "🚨 Shoshilinch qo'ng'iroqlar":
navbatchi shifokor raqami, javob kutish vaqti (soniya) va ogohlantirish yuboriladigan
Telegram ID lar.
