# Klinika — AI Voice Agent + navbat olish tizimi

Ko'p profilli klinika uchun to'liq tizim: bemor **telefon orqali AI bilan gaplashib**
yoki **Telegram Mini App** orqali navbat oladi; registratura va shifokorlar hammasini
**admin panelda** boshqaradi.

**Ishga tushirish:** [SETUP.md](SETUP.md) — bosqichma-bosqich, boshidan oxirigacha.

---

## Tarkibi

| Papka | Nima |
|---|---|
| [`backend/`](backend) | Node.js + Express + Prisma: API, Telegram bot, AI Voice Agent, fon vazifalari |
| [`miniapp/`](miniapp) | React Telegram Mini App — bemorlar uchun |
| [`admin/`](admin) | React admin panel — registratura, shifokorlar, administrator |
| [`prompts/`](prompts) | Shu tizimni qurish uchun ishlatilgan texnik topshiriq (uz va en) |

---

## Asosiy qarorlar

**Bo'sh vaqt bitta joyda hisoblanadi.** `availabilityService.js` — yagona manba.
Mini App ham, Voice Agent ham, admin panel ham aynan shuni chaqiradi, shuning uchun
telefon orqali va ilova orqali olingan navbatlar to'qnashmaydi. Ustiga bazada
`(doctorId, startTime)` va `(roomId, startTime)` unikal cheklovlari bor — ikkita
so'rov bir vaqtda kelsa, ikkinchisi rad etiladi.

**AI hech narsani o'zidan to'qib chiqara olmaydi.** Voice Agent 17 ta aniq funksiya
orqali ishlaydi: narx, bo'sh vaqt, shifokor ismi, kabinet — hammasi bazadan keladi.

**AI dan oldin uchta himoya qatlami ishlaydi:**
1. **Shoshilinch holat triaji** — ko'krak og'rig'i, nafas qisilishi, hushdan ketish,
   qon ketish kabi belgilar eshitilsa, navbat olish to'xtaydi, 103 aytiladi va
   qo'ng'iroq operatorga uzatiladi.
2. **Operator so'rovi** — bemor so'rasa, darhol.
3. **Tibbiy savol** — tashxis, dori, tahlil natijasi haqidagi savollar rad etiladi.

**Maxfiylik tibbiy ma'lumot darajasida.** Caller ID ga ishonilmaydi: mavjud navbat
haqida gapirishdan oldin familiya yoki tug'ilgan yil so'raladi. Nozik xizmatlar nomi
SMS/Telegram xabarlarida yozilmaydi. Kim kimning kartochkasini ochgani audit jurnaliga
tushadi. Qo'ng'iroq yozuvlari muddati tugagach avtomatik o'chiriladi.

**Qo'ng'iroq hech qachon jim tugamaydi.** AI ishlamay qolsa, raqamli menyu (DTMF)
ishga tushadi va bemorni baribir navbatga yozadi yoki operatorga ulaydi.

---

## Imkoniyatlar

**Bemor uchun (Mini App + bot)**
- Shifokor, xizmat yoki **shikoyat bo'yicha** yo'naltirish
- Oila profillari — ota-ona farzandi uchun navbat oladi
- Ayol shifokor filtri, yosh chegaralari
- Tayyorgarlik yo'riqnomalari (och qorin, UTT oldidan suv va h.k.)
- Bekor qilish, ko'chirish, "🚗 Yo'ldaman", kutish ro'yxati, kalendarga qo'shish
- O'zbek va rus tili, diskret rejim

**Telefon orqali (AI Voice Agent)**
- 3 soniya ichida javob (oldindan yozilgan salomlashuv)
- Shikoyatdan mutaxassisga marshrutlash, real bo'sh vaqtlarni taklif qilish
- Navbat olish, ko'chirish, bekor qilish, kutish ro'yxatiga yozish
- "ertaga", "to'qqiz yarim", "пол-одиннадцатого" kabi og'zaki ifodalarni tushunish
- Har bir qo'ng'iroq uchun transkript, natija va javob kechikishi jurnalga yoziladi

**Klinika uchun (admin panel)**
- Navbatlar jadval va kun ko'rinishida, qo'ng'iroq transkripti bilan
- Shifokor kalendarini yopish; "kunni bekor qilish" — barcha bemorga avtomatik xabar
- Xizmatlar, kabinetlar, ish vaqti va istisnolar (ta'til, bayram, qo'shimcha kun)
- Bemorlar, kelmaganlik hisobi, kutish ro'yxati
- Dashboard: Voice Agent konversiyasi, no-show foizi, band soatlar xaritasi
- Rollar: SUPERADMIN / ADMIN (registratura) / DOCTOR (faqat o'z bemorlari)

**Avtomatik**
- Eslatmalar: 24 soat oldin (tasdiqlash tugmasi bilan), tayyorgarlik, 2 soat oldin
- Shifokorga kunlik ro'yxat, qabuldan keyin baho so'rash
- Kelmaganlarni belgilash, kutish ro'yxatidan taklif qilish, eski yozuvlarni tozalash

---

## Texnologiyalar

Node.js · Express · Prisma · PostgreSQL · React · Vite · Telegram Bot API ·
Twilio / Asterisk (SIP) · Anthropic API

Telefoniya provayderi almashtiriladigan: `TELEPHONY_PROVIDER=twilio|sip`.

---

## Testlar

```bash
cd backend && npm test
```

54 ta test — telefon formatlari, vaqt zonasi, triaj (shu jumladan noto'g'ri
ishlamasligi kerak bo'lgan holatlar), bandlik, bekor qilish oynasi, ikki marta
band qilish, idempotency, eslatmalarning bir martaligi, Voice Agent senariylari.

---

## Halol ogohlantirishlar

- **Twilio O'zbekiston raqamlarini sotmaydi.** Real ish uchun mahalliy SIP trunk +
  Asterisk kerak. Kod shunga tayyor, lekin Asterisk sozlashni o'zingiz qilasiz.
- **O'zbekcha TTS/STT sifati** ingliz/rus darajasida emas. ElevenLabs bilan ovoz
  yaxshi chiqadi; Twilio ning o'z ovozi o'zbek tilini bilmaydi.
- **Bu tizim tibbiy maslahat bermaydi va tashxis qo'ymaydi.** AI faqat navbat va
  ma'lumot bilan ishlaydi.
