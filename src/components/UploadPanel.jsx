import React, { useState, useRef } from 'react';
import { getUploadUrl, uploadToS3, confirmUpload } from '../utils/api';
import './UploadPanel.css';

export default function UploadPanel({ roomId, onUploadStarted }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('idle'); // idle | uploading | confirming | done | error
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const ALLOWED = ['video/mp4', 'video/webm', 'video/mkv', 'video/x-matroska', 'video/avi'];

  const handleFile = (f) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type) && !f.name.match(/\.(mp4|webm|mkv|avi)$/i)) {
      return setError('Unsupported file type. Use MP4, WebM, MKV, or AVI.');
    }
    setFile(f);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStage('uploading');
    setError('');
    try {
      // Get presigned S3 URL
      const sizeMb = file.size / (1024 * 1024);
      const urlRes = await getUploadUrl(roomId, file.name, file.type || 'video/mp4', sizeMb);
      const { presigned_url, s3_key } = urlRes.data;

      // Upload directly to S3
      await uploadToS3(presigned_url, file, setProgress);

      // Tell backend transcoding can start
      setStage('confirming');
      await confirmUpload(roomId, s3_key, file.name.replace(/\.[^.]+$/, ''));

      setStage('done');
      onUploadStarted && onUploadStarted();
    } catch (e) {
      console.error('[upload]', e);
      setError('Upload failed. Please try again.');
      setStage('error');
    }
  };

  if (stage === 'done') {
    return (
      <div className="upload-panel upload-done">
        <div className="upload-done-icon">✓</div>
        <p>Upload complete — transcoding in progress</p>
        <span>The video will appear automatically when ready</span>
      </div>
    );
  }

  return (
    <div className="upload-panel">
      <div className="upload-label">◈ upload video</div>

      <div
        className={`upload-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/mkv,.mkv,video/avi"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {file ? (
          <div className="upload-file-info">
            <span className="upload-file-icon">▶</span>
            <span className="upload-file-name">{file.name}</span>
            <span className="upload-file-size">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
          </div>
        ) : (
          <div className="upload-placeholder">
            <span className="upload-icon">⬆</span>
            <p>Drop video here or click to browse</p>
            <span>MP4, WebM, MKV, AVI supported</span>
          </div>
        )}
      </div>

      {error && <p className="upload-error">{error}</p>}

      {stage === 'uploading' && (
        <div className="upload-progress">
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="upload-progress-text">{progress}%</span>
        </div>
      )}

      {stage === 'confirming' && (
        <p className="upload-confirming">Starting transcoder...</p>
      )}

      {file && stage === 'idle' && (
        <button className="upload-btn" onClick={handleUpload}>
          Upload & Start Transcoding →
        </button>
      )}

      {stage === 'error' && (
        <button className="upload-btn" onClick={() => { setStage('idle'); setProgress(0); }}>
          Try Again
        </button>
      )}
    </div>
  );
}
