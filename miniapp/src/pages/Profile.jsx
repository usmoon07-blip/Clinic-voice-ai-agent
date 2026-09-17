import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../lib/api.js';
import { useLang } from '../lib/i18n.js';
import ProfileForm from '../components/ProfileForm.jsx';

export default function Profile() {
  const { t, lang, setLang, patient, setPatient, clinic } = useLang();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (patient) {
      setForm({
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : '',
        discreetMode: patient.discreetMode,
      });
    }
  }, [patient]);

  if (!patient || !form) {
    return (
      <div>
        <div className="page"><h1>{t.profile}</h1></div>
        <ProfileForm />
      </div>
    );
  }

  const save = async (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    const updated = await api.post('/profile', next).then(unwrap);
    setPatient(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <div className="page">
        <h1>{t.profile}</h1>
      </div>

      <div className="card">
        <div className="row">
          <div className="avatar lg">{patient.firstName[0]}</div>
          <div>
            <h3>{patient.firstName} {patient.lastName || ''}</h3>
            <p className="muted small">{patient.phone}</p>
            <p className="muted small">{t.cardNumber}: {patient.medicalCardNumber}</p>
          </div>
        </div>
      </div>

      {saved ? <div className="alert info">{t.saved}</div> : null}

      <div className="card">
        <label>{t.firstName}</label>
        <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        <label>{t.lastName}</label>
        <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        <label>{t.birthDate}</label>
        <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
        <button className="btn mt" onClick={() => save({})}>{t.save}</button>
      </div>

      <div className="card">
        <div className="between">
          <div className="grow">
            <b>{t.discreetMode}</b>
            <p className="muted small">{t.discreetHint}</p>
          </div>
          <button
            className={`chip ${form.discreetMode ? 'active' : ''}`}
            onClick={() => save({ discreetMode: !form.discreetMode })}
          >
            {form.discreetMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="card">
        <b>{t.language}</b>
        <div className="row mt">
          <button className={`chip ${lang === 'UZ' ? 'active' : ''}`} onClick={() => setLang('UZ')}>O'zbekcha</button>
          <button className={`chip ${lang === 'RU' ? 'active' : ''}`} onClick={() => setLang('RU')}>Русский</button>
        </div>
      </div>

      {patient.familyMembers?.length ? (
        <div className="card">
          <b>{t.familyMembers}</b>
          {patient.familyMembers.map((m) => (
            <div key={m.id} className="between mt">
              <span>{m.firstName} {m.lastName || ''}</span>
              <span className="muted small">{m.birthDate ? new Date(m.birthDate).getFullYear() : ''}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="page">
        <button className="btn secondary" onClick={() => navigate('/appointments')}>📅 {t.myAppointments}</button>
        {clinic?.phone ? (
          <a className="btn secondary mt" href={`tel:${clinic.phone}`}>📞 {clinic.phone}</a>
        ) : null}
      </div>
    </div>
  );
}
