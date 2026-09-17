import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../lib/api.js';
import { useLang, localized, money } from '../lib/i18n.js';
import ServiceSheet from '../components/ServiceSheet.jsx';
import ComplaintSearch from '../components/ComplaintSearch.jsx';

export default function Home() {
  const { t, lang, patient, clinic } = useLang();
  const navigate = useNavigate();
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [upcoming, setUpcoming] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [complaint, setComplaint] = useState(false);

  useEffect(() => {
    api.get('/specialties').then(unwrap).then(setSpecialties).catch(() => {});
    api.get('/doctors').then(unwrap).then((d) => setDoctors(d.slice(0, 10))).catch(() => {});
    api.get('/services').then(unwrap).then((s) => setServices(s.slice(0, 4))).catch(() => {});
    if (patient) {
      api.get('/appointments').then(unwrap)
        .then((list) => setUpcoming(list.find((a) => ['PENDING', 'CONFIRMED'].includes(a.status) && a.minutesLeft > -30) || null))
        .catch(() => {});
    }
  }, [patient]);

  return (
    <div>
      <div className="page">
        <h1>{t.hi}{patient ? `, ${patient.firstName}` : ''} 👋</h1>
        <p className="muted">{t.howCanWeHelp}</p>
      </div>

      <div className="grid2">
        <button className="card flat" style={{ margin: 0 }} onClick={() => navigate('/booking')}>
          <div style={{ fontSize: 22 }}>👨‍⚕️</div>
          <div className="small">{t.byDoctor}</div>
        </button>
        <button className="card flat" style={{ margin: 0 }} onClick={() => navigate('/services')}>
          <div style={{ fontSize: 22 }}>🩺</div>
          <div className="small">{t.byService}</div>
        </button>
      </div>
      <div className="grid2 mt">
        <button className="card flat tinted" style={{ margin: 0, gridColumn: '1 / -1' }} onClick={() => setComplaint(true)}>
          <div style={{ fontSize: 22 }}>💬</div>
          <div className="small">{t.byComplaint}</div>
        </button>
      </div>

      {upcoming ? (
        <>
          <h2>{t.upcoming}</h2>
          <div className="card tinted">
            <div className="between">
              <div>
                <h3>{new Date(upcoming.startTime).toLocaleString(lang === 'RU' ? 'ru-RU' : 'uz-UZ', {
                  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                })}</h3>
                <p className="muted small">
                  {upcoming.doctor.firstName} {upcoming.doctor.lastName}
                  {upcoming.room ? ` · ${upcoming.room.name}` : ''}
                </p>
              </div>
              <span className="badge green">{t.status[upcoming.status]}</span>
            </div>
            <button className="btn secondary mt" onClick={() => navigate('/appointments')}>
              {t.myAppointments}
            </button>
          </div>
        </>
      ) : null}

      <h2>{t.specialties}</h2>
      <div className="scroll-x">
        {specialties.map((s) => (
          <button
            key={s.id}
            className="card flat"
            style={{ margin: 0, minWidth: 116, textAlign: 'center' }}
            onClick={() => navigate('/booking', { state: { specialtyId: s.id } })}
          >
            <div style={{ fontSize: 26 }}>{s.icon || '🩺'}</div>
            <div className="small">{localized(s, 'name', lang)}</div>
          </button>
        ))}
      </div>

      <h2>{t.doctors}</h2>
      <div className="scroll-x">
        {doctors.map((d) => (
          <button
            key={d.id}
            style={{ border: 'none', background: 'none', textAlign: 'center', minWidth: 84, cursor: 'pointer' }}
            onClick={() => navigate('/booking', { state: { doctorId: d.id, specialtyId: d.specialtyId } })}
          >
            <div className="avatar" style={{ margin: '0 auto' }}>
              {d.firstName[0]}{d.lastName[0]}
            </div>
            <div className="small mt">{d.firstName}</div>
            <div className="muted small">{localized(d.specialty, 'name', lang).split(' ')[0]}</div>
          </button>
        ))}
      </div>

      <h2>{t.popularServices}</h2>
      {services.map((s) => (
        <button key={s.id} className="card" style={{ textAlign: 'left', width: 'calc(100% - 32px)' }} onClick={() => setSheet(s)}>
          <div className="between">
            <div>
              <h3>{localized(s, 'name', lang)}</h3>
              <p className="muted small">{s.durationMinutes} {t.minutes}</p>
            </div>
            <span className="badge green">{money(s.price, lang)}</span>
          </div>
        </button>
      ))}

      {clinic ? (
        <div className="card flat">
          <div className="muted small">{t.address}</div>
          <div>{clinic.address}</div>
          <div className="row mt">
            {clinic.phone ? <a className="btn secondary small" href={`tel:${clinic.phone}`}>📞 {clinic.phone}</a> : null}
            {clinic.latitude ? (
              <a className="btn secondary small" target="_blank" rel="noreferrer"
                 href={`https://yandex.uz/maps/?pt=${clinic.longitude},${clinic.latitude}&z=17`}>
                🗺️ {t.openMap}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {sheet ? <ServiceSheet service={sheet} onClose={() => setSheet(null)} /> : null}
      {complaint ? <ComplaintSearch onClose={() => setComplaint(false)} /> : null}
    </div>
  );
}
