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
    if (!token) {
      navigate('/login');
      return;
    }
    fetch(`${API_BASE}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null));
  }, [navigate]);

  function handleLogout() {
    tokenStore.clear();
    navigate('/login');
  }

  async function handleCreateMeeting() {
    const token = tokenStore.getAccess();
    const res = await fetch(`${API_BASE}/api/meetings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title: 'New Meeting' })
    });
    const data = await res.json();
    const id = data?.data?._id || data?.data?.id || data?._id || data?.id;
    if (id) {
      navigate(`/meeting/${id}`);
    }
  }

  function handleJoinMeeting(e) {
    e.preventDefault();
    const trimmed = meetingId.trim();
    if (!trimmed) return;
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
              Signed in as <strong>{user.name}</strong>
            </p>
          ) : (
            <p className="muted">Loading profile...</p>
          )}
        </div>
        <button onClick={handleLogout}>Sign out</button>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <h3>Create a meeting</h3>
          <button onClick={handleCreateMeeting}>
            Start new meeting
          </button>
        </section>
        <section className="card">
          <h3>Join a meeting</h3>
          <form onSubmit={handleJoinMeeting}
                className="stacked-form">
            <label>
              Meeting ID
              <input
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="e.g. 64f..."
              />
            </label>
            <button type="submit">Open room</button>
          </form>
          {joinError && <p className="error-text">{joinError}</p>}
        </section>
      </div>
    </section>
  );
}