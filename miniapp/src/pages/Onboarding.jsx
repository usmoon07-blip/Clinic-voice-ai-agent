import { useState } from 'react';
import { useLang } from '../lib/i18n.js';

const ART = ['🏥', '👨‍⚕️', '⏱️'];

export default function Onboarding({ onDone }) {
  const { t, lang, setLang } = useLang();
  const [step, setStep] = useState(0);
  const slide = t.onboarding[step];
  const last = step === t.onboarding.length - 1;

  return (
    <div className="onboard">
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className={`chip ${lang === 'UZ' ? 'active' : ''}`} onClick={() => setLang('UZ')}>UZ</button>
        <button className={`chip ${lang === 'RU' ? 'active' : ''}`} onClick={() => setLang('RU')}>RU</button>
      </div>

      <div>
        <div className="art">{ART[step]}</div>
        <h1 className="center">{slide.title}</h1>
        <p className="muted center mt">{slide.text}</p>
      </div>

      <div>
        <div className="steps mb">
          {t.onboarding.map((_, i) => <span key={i} className={i <= step ? 'done' : ''} />)}
        </div>
        <button className="btn" onClick={() => (last ? onDone() : setStep(step + 1))}>
          {last ? t.start : t.next}
        </button>
      </div>
    </div>
  );
}
