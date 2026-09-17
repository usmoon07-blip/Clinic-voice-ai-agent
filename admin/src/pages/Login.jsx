import { useState } from 'react';
import { api, unwrap } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await api.post('/login', form).then(unwrap);
      localStorage.setItem('clinic_admin_token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="card">
        <h1>🏥 Admin panel</h1>
        {error ? <div className="alert error">{error}</div> : null}
        <form onSubmit={submit}>
          <label>Login</label>
          <input value={form.login} autoFocus onChange={(e) => setForm({ ...form, login: e.target.value })} />
          <label>Parol</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button className="btn block mt" disabled={busy}>{busy ? 'Kirilmoqda...' : 'Kirish'}</button>
        </form>
      </div>
    </div>
  );
}
