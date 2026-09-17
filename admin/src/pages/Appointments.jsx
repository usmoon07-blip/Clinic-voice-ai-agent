import { useEffect, useMemo, useState } from 'react';
import { api, unwrap, money, timeOnly, dateKey, dt } from '../lib/api.js';
import { StatusBadge, SourceBadge } from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

const STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export default function Appointments({ user }) {
  const [date, setDate] = useState(dateKey());
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('table');
  const [items, setItems] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [creating, setCreating] = useState(null);
  const [slots, setSlots] = useState([]);

  const load = () => {
    api.get('/appointments', { params: { date, status: status || undefined, query: query || undefined } })
      .then(unwrap).then(setItems).catch((e) => setError(e.message));
  };

  useEffect(load, [date, status, query]);
  useEffect(() => {
    api.get('/doctors').then(unwrap).then(setDoctors).catch(() => {});
    api.get('/services').then(unwrap).then(setServices).catch(() => {});
  }, []);

  const changeStatus = async (id, next) => {
    setError(null);
    try {
      await api.patch(`/appointments/${id}/status`, { status: next });
      load();
    } catch (e) { setError(e.message); }
  };

  const openTranscript = async (callLogId) => {
    const call = await api.get(`/calls/${callLogId}`).then(unwrap);
    setTranscript(call);
  };

  const byDoctor = useMemo(() => {
    const map = {};
    for (const a of items) {
      const key = `${a.doctor.firstName} ${a.doctor.lastName}`;
      (map[key] = map[key] || []).push(a);
    }
    return map;
  }, [items]);

  const loadSlots = async (form) => {
    if (!form.serviceId || !form.date) return;
    const res = await api.get('/appointments/slots', {
      params: { serviceId: form.serviceId, doctorId: form.doctorId || undefined, date: form.date },
    }).then(unwrap);
    setSlots(res.slots);
  };

  const createAppointment = async () => {
    setError(null);
    try {
      await api.post('/appointments', {
        phone: creating.phone,
        firstName: creating.firstName,
        lastName: creating.lastName,
        birthDate: creating.birthDate || undefined,
        doctorId: creating.slot.doctorId,
        serviceId: creating.serviceId,
        startTime: creating.slot.startUtc,
        note: creating.note,
      });
      setCreating(null);
      setSlots([]);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="between">
        <h1>Navbatlar</h1>
        {user.role !== 'DOCTOR' ? (
          <button className="btn" onClick={() => setCreating({ date: dateKey(), firstName: '', phone: '' })}>
            + Qo'lda yozish
          </button>
        ) : null}
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <div className="filters">
        <div><label>Sana</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Hammasi</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="grow"><label>Qidiruv (ism yoki telefon)</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Karimov yoki 901234567" />
        </div>
        <div style={{ minWidth: 'auto' }}>
          <label>Ko'rinish</label>
          <div className="row">
            <button className={`btn ${view === 'table' ? '' : 'secondary'}`} onClick={() => setView('table')}>Jadval</button>
            <button className={`btn ${view === 'day' ? '' : 'secondary'}`} onClick={() => setView('day')}>Kun</button>
          </div>
        </div>
      </div>

      {view === 'day' ? (
        <div className="timeline">
          {Object.entries(byDoctor).map(([doctor, list]) => (
            <div className="col card" key={doctor}>
              <h3>{doctor}</h3>
              {list.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).map((a) => (
                <div key={a.id} className={`slot ${a.status === 'CANCELLED' ? 'cancelled' : ''} ${a.status === 'NO_SHOW' ? 'noshow' : ''}`}>
                  <b>{timeOnly(a.startTime)}</b> {a.patient.firstName} {a.patient.lastName || ''}
                  <div className="muted small">{a.service.nameUz}{a.room ? ` · ${a.room.name}` : ''}</div>
                  {a.onTheWay ? <span className="badge green">🚗 Yo'lda</span> : null}
                </div>
              ))}
              {list.length === 0 ? <div className="muted small">Navbat yo'q</div> : null}
            </div>
          ))}
          {items.length === 0 ? <div className="muted">Bu kunda navbat yo'q</div> : null}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Vaqt</th><th>Bemor</th><th>Telefon</th><th>Shifokor</th><th>Xizmat</th>
              <th>Kabinet</th><th>Narx</th><th>Manba</th><th>Status</th><th>Amal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className={a.onTheWay ? 'clickable' : ''}>
                <td><b>{timeOnly(a.startTime)}</b></td>
                <td>
                  {a.patient.firstName} {a.patient.lastName || ''}
                  {a.onTheWay ? <div><span className="badge green">🚗 Yo'lda</span></div> : null}
                  {a.patient.noShowCount > 0 ? <div className="badge red">Kelmagan: {a.patient.noShowCount}</div> : null}
                </td>
                <td className="small">{a.patient.phone}</td>
                <td>{a.doctor.firstName} {a.doctor.lastName}</td>
                <td className="small">{a.service.nameUz}</td>
                <td className="small">{a.room?.name || '—'}</td>
                <td className="small">{money(a.price)}</td>
                <td>
                  <SourceBadge source={a.source} />
                  {a.callLog ? (
                    <div><button className="btn secondary small mt" onClick={() => openTranscript(a.callLog.id)}>Transkript</button></div>
                  ) : null}
                </td>
                <td><StatusBadge status={a.status} /></td>
                <td>
                  <select value={a.status} onChange={(e) => changeStatus(a.id, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 ? <tr><td colSpan={10} className="muted center">Navbat topilmadi</td></tr> : null}
          </tbody>
        </table>
      )}

      {transcript ? (
        <Modal title={`Qo'ng'iroq #${transcript.id}`} onClose={() => setTranscript(null)}>
          <div className="row wrap">
            <span className="badge">{transcript.phone}</span>
            <span className="badge">{dt(transcript.startedAt)}</span>
            <span className="badge">{transcript.durationSec ?? '—'} s</span>
            <span className="badge">{transcript.detectedLanguage}</span>
            {transcript.avgLatencyMs ? <span className="badge">{(transcript.avgLatencyMs / 1000).toFixed(1)}s kechikish</span> : null}
          </div>
          <div className="transcript mt">{transcript.transcript || 'Transkript saqlanmagan (muddati o\'tgan).'}</div>
        </Modal>
      ) : null}

      {creating ? (
        <Modal
          title="Qo'lda navbat yozish"
          onClose={() => { setCreating(null); setSlots([]); }}
          footer={<button className="btn" disabled={!creating.slot || !creating.firstName || !creating.phone} onClick={createAppointment}>Saqlash</button>}
        >
          <label>Ism *</label>
          <input value={creating.firstName} onChange={(e) => setCreating({ ...creating, firstName: e.target.value })} />
          <label>Familiya</label>
          <input value={creating.lastName || ''} onChange={(e) => setCreating({ ...creating, lastName: e.target.value })} />
          <label>Telefon *</label>
          <input value={creating.phone} onChange={(e) => setCreating({ ...creating, phone: e.target.value })} placeholder="901234567" />
          <label>Tug'ilgan sana</label>
          <input type="date" value={creating.birthDate || ''} onChange={(e) => setCreating({ ...creating, birthDate: e.target.value })} />

          <label>Xizmat *</label>
          <select value={creating.serviceId || ''} onChange={(e) => {
            const next = { ...creating, serviceId: Number(e.target.value), slot: null };
            setCreating(next); loadSlots(next);
          }}>
            <option value="">— tanlang —</option>
            {services.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.nameUz}</option>)}
          </select>

          <label>Shifokor</label>
          <select value={creating.doctorId || ''} onChange={(e) => {
            const next = { ...creating, doctorId: e.target.value ? Number(e.target.value) : null, slot: null };
            setCreating(next); loadSlots(next);
          }}>
            <option value="">Farqi yo'q</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
          </select>

          <label>Sana</label>
          <input type="date" value={creating.date} onChange={(e) => {
            const next = { ...creating, date: e.target.value, slot: null };
            setCreating(next); loadSlots(next);
          }} />

          <label>Bo'sh vaqtlar</label>
          <div className="row wrap">
            {slots.map((s) => (
              <button
                key={`${s.doctorId}-${s.startUtc}`}
                className={`btn ${creating.slot?.startUtc === s.startUtc && creating.slot?.doctorId === s.doctorId ? '' : 'secondary'}`}
                onClick={() => setCreating({ ...creating, slot: s })}
              >
                {s.time} · {s.doctorName.split(' ')[0]}
              </button>
            ))}
            {slots.length === 0 ? <span className="muted small">Bo'sh vaqt yo'q</span> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
