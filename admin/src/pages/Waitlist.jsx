import { useEffect, useState } from 'react';
import { api, unwrap, dt, dateOnly } from '../lib/api.js';

export default function Waitlist() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  const load = () => api.get('/waitlist').then(unwrap).then(setItems).catch((e) => setError(e.message));
  useEffect(load, []);

  const remove = async (id) => { await api.delete(`/waitlist/${id}`); load(); };

  return (
    <div>
      <h1>Kutish ro'yxati</h1>
      <div className="alert info">
        Navbat bekor qilinganda yoki yangi joy ochilganda, ro'yxatdagi birinchi mos bemorga
        avtomatik taklif yuboriladi. 30 daqiqa ichida javob bo'lmasa — keyingisiga o'tadi.
      </div>
      {error ? <div className="alert error">{error}</div> : null}

      <table>
        <thead><tr><th>Bemor</th><th>Xizmat</th><th>Shifokor</th><th>Oraliq</th><th>Vaqt</th><th>Holat</th><th>Amal</th></tr></thead>
        <tbody>
          {items.map((w) => (
            <tr key={w.id}>
              <td><b>{w.patient.firstName} {w.patient.lastName || ''}</b><div className="muted small">{w.patient.phone}</div></td>
              <td className="small">{w.service?.nameUz || w.specialty?.nameUz || '—'}</td>
              <td className="small">{w.doctor ? `${w.doctor.firstName} ${w.doctor.lastName}` : 'Farqi yo\'q'}</td>
              <td className="small">{dateOnly(w.dateFrom)} — {dateOnly(w.dateTo)}</td>
              <td className="small">{w.preferredPartOfDay}</td>
              <td>
                <span className={`badge ${w.status === 'OFFERED' ? 'amber' : ''}`}>{w.status}</span>
                {w.offeredSlot ? <div className="muted small">{dt(w.offeredSlot)}</div> : null}
              </td>
              <td><button className="btn danger" onClick={() => remove(w.id)}>O'chirish</button></td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={7} className="muted center">Kutish ro'yxati bo'sh</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
