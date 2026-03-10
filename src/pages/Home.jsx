import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../utils/api';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('create'); // 'create' | 'join'

  const handleCreate = async () => {
    if (!username.trim()) return setError('Enter your name first');
    setLoading(true);
    setError('');
    try {
      const res = await createRoom(username.trim());
      const roomId = res.data.room_id;
      sessionStorage.setItem('cw_username', username.trim());
      navigate(`/room/${roomId}`);
    } catch (e) {
      setError('Failed to create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = () => {
    if (!username.trim()) return setError('Enter your name first');
    if (!joinCode.trim()) return setError('Enter a room code');
    sessionStorage.setItem('cw_username', username.trim());
    navigate(`/room/${joinCode.trim().toUpperCase()}`);
  };

  return (
    <div className="home">
      <div className="home-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="home-content">
        <div className="home-hero">
          <div className="home-logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">cowatch</span>
          </div>
          <p className="home-tagline">watch together, feel together</p>
        </div>

        <div className="home-card">
          <div className="tab-row">
            <button
              className={`tab-btn ${mode === 'create' ? 'active' : ''}`}
              onClick={() => { setMode('create'); setError(''); }}
            >
              Create Room
            </button>
            <button
              className={`tab-btn ${mode === 'join' ? 'active' : ''}`}
              onClick={() => { setMode('join'); setError(''); }}
            >
              Join Room
            </button>
          </div>

          <div className="form-group">
            <label>Your name</label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleJoin())}
              maxLength={50}
            />
          </div>

          {mode === 'join' && (
            <div className="form-group">
              <label>Room code</label>
              <input
                type="text"
                placeholder="e.g. A3X9KZ2P"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={8}
                className="code-input"
              />
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button
            className="primary-btn"
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : mode === 'create' ? (
              'Create Room →'
            ) : (
              'Join Room →'
            )}
          </button>
        </div>

        <p className="home-footer">
          No account needed — just share the room code with your partner
        </p>
      </div>
    </div>
  );
}
