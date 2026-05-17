import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const defaultLanguageOptions = [
  { id: 'javascript', label: 'javascript', extension: '.js' },
  { id: 'jsx', label: 'jsx', extension: '.jsx' },
  { id: 'python', label: 'python', extension: '.py' },
  { id: 'typescript', label: 'typescript', extension: '.ts' },
  { id: 'tsx', label: 'tsx', extension: '.tsx' },
  { id: 'cpp', label: 'cpp', extension: '.cpp' },
  { id: 'java', label: 'java', extension: '.java' },
  { id: 'html', label: 'html', extension: '.html' },
  { id: 'css', label: 'css', extension: '.css' },
  { id: 'json', label: 'json', extension: '.json' },
  { id: 'markdown', label: 'markdown', extension: '.md' },
]

const extensionMap = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.cpp': 'cpp',
  '.java': 'java',
  '.html': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
}

const languageExtensionMap = {
  javascript: '.js',
  jsx: '.jsx',
  python: '.py',
  typescript: '.ts',
  tsx: '.tsx',
  cpp: '.cpp',
  java: '.java',
  html: '.html',
  css: '.css',
  json: '.json',
  markdown: '.md',
}

const menuItems = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal']

const menuContent = {
  File: [
    'New File and New Folder from Explorer buttons.',
    'Save current file from Save button.',
    'Delete selected file or folder from Delete button.',
  ],
  Edit: [
    'Write or update code directly in the editor area.',
    'Line numbers help quick editing like VS Code.',
    'Auto language detection works from file extension.',
  ],
  Selection: [
    'Select file from Explorer tree to load in editor.',
    'Current active file appears in tab area.',
    'Selected language is shown in toolbar and status bar.',
  ],
  View: [
    'Left side Explorer panel for workspace files.',
    'Center editor panel for coding and running.',
    'Right side debug panel for output and AI help.',
  ],
  Go: [
    'Open any file quickly from Explorer tree.',
    'Switch between files using the tab section.',
    'Jump to errors from execution output and AI debug advice.',
  ],
  Run: [
    'Select language from dropdown.',
    'Click Run to execute code.',
    'Execution output appears in Debug Console.',
  ],
  Terminal: [
    'Backend runs on port 4000 with npm run server.',
    'Frontend runs with npm run dev.',
    'Use npm run dev:full to run both together.',
  ],
}

function getFileExtension(filePath) {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot < 0) {
    return ''
  }

  return filePath.slice(lastDot)
}

function inferLanguage(filePath) {
  return extensionMap[getFileExtension(filePath)] || 'javascript'
}

function getParentFolder(pathValue) {
  if (!pathValue || !pathValue.includes('/')) {
    return ''
  }

  return pathValue.split('/').slice(0, -1).join('/')
}

function joinPath(basePath, name) {
  if (!basePath) {
    return name
  }

  return `${basePath}/${name}`
}

function flattenNodes(nodes) {
  const result = []

  for (const node of nodes) {
    result.push(node)
    if (node.type === 'folder' && node.children?.length) {
      result.push(...flattenNodes(node.children))
    }
  }

  return result
}

function FileTree({ nodes, selectedPath, onSelect }) {
  if (!nodes.length) {
    return <p className="tree-empty">No files found.</p>
  }

  return (
    <ul className="tree-list">
      {nodes.map((node) => (
        <li key={node.path}>
          <button
            type="button"
            className={`tree-node ${selectedPath === node.path ? 'active' : ''}`}
            onClick={() => onSelect(node)}
          >
            <span aria-hidden="true">{node.type === 'folder' ? '📁' : '📄'}</span>
            <span>{node.name}</span>
          </button>
          {node.type === 'folder' && node.children?.length > 0 && (
            <FileTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} />
          )}
        </li>
      ))}
    </ul>
  )
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {}
    return { name: 'Local User', email: '' }
  })
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken') || '')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [googleSdkReady, setGoogleSdkReady] = useState(() => Boolean(window.google?.accounts?.id))
  const [lastSignedInUser, setLastSignedInUser] = useState(() => {
    try {
      const stored = localStorage.getItem('lastSignedInUser')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {}
    return null
  })
  const [tree, setTree] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [languageOptions, setLanguageOptions] = useState(defaultLanguageOptions)
  const [status, setStatus] = useState('Ready')
  const [aiStatus, setAiStatus] = useState(null)
  const [output, setOutput] = useState('Program output will appear here.')
  const [executionInput, setExecutionInput] = useState('')
  const [htmlPreview, setHtmlPreview] = useState('')
  const [debugAdvice, setDebugAdvice] = useState('AI debug suggestions will appear here when an error happens.')
  const [codeExplanation, setCodeExplanation] = useState('Code explanation will appear here.')
  const [explainInput, setExplainInput] = useState('')
  const [explainLang, setExplainLang] = useState(language)
  const [isRunning, setIsRunning] = useState(false)
  const [isDebugging, setIsDebugging] = useState(false)
  const [autosaveEnabled, setAutosaveEnabled] = useState(true)
  const [autosaveIntervalMs, setAutosaveIntervalMs] = useState(5000)
  const [isExplaining, setIsExplaining] = useState(false)
  const [activeMenu, setActiveMenu] = useState('File')
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Voice assistant ready.')
  const [voiceTranscript, setVoiceTranscript] = useState('No voice command captured yet.')
  const [voiceAssistantReply, setVoiceAssistantReply] = useState('Voice assistant responses will appear here.')
  const [voiceLocale, setVoiceLocale] = useState('hi-IN')
  const [micPermission, setMicPermission] = useState('unknown')
  const [menuOpen, setMenuOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatches, setSearchMatches] = useState([])
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)

  const recognitionRef = useRef(null)
  const lastSavedContentRef = useRef('')
  const autosaveTimerRef = useRef(null)
  const codeEditorRef = useRef(null)
  const commandInputRef = useRef(null)
  const searchInputRef = useRef(null)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')

  const snippets = [
    { id: 'for-loop-js', title: 'For loop (JS)', lang: 'javascript', code: 'for (let i = 0; i < 10; i++) { console.log(i) }' },
    { id: 'react-fn', title: 'React Function Component', lang: 'jsx', code: "export default function MyComponent() {\n  return <div>Hello</div>\n}" },
  ]

  const lineCount = useMemo(() => Math.max(code.split('\n').length, 1), [code])

  const menuActions = useMemo(
    () => ({
      File: [
        { label: 'New File', onClick: () => handleCreate('file'), shortcut: 'Ctrl+N' },
        { label: 'New Folder', onClick: () => handleCreate('folder') },
        { label: 'Save', onClick: saveCurrentFile, disabled: !selectedNode || selectedNode.type !== 'file', shortcut: 'Ctrl+S' },
        { label: 'Delete', onClick: handleDelete, disabled: !selectedNode, shortcut: 'Del' },
        { label: 'Refresh Explorer', onClick: fetchTree, shortcut: 'Ctrl+R' },
      ],
      Edit: [
        { label: 'Save Current File', onClick: saveCurrentFile, disabled: !selectedNode || selectedNode.type !== 'file', shortcut: 'Ctrl+S' },
      ],
      Selection: [
        { label: 'Refresh Explorer', onClick: fetchTree, shortcut: 'Ctrl+R' },
      ],
      View: [
        { label: 'Toggle Theme', onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark'), shortcut: 'Ctrl+Shift+L' },
      ],
      Go: [
        { label: 'Reload Tree', onClick: fetchTree, shortcut: 'Ctrl+R' },
      ],
      Run: [
        { label: isRunning ? 'Running...' : 'Run Code', onClick: runCode, disabled: isRunning, shortcut: 'Ctrl+Enter' },
      ],
      Terminal: [
        { label: isRunning ? 'Running...' : 'Run Code', onClick: runCode, disabled: isRunning, shortcut: 'Ctrl+Enter' },
      ],
      Logout: [
        { label: 'Logout (sign out)', onClick: handleLogout, shortcut: 'Ctrl+Shift+Q' },
      ],
    }),
    [selectedNode, isRunning, theme],
  )

  const commandItems = useMemo(() =>
    Object.entries(menuActions).flatMap(([menuName, actions]) =>
      actions.map((action) => ({
        menu: menuName,
        label: action.label,
        shortcut: action.shortcut,
        disabled: action.disabled,
        onClick: action.onClick,
      })),
    ),
  [menuActions])

  const filteredCommands = useMemo(() => {
    const query = commandQuery.trim().toLowerCase()
    if (!query) return commandItems
    return commandItems.filter((cmd) =>
      cmd.label.toLowerCase().includes(query) || cmd.menu.toLowerCase().includes(query),
    )
  }, [commandItems, commandQuery])

  useEffect(() => {
    try {
      if (authToken) {
        localStorage.setItem('authToken', authToken)
      } else {
        localStorage.removeItem('authToken')
      }
    } catch {}
  }, [authToken])

  useEffect(() => {
    try {
      localStorage.setItem('user', JSON.stringify(user))
    } catch {}
  }, [user])

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGoogleSdkReady(true)
      return
    }

    let attempts = 0
    const intervalId = window.setInterval(() => {
      attempts += 1
      if (window.google?.accounts?.id) {
        setGoogleSdkReady(true)
        window.clearInterval(intervalId)
      } else if (attempts >= 40) {
        window.clearInterval(intervalId)
      }
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    // Initialize Google Sign-In
    if (authToken || !googleSdkReady) {
      return
    }

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!googleClientId) {
      return
    }

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleLogin,
    })

    const buttonElement = document.getElementById('google_signin_button')
    if (buttonElement) {
      buttonElement.innerHTML = ''
      window.google.accounts.id.renderButton(buttonElement, {
        type: 'standard',
        size: 'large',
        theme: 'dark',
        text: 'signin_with',
      })
    }
  }, [authToken, googleSdkReady])

  async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {})

    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`)
    }

    const response = await fetch(url, { ...options, headers })

    if (response.status === 401) {
      throw new Error('Authentication required')
    }

    return response
  }

  function buildAiNotice(ai) {
    if (!ai) {
      return ''
    }

    if (ai.available) {
      return `AI connected via ${ai.provider}.`
    }

    if (!ai.configured || ai.reason === 'missing_key') {
      return 'AI key is missing on the backend. Add AI_API_KEY to .env and restart the server.'
    }

    if (ai.reason === 'billing') {
      return `AI key is loaded, but ${ai.provider} billing or credits are not active. Add credits, then restart the backend.`
    }

    if (ai.reason === 'auth') {
      return `AI key was sent, but ${ai.provider} rejected it. Check the key value and model name in .env.`
    }

    if (ai.reason === 'rate_limit') {
      return `AI provider rate limit reached. Wait a bit and try again.`
    }

    if (ai.reason === 'network') {
      return `Could not reach the AI provider. Check internet access and backend connectivity.`
    }

    return ai.message
      ? `AI is unavailable: ${ai.message}`
      : 'AI is unavailable right now. Local fallback help is being shown.'
  }

  async function refreshAiStatus() {
    try {
      const response = await fetch('/api/ai/status')
      const data = await response.json()
      if (!response.ok) {
        return
      }
      setAiStatus({
        ...data,
        available: Boolean(data.configured),
        reason: data.configured ? 'ok' : 'missing_key',
        message: '',
      })
    } catch {
      setAiStatus(null)
    }
  }

  async function handleLogout() {
    const lastUser = user?.email
      ? { name: user.name || 'Local User', email: user.email }
      : lastSignedInUser
    if (lastUser) {
      setLastSignedInUser(lastUser)
      try { localStorage.setItem('lastSignedInUser', JSON.stringify(lastUser)) } catch {}
    }

    setAuthMode('login')
    setAuthEmail('')
    setAuthPassword('')
    setAuthName('')
    setAuthToken('')
    setUser({ name: 'Local User', email: '' })
    setTree([])
    setSelectedNode(null)
    setCode('')
    setLanguage('javascript')
    setActiveMenu('File')
    setStatus('Signed out')
    setOutput('Program output will appear here.')
    setExecutionInput('')
    setHtmlPreview('')
    setDebugAdvice('AI debug suggestions will appear here when an error happens.')
    setCodeExplanation('Code explanation will appear here.')
    setAiStatus(null)
    setExplainInput('')
    setExplainLang('javascript')
    setVoiceTranscript('No voice command captured yet.')
    setVoiceAssistantReply('Voice assistant responses will appear here.')
    setIsRunning(false)
    setIsDebugging(false)
    setIsExplaining(false)
    try {
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
    } catch {}
  }

  async function handleAuthSubmit() {
    setAuthError('')
    setAuthLoading(true)
    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const payload = { email: authEmail, password: authPassword }
      if (authMode === 'signup') {
        payload.name = authName || authEmail
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || `Authentication failed (status ${response.status})`)
      }

      setAuthToken(data.token)
      setUser({
        name: data.user?.name || authEmail,
        email: data.user?.email || authEmail,
        picture: '',
      })
      const lastUser = {
        name: data.user?.name || authName || authEmail,
        email: data.user?.email || authEmail,
      }
      setLastSignedInUser(lastUser)
      try { localStorage.setItem('lastSignedInUser', JSON.stringify(lastUser)) } catch {}
      setStatus('Signed in')
      await fetchTree()
    } catch (error) {
      setAuthError(error.message)
      setStatus(error.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleGoogleLogin(response) {
    setAuthError('')
    setAuthLoading(true)
    try {
      const idToken = response.credential
      if (!idToken) {
        throw new Error('Google authentication failed: No credential received')
      }

      // Call the backend to verify and login with Google
      const backendResponse = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      const data = await backendResponse.json()

      if (!backendResponse.ok) {
        throw new Error(data.error || 'Google authentication failed')
      }

      // Set auth token and user data
      setAuthToken(data.token)
      setUser({
        name: data.user?.name || '',
        email: data.user?.email || '',
        picture: data.user?.picture || '',
      })

      const lastUser = {
        name: data.user?.name || '',
        email: data.user?.email || '',
      }
      setLastSignedInUser(lastUser)
      try { localStorage.setItem('lastSignedInUser', JSON.stringify(lastUser)) } catch {}

      setStatus('Signed in with Google')
      await fetchTree()
    } catch (error) {
      setAuthError(error.message)
      setStatus(error.message)
      console.error('Google login error:', error)
    } finally {
      setAuthLoading(false)
    }
  }

  function handleGoogleLoginClick() {
    setAuthError('')

    if (!googleSdkReady || !window.google?.accounts?.id) {
      setAuthError('Google Sign-In abhi load ho raha hai, 1-2 second baad phir try karein.')
      return
    }

    try {
      window.google.accounts.id.prompt()
    } catch {
      setAuthError('Google Sign-In open nahi hua. Page refresh karke dobara try karein.')
    }
  }

  async function fetchTree() {
    const response = await apiRequest('/api/files')
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load files')
    }

    setTree(data.tree)
  }

  async function openFile(pathValue) {
    const response = await apiRequest(`/api/file-content?path=${encodeURIComponent(pathValue)}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Unable to open file')
    }

    setCode(data.content)
    setLanguage(inferLanguage(pathValue))
  }

  async function selectNode(node) {
    try {
      setSelectedNode(node)
      setStatus(`Selected: ${node.path}`)

      if (node.type === 'file') {
        await openFile(node.path)
      }
    } catch (error) {
      setStatus(error.message)
    }
  }

  async function handleCreate(type) {
    const rawName = window.prompt(type === 'folder' ? 'Folder name' : 'File name')

    if (!rawName) {
      return
    }

    const trimmedName = rawName.trim()
    if (!trimmedName) {
      return
    }

    try {
      const baseFolder = selectedNode
        ? selectedNode.type === 'folder'
          ? selectedNode.path
          : getParentFolder(selectedNode.path)
        : ''

      let finalName = trimmedName

      if (type === 'file' && !getFileExtension(trimmedName)) {
        const selectedLanguage = languageOptions.find((item) => item.id === language)
        finalName = `${trimmedName}${selectedLanguage?.extension || '.txt'}`
      }

      const fullPath = joinPath(baseFolder, finalName)

      const response = await apiRequest('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, type, content: '' }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Unable to create ${type}`)
      }

      setStatus(`${type} created: ${fullPath}`)
      await fetchTree()
    } catch (error) {
      setStatus(error.message)
    }
  }

  async function handleDelete() {
    if (!selectedNode?.path) {
      setStatus('Select a file or folder first.')
      return
    }

    const confirmed = window.confirm(`Delete ${selectedNode.path}?`)
    if (!confirmed) {
      return
    }

    try {
      const response = await apiRequest(`/api/files?path=${encodeURIComponent(selectedNode.path)}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete item')
      }

      if (selectedNode.type === 'file') {
        setCode('')
      }

      setSelectedNode(null)
      setStatus('Deleted successfully')
      await fetchTree()
    } catch (error) {
      setStatus(error.message)
    }
  }

  async function saveCurrentFile() {
    if (!selectedNode || selectedNode.type !== 'file') {
      setStatus('Select a file before saving.')
      return
    }

    try {
      // Create a snapshot of the previous saved content for undo-safe history
      if (lastSavedContentRef.current && lastSavedContentRef.current !== code) {
        try {
          await fetch('/api/snapshots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: selectedNode.path, content: lastSavedContentRef.current }),
          })
        } catch (e) {
          // non-fatal: snapshot failure shouldn't block save
        }
      }

      const response = await apiRequest('/api/file-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedNode.path, content: code }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save file')
      }

      setStatus(`Saved: ${selectedNode.path}`)
      lastSavedContentRef.current = code
    } catch (error) {
      setStatus(error.message)
    }
  }

  // Autosave effect
  useEffect(() => {
    if (!autosaveEnabled) {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      return
    }

    // clear any existing timer then set new
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = setInterval(() => {
      if (selectedNode?.type === 'file' && code !== lastSavedContentRef.current) {
        saveCurrentFile()
      }
    }, autosaveIntervalMs)

    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [autosaveEnabled, autosaveIntervalMs, selectedNode, code])

  async function runCode() {
    if (language === 'html') {
      setHtmlPreview(code)
      setOutput('HTML preview rendered below.')
      setStatus('HTML preview ready')
      return
    }

    setHtmlPreview('')
    setIsRunning(true)

    try {
      const response = await apiRequest('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, stdin: executionInput }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Execution failed')
      }

      setOutput(data.output)

      if (data.success) {
        setStatus(`Execution successful (${data.mode || 'local'})`)
      } else {
        setStatus('Execution failed. Fetching AI debug help...')
        await debugWithAI(data.output)
      }
    } catch (error) {
      setOutput(error.message)
      setStatus('Execution failed')
      await debugWithAI(error.message)
    } finally {
      setIsRunning(false)
    }
  }

  async function debugWithAI(errorText = output) {
    setIsDebugging(true)

    try {
      const response = await apiRequest('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          code,
          errorOutput: errorText,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Debug request failed')
      }

      setDebugAdvice(data.suggestion || 'No suggestion returned.')
      setAiStatus(data.ai || null)
      setStatus(data.success ? (buildAiNotice(data.ai) || 'AI debug suggestion ready') : 'AI debug unavailable')
    } catch (error) {
      setDebugAdvice(error.message)
      setStatus('AI debug failed')
    } finally {
      setIsDebugging(false)
    }
  }

  async function explainCodeWithAI() {
    setIsExplaining(true)

    try {
      const payloadCode = explainInput && explainInput.trim() ? explainInput : code
      const payloadLanguage = explainLang || language

      const response = await apiRequest('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: payloadLanguage, code: payloadCode }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'AI explanation failed')
      }

      setCodeExplanation(data.explanation || 'No explanation returned.')
      setAiStatus(data.ai || null)
      setStatus(data.success ? (buildAiNotice(data.ai) || 'AI explanation ready') : 'AI explanation unavailable')
    } catch (error) {
      setCodeExplanation(error.message)
      setStatus('AI explanation failed')
    } finally {
      setIsExplaining(false)
    }
  }

  async function processVoiceCommand(transcriptText) {
    const normalized = transcriptText.toLowerCase().trim()

    if (!normalized) {
      setVoiceStatus('Voice command was empty. Try again.')
      return
    }

    async function respondWithVoice(text) {
      setVoiceAssistantReply(text)

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'hi-IN'
        utterance.rate = 1
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
      }
    }

    async function askAssistant(message) {
      try {
        const response = await apiRequest('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, language, code }),
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Assistant response failed')
        }

        const reply = data.reply || 'Main sun raha hoon. Aap apna next question bol sakte ho.'
        await respondWithVoice(reply)
        setVoiceStatus('Voice response generated.')
      } catch (error) {
        const fallback = `Mainne suna: ${message}. Lekin abhi response service available nahi hai.`
        await respondWithVoice(fallback)
        setVoiceStatus(error.message)
      }
    }

    if (normalized.includes('run')) {
      setVoiceStatus('Running code from voice command...')
      await runCode()
      await respondWithVoice('Code run command execute kar diya gaya hai.')
      return
    }

    if (normalized.includes('save')) {
      setVoiceStatus('Saving file from voice command...')
      await saveCurrentFile()
      await respondWithVoice('File save command execute kar diya gaya hai.')
      return
    }

    if (normalized.includes('debug') || normalized.includes('resolve')) {
      setVoiceStatus('Fetching AI debug from voice command...')
      await debugWithAI()
      await respondWithVoice('AI debug suggestion generate kar diya gaya hai.')
      return
    }

    if (normalized.includes('explain')) {
      setVoiceStatus('Generating AI explanation from voice command...')
      await explainCodeWithAI()
      await respondWithVoice('AI explanation generate kar diya gaya hai.')
      return
    }

    if (normalized.includes('set language') || normalized.startsWith('language ')) {
      const query = normalized
        .replace('set language', '')
        .replace(/^language\s+/, '')
        .trim()

      const languageMatch = languageOptions.find(
        (item) => item.id.toLowerCase() === query || item.label.toLowerCase() === query,
      )

      if (languageMatch) {
        setLanguage(languageMatch.id)
        setVoiceStatus(`Language changed to ${languageMatch.label}.`)
        await respondWithVoice(`Language ${languageMatch.label} set kar di gayi hai.`)
      } else {
        setVoiceStatus(`Language not found: ${query}`)
        await respondWithVoice(`Language ${query} nahi mili.`)
      }
      return
    }

    if (normalized.startsWith('open file')) {
      const query = normalized.replace('open file', '').trim()
      if (!query) {
        setVoiceStatus('Say a file name after open file command.')
        return
      }

      const allNodes = flattenNodes(tree).filter((node) => node.type === 'file')
      const match = allNodes.find(
        (node) => node.name.toLowerCase() === query || node.path.toLowerCase().includes(query),
      )

      if (!match) {
        setVoiceStatus(`File not found: ${query}`)
        await respondWithVoice(`File ${query} nahi mili.`)
        return
      }

      await selectNode(match)
      setVoiceStatus(`Opened file ${match.path}`)
      await respondWithVoice(`File ${match.name} open kar di gayi hai.`)
      return
    }

    setVoiceStatus('General voice mode: generating AI reply...')
    await askAssistant(transcriptText)
  }

  async function handleManualVoiceResponse() {
    const text = voiceTranscript?.trim()
    if (!text || text === 'No speech captured.' || text === 'No voice command captured yet.') {
      setVoiceStatus('Pehle kuch bolke transcript capture karo, phir Respond Now dabao.')
      return
    }

    setVoiceStatus('Manual response generation in progress...')
    await processVoiceCommand(text)
  }

  function stopVoiceAssistant() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  async function requestMicAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus('Microphone API not supported in this browser.')
      setMicPermission('unsupported')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      for (const track of stream.getTracks()) {
        track.stop()
      }
      setMicPermission('granted')
      setVoiceStatus('Microphone permission granted.')
    } catch {
      setMicPermission('denied')
      setVoiceStatus('Microphone permission denied. Browser settings se allow karo.')
    }
  }

  function startVoiceAssistant() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceSupported(false)
      setVoiceStatus('Voice assistant is not supported in this browser.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = voiceLocale
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setVoiceStatus('Listening... say commands like run code, save file, or explain code.')
    }

    recognition.onresult = async (event) => {
      const transcriptText = event.results?.[0]?.[0]?.transcript?.trim() || ''
      setVoiceTranscript(transcriptText || 'No speech captured.')
      if (!transcriptText) {
        setVoiceStatus('Voice capture clear nahi hua. Fir se boliye ya Respond Now use kijiye.')
        return
      }

      await processVoiceCommand(transcriptText)
    }

    recognition.onerror = (event) => {
      setVoiceStatus(`Voice error: ${event.error || 'unknown error'}`)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (voiceTranscript === 'No voice command captured yet.') {
        setVoiceStatus('Mic stopped. Agar response nahi aaya to dubara Start Voice karo.')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceSupported(Boolean(SpeechRecognition))

    if (!SpeechRecognition) {
      setVoiceStatus('Voice assistant is not supported in this browser.')
    }

    async function syncMicPermission() {
      if (!navigator.permissions?.query) {
        setMicPermission('unknown')
        return
      }

      try {
        const result = await navigator.permissions.query({ name: 'microphone' })
        setMicPermission(result.state)
        result.onchange = () => setMicPermission(result.state)
      } catch {
        setMicPermission('unknown')
      }
    }

    syncMicPermission()
  }, [])

  useEffect(() => {
    if (!authToken) {
      setStatus('Sign in to load workspace.')
      return
    }

    async function bootstrap() {
      try {
        await fetchTree()

        const response = await apiRequest('/api/languages')
        const data = await response.json()

        if (response.ok && Array.isArray(data.languages)) {
          const mapped = data.languages
            .map((item) => ({
              id: item.language,
              label: item.language,
              extension: languageExtensionMap[item.language] || `.${item.language}`,
            }))
            .filter((item) => Boolean(item.id))

          if (mapped.length > 0) {
            const merged = [...defaultLanguageOptions]

            for (const option of mapped) {
              if (!merged.find((item) => item.id === option.id)) {
                merged.push(option)
              }
            }

            setLanguageOptions(merged)
            setLanguage((prevLanguage) => {
              if (merged.find((item) => item.id === prevLanguage)) {
                return prevLanguage
              }

              return merged[0].id
            })
          }
        }

        await refreshAiStatus()
        setStatus('Workspace loaded')
      } catch (error) {
        setStatus(error.message)
      }
    }

    bootstrap()
  }, [authToken])

  useEffect(() => {
    // apply theme on mount/change
    try {
      document.body.classList.toggle('light', theme === 'light')
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      const key = event.key.toLowerCase()

      if (event.ctrlKey && event.shiftKey && key === 'p') {
        event.preventDefault()
        setCommandPaletteOpen(true)
        setMenuOpen(false)
        return
      }

      if (event.ctrlKey && !event.shiftKey && key === 'f') {
        event.preventDefault()
        setSearchPanelOpen(true)
        setStatus('Search opened. Type query to find matching lines.')
        return
      }

      if (event.ctrlKey && !event.shiftKey && key === 's') {
        event.preventDefault()
        saveCurrentFile()
        return
      }

      if (event.ctrlKey && !event.shiftKey && key === 'enter') {
        event.preventDefault()
        runCode()
        return
      }

      if (event.ctrlKey && event.shiftKey && key === 'q') {
        event.preventDefault()
        handleLogout()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveCurrentFile, runCode, handleLogout])

  useEffect(() => {
    if (commandPaletteOpen && commandInputRef.current) {
      setTimeout(() => {
        try { commandInputRef.current.focus() } catch {}
      }, 10)
    }
  }, [commandPaletteOpen])

  useEffect(() => {
    if (searchPanelOpen && searchInputRef.current) {
      setTimeout(() => {
        try { searchInputRef.current.focus() } catch {}
      }, 10)
    }
  }, [searchPanelOpen])

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      setSearchMatches([])
      setSearchMatchIndex(0)
      return
    }

    const lines = code.split('\n')
    const matches = []
    let globalOffset = 0

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const lineText = lines[lineIndex]
      const lowerLine = lineText.toLowerCase()
      let fromIndex = 0

      while (true) {
        const foundAt = lowerLine.indexOf(query, fromIndex)
        if (foundAt < 0) {
          break
        }

        matches.push({
          lineNumber: lineIndex + 1,
          startIndex: globalOffset + foundAt,
          endIndex: globalOffset + foundAt + query.length,
        })

        fromIndex = foundAt + Math.max(query.length, 1)
      }

      globalOffset += lineText.length + 1
    }

    setSearchMatches(matches)
    setSearchMatchIndex(0)
  }, [searchQuery, code])

  useEffect(() => {
    if (!searchPanelOpen || !searchMatches.length) {
      return
    }

    const editor = codeEditorRef.current
    const match = searchMatches[searchMatchIndex]
    if (!editor || !match) {
      return
    }

    editor.focus()
    try {
      editor.setSelectionRange(match.startIndex, match.endIndex)
    } catch {}
    setStatus(`Found at line ${match.lineNumber}`)
  }, [searchPanelOpen, searchMatches, searchMatchIndex])

  function goToSearchMatch(direction) {
    if (!searchMatches.length) {
      return
    }

    const delta = direction === 'prev' ? -1 : 1
    const nextIndex = (searchMatchIndex + delta + searchMatches.length) % searchMatches.length
    setSearchMatchIndex(nextIndex)
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setSearchPanelOpen(false)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      goToSearchMatch(event.shiftKey ? 'prev' : 'next')
    }
  }

  

  if (!authToken) {
    return (
      <div className="app-shell">
        <header className="window-bar">
          <div className="brand-mark" aria-hidden="true">
            <span className="bolt">AI</span>
          </div>
          <h1>AI-Powered Coding IDE</h1>
          <span className="menu-item" aria-live="polite">{status}</span>
        </header>

        <section className="glass-card" style={{ padding: '18px', maxWidth: 520, margin: '0 auto', width: '100%' }}>
          <h2 style={{ marginTop: 0 }}>Sign in or Sign up</h2>
          {lastSignedInUser ? (
            <p style={{ margin: '6px 0', color: '#b8c3e0' }}>
              Last signed in as <strong>{lastSignedInUser.name || 'User'}</strong>
              {lastSignedInUser.email ? ` (${lastSignedInUser.email})` : ''}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button
              type="button"
              className={`menu-item ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
            >Login</button>
            <button
              type="button"
              className={`menu-item ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => setAuthMode('signup')}
            >Sign Up</button>
          </div>

          {authMode === 'signup' ? (
            <label className="input-label">Name
              <input
                className="code-input"
                style={{ width: '100%', marginTop: 4, marginBottom: 8 }}
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          ) : null}

          <label className="input-label">Email
            <input
              className="code-input"
              style={{ width: '100%', marginTop: 4, marginBottom: 8 }}
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="input-label">Password
            <input
              className="code-input"
              style={{ width: '100%', marginTop: 4, marginBottom: 8 }}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              type="password"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>

          <button
            type="button"
            className="menu-item"
            disabled={authLoading}
            onClick={handleAuthSubmit}
          >
            {authLoading ? 'Working...' : authMode === 'signup' ? 'Create account' : 'Login'}
          </button>

          <div style={{ display: 'flex', gap: 10, margin: '12px 0', alignItems: 'center' }}>
            <div style={{ flex: 1, height: '1px', background: '#b8c3e0', opacity: 0.3 }} />
            <span style={{ color: '#b8c3e0', fontSize: '12px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: '#b8c3e0', opacity: 0.3 }} />
          </div>

          <div
            id="google_signin_button"
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          />

          <button
            type="button"
            className="menu-item"
            disabled={authLoading}
            onClick={handleGoogleLoginClick}
            style={{ marginBottom: '12px' }}
          >
            Continue with Google
          </button>

          {authError ? <p style={{ color: '#ffb4b4' }}>{authError}</p> : null}
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="window-bar">
        <div className="brand-mark" aria-hidden="true">
          <span className="bolt">AI</span>
        </div>
        <h1>AI-Powered Coding IDE</h1>

        <div className="user-pill" title={user.email}>
          {user.picture ? <img src={user.picture} alt={user.name} className="user-avatar" /> : <span>{user.name?.[0] || 'U'}</span>}
          <span>{user.name}</span>
        </div>

        <nav className="menu-strip" aria-label="Main menu">
          {menuItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`menu-item ${activeMenu === item ? 'active' : ''}`}
              onClick={() => {
                const isSame = activeMenu === item
                setActiveMenu(item)
                setMenuOpen(isSame ? !menuOpen : true)
              }}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            className="menu-item"
            title="Logout and reset the IDE session"
            onClick={handleLogout}
          >Logout</button>
        </nav>
      </header>

      {menuOpen && menuActions[activeMenu]?.length ? (
        <div className="menu-dropdown">
          {menuActions[activeMenu].map((action) => (
            <button
              key={action.label}
              type="button"
              className="menu-dropdown-item"
              disabled={action.disabled}
              onClick={() => {
                action.onClick()
                setMenuOpen(false)
              }}
            >
              <span>{action.label}</span>
              {action.shortcut ? <span className="shortcut-pill">{action.shortcut}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      <section className="menu-content-card" aria-label="Menu section content">
        <h2>{activeMenu}</h2>
        <ul>
          {menuContent[activeMenu].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {menuActions[activeMenu]?.length ? (
          <div className="menu-action-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {menuActions[activeMenu].map((action) => (
              <button
                key={action.label}
                type="button"
                className="menu-item"
                disabled={action.disabled}
                onClick={action.onClick}
              >
                <span>{action.label}</span>
                {action.shortcut ? <span className="shortcut-pill">{action.shortcut}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="workspace-shell">
        <aside className="activity-bar" aria-label="Activity bar">
          <button type="button" className="activity-btn active" title="Explorer">≡</button>
          <button
            type="button"
            className={`activity-btn ${searchPanelOpen ? 'active' : ''}`}
            title="Search"
            onClick={() => {
              setSearchPanelOpen(true)
              setStatus('Search opened. Type query to find matching lines.')
            }}
          >
            ⌕
          </button>
          <button type="button" className="activity-btn" title="Source Control">⑂</button>
          <button type="button" className="activity-btn" title="Run and Debug">▷</button>
          <button type="button" className="activity-btn" title="Extensions">◫</button>
        </aside>

        <main className="ide-layout">
          <aside className="left-panel glass-card">
            <div className="panel-head">Explorer</div>

            <div className="action-row">
              <button type="button" onClick={() => handleCreate('file')}>+ File</button>
              <button type="button" onClick={() => handleCreate('folder')}>+ Folder</button>
              <button type="button" onClick={handleDelete}>Delete</button>
            </div>

            <div className="tree-scroll">
              <FileTree nodes={tree} selectedPath={selectedNode?.path || ''} onSelect={selectNode} />
            </div>

            

            <article className="assistant-card issue-card left-debugger-card">
              <h3>AI Debugger</h3>
              {aiStatus ? (
                <div className={`ai-status-banner ${aiStatus.available ? 'ok' : 'warn'}`}>
                  {buildAiNotice(aiStatus)}
                </div>
              ) : null}
              <div className="assistant-action-row">
                <button type="button" disabled={isDebugging} onClick={() => debugWithAI()}>
                  {isDebugging ? 'Debugging...' : 'Debug With AI'}
                </button>
                <button type="button" disabled={isDebugging} onClick={() => debugWithAI()}>
                  {isDebugging ? 'Resolving...' : 'Resolve Error'}
                </button>
              </div>
              <pre className="output-box advice-box">{debugAdvice}</pre>
            </article>
          </aside>

          <section className="center-panel glass-card">
            <div className="tabs-row">
              <span className="tab active">{selectedNode?.path || 'No file selected'}</span>
            </div>

            <div className="editor-toolbar">
              <label htmlFor="language-picker">Language</label>
              <select
                id="language-picker"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {languageOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <button type="button" onClick={saveCurrentFile}>Save</button>
              <button type="button" disabled={isRunning} onClick={runCode}>
                {isRunning ? 'Running...' : 'Run'}
              </button>
              <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light' : 'Dark'} Theme</button>
            </div>

            {searchPanelOpen ? (
              <div className="search-panel">
                <input
                  ref={searchInputRef}
                  className="search-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search in current file (Ctrl+F)"
                />
                <span className="search-meta">
                  {searchMatches.length
                    ? `${searchMatchIndex + 1}/${searchMatches.length} · line ${searchMatches[searchMatchIndex]?.lineNumber || '-'}`
                    : 'No match'}
                </span>
                <button type="button" onClick={() => goToSearchMatch('prev')} disabled={!searchMatches.length}>Prev</button>
                <button type="button" onClick={() => goToSearchMatch('next')} disabled={!searchMatches.length}>Next</button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchPanelOpen(false)
                    setSearchQuery('')
                    setSearchMatches([])
                    setSearchMatchIndex(0)
                  }}
                >
                  Close
                </button>
              </div>
            ) : null}

            <article className="editor-card">
              <div className="code-grid">
                <ol className="line-numbers">
                  {Array.from({ length: lineCount }, (_, idx) => (
                    <li key={idx}>{idx + 1}</li>
                  ))}
                </ol>
                <textarea
                  className="code-input"
                  ref={codeEditorRef}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Select or create a file to start coding..."
                  spellCheck="false"
                />
              </div>
            </article>

            <article className="assistant-card issue-card">
              <h3>Snippets</h3>
              <div className="assistant-action-row">
                {snippets.map((s) => (
                  <div key={s.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong style={{ flex: 1 }}>{s.title}</strong>
                      <button type="button" onClick={() => {
                        const editor = codeEditorRef.current
                        if (editor && typeof editor.selectionStart === 'number') {
                          const start = editor.selectionStart
                          const end = editor.selectionEnd
                          const before = code.slice(0, start)
                          const after = code.slice(end)
                          const inserted = s.code
                          const newCode = `${before}${inserted}${after}`
                          setCode(newCode)
                          // place cursor after inserted snippet
                          setTimeout(() => {
                            try { editor.selectionStart = editor.selectionEnd = start + inserted.length } catch {}
                          }, 0)
                        } else {
                          setCode((prev) => prev + '\n' + s.code)
                        }
                      }}>Insert</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <aside className="right-panel glass-card">
            <div className="assistant-head">
              <span className="avatar" aria-hidden="true" />
              <h2>Debug Console</h2>
            </div>

            <article className="assistant-card issue-card">
              <h3>Execution Output</h3>
              <label htmlFor="execution-input" className="input-label">Execution Input (stdin)</label>
              <textarea
                id="execution-input"
                className="stdin-input"
                value={executionInput}
                onChange={(event) => setExecutionInput(event.target.value)}
                placeholder="Type input values here. Example:\nChetan"
              />
              <pre className="output-box">{output}</pre>
              {language === 'html' && htmlPreview ? (
                <iframe
                  title="HTML Preview"
                  className="preview-frame"
                  sandbox="allow-scripts"
                  srcDoc={htmlPreview}
                />
              ) : null}
            </article>

            <article className="assistant-card issue-card">
              <h3>Voice Assistant</h3>
              <div className="assistant-action-row">
                <p className="mic-permission">Mic Permission: {micPermission}</p>
                <label htmlFor="voice-locale" className="input-label">Voice Locale</label>
                <select
                  id="voice-locale"
                  className="voice-locale-select"
                  value={voiceLocale}
                  onChange={(event) => setVoiceLocale(event.target.value)}
                >
                  <option value="hi-IN">Hindi (hi-IN)</option>
                  <option value="en-US">English (en-US)</option>
                </select>
                <button
                  type="button"
                  disabled={!voiceSupported || isListening}
                  onClick={startVoiceAssistant}
                >
                  {isListening ? 'Listening...' : 'Start Voice'}
                </button>
                <button
                  type="button"
                  disabled={!isListening}
                  onClick={stopVoiceAssistant}
                >
                  Stop Voice
                </button>
                <button
                  type="button"
                  onClick={requestMicAccess}
                >
                  Request Mic Access
                </button>
                <button
                  type="button"
                  disabled={isListening}
                  onClick={handleManualVoiceResponse}
                >
                  Respond Now
                </button>
              </div>
              <p className="voice-status">{voiceStatus}</p>
              <pre className="output-box advice-box">{voiceTranscript}</pre>
              <pre className="output-box advice-box">{voiceAssistantReply}</pre>
            </article>

            <article className="assistant-card issue-card">
              <h3>AI Code Assistant</h3>
              {aiStatus ? (
                <div className={`ai-status-banner ${aiStatus.available ? 'ok' : 'warn'}`}>
                  {buildAiNotice(aiStatus)}
                </div>
              ) : null}
              <label className="input-label">Explain any code (paste here or use Editor Code)</label>
              <textarea
                className="explain-input"
                value={explainInput}
                onChange={(e) => setExplainInput(e.target.value)}
                placeholder="Paste any code here to get an explanation (or click Use Editor Code)."
                rows={6}
              />
              <div className="assistant-action-row">
                <select value={explainLang} onChange={(e) => setExplainLang(e.target.value)}>
                  {languageOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setExplainInput(code)}>Use Editor Code</button>
                <button type="button" disabled={isExplaining} onClick={explainCodeWithAI}>
                  {isExplaining ? 'Explaining...' : 'Explain Code'}
                </button>
              </div>
              <pre className="output-box advice-box">{codeExplanation}</pre>
            </article>
          </aside>
        </main>
      </div>

      <footer className="status-bar">
        <span>{selectedNode?.path || 'No file open'}</span>
        <span>{language}</span>
        <span>{status}</span>
      </footer>

      {commandPaletteOpen ? (
        <div className="command-palette-backdrop" onClick={() => setCommandPaletteOpen(false)}>
          <div className="command-palette" onClick={(e) => e.stopPropagation()}>
            <div className="command-palette-head">
              <span>Command Palette</span>
              <button type="button" className="menu-item" onClick={() => setCommandPaletteOpen(false)}>Esc</button>
            </div>
            <input
              ref={commandInputRef}
              className="command-input"
              placeholder="Type a command... (Ctrl+Shift+P)"
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setCommandPaletteOpen(false)
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const first = filteredCommands.find((cmd) => !cmd.disabled)
                  if (first) {
                    first.onClick()
                    setCommandPaletteOpen(false)
                  }
                }
              }}
            />
            <div className="command-list">
              {filteredCommands.map((cmd) => (
                <button
                  key={`${cmd.menu}-${cmd.label}`}
                  type="button"
                  className="command-item"
                  disabled={cmd.disabled}
                  onClick={() => {
                    cmd.onClick()
                    setCommandPaletteOpen(false)
                  }}
                >
                  <div className="command-main">
                    <span className="command-label">{cmd.label}</span>
                    <span className="command-menu">{cmd.menu}</span>
                  </div>
                  {cmd.shortcut ? <span className="shortcut-pill">{cmd.shortcut}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
