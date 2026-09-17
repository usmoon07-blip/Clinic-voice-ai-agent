import { useEffect, useMemo, useState } from 'react';
import { api, unwrap } from '../lib/api.js';
import { useLang, localized, money } from '../lib/i18n.js';
import ServiceSheet from '../components/ServiceSheet.jsx';

const CATEGORY_LABELS = {
  UZ: {
    CONSULTATION: 'Konsultatsiya', DIAGNOSTICS: 'Diagnostika', LABORATORY: 'Laboratoriya',
    PROCEDURE: 'Muolajalar', MINOR_SURGERY: 'Kichik jarrohlik', TREATMENT_COURSE: 'Davolash kursi',
    VACCINATION: 'Emlash', DENTISTRY: 'Stomatologiya',
  },
  RU: {
    CONSULTATION: 'Консультации', DIAGNOSTICS: 'Диагностика', LABORATORY: 'Лаборатория',
    PROCEDURE: 'Процедуры', MINOR_SURGERY: 'Малая хирургия', TREATMENT_COURSE: 'Курс лечения',
    VACCINATION: 'Вакцинация', DENTISTRY: 'Стоматология',
  },
};

export default function Services() {
  const { t, lang } = useLang();
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    api.get('/services').then(unwrap).then(setServices).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const filtered = services.filter((s) => {
      const name = `${s.nameUz} ${s.nameRu}`.toLowerCase();
      return !query || name.includes(query.toLowerCase());
    });
    return filtered.reduce((acc, s) => {
      (acc[s.category] = acc[s.category] || []).push(s);
      return acc;
    }, {});
  }, [services, query]);

  return (
    <div>
      <div className="page">
        <h1>{t.services}</h1>
        <input
          className="mt"
          value={query}
          placeholder={lang === 'RU' ? 'Поиск услуги...' : 'Xizmatni qidirish...'}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h2>{CATEGORY_LABELS[lang][category] || category}</h2>
          {items.map((s) => (
            <button key={s.id} className="card" style={{ textAlign: 'left', width: 'calc(100% - 32px)' }} onClick={() => setSheet(s)}>
              <div className="between">
                <div className="grow">
                  <h3>{localized(s, 'name', lang)}</h3>
                  <p className="muted small">{localized(s, 'description', lang)}</p>
                  <p className="muted small mt">⏱ {s.durationMinutes} {t.minutes}</p>
                </div>
                <span className="badge green">{money(s.price, lang)}</span>
              </div>
              {(s.preparationUz || s.preparationRu) ? (
                <span className="badge amber mt">📋 {t.preparation}</span>
              ) : null}
            </button>
          ))}
        </div>
      ))}

      {sheet ? <ServiceSheet service={sheet} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}
