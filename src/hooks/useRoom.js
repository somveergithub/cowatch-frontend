import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket, disconnectSocket } from '../utils/api';

export const useRoom = (roomId, username) => {
  const [roomState, setRoomState] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [videoStatus, setVideoStatus] = useState('pending');
  const [hlsUrl, setHlsUrl] = useState(null);
  const socket = getSocket();

  // ── Connect and join room ───────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !username) return;

    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { room_id: roomId, username });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:joined', (data) => {
      setRoomState(data);
      setUsers(data.users || []);
      setMessages(data.chat_history || []);
      setVideoStatus(data.video_status);
      if (data.hls_url) setHlsUrl(data.hls_url);
    });

    socket.on('room:user_joined', (data) => setUsers(data.users || []));
    socket.on('room:user_left', (data) => setUsers(data.users || []));

    socket.on('video:ready', (data) => {
      setVideoStatus('ready');
      if (data.hls_url) setHlsUrl(data.hls_url);
    });

    socket.on('video:error', () => setVideoStatus('error'));

    socket.on('chat:message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:joined');
      socket.off('room:user_joined');
      socket.off('room:user_left');
      socket.off('video:ready');
      socket.off('video:error');
      socket.off('chat:message');
      disconnectSocket();
    };
  }, [roomId, username]);

  // ── Video sync emitters ─────────────────────────────────────────────────────
  const emitPlay = useCallback((currentTime) => {
    socket.emit('video_play', { room_id: roomId, current_time: currentTime, sent_at: Date.now() });
  }, [roomId]);

  const emitPause = useCallback((currentTime) => {
    socket.emit('video_pause', { room_id: roomId, current_time: currentTime });
  }, [roomId]);

  const emitSeek = useCallback((currentTime) => {
    socket.emit('video_seek', { room_id: roomId, current_time: currentTime, sent_at: Date.now() });
  }, [roomId]);

  const emitBuffer = useCallback((isBuffering) => {
    socket.emit('video_buffer', { room_id: roomId, is_buffering: isBuffering });
  }, [roomId]);

  // ── Chat emitters ───────────────────────────────────────────────────────────
  const sendMessage = useCallback((text) => {
    socket.emit('chat_message', { room_id: roomId, username, text });
  }, [roomId, username]);

  const sendTyping = useCallback((isTyping) => {
    socket.emit('chat_typing', { room_id: roomId, username, is_typing: isTyping });
  }, [roomId, username]);

  return {
    socket,
    connected,
    roomState,
    users,
    messages,
    videoStatus,
    hlsUrl,
    emitPlay,
    emitPause,
    emitSeek,
    emitBuffer,
    sendMessage,
    sendTyping,
  };
};
