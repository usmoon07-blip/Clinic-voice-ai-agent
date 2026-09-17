import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { api, unwrap } from './lib/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Appointments from './pages/Appointments.jsx';
import Doctors from './pages/Doctors.jsx';
import Services from './pages/Services.jsx';
import Rooms from './pages/Rooms.jsx';
import Schedule from './pages/Schedule.jsx';
import Patients from './pages/Patients.jsx';
import Calls from './pages/Calls.jsx';
import Waitlist from './pages/Waitlist.jsx';
import Settings from './pages/Settings.jsx';
import Audit from './pages/Audit.jsx';

/** Rollar: SUPERADMIN hammasini, ADMIN registraturani, DOCTOR faqat o'zinikini ko'radi. */
const MENU = [
  { to: '/', label: '📊 Dashboard', roles: ['SUPERADMIN', 'ADMIN', 'DOCTOR'] },
  { to: '/appointments', label: '📅 Navbatlar', roles: ['SUPERADMIN', 'ADMIN', 'DOCTOR'] },
  { to: '/doctors', label: '👨‍⚕️ Shifokorlar', roles: ['SUPERADMIN', 'ADMIN', 'DOCTOR'] },
  { to: '/schedule', label: '🕐 Ish vaqti', roles: ['SUPERADMIN', 'ADMIN', 'DOCTOR'] },
  { to: '/services', label: '🩺 Xizmatlar', roles: ['SUPERADMIN', 'ADMIN'] },
  { to: '/rooms', label: '🚪 Kabinetlar', roles: ['SUPERADMIN', 'ADMIN'] },
  { to: '/patients', label: '👥 Bemorlar', roles: ['SUPERADMIN', 'ADMIN', 'DOCTOR'] },
  { to: '/calls', label: '📞 Qo\'ng\'iroqlar', roles: ['SUPERADMIN', 'ADMIN'] },
  { to: '/waitlist', label: '⏳ Kutish ro\'yxati', roles: ['SUPERADMIN', 'ADMIN'] },
  { to: '/settings', label: '⚙️ Sozlamalar', roles: ['SUPERADMIN', 'ADMIN'] },
  { to: '/audit', label: '🔐 Audit jurnali', roles: ['SUPERADMIN'] },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('clinic_admin_token')) { setChecked(true); return; }
    api.get('/me').then(unwrap).then(setUser).catch(() => {}).finally(() => setChecked(true));
  }, []);

  if (!checked) return <div className="content">Yuklanmoqda...</div>;
  if (!user) return <Login onLogin={setUser} />;

  const logout = () => {
    localStorage.removeItem('clinic_admin_token');
    setUser(null);
    navigate('/login');
  };

  const menu = MENU.filter((m) => m.roles.includes(user.role));

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">🏥 Klinika</div>
        {menu.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            {m.label}
          </NavLink>
        ))}
        <div className="who">
          <div>{user.fullName}</div>
          <div className="small">{user.role}</div>
          <button className="btn secondary mt block" onClick={logout}>Chiqish</button>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/appointments" element={<Appointments user={user} />} />
          <Route path="/doctors" element={<Doctors user={user} />} />
          <Route path="/schedule" element={<Schedule user={user} />} />
          <Route path="/services" element={<Services />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/patients" element={<Patients user={user} />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
