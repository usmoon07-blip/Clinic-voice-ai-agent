import { useEffect, useState } from 'react';
import { api, unwrap } from '../lib/api.js';

const TYPES = ['CONSULTATION', 'ULTRASOUND', 'ECG', 'PROCEDURE', 'LABORATORY', 'XRAY', 'OPERATING', 'DENTAL'];

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'CONSULTATION' });
  const [error, setError] = useState(null);

  const load = () => api.get('/rooms').then(unwrap).then(setRooms).catch((e) => setError(e.message));
  useEffect(load, []);

  const add = async () => {
    setError(null);
    try {
      await api.post('/rooms', form);
      setForm({ name: '', type: 'CONSULTATION' });
      load();
    } catch (e) { setError(e.message); }
  };

  const toggle = async (room) => {
    await api.patch(`/rooms/${room.id}`, { isActive: !room.isActive });
    load();
  };

  return (
    <div>
      <h1>Kabinetlar</h1>
      <div className="alert info">
        Kabinet bandligi navbat berishda hisobga olinadi: shifokor bo'sh bo'lsa ham,
        kerakli kabinet band bo'lsa, o'sha vaqt taklif qilinmaydi.
      </div>
      {error ? <div className="alert error">{error}</div> : null}

      <div className="card row wrap">
        <div className="grow"><label>Nomi</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="4-kabinet" /></div>
        <div><label>Turi</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div><label>&nbsp;</label><button className="btn" onClick={add} disabled={!form.name}>Qo'shish</button></div>
      </div>

      <table>
        <thead><tr><th>Nomi</th><th>Turi</th><th>Holati</th><th>Amal</th></tr></thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b></td>
              <td>{r.type}</td>
              <td>{r.isActive ? <span className="badge green">Faol</span> : <span className="badge red">Nofaol</span>}</td>
              <td><button className="btn secondary" onClick={() => toggle(r)}>{r.isActive ? 'Nofaol qilish' : 'Faollashtirish'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
