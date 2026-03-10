import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = (socket, currentSid) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { sid: MediaStream }
  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const peerConnections = useRef({});                     // { sid: RTCPeerConnection }
  const localStreamRef = useRef(null);

  // ── Start local camera/mic ──────────────────────────────────────────────────
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn('[WebRTC] Could not access camera/mic:', err.message);
      return null;
    }
  }, []);

  // ── Create a peer connection to a remote user ───────────────────────────────
  const createPeerConnection = useCallback((remoteSid) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // When remote track arrives, add to remoteStreams
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => ({ ...prev, [remoteSid]: remoteStream }));
    };

    // Relay ICE candidates via socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('rtc_ice_candidate', {
          target_sid: remoteSid,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[remoteSid];
          return next;
        });
        delete peerConnections.current[remoteSid];
      }
    };

    peerConnections.current[remoteSid] = pc;
    return pc;
  }, [socket]);

  // ── Handle incoming WebRTC signaling events ─────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // A new user joined — WE initiate the offer to them
    socket.on('rtc:user_joined', async ({ sid }) => {
      if (sid === currentSid) return;
      const pc = createPeerConnection(sid);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('rtc_offer', { target_sid: sid, offer });
    });

    // We received an offer — send back an answer
    socket.on('rtc:offer', async ({ from_sid, offer }) => {
      const pc = createPeerConnection(from_sid);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('rtc_answer', { target_sid: from_sid, answer });
    });

    // We received an answer to our offer
    socket.on('rtc:answer', async ({ from_sid, answer }) => {
      const pc = peerConnections.current[from_sid];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // ICE candidate from a peer
    socket.on('rtc:ice_candidate', async ({ from_sid, candidate }) => {
      const pc = peerConnections.current[from_sid];
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn('[WebRTC] ICE error:', e); }
      }
    });

    // Peer left — clean up their connection
    socket.on('rtc:user_left', ({ sid }) => {
      if (peerConnections.current[sid]) {
        peerConnections.current[sid].close();
        delete peerConnections.current[sid];
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[sid];
        return next;
      });
    });

    return () => {
      socket.off('rtc:user_joined');
      socket.off('rtc:offer');
      socket.off('rtc:answer');
      socket.off('rtc:ice_candidate');
      socket.off('rtc:user_left');
    };
  }, [socket, currentSid, createPeerConnection]);

  // ── Toggle cam/mic ──────────────────────────────────────────────────────────
  const toggleCam = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setCamEnabled((prev) => !prev);
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setMicEnabled((prev) => !prev);
    }
  }, []);

  // ── Cleanup all on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    localStream,
    remoteStreams,
    camEnabled,
    micEnabled,
    startLocalStream,
    toggleCam,
    toggleMic,
  };
};
