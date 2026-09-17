import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/admin',
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clinic_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('clinic_admin_token');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    const data = error.response?.data;
    const message = data?.error?.message || error.message;
    return Promise.reject(Object.assign(new Error(message), { code: data?.error?.code }));
  },
);

export const unwrap = (res) => res.data.data;

export const money = (v) => `${Number(v || 0).toLocaleString('ru-RU')} so'm`;

/* Klinika Toshkentda — admin panel vaqtni har doim Asia/Tashkent bo'yicha
   ko'rsatadi, xodim qayerdan kirganidan qat'i nazar. */
export const TZ = 'Asia/Tashkent';

export const dt = (value, opts = {}) =>
  new Date(value).toLocaleString('ru-RU', {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', ...opts,
  });

export const dateOnly = (value) =>
  new Date(value).toLocaleDateString('ru-RU', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });

export const timeOnly = (value) =>
  new Date(value).toLocaleTimeString('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

/** Toshkent kuni "YYYY-MM-DD" ko'rinishida (filtrlar uchun). */
export const dateKey = (d = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
