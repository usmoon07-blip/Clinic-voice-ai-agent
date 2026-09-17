import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, unwrap, telegram } from '../lib/api.js';
import { useLang, localized, money, formatDate, formatDateShort, formatDateTime } from '../lib/i18n.js';
import ProfileForm from '../components/ProfileForm.jsx';

const STEPS = ['who', 'service', 'doctor', 'date', 'time', 'confirm'];

/** Navbat olish oqimi — 6 qadam. */
export default function Booking() {
  const { t, lang, patient, clinic } = useLang();
  const navigate = useNavigate();
  const preset = useLocation().state || {};

  const [step, setStep] = useState(preset.serviceId ? 2 : 0);
  const [forPatientId, setForPatientId] = useState(null);
  const [specialtyId, setSpecialtyId] = useState(preset.specialtyId || null);
  const [serviceId, setServiceId] = useState(preset.serviceId || null);
  const [doctorId, setDoctorId] = useState(preset.doctorId || null);
  const [femaleOnly, setFemaleOnly] = useState(false);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);

  const [specialties, setSpecialties] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [dates, setDates] = useState([]);
  const [slots, setSlots] = useState([]);
  const [family, setFamily] = useState([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [waitlisted, setWaitlisted] = useState(false);
  const [newMember, setNewMember] = useState(null);

  useEffect(() => { setForPatientId(patient?.id ?? null); setFamily(patient?.familyMembers || []); }, [patient]);

  useEffect(() => { api.get('/specialties').then(unwrap).then(setSpecialties).catch(() => {}); }, []);

  useEffect(() => {
    if (!specialtyId) return;
    api.get('/services', { params: { specialtyId } }).then(unwrap).then(setServices).catch(() => {});
  }, [specialtyId]);

  useEffect(() => {
    if (!serviceId) return;
    api.get('/doctors', { params: { serviceId, ...(femaleOnly ? { gender: 'FEMALE' } : {}) } })
      .then(unwrap).then(setDoctors).catch(() => {});
  }, [serviceId, femaleOnly]);

  useEffect(() => {
    if (!serviceId || step !== 3) return;
    setBusy(true);
    api.get('/availability/dates', { params: { serviceId, doctorId: doctorId || undefined, patientId: forPatientId || undefined } })
      .then(unwrap).then(setDates).catch(() => setDates([])).finally(() => setBusy(false));
  }, [serviceId, doctorId, step, forPatientId]);

  useEffect(() => {
    if (!serviceId || !date) return;
    setBusy(true);
    api.get('/availability/slots', { params: { serviceId, doctorId: doctorId || undefined, date, patientId: forPatientId || undefined } })
      .then(unwrap).then((d) => setSlots(d.slots)).catch(() => setSlots([])).finally(() => setBusy(false));
  }, [serviceId, doctorId, date, forPatientId]);

  // "Farqi yo'q" tanlanganda bir xil vaqt bir necha shifokordan kelishi mumkin —
  // bemorga har bir vaqt bir martadan ko'rsatiladi.
  const visibleSlots = useMemo(() => {
    if (doctorId) return slots;
    const seen = new Set();
    return slots.filter((s) => {
      if (seen.has(s.time)) return false;
      seen.add(s.time);
      return true;
    });
  }, [slots, doctorId]);

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const doctor = useMemo(() => doctors.find((d) => d.id === (slot?.doctorId || doctorId)), [doctors, doctorId, slot]);

  const go = (next) => { telegram.haptic(); setError(null); setStep(next); };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.post('/appointments', {
        doctorId: slot.doctorId,
        serviceId,
        startTime: slot.startUtc,
        patientId: forPatientId,
        // Bir xil kalit bilan ikkinchi marta yuborilsa, ikkita navbat yaratilmaydi
        idempotencyKey: `mini:${forPatientId}:${slot.doctorId}:${slot.startUtc}`,
      }).then(unwrap);
      telegram.haptic('medium');
      setDone(created);
    } catch (e) {
      setError(e.message);
      // Vaqt band bo'lib qolgan bo'lsa, ro'yxatni yangilaymiz
      if (e.code === 'SLOT_TAKEN' || e.code === 'DOCTOR_BUSY') {
        setSlot(null);
        setStep(4);
        const fresh = await api.get('/availability/slots', { params: { serviceId, doctorId: doctorId || undefined, date } })
          .then(unwrap).catch(() => ({ slots: [] }));
        setSlots(fresh.slots);
      }
    } finally {
      setBusy(false);
    }
  };

  const joinWaitlist = async () => {
    setBusy(true);
    try {
      await api.post('/waitlist', {
        serviceId,
        doctorId: doctorId || undefined,
        dateFrom: new Date().toISOString(),
        dateTo: new Date(Date.now() + 14 * 86400000).toISOString(),
      });
      setWaitlisted(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addFamilyMember = async () => {
    setBusy(true);
    try {
      const member = await api.post('/family', newMember).then(unwrap);
      setFamily([...family, member]);
      setForPatientId(member.id);
      setNewMember(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!patient) {
    return (
      <div>
        <div className="page"><h1>{t.book}</h1></div>
        <ProfileForm />
      </div>
    );
  }

  if (done) {
    const start = new Date(done.startTime);
    const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(
      ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
        `DTSTART:${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `SUMMARY:${clinic?.name || t.appName}`,
        `LOCATION:${clinic?.address || ''}`,
        'END:VEVENT', 'END:VCALENDAR'].join('\n'),
    )}`;

    return (
      <div className="page">
        <div className="center" style={{ fontSize: 56, marginTop: 24 }}>✅</div>
        <h1 className="center">{lang === 'RU' ? 'Вы записаны!' : 'Yozildingiz!'}</h1>
        <div className="card tinted mt" style={{ margin: '16px 0' }}>
          <h3>{formatDateTime(start, lang)}</h3>
          <p className="muted">{doctor ? `${doctor.firstName} ${doctor.lastName}` : ''}</p>
          <p className="muted">{service ? localized(service, 'name', lang) : ''}</p>
        </div>
        {service && localized(service, 'preparation', lang) ? (
          <div className="alert warn"><b>📋 {t.preparation}</b><div className="mt">{localized(service, 'preparation', lang)}</div></div>
        ) : null}
        <a className="btn secondary mt" href={ics} download="appointment.ics">📅 {t.addToCalendar}</a>
        <button className="btn mt" onClick={() => navigate('/appointments')}>{t.myAppointments}</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page">
        <h1>{t.book}</h1>
        <p className="muted">{t.step} {step + 1} / {STEPS.length}</p>
      </div>
      <div className="steps">
        {STEPS.map((s, i) => <span key={s} className={i <= step ? 'done' : ''} />)}
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      {/* 1 — Kim uchun */}
      {step === 0 ? (
        <div>
          <h2>{t.whoFor}</h2>
          <button className={`card ${forPatientId === patient.id ? 'tinted' : ''}`} style={{ width: 'calc(100% - 32px)', textAlign: 'left' }}
                  onClick={() => { setForPatientId(patient.id); go(1); }}>
            <h3>{t.forMe}</h3>
            <p className="muted small">{patient.firstName} {patient.lastName || ''}</p>
          </button>

          {family.map((m) => (
            <button key={m.id} className={`card ${forPatientId === m.id ? 'tinted' : ''}`} style={{ width: 'calc(100% - 32px)', textAlign: 'left' }}
                    onClick={() => { setForPatientId(m.id); go(1); }}>
              <h3>{m.firstName} {m.lastName || ''}</h3>
              <p className="muted small">
                {m.relationToGuardian === 'CHILD' ? t.forChild : t.forOther}
                {m.birthDate ? ` · ${new Date(m.birthDate).getFullYear()}` : ''}
              </p>
            </button>
          ))}

          {newMember ? (
            <div className="card">
              <label>{t.firstName}</label>
              <input value={newMember.firstName} onChange={(e) => setNewMember({ ...newMember, firstName: e.target.value })} />
              <label>{t.birthDate}</label>
              <input type="date" value={newMember.birthDate} onChange={(e) => setNewMember({ ...newMember, birthDate: e.target.value })} />
              <div className="row mt">
                <button className="btn" onClick={addFamilyMember} disabled={busy || !newMember.firstName}>{t.save}</button>
                <button className="btn secondary" onClick={() => setNewMember(null)}>{t.back}</button>
              </div>
            </div>
          ) : (
            <button className="btn secondary" style={{ width: 'calc(100% - 32px)', margin: '0 16px' }}
                    onClick={() => setNewMember({ firstName: '', birthDate: '', relation: 'CHILD' })}>
              {t.addFamily}
            </button>
          )}
        </div>
      ) : null}

      {/* 2 — Xizmat */}
      {step === 1 ? (
        <div>
          <h2>{t.chooseService}</h2>
          {!specialtyId ? (
            <div className="grid2">
              {specialties.map((s) => (
                <button key={s.id} className="card flat" style={{ margin: 0 }} onClick={() => setSpecialtyId(s.id)}>
                  <div style={{ fontSize: 24 }}>{s.icon || '🩺'}</div>
                  <div className="small">{localized(s, 'name', lang)}</div>
                </button>
              ))}
            </div>
          ) : (
            <>
              <button className="chip" style={{ margin: '0 16px 10px' }} onClick={() => setSpecialtyId(null)}>← {t.back}</button>
              {services.map((s) => (
                <button key={s.id} className={`card ${serviceId === s.id ? 'tinted' : ''}`} style={{ width: 'calc(100% - 32px)', textAlign: 'left' }}
                        onClick={() => { setServiceId(s.id); go(2); }}>
                  <div className="between">
                    <div className="grow">
                      <h3>{localized(s, 'name', lang)}</h3>
                      <p className="muted small">{s.durationMinutes} {t.minutes}</p>
                    </div>
                    <span className="badge green">{money(s.price, lang)}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}

      {/* 3 — Shifokor */}
      {step === 2 ? (
        <div>
          <h2>{t.chooseDoctor}</h2>
          <div className="row" style={{ padding: '0 16px 10px' }}>
            <button className={`chip ${femaleOnly ? 'active' : ''}`} onClick={() => setFemaleOnly(!femaleOnly)}>
              👩‍⚕️ {t.femaleDoctorOnly}
            </button>
            <button className={`chip ${!doctorId ? 'active' : ''}`} onClick={() => { setDoctorId(null); go(3); }}>
              {lang === 'RU' ? 'Любой врач' : 'Farqi yo\'q'}
            </button>
          </div>

          {doctors.map((d) => (
            <button key={d.id} className={`card ${doctorId === d.id ? 'tinted' : ''}`} style={{ width: 'calc(100% - 32px)', textAlign: 'left' }}
                    onClick={() => { setDoctorId(d.id); go(3); }}>
              <div className="row">
                <div className="avatar">{d.firstName[0]}{d.lastName[0]}</div>
                <div className="grow">
                  <h3>{d.firstName} {d.lastName}</h3>
                  <p className="muted small">{localized(d.specialty, 'name', lang)}</p>
                  <p className="muted small">
                    {d.experienceYears} {t.experience}
                    {d.rating ? ` · ⭐ ${Number(d.rating).toFixed(1)}` : ''}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {doctors.length === 0 ? <div className="alert info">{t.noSlots}</div> : null}
        </div>
      ) : null}

      {/* 4 — Sana */}
      {step === 3 ? (
        <div>
          <h2>{t.chooseDate}</h2>
          {busy ? <div className="skeleton" /> : null}
          <div className="grid3" style={{ padding: '0 16px' }}>
            {dates.map((d) => {
              const dt = new Date(`${d}T00:00:00`);
              return (
                <button key={d} className={`chip ${date === d ? 'active' : ''}`} onClick={() => { setDate(d); go(4); }}>
                  {formatDateShort(dt, lang)}
                </button>
              );
            })}
          </div>
          {!busy && dates.length === 0 ? (
            <div className="page">
              <div className="alert info" style={{ margin: 0 }}>{t.noSlots}</div>
              <button className="btn mt" onClick={joinWaitlist} disabled={busy || waitlisted}>
                {waitlisted ? t.waitlistAdded : t.joinWaitlist}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 5 — Vaqt */}
      {step === 4 ? (
        <div>
          <h2>{t.chooseTime}</h2>
          {busy ? <div className="skeleton" /> : null}
          <div className="grid4" style={{ padding: '0 16px' }}>
            {visibleSlots.map((s) => (
              <button key={`${s.doctorId}-${s.startUtc}`} className={`chip ${slot?.startUtc === s.startUtc && slot?.doctorId === s.doctorId ? 'active' : ''}`}
                      onClick={() => { setSlot(s); go(5); }}>
                {s.time}
              </button>
            ))}
          </div>
          {!busy && visibleSlots.length === 0 ? (
            <div className="page">
              <div className="alert info" style={{ margin: 0 }}>{t.noSlots}</div>
              <button className="btn mt" onClick={joinWaitlist} disabled={busy || waitlisted}>
                {waitlisted ? t.waitlistAdded : t.joinWaitlist}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 6 — Tasdiqlash */}
      {step === 5 && slot ? (
        <div>
          <h2>{t.confirmBooking}</h2>
          <div className="card">
            <div className="between mb"><span className="muted">{t.chooseDoctor}</span><b>{slot.doctorName}</b></div>
            <div className="between mb"><span className="muted">{t.services}</span><b>{service ? localized(service, 'name', lang) : ''}</b></div>
            <div className="between mb"><span className="muted">{t.chooseDate}</span><b>{formatDate(slot.startUtc, lang)}</b></div>
            <div className="between mb"><span className="muted">{t.chooseTime}</span><b>{slot.time}</b></div>
            {slot.roomName ? <div className="between mb"><span className="muted">🚪</span><b>{slot.roomName}</b></div> : null}
            <div className="between"><span className="muted">{t.price}</span><b>{money(slot.price, lang)}</b></div>
          </div>

          {service && localized(service, 'preparation', lang) ? (
            <div className="alert warn"><b>📋 {t.preparation}</b><div className="mt">{localized(service, 'preparation', lang)}</div></div>
          ) : null}

          <div className="page">
            <button className="btn" onClick={submit} disabled={busy}>{busy ? t.loading : t.confirm}</button>
            <button className="btn secondary mt" onClick={() => go(4)}>{t.back}</button>
          </div>
        </div>
      ) : null}

      {step > 0 && step < 5 ? (
        <div className="page">
          <button className="btn secondary" onClick={() => go(step - 1)}>{t.back}</button>
        </div>
      ) : null}
    </div>
  );
}
