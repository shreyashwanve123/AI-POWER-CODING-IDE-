import React from 'react';
import { Files, Search, GitBranch, Blocks, Settings, FileCode2, FileJson, ChevronDown, ChevronRight } from 'lucide-react';

export default function Sidebar() {
  const [isSrcOpen, setIsSrcOpen] = React.useState(true);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        Explorer
      </div>
      
      <div className="sidebar-content">
        <div className="tree-item root">
          <ChevronDown size={14} />
          MINI.PROJECT
        </div>
        
        <div className="tree-children">
          <div>
            <div 
              className={`tree-item ${isSrcOpen ? 'active' : ''}`}
              onClick={() => setIsSrcOpen(!isSrcOpen)}
            >
              {isSrcOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>src</span>
            </div>
            
            {isSrcOpen && (
              <div className="tree-children">
                <div className="tree-item">
                  <FileCode2 size={14} className="file-icon py" /> authService.py
                </div>
                <div className="tree-item">
                  <FileCode2 size={14} className="file-icon js" /> paymentService.js
                </div>
                <div className="tree-item active" style={{ backgroundColor: '#37373d' }}>
                  <FileCode2 size={14} className="file-icon js" /> authService.js
                </div>
              </div>
            )}
          </div>

          <div className="tree-item">
            <FileJson size={14} className="file-icon json" /> package.json
          </div>
          <div className="tree-item">
            <span style={{ color: '#8c9ca2', fontWeight: 'bold', fontSize: '12px', marginLeft: '4px', marginRight: '2px' }}>!</span> .gitignore
          </div>
        </div>
      </div>
    </div>
  );
}
