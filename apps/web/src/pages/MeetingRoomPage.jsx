import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { tokenStore } from '../api/auth';
import { getMeeting } from '../api/meetings';
import { createMeetingSocket } from '../api/socket';

function participantLabel(participant) {
  return participant.name || participant.email || participant.id || 'Unknown participant';
}

export default function MeetingRoomPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const token = tokenStore.getAccess();
  const socket = useMemo(() => (token ? createMeetingSocket(token) : null), [token]);

  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [remoteTyping, setRemoteTyping] = useState([]);
  const [signalLog, setSignalLog] = useState([]);
  const [connectionState, setConnectionState] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return undefined;
    }

    let cancelled = false;

    getMeeting(meetingId, token)
      .then((data) => {
        if (!cancelled) {
          setMeeting(data);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.error?.message || 'Unable to load meeting.');
        if (err?.error?.code === 'MISSING_ACCESS_TOKEN' || err?.error?.code === 'INVALID_ACCESS_TOKEN') {
          navigate('/login');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meetingId, navigate, token]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleConnect() {
      setConnectionState('connected');
      socket.emit('meeting:join', { meetingId });
    }

    function handleConnectError(err) {
      setConnectionState('error');
      setError(err?.message || 'Socket connection failed.');
    }

    function handleReady() {
      setConnectionState('connected');
    }

    function handleJoined(payload) {
      if (payload?.meeting) {
        setMeeting((current) => current || payload.meeting);
      }
      if (payload?.participants) {
        setParticipants(payload.participants);
      }
      if (payload?.messages) {
        setMessages(payload.messages);
      }
    }

    function handleParticipantUpdate(payload) {
      if (payload?.meetingId !== meetingId) return;
      setParticipants(payload.participants || []);
    }

    function handleMeetingError(payload) {
      if (payload?.meetingId && payload.meetingId !== meetingId) return;
      setError(payload?.message || 'Unable to join meeting room.');
      setConnectionState('error');
    }

    function handleChatMessage(payload) {
      if (payload?.meetingId !== meetingId) return;
      setMessages((current) => [...current, payload.message]);
    }

    function handleTyping(payload) {
      if (payload?.meetingId !== meetingId) return;
      setRemoteTyping((current) => {
        const next = current.filter((entry) => entry.senderId !== payload.senderId);
        if (payload.isTyping) {
          next.push({ senderId: payload.senderId, senderName: payload.senderName });
        }
        return next;
      });
    }

    function handleSignal(payload) {
      if (payload?.meetingId !== meetingId) return;
      setSignalLog((current) => [
        ...current,
        {
          id: `${Date.now()}-${payload.senderPeerId || 'peer'}`,
          type: payload.type,
          senderName: payload.senderName || payload.senderId || 'Peer',
          summary: payload.data?.sdp ? `${payload.type} SDP received` : `${payload.type} signal received`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('socket:ready', handleReady);
    socket.on('meeting:joined', handleJoined);
    socket.on('participant:update', handleParticipantUpdate);
    socket.on('meeting:error', handleMeetingError);
    socket.on('chat:new-message', handleChatMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('signal', handleSignal);

    setConnectionState('connecting');
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('socket:ready', handleReady);
      socket.off('meeting:joined', handleJoined);
      socket.off('participant:update', handleParticipantUpdate);
      socket.off('meeting:error', handleMeetingError);
      socket.off('chat:new-message', handleChatMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('signal', handleSignal);

      socket.emit('meeting:leave', { meetingId });
      socket.disconnect();
    };
  }, [meetingId, socket]);

  function handleSendMessage(e) {
    e.preventDefault();
    const text = draftMessage.trim();
    if (!text || !socket) return;

    socket.emit('chat:message', { meetingId, text });
    setDraftMessage('');
    socket.emit('chat:typing', { meetingId, isTyping: false });
  }

  function handleDraftChange(nextValue) {
    setDraftMessage(nextValue);
    if (!socket) return;
    socket.emit('chat:typing', { meetingId, isTyping: nextValue.trim().length > 0 });
  }

  async function handleSendSignal() {
    if (!socket) return;

    const message = `Hello from ${socket.id}`;
    socket.emit('signal', {
      meetingId,
      type: 'data',
      data: { message },
    });
    setSignalLog((current) => [
      ...current,
      {
        id: `${Date.now()}-local-signal`,
        type: 'data',
        senderName: 'You',
        summary: 'Local data signal sent',
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  const statusText = connectionState === 'connected'
    ? 'Live'
    : connectionState === 'connecting'
      ? 'Connecting'
      : connectionState === 'error'
        ? 'Connection issue'
        : 'Idle';

  return (
    <section className="meeting-room">
      <div className="meeting-hero card">
        <div>
          <p className="eyebrow">Meeting room</p>
          <h2>{meeting?.title || `Meeting ${meetingId}`}</h2>
          <p className="muted">Status: {statusText}</p>
        </div>
        <div className="meeting-actions">
          <Link className="button secondary" to="/dashboard">Back to dashboard</Link>
          <span className={`status-pill ${connectionState}`}>{statusText}</span>
        </div>
      </div>

      {error && <div className="card notice error">{error}</div>}

      <div className="meeting-grid">
        <article className="card meeting-panel">
          <h3>Room state</h3>
          <p className="muted">
            {meeting?.description || 'Join status is driven by the socket handshake and participant updates.'}
          </p>
          <div className="metric-row">
            <div>
              <span className="metric-label">Meeting ID</span>
              <strong>{meetingId}</strong>
            </div>
            <div>
              <span className="metric-label">Participants</span>
              <strong>{participants.length}</strong>
            </div>
          </div>
        </article>

        <article className="card meeting-panel">
          <h3>Presence</h3>
          {participants.length > 0 ? (
            <ul className="participant-list">
              {participants.map((participant) => (
                <li key={participant.socketId || participant.id}>
                  <span className="participant-dot" />
                  <span>{participantLabel(participant)}</span>
                  <small>{participant.role || 'member'}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Waiting for the socket server to confirm the room state.</p>
          )}
          {remoteTyping.length > 0 && (
            <p className="typing-indicator">
              {remoteTyping.map((entry) => entry.senderName).join(', ')} {remoteTyping.length > 1 ? 'are' : 'is'} typing...
            </p>
          )}
        </article>
      </div>

      <div className="meeting-grid">
        <article className="card meeting-panel chat-panel">
          <div className="panel-heading-row">
            <h3>Chat</h3>
            <button type="button" className="button secondary" onClick={handleSendSignal}>Send test signal</button>
          </div>
          <div className="chat-log">
            {messages.length > 0 ? (
              messages.map((message) => (
                <div className="chat-message" key={message.id}>
                  <div className="chat-message-meta">
                    <strong>{message.senderName || message.senderId}</strong>
                    <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p>{message.text}</p>
                </div>
              ))
            ) : (
              <p className="muted">No messages yet. Start the room conversation here.</p>
            )}
          </div>
          <form className="chat-form" onSubmit={handleSendMessage}>
            <input
              value={draftMessage}
              onChange={(e) => handleDraftChange(e.target.value)}
              placeholder="Write a message..."
            />
            <button type="submit">Send</button>
          </form>
        </article>

        <article className="card meeting-panel signal-panel">
          <h3>Signal log</h3>
          <p className="muted">WebRTC signaling events are relayed through the socket server and recorded here for the room.</p>
          <div className="signal-log">
            {signalLog.length > 0 ? (
              signalLog.map((entry) => (
                <div className="signal-entry" key={entry.id}>
                  <strong>{entry.senderName}</strong>
                  <span>{entry.summary}</span>
                  <small>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
              ))
            ) : (
              <p className="muted">No signals have been exchanged yet.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}