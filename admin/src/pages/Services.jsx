import { useEffect, useState } from 'react';
import { api, unwrap, money } from '../lib/api.js';
import Modal from '../components/Modal.jsx';

const CATEGORIES = ['CONSULTATION', 'DIAGNOSTICS', 'LABORATORY', 'PROCEDURE', 'MINOR_SURGERY', 'TREATMENT_COURSE', 'VACCINATION', 'DENTISTRY'];
const ROOM_TYPES = ['', 'CONSULTATION', 'ULTRASOUND', 'ECG', 'PROCEDURE', 'LABORATORY', 'XRAY', 'OPERATING', 'DENTAL'];

export default function Services() {
  const [services, setServices] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api.get('/services').then(unwrap).then(setServices).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.get('/specialties').then(unwrap).then(setSpecialties).catch(() => {});
  }, []);

  const save = async () => {
    setError(null);
    const payload = {
      nameUz: edit.nameUz, nameRu: edit.nameRu,
      descriptionUz: edit.descriptionUz, descriptionRu: edit.descriptionRu,
      aliases: typeof edit.aliases === 'string'
        ? edit.aliases.split(',').map((a) => a.trim()).filter(Boolean)
        : edit.aliases || [],
      price: Number(edit.price || 0),
      oldPrice: edit.oldPrice ? Number(edit.oldPrice) : null,
      category: edit.category,
      durationMinutes: Number(edit.durationMinutes || 30),
      followUpDurationMinutes: edit.followUpDurationMinutes ? Number(edit.followUpDurationMinutes) : null,
      specialtyId: Number(edit.specialtyId),
      requiredRoomType: edit.requiredRoomType || null,
      minAge: Number(edit.minAge || 0), maxAge: Number(edit.maxAge || 120),
      preparationUz: edit.preparationUz || null, preparationRu: edit.preparationRu || null,
      prepReminderHours: Number(edit.prepReminderHours || 24),
      isSensitive: Boolean(edit.isSensitive),
      isCourse: Boolean(edit.isCourse),
      sessionCount: Number(edit.sessionCount || 1),
      sessionIntervalDays: Number(edit.sessionIntervalDays || 1),
      isActive: edit.isActive !== false,
    };
    try {
      if (edit.id) await api.patch(`/services/${edit.id}`, payload);
      else await api.post('/services', payload);
      setEdit(null);
      load();
    } catch (e) { setError(e.message); }
  };

  const deactivate = async (id) => {
    if (!window.confirm('Xizmat nofaol qilinsinmi? (tarixiy navbatlar saqlanadi)')) return;
    await api.delete(`/services/${id}`);
    load();
  };

  return (
    <div>
      <div className="between">
        <h1>Xizmatlar va narxlar</h1>
        <button className="btn" onClick={() => setEdit({ category: 'CONSULTATION', durationMinutes: 30, minAge: 0, maxAge: 120, prepReminderHours: 24 })}>
          + Qo'shish
        </button>
      </div>

      {error ? <div className="alert error">{error}</div> : null}

      <table>
        <thead>
          <tr><th>Nomi</th><th>Yo'nalish</th><th>Kategoriya</th><th>Davomiyligi</th><th>Narx</th><th>Kabinet</th><th>Belgilar</th><th>Amal</th></tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>
                <b>{s.nameUz}</b>
                <div className="muted small">{s.nameRu}</div>
                {!s.isActive ? <span className="badge red">Nofaol</span> : null}
              </td>
              <td className="small">{s.specialty?.nameUz}</td>
              <td className="small">{s.category}</td>
              <td className="small">
                {s.durationMinutes} daq
                {s.followUpDurationMinutes ? <div className="muted">takroriy: {s.followUpDurationMinutes} daq</div> : null}
              </td>
              <td className="small">{money(s.price)}</td>
              <td className="small">{s.requiredRoomType || '—'}</td>
              <td>
                {s.isSensitive ? <span className="badge amber">Nozik</span> : null}
                {s.preparationUz ? <span className="badge blue">Tayyorgarlik</span> : null}
                {s.isCourse ? <span className="badge">Kurs ×{s.sessionCount}</span> : null}
              </td>
              <td>
                <div className="row">
                  <button className="btn secondary" onClick={() => setEdit({ ...s, aliases: (s.aliases || []).join(', ') })}>Tahrirlash</button>
                  <button className="btn danger" onClick={() => deactivate(s.id)}>Nofaol</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {edit ? (
        <Modal title={edit.id ? 'Xizmatni tahrirlash' : 'Yangi xizmat'} onClose={() => setEdit(null)}
               footer={<button className="btn" onClick={save}>Saqlash</button>}>
          <div className="row">
            <div className="grow"><label>Nomi (uz)</label><input value={edit.nameUz || ''} onChange={(e) => setEdit({ ...edit, nameUz: e.target.value })} /></div>
            <div className="grow"><label>Nomi (ru)</label><input value={edit.nameRu || ''} onChange={(e) => setEdit({ ...edit, nameRu: e.target.value })} /></div>
          </div>
          <label>Yo'nalish</label>
          <select value={edit.specialtyId || ''} onChange={(e) => setEdit({ ...edit, specialtyId: e.target.value })}>
            <option value="">— tanlang —</option>
            {specialties.map((s) => <option key={s.id} value={s.id}>{s.nameUz}</option>)}
          </select>
          <div className="row">
            <div className="grow"><label>Kategoriya</label>
              <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grow"><label>Kerakli kabinet turi</label>
              <select value={edit.requiredRoomType || ''} onChange={(e) => setEdit({ ...edit, requiredRoomType: e.target.value })}>
                {ROOM_TYPES.map((r) => <option key={r} value={r}>{r || '— ixtiyoriy —'}</option>)}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="grow"><label>Narx</label><input type="number" value={edit.price || 0} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></div>
            <div className="grow"><label>Eski narx (chegirma)</label><input type="number" value={edit.oldPrice || ''} onChange={(e) => setEdit({ ...edit, oldPrice: e.target.value })} /></div>
            <div className="grow"><label>Birlamchi qabul (daq)</label><input type="number" value={edit.durationMinutes} onChange={(e) => setEdit({ ...edit, durationMinutes: e.target.value })} /></div>
            <div className="grow">
              <label>Takroriy qabul (daq)</label>
              <input type="number" placeholder="bo'sh = birlamchi bilan bir xil"
                     value={edit.followUpDurationMinutes || ''}
                     onChange={(e) => setEdit({ ...edit, followUpDurationMinutes: e.target.value })} />
            </div>
          </div>
          <div className="muted small">
            Bemor bu shifokorda avval bo'lgan bo'lsa, navbat shu qisqa vaqt bilan hisoblanadi.
            Masalan: birlamchi 40 daqiqa, takroriy 15 daqiqa.
          </div>
          <div className="row">
            <div className="grow"><label>Min yosh</label><input type="number" value={edit.minAge} onChange={(e) => setEdit({ ...edit, minAge: e.target.value })} /></div>
            <div className="grow"><label>Max yosh</label><input type="number" value={edit.maxAge} onChange={(e) => setEdit({ ...edit, maxAge: e.target.value })} /></div>
          </div>

          <label>Tavsif (uz)</label>
          <textarea rows={2} value={edit.descriptionUz || ''} onChange={(e) => setEdit({ ...edit, descriptionUz: e.target.value })} />

          <label>Xalq tilidagi nomlari (vergul bilan) — Voice Agent shu bo'yicha tanadi</label>
          <input value={edit.aliases || ''} onChange={(e) => setEdit({ ...edit, aliases: e.target.value })} placeholder="uzi, analiz, tekshiruv" />

          <label>Tayyorgarlik yo'riqnomasi (uz)</label>
          <textarea rows={2} value={edit.preparationUz || ''} onChange={(e) => setEdit({ ...edit, preparationUz: e.target.value })}
                    placeholder="Tahlil och qoringa topshiriladi..." />
          <label>Tayyorgarlik yo'riqnomasi (ru)</label>
          <textarea rows={2} value={edit.preparationRu || ''} onChange={(e) => setEdit({ ...edit, preparationRu: e.target.value })} />
          <label>Eslatma necha soat oldin yuborilsin</label>
          <input type="number" value={edit.prepReminderHours} onChange={(e) => setEdit({ ...edit, prepReminderHours: e.target.value })} />

          <label className="row mt" style={{ color: 'var(--text)' }}>
            <input type="checkbox" style={{ width: 16 }} checked={Boolean(edit.isSensitive)} onChange={(e) => setEdit({ ...edit, isSensitive: e.target.checked })} />
            <span>Nozik xizmat — nomi SMS/Telegram xabarlarida yozilmaydi</span>
          </label>
          <label className="row" style={{ color: 'var(--text)' }}>
            <input type="checkbox" style={{ width: 16 }} checked={Boolean(edit.isCourse)} onChange={(e) => setEdit({ ...edit, isCourse: e.target.checked })} />
            <span>Davolash kursi (ko'p seansli)</span>
          </label>
          {edit.isCourse ? (
            <div className="row">
              <div className="grow"><label>Seanslar soni</label><input type="number" value={edit.sessionCount || 1} onChange={(e) => setEdit({ ...edit, sessionCount: e.target.value })} /></div>
              <div className="grow"><label>Oraliq (kun)</label><input type="number" value={edit.sessionIntervalDays || 1} onChange={(e) => setEdit({ ...edit, sessionIntervalDays: e.target.value })} /></div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
