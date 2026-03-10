import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:8000';

// ── Axios API client ──────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: API_URL });

export const createRoom = (hostUsername) =>
  api.post('/api/rooms', { host_username: hostUsername });

export const getRoom = (roomId) =>
  api.get(`/api/rooms/${roomId}`);

export const getUploadUrl = (roomId, filename, contentType, fileSizeMb) =>
  api.post(`/api/rooms/${roomId}/upload`, { filename, content_type: contentType, file_size_mb: fileSizeMb });

export const confirmUpload = (roomId, s3Key, videoTitle) =>
  api.post(`/api/rooms/${roomId}/confirm-upload`, { s3_key: s3Key, video_title: videoTitle });

export const getMessages = (roomId) =>
  api.get(`/api/rooms/${roomId}/messages`);

// ── Upload directly to S3 via presigned URL ───────────────────────────────────
export const uploadToS3 = async (presignedUrl, file, onProgress) => {
  return axios.put(presignedUrl, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (e) => {
      const pct = Math.round((e.loaded * 100) / e.total);
      onProgress && onProgress(pct);
    },
  });
};

// ── Socket.io singleton ───────────────────────────────────────────────────────
let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
