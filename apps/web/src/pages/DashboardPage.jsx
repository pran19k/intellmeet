import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, tokenStore } from '../api/auth';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [meetingId, setMeetingId] = useState('');
  const [joinError, setJoinError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = tokenStore.getAccess();
    if (!token) return navigate('/login');

    fetch(`${API_BASE}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, [navigate]);

  function handleLogout() {
    tokenStore.clear();
    navigate('/login');
  }

  function handleJoinMeeting(e) {
    e.preventDefault();
    setJoinError(null);

    const trimmed = meetingId.trim();
    if (!trimmed) {
      setJoinError('Enter a meeting ID to continue.');
      return;
    }

    navigate(`/meeting/${trimmed}`);
  }

  return (
    <section className="dashboard-shell">
      <div className="card dashboard-banner">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Dashboard</h2>
          {user ? (
            <p className="muted">
              Signed in as <strong>{user.name}</strong> ({user.email})
            </p>
          ) : (
            <p className="muted">Loading profile...</p>
          )}
        </div>
        <button onClick={handleLogout}>Sign out</button>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h3>Join a meeting</h3>
          <form onSubmit={handleJoinMeeting} className="stacked-form">
            <label>
              Meeting ID
              <input value={meetingId} onChange={(e) => setMeetingId(e.target.value)} placeholder="e.g. 64f..." />
            </label>
            <button type="submit">Open room</button>
          </form>
          {joinError && <p className="error-text">{joinError}</p>}
        </section>

        <section className="card">
          <h3>Live presence</h3>
          <p className="muted">The meeting room now subscribes to socket presence updates and room membership checks.</p>
          <p className="muted">Once you open a room, the participant list and connection state update from the socket events.</p>
        </section>
      </div>
    </section>
  );
}
