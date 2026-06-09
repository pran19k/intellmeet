import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return navigate('/login');

    fetch('http://localhost:4000/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  }

  return (
    <section className="card">
      <h2>Dashboard</h2>
      {user ? (
        <div>
          <p>Signed in as <strong>{user.name}</strong> ({user.email})</p>
          <button onClick={handleLogout}>Sign out</button>
        </div>
      ) : (
        <p>Loading profile...</p>
      )}
      <p>This placeholder will host meetings, analytics widgets, and quick actions.</p>
    </section>
  );
}
