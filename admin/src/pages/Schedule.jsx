import { useEffect, useState } from 'react';
import { api, unwrap, dateKey, dateOnly } from '../lib/api.js';

const DAYS = [
  { n: 1, label: 'Dushanba' }, { n: 2, label: 'Seshanba' }, { n: 3, label: 'Chorshanba' },
  { n: 4, label: 'Payshanba' }, { n: 5, label: 'Juma' }, { n: 6, label: 'Shanba' }, { n: 7, label: 'Yakshanba' },
];
const EXCEPTION_TYPES = [
  { v: 'DAY_OFF', label: 'Dam olish kuni' },
  { v: 'VACATION', label: "Ta'til" },
  { v: 'HOLIDAY', label: 'Bayram' },
  { v: 'EXTRA_WORKING_DAY', label: "Qo'shimcha ish kuni" },
];

export default function Schedule({ user }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(user.role === 'DOCTOR' ? user.doctorId : '');
  const [hours, setHours] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [newException, setNewException] = useState({ date: dateKey(), type: 'DAY_OFF', note: '' });
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => { api.get('/doctors').then(unwrap).then(setDoctors).catch(() => {}); }, []);

  const load = () => {
    if (!doctorId) return;
    api.get('/working-hours', { params: { doctorId } }).then(unwrap).then((d) => {
      const byDay = DAYS.map((day) => d.hours.find((h) => h.dayOfWeek === day.n) || {
        dayOfWeek: day.n, startTime: '09:00', endTime: '17:00', breakStart: '13:00', breakEnd: '14:00', isWorking: day.n <= 5,
      });
      setHours(byDay);
      setExceptions(d.exceptions);
    }).catch((e) => setError(e.message));
  };
  useEffect(load, [doctorId]);

  const save = async () => {
    setError(null);
    try {
      await api.post('/working-hours', { doctorId, hours });
      setNote('Ish vaqti saqlandi ✅');
      setTimeout(() => setNote(null), 2500);
    } catch (e) { setError(e.message); }
  };

  const addException = async () => {
    setError(null);
    try {
      await api.post('/exceptions', { doctorId, ...newException });
      setNewException({ date: dateKey(), type: 'DAY_OFF', note: '' });
      load();
    } catch (e) { setError(e.message); }
  };

  const removeException = async (id) => {
    await api.delete(`/exceptions/${id}`);
    load();
  };

  const setField = (index, field, value) => {
    const next = [...hours];
    next[index] = { ...next[index], [field]: value };
    setHours(next);
  };

  return (
    <div>
      <h1>Ish vaqti</h1>
      {error ? <div className="alert error">{error}</div> : null}
      {note ? <div className="alert info">{note}</div> : null}

      {user.role !== 'DOCTOR' ? (
        <div className="filters">
          <div className="grow">
            <label>Shifokor</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">— tanlang —</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      {doctorId ? (
        <>
          <table>
            <thead><tr><th>Kun</th><th>Ishlaydi</th><th>Boshlanish</th><th>Tugash</th><th>Tanaffus (dan)</th><th>Tanaffus (gacha)</th></tr></thead>
            <tbody>
              {hours.map((h, i) => (
                <tr key={h.dayOfWeek}>
                  <td>{DAYS[i].label}</td>
                  <td><input type="checkbox" style={{ width: 16 }} checked={h.isWorking} onChange={(e) => setField(i, 'isWorking', e.target.checked)} /></td>
                  <td><input type="time" value={h.startTime} onChange={(e) => setField(i, 'startTime', e.target.value)} /></td>
                  <td><input type="time" value={h.endTime} onChange={(e) => setField(i, 'endTime', e.target.value)} /></td>
                  <td><input type="time" value={h.breakStart || ''} onChange={(e) => setField(i, 'breakStart', e.target.value)} /></td>
                  <td><input type="time" value={h.breakEnd || ''} onChange={(e) => setField(i, 'breakEnd', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn mt" onClick={save}>Saqlash</button>

          <h2>Istisnolar (ta'til, bayram, qo'shimcha kun)</h2>
          <div className="card row wrap">
            <div><label>Sana</label><input type="date" value={newException.date} onChange={(e) => setNewException({ ...newException, date: e.target.value })} /></div>
            <div><label>Turi</label>
              <select value={newException.type} onChange={(e) => setNewException({ ...newException, type: e.target.value })}>
                {EXCEPTION_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
            {newException.type === 'EXTRA_WORKING_DAY' ? (
              <>
                <div><label>Boshlanish</label><input type="time" value={newException.startTime || '09:00'} onChange={(e) => setNewException({ ...newException, startTime: e.target.value })} /></div>
                <div><label>Tugash</label><input type="time" value={newException.endTime || '13:00'} onChange={(e) => setNewException({ ...newException, endTime: e.target.value })} /></div>
              </>
            ) : null}
            <div className="grow"><label>Izoh</label><input value={newException.note} onChange={(e) => setNewException({ ...newException, note: e.target.value })} /></div>
            <div><label>&nbsp;</label><button className="btn" onClick={addException}>Qo'shish</button></div>
          </div>

          <table>
            <thead><tr><th>Sana</th><th>Turi</th><th>Izoh</th><th>Amal</th></tr></thead>
            <tbody>
              {exceptions.map((e) => (
                <tr key={e.id}>
                  <td>{dateOnly(e.date)}</td>
                  <td>{EXCEPTION_TYPES.find((t) => t.v === e.type)?.label || e.type}</td>
                  <td className="small">{e.note || '—'}</td>
                  <td><button className="btn danger" onClick={() => removeException(e.id)}>O'chirish</button></td>
                </tr>
              ))}
              {exceptions.length === 0 ? <tr><td colSpan={4} className="muted center">Istisno yo'q</td></tr> : null}
            </tbody>
          </table>
        </>
      ) : <div className="muted">Shifokorni tanlang</div>}
    </div>
  );
}
