import React, { useState, useEffect } from 'react';
import TopNav from './components/TopNav';
import Sidebar from './components/Sidebar';
import CodeEditor from './components/CodeEditor';
import AIAssistant from './components/AIAssistant';
import TerminalPanel from './components/TerminalPanel';

function App() {
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
  }, [theme]);

  return (
    <div className="app-container">
      <TopNav theme={theme} toggleTheme={toggleTheme} />

      <div className="main-content">
        <Sidebar />

        <div className="center-area">
          <CodeEditor />
          <TerminalPanel />
        </div>

        <AIAssistant />
      </div>
    </div>
  );
}

export default App;
