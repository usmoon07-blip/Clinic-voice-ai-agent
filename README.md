# Clinic Voice AI Agent — Prompt

Ko'p profilli klinika uchun **AI Voice Agent + Telegram Mini App navbat tizimi** ni
noldan qurdirish uchun tayyor texnik topshiriq (prompt).

## Fayllar

- [`prompts/clinic-voice-ai-agent-prompt-uz.md`](prompts/clinic-voice-ai-agent-prompt-uz.md)
  — to'liq prompt (o'zbek tilida). AI dasturchiga (Claude Code / Cursor / ChatGPT)
  o'zgartirmasdan nusxalab beriladi.

## Qanday ishlatiladi

1. Promptni oching va kvadrat qavsdagi `[Klinika nomi]` kabi joylarni o'zingiznikiga almashtiring.
2. Kerak bo'lmagan bo'limlarni olib tashlang (masalan stomatologiya yo'q bo'lsa).
3. To'liq matnni AI dasturchiga yuboring. U avval sizdan kalitlarni so'raydi
   (Neon DB, BotFather token, telefoniya, STT/TTS, AI model), keyin kod yozadi.

## Tizim tarkibi

| Qism | Vazifasi |
|---|---|
| Telegram Mini App | Bemor navbat oladi, ko'chiradi, bekor qiladi |
| Admin panel | Registratura, shifokorlar, jadval, qo'ng'iroqlar tarixi |
| Node.js backend | Bot, API, navbat logikasi, eslatmalar |
| AI Voice Agent | Telefonga javob berib, suhbat orqali navbatga yozadi |

## Asosiy printsiplar

- AI tashxis qo'ymaydi, dori tavsiya qilmaydi — faqat navbat va ma'lumot.
- Shoshilinch belgi eshitilsa — 103 va operatorga uzatish.
- Bo'sh vaqtni hisoblash logikasi yagona joyda (telefon va ilova to'qnashmasligi uchun).
- Tibbiy ma'lumot maxfiyligi: rollar, audit jurnali, diskret rejim.
