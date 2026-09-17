import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api, unwrap, telegram } from './lib/api.js';
import { LangContext, STRINGS } from './lib/i18n.js';
import BottomNav from './components/BottomNav.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import Services from './pages/Services.jsx';
import Booking from './pages/Booking.jsx';
import Appointments from './pages/Appointments.jsx';
import Profile from './pages/Profile.jsx';

const ONBOARD_KEY = 'clinic_onboarded';

export default function App() {
  const [lang, setLang] = useState(localStorage.getItem('clinic_lang') || 'UZ');
  const [patient, setPatient] = useState(null);
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(Boolean(localStorage.getItem(ONBOARD_KEY)));
  const location = useLocation();

  useEffect(() => {
    telegram.ready();
    (async () => {
      try {
        const [info, profile] = await Promise.all([
          api.get('/clinic').then(unwrap),
          api.get('/profile').then(unwrap).catch(() => null),
        ]);
        setClinic(info);
        if (profile) {
          setPatient(profile);
          if (profile.language) setLang(profile.language);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem('clinic_lang', next);
    if (patient) api.post('/profile', { language: next }).catch(() => {});
  };

  const ctx = useMemo(
    () => ({ lang, setLang: changeLang, t: STRINGS[lang], patient, setPatient, clinic }),
    [lang, patient, clinic],
  );

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }

  if (!onboarded) {
    return (
      <LangContext.Provider value={ctx}>
        <Onboarding
          onDone={() => {
            localStorage.setItem(ONBOARD_KEY, '1');
            setOnboarded(true);
          }}
        />
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={ctx}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav current={location.pathname} />
    </LangContext.Provider>
  );
}
