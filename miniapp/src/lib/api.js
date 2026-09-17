import axios from 'axios';

const tg = window.Telegram?.WebApp;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/client',
  timeout: 15000,
});

// Har bir so'rovga Telegram initData qo'shiladi — server imzoni tekshiradi
api.interceptors.request.use((config) => {
  if (tg?.initData) {
    config.headers['X-Telegram-Init-Data'] = tg.initData;
  } else if (import.meta.env.VITE_DEV_TELEGRAM_ID) {
    // Faqat brauzerda test qilish uchun (backend dev rejimida qabul qiladi)
    config.headers['X-Dev-Telegram-Id'] = import.meta.env.VITE_DEV_TELEGRAM_ID;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const data = error.response?.data;
    const message = data?.error?.message || error.message || 'Xatolik yuz berdi';
    return Promise.reject(Object.assign(new Error(message), { code: data?.error?.code, raw: data }));
  },
);

export const unwrap = (res) => res.data.data;

export const telegram = {
  ready() {
    tg?.ready();
    tg?.expand();
  },
  user: tg?.initDataUnsafe?.user || null,
  haptic(style = 'light') {
    try { tg?.HapticFeedback?.impactOccurred(style); } catch { /* ignore */ }
  },
  close() { tg?.close(); },
  isTelegram: Boolean(tg?.initData),
};
