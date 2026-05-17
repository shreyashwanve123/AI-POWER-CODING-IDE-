import React, { useState } from 'react';
import { Bot, Mic, Send, Zap, Bug, FileCode, CheckCircle2, ChevronDown, ListFilter, Sparkles } from 'lucide-react';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your AI coding assistant. How can I help you today?' },
    { role: 'user', text: 'Generate a Login API for user authentication.' },
    { role: 'assistant', text: 'Of course! Let me generate the Login API code for user authentication. I have added the code to authService.js.' }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    setInput('');
    setIsGenerating(true);
    
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: 'I have analyzed your request and generated the solution. Let me know if you need more details!' 
      }]);
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <div className="ai-panel">
      <div className="ai-header">
        <div className="ai-title">
          <Bot size={18} className="ai-icon" />
          <span>AI Assistant</span>
        </div>
        <div className="ai-actions">
          <button className="icon-only-btn"><Mic size={16} /></button>
          <button className="icon-only-btn"><ListFilter size={16} /></button>
        </div>
      </div>

      <div className="ai-chips">
        <button className="chip-btn">
          <Zap size={12} style={{ color: '#facc15' }} /> Optimize
        </button>
        <button className="chip-btn">
          <Bug size={12} style={{ color: '#f87171' }} /> Debug
        </button>
        <button className="chip-btn">
          <FileCode size={12} style={{ color: '#60a5fa' }} /> Explain
        </button>
        <button className="chip-btn">
          <Sparkles size={12} style={{ color: '#c084fc' }} /> Generate
        </button>
      </div>

      <div className="chat-history">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg-row ${msg.role}`}>
            <div className={`avatar ${msg.role === 'user' ? 'user-avatar' : 'ai-avatar'}`}>
              {msg.role === 'user' ? 'U' : <Bot size={14} className="ai-icon" />}
            </div>
            
            <div className="message-bubble">
              {msg.text}
            </div>
          </div>
        ))}
        
        {isGenerating && (
          <div className="chat-msg-row ai">
            <div className="avatar ai-avatar">
              <Bot size={14} className="ai-icon" />
            </div>
            <div className="typing-indicator">
              <div className="dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <span className="typing-text">Generating response...</span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask AI assistant..."
            className="chat-input"
          />
          <button 
            onClick={sendMessage}
            className="send-btn"
            disabled={!input.trim() || isGenerating}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
