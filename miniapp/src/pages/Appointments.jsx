import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap, telegram } from '../lib/api.js';
import { useLang, localized, money } from '../lib/i18n.js';

const STATUS_CLASS = {
  CONFIRMED: 'green', CHECKED_IN: 'green', COMPLETED: '',
  CANCELLED: 'red', NO_SHOW: 'red', PENDING: 'amber',
};

export default function Appointments() {
  const { t, lang, patient } = useLang();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const load = () => api.get('/appointments').then(unwrap).then(setItems).catch(() => {});
  useEffect(() => { if (patient) load(); }, [patient]);

  const cancel = async (id) => {
    setError(null);
    setBusyId(id);
    try {
      await api.post(`/appointments/${id}/cancel`, {});
      telegram.haptic('medium');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onTheWay = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/appointments/${id}/on-the-way`, {});
      telegram.haptic('medium');
      setNote(t.onMyWaySent);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!patient) {
    return <div className="page"><h1>{t.myAppointments}</h1><p className="muted mt">{t.fillProfile}</p></div>;
  }

  const upcoming = items.filter((a) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status));
  const past = items.filter((a) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status));

  const Card = ({ a }) => (
    <div className="card">
      <div className="between">
        <div className="grow">
          <h3>
            {new Date(a.startTime).toLocaleString(lang === 'RU' ? 'ru-RU' : 'uz-UZ',
              { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </h3>
          <p className="muted small">{a.doctor.firstName} {a.doctor.lastName} · {localized(a.doctor.specialty, 'name', lang)}</p>
          <p className="muted small">{localized(a.service, 'name', lang)}</p>
          {a.room ? <p className="muted small">🚪 {a.room.name}</p> : null}
          {a.patientId !== patient.id ? <p className="muted small">👤 {a.patient.firstName}</p> : null}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${STATUS_CLASS[a.status] || ''}`}>{t.status[a.status]}</span>
          <div className="muted small mt">{money(a.price, lang)}</div>
        </div>
      </div>

      {a.onTheWay ? <span className="badge green mt">🚗 {t.onMyWay}</span> : null}

      <div className="row wrap mt">
        {a.canShowOnTheWay ? (
          <button className="btn small" onClick={() => onTheWay(a.id)} disabled={busyId === a.id}>🚗 {t.onMyWay}</button>
        ) : null}
        {a.canCancel ? (
          <>
            <button className="btn small secondary" onClick={() => navigate('/booking', { state: { serviceId: a.serviceId, doctorId: a.doctorId } })}>
              📅 {t.reschedule}
            </button>
            <button className="btn small danger" onClick={() => cancel(a.id)} disabled={busyId === a.id}>❌ {t.cancel}</button>
          </>
        ) : null}
        {['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status) ? (
          <button className="btn small secondary" onClick={() => navigate('/booking', { state: { serviceId: a.serviceId, doctorId: a.doctorId } })}>
            🔁 {t.bookAgain}
          </button>
        ) : null}
      </div>

      {!a.canCancel && ['PENDING', 'CONFIRMED'].includes(a.status) ? (
        <p className="muted small mt">
          {lang === 'RU'
            ? 'Отмена доступна не позднее чем за 2 часа. Позвоните в клинику.'
            : "Bekor qilish qabuldan 2 soat oldin mumkin. Klinikaga qo'ng'iroq qiling."}
        </p>
      ) : null}
    </div>
  );

  return (
    <div>
      <div className="page"><h1>{t.myAppointments}</h1></div>
      {error ? <div className="alert error">{error}</div> : null}
      {note ? <div className="alert info">{note}</div> : null}

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="page"><p className="muted">{t.noAppointments}</p></div>
      ) : null}

      {upcoming.map((a) => <Card key={a.id} a={a} />)}

      {past.length ? <h2>{lang === 'RU' ? 'История' : 'Tarix'}</h2> : null}
      {past.slice(0, 10).map((a) => <Card key={a.id} a={a} />)}
    </div>
  );
}
