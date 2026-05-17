import React, { useState } from 'react';
import { Terminal as TerminalIcon, X, ChevronUp, Trash2 } from 'lucide-react';

export default function TerminalPanel() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <div className="terminal-closed" onClick={() => setIsOpen(true)}>
        <ChevronUp size={14} /> Open Terminal
      </div>
    );
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-tabs">
          <div className="term-tab">Problems</div>
          <div className="term-tab">Output</div>
          <div className="term-tab active">
            Terminal
          </div>
          <div className="term-tab">AI Debug</div>
        </div>
        
        <div className="terminal-actions">
          <button className="icon-only-btn" title="Clear Terminal">
            <Trash2 size={14} />
          </button>
          <button className="icon-only-btn" onClick={() => setIsOpen(false)}>
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="terminal-content">
        <div className="terminals-list">
          <div className="term-item">
            <span>bash</span>
            <TerminalIcon size={12} />
          </div>
        </div>
        
        <div className="term-output">
          <div className="text-green">user@workspace:~/MINI.PROJECT/src$</div>
          <div className="term-output-line cmd">
            <span className="text-green">user@workspace:~/MINI.PROJECT/src$</span>
            <span style={{ display: 'flex', gap: '8px' }}>node authService.js
              <span className="cursor-blink"></span>
            </span>
          </div>
          <div className="term-output-line term-muted">Server listening on port 3000...</div>
          <div className="term-output-line text-yellow">[Warn] AI Assistant indexing project files...</div>
        </div>
      </div>
    </div>
  );
}
