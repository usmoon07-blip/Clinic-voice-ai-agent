import { useEffect, useState } from 'react';
import { api, unwrap, dt, dateOnly } from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';

export default function Patients({ user }) {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api.get('/patients', { params: { query: query || undefined } })
    .then(unwrap).then(setPatients).catch((e) => setError(e.message));

  useEffect(() => { const id = setTimeout(load, 300); return () => clearTimeout(id); }, [query]);

  const open = async (id) => {
    const data = await api.get(`/patients/${id}`).then(unwrap);
    setDetail(data);
  };

  const update = async (patch) => {
    await api.patch(`/patients/${detail.id}`, patch);
    open(detail.id);
    load();
  };

  return (
    <div>
      <h1>Bemorlar</h1>
      {error ? <div className="alert error">{error}</div> : null}

      <div className="filters">
        <div className="grow">
          <label>Qidiruv (ism, telefon, kartochka raqami)</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Karimov / 901234567 / MC-2026-000001" />
        </div>
      </div>

      <table>
        <thead><tr><th>Ism</th><th>Telefon</th><th>Kartochka</th><th>Tug'ilgan</th><th>Kelmagan</th><th>Manba</th></tr></thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => open(p.id)}>
              <td><b>{p.firstName} {p.lastName || ''}</b>{p.isBlacklisted ? <span className="badge red">Qora ro'yxat</span> : null}</td>
              <td className="small">{p.phone}</td>
              <td className="small">{p.medicalCardNumber}</td>
              <td className="small">{p.birthDate ? dateOnly(p.birthDate) : '—'}</td>
              <td>{p.noShowCount > 0 ? <span className="badge red">{p.noShowCount}</span> : '0'}</td>
              <td className="small">{p.source}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail ? (
        <Modal title={`${detail.firstName} ${detail.lastName || ''}`} onClose={() => setDetail(null)}>
          <div className="row wrap">
            <span className="badge">{detail.phone}</span>
            <span className="badge">{detail.medicalCardNumber}</span>
            {detail.birthDate ? <span className="badge">{dateOnly(detail.birthDate)}</span> : null}
            <span className="badge">{detail.language}</span>
            {detail.discreetMode ? <span className="badge amber">Diskret rejim</span> : null}
          </div>

          {detail.noShowCount > 0 ? (
            <div className="alert warn mt">
              Kelmagan: {detail.noShowCount} marta.
              {user.role !== 'DOCTOR' ? (
                <button className="btn secondary" style={{ marginLeft: 10 }} onClick={() => update({ resetNoShow: true })}>
                  Hisobni nolga tushirish
                </button>
              ) : null}
            </div>
          ) : null}

          {user.role !== 'DOCTOR' ? (
            <>
              <label>Admin izohi</label>
              <textarea rows={2} defaultValue={detail.adminNote || ''} onBlur={(e) => update({ adminNote: e.target.value })} />
              <div className="row mt">
                <button className={`btn ${detail.isBlacklisted ? 'secondary' : 'danger'}`}
                        onClick={() => update({ isBlacklisted: !detail.isBlacklisted })}>
                  {detail.isBlacklisted ? 'Qora ro\'yxatdan chiqarish' : 'Qora ro\'yxatga qo\'shish'}
                </button>
              </div>
            </>
          ) : null}

          {detail.familyMembers?.length ? (
            <>
              <h2>Oila a'zolari</h2>
              <table>
                <tbody>
                  {detail.familyMembers.map((m) => (
                    <tr key={m.id}>
                      <td>{m.firstName} {m.lastName || ''}</td>
                      <td className="small">{m.relationToGuardian}</td>
                      <td className="small">{m.birthDate ? dateOnly(m.birthDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <h2>Navbatlar tarixi</h2>
          <table>
            <tbody>
              {detail.appointments.map((a) => (
                <tr key={a.id}>
                  <td className="small">{dt(a.startTime)}</td>
                  <td className="small">{a.doctor.firstName} {a.doctor.lastName}</td>
                  <td className="small">{a.service.nameUz}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
              {detail.appointments.length === 0 ? <tr><td className="muted">Navbat yo'q</td></tr> : null}
            </tbody>
          </table>
        </Modal>
      ) : null}
    </div>
  );
}
