import { useEffect, useState } from 'react';
import { api, unwrap, dt } from '../lib/api.js';
import { OutcomeBadge } from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';

const OUTCOMES = ['BOOKED', 'NOT_BOOKED', 'ESCALATED', 'DROPPED', 'EMERGENCY', 'CANCELLED', 'RESCHEDULED', 'INFO_ONLY'];

export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [outcome, setOutcome] = useState('');
  const [onlyMisunderstood, setOnlyMisunderstood] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    api.get('/calls', { params: { outcome: outcome || undefined, onlyMisunderstood: onlyMisunderstood || undefined } })
      .then(unwrap).then(setCalls).catch((e) => setError(e.message));
    api.get('/callbacks').then(unwrap).then(setCallbacks).catch(() => {});
  };
  useEffect(load, [outcome, onlyMisunderstood]);

  const open = async (id) => setDetail(await api.get(`/calls/${id}`).then(unwrap));
  const handleCallback = async (id) => { await api.post(`/callbacks/${id}/handle`, {}); load(); };

  return (
    <div>
      <h1>Qo'ng'iroqlar tarixi</h1>
      {error ? <div className="alert error">{error}</div> : null}

      {callbacks.length ? (
        <>
          <h2>📲 Qayta qo'ng'iroq so'rovlari</h2>
          <div className="alert warn">
            Bu ro'yxatdagi bemorlar operatorga ulana olmagan. 🚨 belgilangani —
            shoshilinch holat: birinchi navbatda shularga qo'ng'iroq qiling.
          </div>
          <table>
            <thead><tr><th>Telefon</th><th>Sabab</th><th>Vaqt</th><th>Amal</th></tr></thead>
            <tbody>
              {callbacks.map((c) => (
                <tr key={c.id} className={c.isEmergency ? 'danger-row' : ''}>
                  <td>
                    <b>{c.phone}</b>
                    {c.isEmergency ? <div><span className="badge red">🚨 SHOSHILINCH</span></div> : null}
                  </td>
                  <td className="small">{c.reason}{c.note ? ` · ${c.note}` : ''}</td>
                  <td className="small">{dt(c.createdAt)}</td>
                  <td><button className="btn secondary" onClick={() => handleCallback(c.id)}>Bajarildi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <div className="filters">
        <div>
          <label>Natija</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Hammasi</option>
            {OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label>&nbsp;</label>
          <button className={`btn ${onlyMisunderstood ? '' : 'secondary'}`} onClick={() => setOnlyMisunderstood(!onlyMisunderstood)}>
            🤔 AI tushunmagan qo'ng'iroqlar
          </button>
        </div>
      </div>

      <div className="alert info">
        "AI tushunmagan qo'ng'iroqlar" — promptni yaxshilash uchun eng qimmatli ro'yxat.
        Transkriptni o'qib, xizmat sinonimlarini yoki system promptni to'ldiring.
      </div>

      <table>
        <thead>
          <tr><th>Vaqt</th><th>Telefon</th><th>Davomiyligi</th><th>Til</th><th>Tushunmovchilik</th><th>Kechikish</th><th>Natija</th><th>Navbat</th></tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.id} className={`clickable ${c.outcome === 'EMERGENCY' ? 'danger-row' : ''}`} onClick={() => open(c.id)}>
              <td className="small">{dt(c.startedAt)}</td>
              <td className="small">{c.phone}</td>
              <td className="small">{c.durationSec ?? '—'} s</td>
              <td className="small">{c.detectedLanguage || '—'}</td>
              <td>{c.misunderstandCount > 0 ? <span className="badge amber">{c.misunderstandCount}</span> : '0'}</td>
              <td className="small">{c.avgLatencyMs ? `${(c.avgLatencyMs / 1000).toFixed(1)}s` : '—'}</td>
              <td><OutcomeBadge outcome={c.outcome} /></td>
              <td className="small">{c.appointment ? `#${c.appointment.id}` : '—'}</td>
            </tr>
          ))}
          {calls.length === 0 ? <tr><td colSpan={8} className="muted center">Qo'ng'iroq yo'q</td></tr> : null}
        </tbody>
      </table>

      {detail ? (
        <Modal title={`Qo'ng'iroq #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="row wrap">
            <span className="badge">{detail.phone}</span>
            <span className="badge">{dt(detail.startedAt)}</span>
            <span className="badge">{detail.durationSec ?? '—'} s</span>
            <OutcomeBadge outcome={detail.outcome} />
          </div>
          {detail.outcome === 'EMERGENCY' ? (
            <div className="alert error mt">⚠️ Shoshilinch holat aniqlangan — qo'ng'iroq operatorga uzatilgan.</div>
          ) : null}
          <div className="transcript mt">{detail.transcript || 'Transkript saqlanmagan (saqlash muddati o\'tgan).'}</div>
        </Modal>
      ) : null}
    </div>
  );
}
