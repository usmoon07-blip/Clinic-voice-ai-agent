import { useEffect, useState } from 'react';
import { api, unwrap, money, dateKey } from '../lib/api.js';
import Modal from '../components/Modal.jsx';

export default function Doctors({ user }) {
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [services, setServices] = useState([]);
  const [edit, setEdit] = useState(null);
  const [cancelDay, setCancelDay] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const load = () => api.get('/doctors').then(unwrap).then(setDoctors).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.get('/specialties').then(unwrap).then(setSpecialties).catch(() => {});
    api.get('/services').then(unwrap).then(setServices).catch(() => {});
  }, []);

  const toggleCalendar = async (doctor) => {
    setError(null);
    try {
      const reason = doctor.calendarStatus === 'OPEN'
        ? window.prompt('Kalendarni yopish sababi (ixtiyoriy):') || null
        : null;
      await api.post(`/doctors/${doctor.id}/calendar-toggle`, { reason });
      load();
    } catch (e) { setError(e.message); }
  };

  const save = async () => {
    setError(null);
    const payload = {
      firstName: edit.firstName, lastName: edit.lastName, specialtyId: Number(edit.specialtyId),
      gender: edit.gender, category: edit.category, experienceYears: Number(edit.experienceYears || 0),
      licenseNumber: edit.licenseNumber, bioUz: edit.bioUz, bioRu: edit.bioRu,
      minAge: Number(edit.minAge || 0), maxAge: Number(edit.maxAge || 120),
      firstVisitPrice: Number(edit.firstVisitPrice || 0), followUpPrice: Number(edit.followUpPrice || 0),
      telegramId: edit.telegramId || null, phone: edit.phone || null,
      isActive: edit.isActive !== false,
      serviceIds: edit.serviceIds || [],
    };
    try {
      if (edit.id) await api.patch(`/doctors/${edit.id}`, payload);
      else await api.post('/doctors', payload);
      setEdit(null);
      load();
    } catch (e) { setError(e.message); }
  };

  const doCancelDay = async () => {
    setError(null);
    try {
      const res = await api.post(`/doctors/${cancelDay.doctor.id}/cancel-day`, {
        date: cancelDay.date, reason: cancelDay.reason,
      }).then(unwrap);
      setNote(`${res.cancelled} ta navbat bekor qilindi, bemorlarga xabar yuborildi.`);
      setCancelDay(null);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="between">
        <h1>Shifokorlar</h1>
        {user.role !== 'DOCTOR' ? (
          <button className="btn" onClick={() => setEdit({ gender: 'MALE', minAge: 18, maxAge: 120, serviceIds: [] })}>+ Qo'shish</button>
        ) : null}
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {note ? <div className="alert info">{note}</div> : null}

      <table>
        <thead>
          <tr><th>Ism</th><th>Mutaxassislik</th><th>Tajriba</th><th>Narx</th><th>Yosh</th><th>Kalendar</th><th>Amal</th></tr>
        </thead>
        <tbody>
          {doctors.map((d) => (
            <tr key={d.id}>
              <td>
                <b>{d.firstName} {d.lastName}</b>
                <div className="muted small">{d.gender === 'FEMALE' ? '👩‍⚕️ ayol' : '👨‍⚕️ erkak'}{d.category ? ` · ${d.category}` : ''}</div>
                {!d.isActive ? <span className="badge red">Nofaol</span> : null}
              </td>
              <td>{d.specialty?.nameUz}</td>
              <td>{d.experienceYears} yil</td>
              <td className="small">{money(d.firstVisitPrice)}<div className="muted">takroriy: {money(d.followUpPrice)}</div></td>
              <td className="small">{d.minAge}–{d.maxAge}</td>
              <td>
                <button
                  className={`btn ${d.calendarStatus === 'OPEN' ? 'secondary' : 'danger'}`}
                  onClick={() => toggleCalendar(d)}
                >
                  {d.calendarStatus === 'OPEN' ? '🟢 Ochiq' : '🔴 Yopiq'}
                </button>
                {d.calendarClosedReason ? <div className="muted small">{d.calendarClosedReason}</div> : null}
              </td>
              <td>
                <div className="row wrap">
                  <button className="btn secondary" onClick={() => setEdit({ ...d, specialtyId: d.specialtyId, serviceIds: d.services?.map((s) => s.id) || [] })}>Tahrirlash</button>
                  <button className="btn danger" onClick={() => setCancelDay({ doctor: d, date: dateKey(), reason: '' })}>Kunni bekor qilish</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit ? (
        <Modal title={edit.id ? 'Shifokorni tahrirlash' : 'Yangi shifokor'} onClose={() => setEdit(null)}
               footer={<button className="btn" onClick={save}>Saqlash</button>}>
          <div className="row">
            <div className="grow"><label>Ism</label><input value={edit.firstName || ''} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} /></div>
            <div className="grow"><label>Familiya</label><input value={edit.lastName || ''} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} /></div>
          </div>
          <label>Mutaxassislik</label>
          <select value={edit.specialtyId || ''} onChange={(e) => setEdit({ ...edit, specialtyId: e.target.value })}>
            <option value="">— tanlang —</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.nameUz}</option>)}
          </select>
          <div className="row">
            <div className="grow"><label>Jinsi</label>
              <select value={edit.gender} onChange={(e) => setEdit({ ...edit, gender: e.target.value })}>
                <option value="MALE">Erkak</option><option value="FEMALE">Ayol</option>
              </select>
            </div>
            <div className="grow"><label>Tajriba (yil)</label><input type="number" value={edit.experienceYears || 0} onChange={(e) => setEdit({ ...edit, experienceYears: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="grow"><label>Min yosh</label><input type="number" value={edit.minAge} onChange={(e) => setEdit({ ...edit, minAge: e.target.value })} /></div>
            <div className="grow"><label>Max yosh</label><input type="number" value={edit.maxAge} onChange={(e) => setEdit({ ...edit, maxAge: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="grow"><label>Birlamchi qabul narxi</label><input type="number" value={edit.firstVisitPrice || 0} onChange={(e) => setEdit({ ...edit, firstVisitPrice: e.target.value })} /></div>
            <div className="grow"><label>Takroriy qabul narxi</label><input type="number" value={edit.followUpPrice || 0} onChange={(e) => setEdit({ ...edit, followUpPrice: e.target.value })} /></div>
          </div>
          <label>Toifa / daraja</label>
          <input value={edit.category || ''} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
          <label>Litsenziya raqami</label>
          <input value={edit.licenseNumber || ''} onChange={(e) => setEdit({ ...edit, licenseNumber: e.target.value })} />
          <label>Telegram ID (bildirishnoma uchun)</label>
          <input value={edit.telegramId || ''} onChange={(e) => setEdit({ ...edit, telegramId: e.target.value })} />
          <label>Bio (uz)</label>
          <textarea rows={2} value={edit.bioUz || ''} onChange={(e) => setEdit({ ...edit, bioUz: e.target.value })} />

          <label>Bajaradigan xizmatlar</label>
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 9, padding: 10 }}>
            {services.map((s) => (
              <label key={s.id} className="row" style={{ margin: '4px 0', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  style={{ width: 16 }}
                  checked={(edit.serviceIds || []).includes(s.id)}
                  onChange={(e) => {
                    const ids = new Set(edit.serviceIds || []);
                    if (e.target.checked) ids.add(s.id); else ids.delete(s.id);
                    setEdit({ ...edit, serviceIds: [...ids] });
                  }}
                />
                <span>{s.nameUz}</span>
              </label>
            ))}
          </div>
        </Modal>
      ) : null}

      {cancelDay ? (
        <Modal
          title={`${cancelDay.doctor.firstName} — kunni bekor qilish`}
          onClose={() => setCancelDay(null)}
          footer={<button className="btn danger" onClick={doCancelDay}>Bekor qilish va bemorlarga xabar berish</button>}
        >
          <div className="alert warn">
            Tanlangan kundagi barcha navbatlar bekor qilinadi va har bir bemorga
            avtomatik xabar yuboriladi.
          </div>
          <label>Sana</label>
          <input type="date" value={cancelDay.date} onChange={(e) => setCancelDay({ ...cancelDay, date: e.target.value })} />
          <label>Sabab</label>
          <input value={cancelDay.reason} onChange={(e) => setCancelDay({ ...cancelDay, reason: e.target.value })} placeholder="Kasallik, ta'til..." />
        </Modal>
      ) : null}
    </div>
  );
}
