import { API_BASE, tokenStore } from './auth';

async function request(path, token) {
  const accessToken = token || tokenStore.getAccess();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw data || { error: { message: 'Network error' } };
  return data;
}

export async function getMeeting(meetingId, token) {
  return request(`/api/meetings/${meetingId}`, token);
}