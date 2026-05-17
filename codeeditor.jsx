import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { X } from 'lucide-react';

const extensions = {
  javascript: [javascript({ jsx: true })],
  python: [python()],
  cpp: [cpp()]
};

export default function CodeEditor() {
  const [activeTab, setActiveTab] = useState('authService.js');
  
  const tabs = [
    { name: 'authService.js', lang: 'javascript' },
    { name: 'paymentService.py', lang: 'python' }
  ];

  const codeData = {
    'authService.js': `// Generate a Login API for user authentication

async function loginUser(request) {
  const username = request.body.username;
  const password = request.body.password;
  
  const user = await User.findOne({ username });
  
  if (!user || !user.validatePassword(password)) {
    throw new Error('Invalid credentials');
  }
  
  const token = generateToken(user._id);
  return { token };
}`,
    'paymentService.py': `def validate_payment(amount, currency):
    if amount <= 0:
        raise ValueError("Amount must be positive")
    
    # Process payment
    return {
        "status": "success",
        "amount": amount,
        "currency": currency
    }`
  };

  const currentLang = tabs.find(t => t.name === activeTab)?.lang || 'javascript';

  return (
    <div className="editor-container">
      <div className="editor-tabs-container">
        {tabs.map((tab) => (
          <div
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`editor-tab ${activeTab === tab.name ? 'active' : ''}`}
          >
            <span className="tab-title">{tab.name}</span>
            <X size={14} className="tab-close" />
          </div>
        ))}
      </div>
      
      <div className="breadcrumbs">
        <span>src</span>
        <span>›</span>
        <span>{activeTab}</span>
      </div>

      <div className="code-area">
        <CodeMirror
          value={codeData[activeTab]}
          height="100%"
          theme={vscodeDark}
          extensions={extensions[currentLang]}
        />
      </div>
    </div>
  );
}
