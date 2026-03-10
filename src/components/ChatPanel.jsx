import React, { useState, useEffect, useRef } from 'react';
import './ChatPanel.css';

export default function ChatPanel({ messages, sendMessage, sendTyping, username, typingUsers }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText('');
    sendTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    sendTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(false), 1500);
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group consecutive messages from same user
  const groupedMessages = messages.reduce((groups, msg, i) => {
    const prev = messages[i - 1];
    const isContinuation = prev && prev.username === msg.username;
    groups.push({ ...msg, isContinuation });
    return groups;
  }, []);

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">◈ chat</span>
        <span className="chat-badge">{messages.length}</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>No messages yet</p>
            <span>Say something ✨</span>
          </div>
        )}

        {groupedMessages.map((msg) => {
          const isOwn = msg.username === username;
          return (
            <div
              key={msg.id}
              className={`chat-msg ${isOwn ? 'own' : 'other'} ${msg.isContinuation ? 'continuation' : ''}`}
            >
              {!msg.isContinuation && (
                <div className="chat-msg-meta">
                  <span className="chat-msg-user">{isOwn ? 'you' : msg.username}</span>
                  <span className="chat-msg-time">{formatTime(msg.created_at)}</span>
                </div>
              )}
              <div className="chat-msg-bubble">{msg.text}</div>
            </div>
          );
        })}

        {typingUsers && typingUsers.length > 0 && (
          <div className="chat-typing-indicator">
            <span className="typing-dots">
              <span /><span /><span />
            </span>
            <span className="typing-text">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Type a message..."
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={1000}
        />
        <button
          className={`chat-send-btn ${text.trim() ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!text.trim()}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
