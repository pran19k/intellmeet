import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, tokenStore } from '../api/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await login({ email, password });
      tokenStore.set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      navigate('/dashboard');
    } catch (err) {
      setError(err?.error?.message || 'Login failed');
    }
  }

  return (
    <section className="card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div>
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="submit">Sign in</button>
        </div>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>
    </section>
  );
}
