import { useNavigate } from 'react-router-dom';
import { useLang, localized, money } from '../lib/i18n.js';

/** Xizmat tafsiloti — pastdan chiqadigan oyna. */
export default function ServiceSheet({ service, onClose }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  if (!service) return null;

  const preparation = localized(service, 'preparation', lang);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h1>{localized(service, 'name', lang)}</h1>
        <p className="muted mt">{localized(service, 'description', lang)}</p>

        <div className="row wrap mt">
          <span className="badge">{t.duration}: {service.durationMinutes} {t.minutes}</span>
          <span className="badge green">{money(service.price, lang)}</span>
          {service.oldPrice ? (
            <span className="badge red" style={{ textDecoration: 'line-through' }}>{money(service.oldPrice, lang)}</span>
          ) : null}
        </div>

        {preparation ? (
          <div className="alert warn mt" style={{ margin: '14px 0 0' }}>
            <b>📋 {t.preparation}</b>
            <div className="mt">{preparation}</div>
          </div>
        ) : null}

        <p className="muted small mt">{t.notMedicalAdvice}</p>

        <button
          className="btn mt"
          onClick={() => navigate('/booking', { state: { serviceId: service.id } })}
        >
          {t.book} — {money(service.price, lang)}
        </button>
      </div>
    </div>
  );
}
