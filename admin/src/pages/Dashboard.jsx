import { Fragment, useEffect, useState } from 'react';
import { api, unwrap, money } from '../lib/api.js';

const DAYS = ['Dsh', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Yak'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 08:00 - 19:00

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [heat, setHeat] = useState({});

  useEffect(() => {
    api.get('/dashboard').then(unwrap).then(setStats).catch(() => {});
    api.get('/dashboard/heatmap').then(unwrap).then(setHeat).catch(() => {});
  }, []);

  if (!stats) return <div>Yuklanmoqda...</div>;

  const max = Math.max(1, ...Object.values(heat));
  const shade = (n) => (n ? `rgba(10,126,164,${0.12 + 0.75 * (n / max)})` : '#f1f4f7');

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="stats">
        <div className="stat"><div className="value">{stats.todayAppointments}</div><div className="label">Bugungi navbatlar</div></div>
        <div className="stat"><div className="value">{stats.pending}</div><div className="label">Kutilmoqda</div></div>
        <div className="stat"><div className="value">{money(stats.todayRevenue)}</div><div className="label">Bugungi tushum</div></div>
        <div className="stat"><div className="value">{stats.totalPatients}</div><div className="label">Jami bemorlar</div></div>
        <div className="stat"><div className="value">{stats.activeDoctors}</div><div className="label">Faol shifokorlar</div></div>
        <div className="stat"><div className="value">{stats.noShowRate}%</div><div className="label">Kelmaganlar (30 kun)</div></div>
      </div>

      <h2>📞 AI Voice Agent (bugun)</h2>
      <div className="stats">
        <div className="stat"><div className="value">{stats.calls.total}</div><div className="label">Qo'ng'iroqlar</div></div>
        <div className="stat"><div className="value">{stats.calls.booked}</div><div className="label">Navbat bilan yakunlangan</div></div>
        <div className="stat"><div className="value">{stats.calls.conversion}%</div><div className="label">Konversiya</div></div>
        <div className="stat"><div className="value">{stats.calls.escalated}</div><div className="label">Operatorga uzatilgan</div></div>
        <div className="stat">
          <div className="value">{stats.avgVoiceLatencyMs ? `${(stats.avgVoiceLatencyMs / 1000).toFixed(1)}s` : '—'}</div>
          <div className="label">O'rtacha javob kechikishi</div>
        </div>
      </div>
      {stats.avgVoiceLatencyMs > 1500 ? (
        <div className="alert warn">
          AI javob kechikishi 1.5 soniyadan yuqori — suhbat sun'iy tuyuladi.
          STT/TTS provayderi va model tezligini tekshiring.
        </div>
      ) : null}

      <h2>Ommabop xizmatlar (30 kun)</h2>
      <table>
        <tbody>
          {stats.popularServices.map((p, i) => (
            <tr key={i}>
              <td>{p.service?.nameUz || '—'}</td>
              <td style={{ width: 90, textAlign: 'right' }}>{p.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Band soatlar (60 kun)</h2>
      <div className="card">
        <div className="heatmap">
          <div />
          {HOURS.map((h) => <div key={h} className="muted">{h}</div>)}
          {DAYS.map((day, di) => (
            <Fragment key={day}>
              <div className="muted" style={{ textAlign: 'left' }}>{day}</div>
              {HOURS.map((h) => {
                const n = heat[`${di + 1}-${h}`] || 0;
                return <div key={`${di}-${h}`} style={{ background: shade(n) }} title={`${n} ta`}>{n || ''}</div>;
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
