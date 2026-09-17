import { useState } from 'react';
import { api, unwrap, telegram } from '../lib/api.js';
import { useLang } from '../lib/i18n.js';

/** Birinchi marta kelgan bemordan ism + telefon + tug'ilgan sana so'raladi. */
export default function ProfileForm({ onSaved }) {
  const { t, lang, setPatient } = useLang();
  const tgUser = telegram.user;
  const [form, setForm] = useState({
    firstName: tgUser?.first_name || '',
    lastName: tgUser?.last_name || '',
    phone: '',
    birthDate: '',
    gender: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async () => {
    setError(null);
    if (!form.firstName.trim() || !form.phone.trim()) {
      setError(t.required);
      return;
    }
    setBusy(true);
    try {
      const saved = await api.post('/profile', { ...form, language: lang, gender: form.gender || undefined }).then(unwrap);
      setPatient(saved);
      onSaved?.(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h3>{t.fillProfile}</h3>
      {error ? <div className="alert error mt" style={{ margin: '10px 0 0' }}>{error}</div> : null}

      <label>{t.firstName}</label>
      <input value={form.firstName} onChange={set('firstName')} />

      <label>{t.lastName}</label>
      <input value={form.lastName} onChange={set('lastName')} />

      <label>{t.phone}</label>
      <input value={form.phone} onChange={set('phone')} placeholder="90 123 45 67" inputMode="tel" />

      <label>{t.birthDate}</label>
      <input type="date" value={form.birthDate} onChange={set('birthDate')} />

      <button className="btn mt" onClick={submit} disabled={busy}>
        {busy ? t.loading : t.save}
      </button>
    </div>
  );
}
