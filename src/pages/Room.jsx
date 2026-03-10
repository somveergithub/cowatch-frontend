import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRoom } from '../utils/api';
import { useRoom } from '../hooks/useRoom';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoPlayer from '../components/VideoPlayer';
import WebcamGrid from '../components/WebcamGrid';
import ChatPanel from '../components/ChatPanel';
import UploadPanel from '../components/UploadPanel';
import './Room.css';

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const username = sessionStorage.getItem('cw_username') || 'Guest';

  const [roomInfo, setRoomInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const isHost = roomInfo?.host_username === username;

  // ── Load room info ──────────────────────────────────────────────────────────
  useEffect(() => {
    getRoom(roomId)
      .then((res) => setRoomInfo(res.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [roomId, navigate]);

  // ── Room socket hook ────────────────────────────────────────────────────────
  const {
    socket, connected, users, messages,
    videoStatus, hlsUrl,
    emitPlay, emitPause, emitSeek, emitBuffer,
    sendMessage, sendTyping,
  } = useRoom(roomId, username);

  const currentSid = socket?.id;

  // ── WebRTC hook ─────────────────────────────────────────────────────────────
  const {
    localStream, remoteStreams,
    camEnabled, micEnabled,
    startLocalStream, toggleCam, toggleMic,
  } = useWebRTC(socket, currentSid);

  // Start local camera when connected
  useEffect(() => {
    if (connected) startLocalStream();
  }, [connected, startLocalStream]);

  // ── Typing indicator ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const timers = {};

    socket.on('chat:typing', ({ sid, username: uname, is_typing }) => {
      if (sid === currentSid) return;
      if (is_typing) {
        setTypingUsers((prev) => prev.includes(uname) ? prev : [...prev, uname]);
        clearTimeout(timers[sid]);
        timers[sid] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== uname));
        }, 3000);
      } else {
        setTypingUsers((prev) => prev.filter((u) => u !== uname));
      }
    });

    return () => socket.off('chat:typing');
  }, [socket, currentSid]);

  // ── Copy room code ──────────────────────────────────────────────────────────
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="room-loading">
        <div className="room-loading-ring" />
        <span>Joining room...</span>
      </div>
    );
  }

  return (
    <div className="room">
      {/* ── Top bar ── */}
      <header className="room-header">
        <div className="room-header-left">
          <span className="room-logo">◈ cowatch</span>
          {roomInfo?.video_title && (
            <span className="room-video-title">{roomInfo.video_title}</span>
          )}
        </div>

        <div className="room-header-center">
          <div className={`room-conn-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span className="room-conn-label">{connected ? 'live' : 'connecting...'}</span>
        </div>

        <div className="room-header-right">
          <button className="room-code-btn" onClick={copyRoomCode}>
            <span className="room-code">{roomId}</span>
            <span className="room-code-copy">{copied ? '✓ copied' : 'copy'}</span>
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="room-body">

        {/* Left: Video */}
        <main className="room-main">
          {/* Upload panel — only shown to host when no video yet */}
          {isHost && (videoStatus === 'pending') && (
            <UploadPanel roomId={roomId} onUploadStarted={() => {}} />
          )}

          <div className="room-player-wrap">
            <VideoPlayer
              hlsUrl={hlsUrl}
              videoStatus={videoStatus}
              socket={socket}
              roomId={roomId}
              emitPlay={emitPlay}
              emitPause={emitPause}
              emitSeek={emitSeek}
              emitBuffer={emitBuffer}
              isHost={isHost}
            />
          </div>
        </main>

        {/* Right sidebar: Webcams + Chat */}
        <aside className="room-sidebar">
          <div className="room-sidebar-webcams">
            <WebcamGrid
              localStream={localStream}
              remoteStreams={remoteStreams}
              users={users}
              currentSid={currentSid}
              camEnabled={camEnabled}
              micEnabled={micEnabled}
              toggleCam={toggleCam}
              toggleMic={toggleMic}
            />
          </div>

          <div className="room-sidebar-chat">
            <ChatPanel
              messages={messages}
              sendMessage={sendMessage}
              sendTyping={sendTyping}
              username={username}
              typingUsers={typingUsers}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
