import { useEffect, useState } from 'react';
import { api, unwrap, dt } from '../lib/api.js';

/** Tibbiy ma'lumot bilan ishlash jurnali — kim nimani ko'rgani/o'zgartirgani. */
export default function Audit() {
  const [logs, setLogs] = useState([]);

  useEffect(() => { api.get('/audit').then(unwrap).then(setLogs).catch(() => {}); }, []);

  return (
    <div>
      <h1>Audit jurnali</h1>
      <div className="alert info">
        Bemor kartochkasini ochish, tahrirlash va o'chirish — hammasi yozib boriladi.
      </div>
      <table>
        <thead><tr><th>Vaqt</th><th>Kim</th><th>Amal</th><th>Obyekt</th><th>Qiymat</th><th>IP</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="small">{dt(l.createdAt)}</td>
              <td className="small">{l.adminUser ? `${l.adminUser.login} (${l.adminUser.role})` : '—'}</td>
              <td><span className={`badge ${l.action === 'DELETE' ? 'red' : l.action === 'VIEW' ? '' : 'blue'}`}>{l.action}</span></td>
              <td className="small">{l.entity}{l.entityId ? ` #${l.entityId}` : ''}</td>
              <td className="small" style={{ maxWidth: 280, overflow: 'hidden' }}>
                {l.newValue ? JSON.stringify(l.newValue).slice(0, 120) : '—'}
              </td>
              <td className="small">{l.ip || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
