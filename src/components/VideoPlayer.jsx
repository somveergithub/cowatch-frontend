import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import './VideoPlayer.css';

export default function VideoPlayer({
  hlsUrl,
  videoStatus,
  socket,
  roomId,
  emitPlay,
  emitPause,
  emitSeek,
  emitBuffer,
  isHost,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const isSyncingRef = useRef(false);  // prevent echo loops
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);

  // ── Load HLS stream ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS] Manifest parsed, ready to play');
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) console.error('[HLS] Fatal error:', data);
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      videoRef.current.src = hlsUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [hlsUrl]);

  // ── Incoming sync events from socket ───────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const video = videoRef.current;
    if (!video) return;

    const syncPlay = ({ current_time, sent_at }) => {
      isSyncingRef.current = true;
      // Latency compensation: add half round-trip time
      const latency = (Date.now() - sent_at) / 2000;
      video.currentTime = current_time + latency;
      video.play().catch(() => {});
      setIsPlaying(true);
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    };

    const syncPause = ({ current_time }) => {
      isSyncingRef.current = true;
      video.currentTime = current_time;
      video.pause();
      setIsPlaying(false);
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    };

    const syncSeek = ({ current_time, sent_at }) => {
      isSyncingRef.current = true;
      const latency = (Date.now() - sent_at) / 2000;
      video.currentTime = current_time + latency;
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    };

    const syncBuffer = ({ is_buffering }) => {
      if (is_buffering) video.pause();
      else if (isPlaying) video.play().catch(() => {});
    };

    const syncState = ({ is_playing, current_time }) => {
      isSyncingRef.current = true;
      video.currentTime = current_time;
      if (is_playing) video.play().catch(() => {});
      else video.pause();
      setIsPlaying(is_playing);
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    };

    socket.on('video:play', syncPlay);
    socket.on('video:pause', syncPause);
    socket.on('video:seek', syncSeek);
    socket.on('video:buffer', syncBuffer);
    socket.on('video:state', syncState);

    return () => {
      socket.off('video:play', syncPlay);
      socket.off('video:pause', syncPause);
      socket.off('video:seek', syncSeek);
      socket.off('video:buffer', syncBuffer);
      socket.off('video:state', syncState);
    };
  }, [socket, isPlaying]);

  // ── Local video event handlers ─────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (isSyncingRef.current) return;
    setIsPlaying(true);
    emitPlay(videoRef.current?.currentTime || 0);
  }, [emitPlay]);

  const handlePause = useCallback(() => {
    if (isSyncingRef.current) return;
    setIsPlaying(false);
    emitPause(videoRef.current?.currentTime || 0);
  }, [emitPause]);

  const handleSeeked = useCallback(() => {
    if (isSyncingRef.current) return;
    emitSeek(videoRef.current?.currentTime || 0);
  }, [emitSeek]);

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(videoRef.current?.currentTime || 0);
  }, []);

  const handleDurationChange = useCallback(() => {
    setDuration(videoRef.current?.duration || 0);
  }, []);

  const handleWaiting = useCallback(() => emitBuffer(true), [emitBuffer]);
  const handleCanPlay = useCallback(() => emitBuffer(false), [emitBuffer]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleProgressClick = (e) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = ratio * duration;
    if (videoRef.current) videoRef.current.currentTime = newTime;
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const el = videoRef.current?.parentElement;
    if (!document.fullscreenElement) {
      el?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const autoHideControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // ── Status overlays ────────────────────────────────────────────────────────
  if (videoStatus === 'pending') {
    return (
      <div className="vp-placeholder">
        <div className="vp-status-icon">⬆</div>
        <p>Waiting for host to upload a video</p>
      </div>
    );
  }

  if (videoStatus === 'processing') {
    return (
      <div className="vp-placeholder">
        <div className="vp-processing-ring" />
        <p>Transcoding video, please wait...</p>
        <span className="vp-sub">This may take a few minutes</span>
      </div>
    );
  }

  if (videoStatus === 'error') {
    return (
      <div className="vp-placeholder vp-error">
        <div className="vp-status-icon">✕</div>
        <p>Transcoding failed. Please try uploading again.</p>
      </div>
    );
  }

  return (
    <div
      className={`vp-container ${showControls ? 'controls-visible' : ''}`}
      onMouseMove={autoHideControls}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="vp-video"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onWaiting={handleWaiting}
        onCanPlay={handleCanPlay}
        onClick={togglePlay}
        playsInline
      />

      <div className="vp-controls">
        {/* Progress bar */}
        <div className="vp-progress" onClick={handleProgressClick}>
          <div
            className="vp-progress-fill"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
        </div>

        <div className="vp-controls-row">
          {/* Play/Pause */}
          <button className="vp-btn" onClick={togglePlay}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Time */}
          <span className="vp-time">{formatTime(currentTime)} / {formatTime(duration)}</span>

          <div className="vp-spacer" />

          {/* Volume */}
          <button className="vp-btn" onClick={toggleMute}>
            {isMuted || volume === 0 ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
          <input
            type="range" min="0" max="1" step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="vp-volume-slider"
          />

          {/* Fullscreen */}
          <button className="vp-btn" onClick={toggleFullscreen}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              {isFullscreen ? (
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              ) : (
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              )}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
