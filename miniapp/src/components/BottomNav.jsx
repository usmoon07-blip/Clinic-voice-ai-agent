import { Link } from 'react-router-dom';
import { useLang } from '../lib/i18n.js';

const ITEMS = [
  { to: '/', icon: '🏠', key: 'home' },
  { to: '/services', icon: '🩺', key: 'services' },
  { to: '/booking', icon: '📅', key: 'booking' },
  { to: '/profile', icon: '👤', key: 'profile' },
];

export default function BottomNav({ current }) {
  const { t } = useLang();
  return (
    <nav className="nav">
      {ITEMS.map((item) => (
        <Link key={item.to} to={item.to} className={current === item.to ? 'active' : ''}>
          <span className="icon">{item.icon}</span>
          <span>{t[item.key]}</span>
        </Link>
      ))}
    </nav>
  );
}
