import React, { useEffect, useRef } from 'react';
import './WebcamGrid.css';

function VideoTile({ stream, username, isLocal, isCamEnabled, isMicEnabled }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="webcam-tile">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}   // always mute local to avoid feedback
          className="webcam-video"
        />
      ) : (
        <div className="webcam-avatar">
          <span>{username?.[0]?.toUpperCase() || '?'}</span>
        </div>
      )}
      <div className="webcam-info">
        <span className="webcam-name">{username}{isLocal ? ' (you)' : ''}</span>
        <div className="webcam-indicators">
          {!isMicEnabled && <span className="indicator mic-off" title="Muted">🎤</span>}
          {!isCamEnabled && <span className="indicator cam-off" title="Camera off">📷</span>}
        </div>
      </div>
    </div>
  );
}

export default function WebcamGrid({
  localStream,
  remoteStreams,
  users,
  currentSid,
  camEnabled,
  micEnabled,
  toggleCam,
  toggleMic,
}) {
  const currentUser = users.find((u) => u.sid === currentSid);

  return (
    <div className="webcam-grid">
      <div className="webcam-header">
        <span className="webcam-title">◈ participants</span>
        <span className="webcam-count">{users.length}</span>
      </div>

      <div className="webcam-tiles">
        {/* Local video tile */}
        <VideoTile
          stream={localStream}
          username={currentUser?.username || 'You'}
          isLocal={true}
          isCamEnabled={camEnabled}
          isMicEnabled={micEnabled}
        />

        {/* Remote video tiles */}
        {users
          .filter((u) => u.sid !== currentSid)
          .map((user) => (
            <VideoTile
              key={user.sid}
              stream={remoteStreams[user.sid] || null}
              username={user.username}
              isLocal={false}
              isCamEnabled={true}
              isMicEnabled={true}
            />
          ))}
      </div>

      {/* Local controls */}
      <div className="webcam-controls">
        <button
          className={`cam-ctrl-btn ${!micEnabled ? 'off' : ''}`}
          onClick={toggleMic}
          title={micEnabled ? 'Mute mic' : 'Unmute mic'}
        >
          {micEnabled ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          )}
          <span>{micEnabled ? 'Mute' : 'Unmute'}</span>
        </button>

        <button
          className={`cam-ctrl-btn ${!camEnabled ? 'off' : ''}`}
          onClick={toggleCam}
          title={camEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {camEnabled ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
            </svg>
          )}
          <span>{camEnabled ? 'Cam off' : 'Cam on'}</span>
        </button>
      </div>
    </div>
  );
}
