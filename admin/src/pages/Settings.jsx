import { useEffect, useState } from 'react';
import { api, unwrap } from '../lib/api.js';

export default function Settings({ user }) {
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const readOnly = user.role !== 'SUPERADMIN';

  useEffect(() => {
    api.get('/settings').then(unwrap).then(setSettings).catch((e) => setError(e.message));
    if (user.role === 'SUPERADMIN') api.get('/users').then(unwrap).then(setUsers).catch(() => {});
  }, [user.role]);

  if (!settings) return <div>Yuklanmoqda...</div>;

  const set = (key) => (e) => setSettings({ ...settings, [key]: e.target.value });

  const save = async () => {
    setError(null);
    try {
      const payload = { ...settings };
      delete payload.updatedAt;
      await api.patch('/settings', payload);
      setNote('Saqlandi ✅');
      setTimeout(() => setNote(null), 2500);
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <h1>Sozlamalar</h1>
      {error ? <div className="alert error">{error}</div> : null}
      {note ? <div className="alert info">{note}</div> : null}
      {readOnly ? <div className="alert warn">Sozlamalarni faqat SUPERADMIN o'zgartira oladi.</div> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Klinika</h2>
        <label>Nomi</label><input value={settings.clinicName || ''} onChange={set('clinicName')} disabled={readOnly} />
        <label>Telefon</label><input value={settings.phone || ''} onChange={set('phone')} disabled={readOnly} />
        <label>Manzil</label><input value={settings.address || ''} onChange={set('address')} disabled={readOnly} />
        <label>Mo'ljal</label><input value={settings.landmark || ''} onChange={set('landmark')} disabled={readOnly} />
        <label>Ish vaqti (matn)</label><input value={settings.workingHoursText || ''} onChange={set('workingHoursText')} disabled={readOnly} />
        <label>Litsenziya raqami</label><input value={settings.licenseNumber || ''} onChange={set('licenseNumber')} disabled={readOnly} />
        <div className="row">
          <div className="grow"><label>Kenglik (lat)</label><input value={settings.latitude || ''} onChange={set('latitude')} disabled={readOnly} /></div>
          <div className="grow"><label>Uzunlik (lng)</label><input value={settings.longitude || ''} onChange={set('longitude')} disabled={readOnly} /></div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Navbat qoidalari</h2>
        <label>Bekor qilish oynasi (daqiqa)</label>
        <input type="number" value={settings.cancellationWindowMinutes} onChange={set('cancellationWindowMinutes')} disabled={readOnly} />
        <div className="muted small">Bemor shu vaqtdan kam qolganda navbatni o'zi bekor qila olmaydi (Mini App, API va AI — hammasi uchun bir xil).</div>

        <label>Minimal oldindan yozilish (daqiqa)</label>
        <input type="number" value={settings.minLeadTimeMinutes} onChange={set('minLeadTimeMinutes')} disabled={readOnly} />

        <label>Qabullar orasidagi bufer (daqiqa)</label>
        <input type="number" value={settings.appointmentBufferMinutes} onChange={set('appointmentBufferMinutes')} disabled={readOnly} />

        <label>Kelmaganlik chegarasi</label>
        <input type="number" value={settings.noShowThreshold} onChange={set('noShowThreshold')} disabled={readOnly} />
        <div className="muted small">Shu sondan ko'p marta kelmagan bemorga onlayn navbat cheklanadi.</div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Maxfiylik va xavfsizlik</h2>
        <label>Qo'ng'iroq yozuvini saqlash muddati (kun)</label>
        <input type="number" value={settings.recordingRetentionDays} onChange={set('recordingRetentionDays')} disabled={readOnly} />
        <div className="muted small">Muddat tugagach transkript va yozuvlar avtomatik o'chiriladi.</div>

        <label>Shoshilinch yordam raqami</label>
        <input value={settings.emergencyPhone || ''} onChange={set('emergencyPhone')} disabled={readOnly} />

        <label>Operator raqami (AI eskalatsiya qilganda)</label>
        <input value={settings.operatorPhone || ''} onChange={set('operatorPhone')} disabled={readOnly} />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>🚨 Shoshilinch qo'ng'iroqlar</h2>
        <div className="alert info">
          Bemor shoshilinch holat haqida aytsa, AI uni "103 ga qo'ng'iroq qiling" deb
          qaytarmaydi — qo'ng'iroqni shu raqamga ULAYDI va bir vaqtning o'zida
          xodimlarga Telegram orqali xabar yuboradi. Agar bu raqam javob bermasa,
          qayta qo'ng'iroq so'rovi "shoshilinch" belgisi bilan yoziladi.
        </div>

        <label>Navbatchi shifokor raqami</label>
        <input value={settings.emergencyTransferPhone || ''} onChange={set('emergencyTransferPhone')}
               placeholder="Bo'sh bo'lsa operator raqami ishlatiladi" disabled={readOnly} />

        <label>Javob kutish vaqti (soniya)</label>
        <input type="number" value={settings.operatorRingSeconds || 25} onChange={set('operatorRingSeconds')} disabled={readOnly} />

        <label>Ogohlantirish yuboriladigan Telegram ID lar (vergul bilan)</label>
        <input value={settings.emergencyAlertChatIds || ''} onChange={set('emergencyAlertChatIds')}
               placeholder="123456789, 987654321" disabled={readOnly} />
        <div className="muted small">
          Telegram ID ni bilish uchun xodim botga yozsin — ID admin panel logida ko'rinadi.
          Shifokorlarning Telegram ID si kiritilgan bo'lsa, ularga ham avtomatik boradi.
        </div>
      </div>

      {!readOnly ? <button className="btn" onClick={save}>Saqlash</button> : null}

      {user.role === 'SUPERADMIN' ? (
        <>
          <h2>Foydalanuvchilar</h2>
          <table>
            <thead><tr><th>Login</th><th>Ism</th><th>Rol</th><th>Oxirgi kirish</th><th>Holat</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.login}</b></td>
                  <td>{u.fullName}</td>
                  <td><span className="badge blue">{u.role}</span></td>
                  <td className="small">{u.lastLoginAt ? dt(u.lastLoginAt) : '—'}</td>
                  <td>{u.isActive ? <span className="badge green">Faol</span> : <span className="badge red">Nofaol</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
