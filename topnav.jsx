import React from 'react';
import { Play, Save, FolderOpen, FilePlus, Moon, Sun } from 'lucide-react';

export default function TopNav({ theme, toggleTheme }) {
  return (
    <div className="topnav">
      <div className="topnav-left">
        <div className="topnav-brand">
          <div className="brand-icon">
            AI
          </div>
          <span className="brand-text">
            AI Coding IDE
          </span>
        </div>
        
        <div className="divider"></div>
        
        <div className="nav-buttons">
          <button className="icon-button">
            <FilePlus size={14} /> New File
          </button>
          <button className="icon-button">
            <FolderOpen size={14} /> Open Project
          </button>
          <button className="icon-button">
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      <div className="topnav-right">
        <button className="primary-button">
          <Play size={14} fill="currentColor" /> Run Code
        </button>
        
        <div className="divider"></div>
        
        <button 
          onClick={toggleTheme}
          className="icon-only-btn"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  );
}
