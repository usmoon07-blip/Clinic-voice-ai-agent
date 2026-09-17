import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, unwrap } from '../lib/api.js';
import { useLang, localized } from '../lib/i18n.js';

/**
 * Shikoyat bo'yicha yo'naltirish.
 * MUHIM: bu tashxis emas — faqat mos yo'nalishni taklif qiladi.
 * Shoshilinch belgilar aniqlansa, darhol 103 ko'rsatiladi.
 */
export default function ComplaintSearch({ onClose }) {
  const { t, lang, clinic } = useLang();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setResult(await api.post('/route-complaint', { text }).then(unwrap));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h1>{t.byComplaint}</h1>

        <textarea
          className="mt"
          rows={3}
          value={text}
          placeholder={t.complaintPlaceholder}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn mt" onClick={search} disabled={busy || !text.trim()}>
          {busy ? t.loading : t.find}
        </button>

        {result?.emergency ? (
          <div className="alert error mt" style={{ margin: '14px 0 0' }}>
            <b>⚠️ {t.emergencyTitle}</b>
            <div className="mt">{lang === 'RU' ? result.messageRu : result.messageUz}</div>
            <a className="btn mt" style={{ background: '#d64545' }} href={`tel:${result.emergencyPhone}`}>
              📞 {result.emergencyPhone}
            </a>
          </div>
        ) : null}

        {result && !result.emergency && result.specialty ? (
          <div className="card tinted mt" style={{ margin: '14px 0 0' }}>
            <div className="muted small">{t.routedTo}</div>
            <h3>{localized(result.specialty, 'name', lang)}</h3>
            <button
              className="btn mt"
              onClick={() => navigate('/booking', { state: { specialtyId: result.specialty.id } })}
            >
              {t.book}
            </button>
          </div>
        ) : null}

        {result && !result.emergency && !result.specialty ? (
          <div className="alert info mt" style={{ margin: '14px 0 0' }}>
            {lang === 'RU'
              ? 'Не удалось определить направление. Выберите услугу вручную или позвоните нам.'
              : "Yo'nalish aniqlanmadi. Xizmatni qo'lda tanlang yoki bizga qo'ng'iroq qiling."}
            {clinic?.phone ? <div className="mt"><a href={`tel:${clinic.phone}`}>📞 {clinic.phone}</a></div> : null}
          </div>
        ) : null}

        <p className="muted small mt">{t.notMedicalAdvice}</p>
      </div>
    </div>
  );
}
