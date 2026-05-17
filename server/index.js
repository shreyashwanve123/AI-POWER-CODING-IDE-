import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { OAuth2Client } from 'google-auth-library'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
// removed Google auth, JWT session handling and cookie-parser

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..')

// Load root .env first, then optional server/.env without overriding existing values.
dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') })
dotenv.config({ path: path.resolve(SERVER_DIR, '.env') })

const app = express()
const PORT = Number(process.env.PORT) || 4000
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, 'workspace-files')
const RUNNER_ROOT = path.resolve(WORKSPACE_ROOT, '.runner')
const EXTERNAL_EXECUTOR_URL = process.env.EXTERNAL_EXECUTOR_URL || 'https://emkc.org/api/v2/piston/execute'
const EXTERNAL_RUNTIMES_URL = process.env.EXTERNAL_RUNTIMES_URL || 'https://emkc.org/api/v2/piston/runtimes'
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1/chat/completions'
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `http://localhost:${PORT}/api/auth/github/callback`
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || 'change-me'
const USERS_DB_PATH = process.env.USERS_DB_PATH || path.join(SERVER_DIR, 'data', 'users.json')
// Authentication is disabled by default. To enforce auth, set AUTH_REQUIRED=true explicitly.
const AUTH_REQUIRED = false

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null
const githubStateStore = new Map()

app.use(cors())
app.use(express.json({ limit: '2mb' }))

function extractBearer(req) {
  const header = req.headers.authorization || ''
  const lower = header.toLowerCase()
  if (!lower.startsWith('bearer ')) {
    return null
  }
  return header.slice(7).trim()
}

async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID || !googleClient) {
    throw new Error('Google auth not configured. Set GOOGLE_CLIENT_ID.')
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload) {
    throw new Error('Invalid Google token payload')
  }

  return {
    sub: payload.sub,
    email: payload.email || '',
    name: payload.name || payload.email || 'User',
    picture: payload.picture || '',
  }
}

function verifyAppJwt(token) {
  try {
    const decoded = jwt.verify(token, APP_JWT_SECRET)
    return decoded
  } catch (error) {
    throw new Error('Invalid or expired session token')
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearer(req)
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization bearer token' })
      return
    }

    // Try app JWT first
    try {
      const session = verifyAppJwt(token)
      req.user = {
        id: session.sub,
        email: session.email,
        name: session.name,
        provider: session.provider,
      }
      next()
      return
    } catch (jwtError) {
      // Fallback to Google ID token if provided
      if (!GOOGLE_CLIENT_ID || !googleClient) {
        res.status(401).json({ error: 'Invalid session token' })
        return
      }

      const googleUser = await verifyGoogleIdToken(token)
      const dbUser = await upsertGoogleUser({ email: googleUser.email, name: googleUser.name })
      const sessionToken = issueJwt({ ...dbUser })
      req.user = { ...dbUser }
      res.setHeader('x-refresh-token', sessionToken)
      next()
      return
    }
  } catch (error) {
    res.status(401).json({ error: error.message || 'Invalid Google ID token' })
  }
}

const localLanguageConfigs = {
  javascript: { extension: '.js', type: 'single', commandCandidates: ['node'] },
  python: { extension: '.py', type: 'single', commandCandidates: ['python', 'py'] },
  typescript: {
    extension: '.ts',
    type: 'single',
    commandCandidates: ['npx'],
    fixedArgs: ['tsx'],
  },
  cpp: { extension: '.cpp', type: 'cpp', commandCandidates: ['g++'] },
  java: { extension: '.java', type: 'java', commandCandidates: ['javac'] },
}

const editorOnlyLanguages = [
  { language: 'html', version: 'editor-only', aliases: [] },
  { language: 'css', version: 'editor-only', aliases: [] },
  { language: 'jsx', version: 'editor-only', aliases: [] },
  { language: 'tsx', version: 'editor-only', aliases: [] },
  { language: 'json', version: 'editor-only', aliases: [] },
  { language: 'markdown', version: 'editor-only', aliases: ['md'] },
]

const languageAliases = {
  js: 'javascript',
  javascript: 'javascript',
  node: 'javascript',
  py: 'python',
  python: 'python',
  ts: 'typescript',
  typescript: 'typescript',
  cpp: 'cpp',
  'c++': 'cpp',
  cxx: 'cpp',
  java: 'java',
}

const sampleFiles = [
  {
    filePath: 'authService.js',
    content: "export async function loginUser(username, password) {\n  return { token: `${username}-${Date.now()}`, passwordLength: password.length }\n}\n",
  },
  {
    filePath: 'paymentService.py',
    content: 'def validate_payment(amount):\n    return amount > 0\n',
  },
]

let runtimeCache = {
  loadedAt: 0,
  items: [],
}

let usersCache = null

async function loadUsers() {
  if (usersCache) return usersCache

  try {
    await fs.mkdir(path.dirname(USERS_DB_PATH), { recursive: true })
    const raw = await fs.readFile(USERS_DB_PATH, 'utf8').catch(() => '[]')
    const parsed = JSON.parse(raw || '[]')
    usersCache = Array.isArray(parsed) ? parsed : []
  } catch {
    usersCache = []
  }

  return usersCache
}

async function saveUsers(users) {
  usersCache = users
  await fs.mkdir(path.dirname(USERS_DB_PATH), { recursive: true })
  await fs.writeFile(USERS_DB_PATH, JSON.stringify(users, null, 2), 'utf8')
}


// removed session helpers and Google credential verification

function normalizeLanguage(language = '') {
  const key = String(language).trim().toLowerCase()
  return languageAliases[key] || key
}

function issueJwt(user) {
  const payload = { sub: user.id, email: user.email, name: user.name, provider: user.provider }
  return jwt.sign(payload, APP_JWT_SECRET, { expiresIn: '7d' })
}

async function findUserByEmail(email) {
  const users = await loadUsers()
  return users.find((u) => u.email === String(email).toLowerCase()) || null
}

async function createUserLocal({ email, name, password }) {
  const users = await loadUsers()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const user = {
    id,
    email: email.toLowerCase(),
    name: name || email,
    passwordHash: bcrypt.hashSync(password, 10),
    provider: 'local',
    createdAt: Date.now(),
  }
  users.push(user)
  await saveUsers(users)
  return { id: user.id, email: user.email, name: user.name, provider: 'local' }
}

async function upsertGoogleUser({ email, name }) {
  const users = await loadUsers()
  const existing = users.find((u) => u.email === email.toLowerCase())
  if (existing) {
    return { id: existing.id, email: existing.email, name: existing.name, provider: existing.provider }
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const user = {
    id,
    email: email.toLowerCase(),
    name: name || email,
    provider: 'google',
    createdAt: Date.now(),
  }
  users.push(user)
  await saveUsers(users)
  return { id: user.id, email: user.email, name: user.name, provider: 'google' }
}

async function upsertGithubUser({ email, name, githubId, picture }) {
  const users = await loadUsers()
  const normalizedEmail = String(email || '').toLowerCase()
  const existing = users.find((u) => u.email === normalizedEmail || (githubId && u.githubId === String(githubId)))

  if (existing) {
    const updated = {
      ...existing,
      email: normalizedEmail || existing.email,
      name: name || existing.name,
      provider: 'github',
      githubId: githubId ? String(githubId) : existing.githubId,
      picture: picture || existing.picture || '',
    }

    const index = users.findIndex((u) => u.id === existing.id)
    users[index] = updated
    await saveUsers(users)
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      provider: 'github',
      picture: updated.picture || '',
    }
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const fallbackEmail = normalizedEmail || `${githubId || id}@users.noreply.github.com`
  const user = {
    id,
    email: fallbackEmail,
    name: name || fallbackEmail,
    provider: 'github',
    githubId: githubId ? String(githubId) : '',
    picture: picture || '',
    createdAt: Date.now(),
  }
  users.push(user)
  await saveUsers(users)
  return { id: user.id, email: user.email, name: user.name, provider: 'github', picture: user.picture }
}

function createGithubOauthState() {
  const state = crypto.randomBytes(24).toString('hex')
  githubStateStore.set(state, Date.now())

  for (const [storedState, createdAt] of githubStateStore.entries()) {
    if (Date.now() - createdAt > 10 * 60 * 1000) {
      githubStateStore.delete(storedState)
    }
  }

  return state
}

function consumeGithubOauthState(state) {
  if (!state || !githubStateStore.has(state)) {
    return false
  }

  githubStateStore.delete(state)
  return true
}

function frontendAuthRedirectUrl(params) {
  const query = new URLSearchParams(params)
  return `${FRONTEND_ORIGIN}/#${query.toString()}`
}

async function exchangeGithubCodeForToken(code) {
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Unable to get GitHub access token')
  }

  return tokenData.access_token
}

async function fetchGithubProfile(accessToken) {
  const commonHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${accessToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const [profileRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers: commonHeaders }),
    fetch('https://api.github.com/user/emails', { headers: commonHeaders }),
  ])

  const profile = await profileRes.json()
  const emails = emailsRes.ok ? await emailsRes.json() : []

  if (!profileRes.ok || !profile?.id) {
    throw new Error(profile?.message || 'Unable to load GitHub profile')
  }

  const primaryEmail = Array.isArray(emails)
    ? emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email || emails[0]?.email
    : ''

  return {
    githubId: String(profile.id),
    email: primaryEmail || profile.email || '',
    name: profile.name || profile.login || 'GitHub User',
    picture: profile.avatar_url || '',
  }
}

function detectLanguageFromCode(code = '') {
  const sample = String(code).slice(0, 200).toLowerCase()
  if (!sample) return 'javascript'
  if (sample.includes('def ') || (sample.includes('import ') && sample.includes(' as '))) return 'python'
  if (sample.includes('console.log') || sample.includes('function ') || sample.includes('=>') || sample.includes(';')) return 'javascript'
  if (sample.includes('#include') || sample.includes('std::') || sample.includes('cout')) return 'cpp'
  if (sample.includes('public static void main') || sample.includes('system.out.println')) return 'java'
  if (sample.trim().startsWith('<') && sample.includes('>')) return 'html'
  if (sample.includes('class ') && sample.includes('render(')) return 'jsx'
  return 'javascript'
}

function resolveSafePath(relativePath = '') {
  const sanitizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const resolvedPath = path.resolve(WORKSPACE_ROOT, sanitizedPath)

  if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Invalid path')
  }

  return resolvedPath
}

async function ensureWorkspaceBootstrapped() {
  await fs.mkdir(WORKSPACE_ROOT, { recursive: true })
  await fs.mkdir(RUNNER_ROOT, { recursive: true })
  await fs.mkdir(path.join(WORKSPACE_ROOT, '.snapshots'), { recursive: true })

  for (const sample of sampleFiles) {
    const absPath = resolveSafePath(sample.filePath)
    try {
      await fs.access(absPath)
    } catch {
      await fs.writeFile(absPath, sample.content, 'utf8')
    }
  }
}

async function readTree(currentAbsPath, currentRelativePath = '') {
  const items = await fs.readdir(currentAbsPath, { withFileTypes: true })
  const filtered = items.filter((item) => item.name !== '.runner')

  const nodes = await Promise.all(
    filtered.map(async (item) => {
      const nodeRelativePath = currentRelativePath
        ? `${currentRelativePath}/${item.name}`
        : item.name
      const nodeAbsPath = resolveSafePath(nodeRelativePath)

      if (item.isDirectory()) {
        const children = await readTree(nodeAbsPath, nodeRelativePath)
        return {
          name: item.name,
          path: nodeRelativePath,
          type: 'folder',
          children,
        }
      }

      return {
        name: item.name,
        path: nodeRelativePath,
        type: 'file',
      }
    }),
  )

  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

function runCommand(command, args, cwd, timeoutMs = 10000, stdin = '') {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    if (typeof stdin === 'string' && stdin.length > 0) {
      child.stdin.write(stdin)
      if (!stdin.endsWith('\n')) {
        child.stdin.write('\n')
      }
      child.stdin.end()
    }

    child.on('close', (code) => {
      clearTimeout(timeout)
      resolve({ code: timedOut ? 124 : code, stdout, stderr, timedOut })
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      resolve({ code: 1, stdout, stderr: error.message, timedOut: false })
    })
  })
}

async function commandExists(command) {
  const checker = process.platform === 'win32' ? 'where' : 'which'
  const result = await runCommand(checker, [command], process.cwd(), 3000)
  return result.code === 0
}

async function pickAvailableCommand(candidates) {
  for (const candidate of candidates) {
    if (await commandExists(candidate)) {
      return candidate
    }
  }

  return null
}

async function runCodeLocally(language, code, stdin = '') {
  const config = localLanguageConfigs[language]
  if (!config) {
    return { success: false, output: `Local runtime not configured for ${language}.` }
  }

  const command = await pickAvailableCommand(config.commandCandidates)
  if (!command) {
    return {
      success: false,
      output: `Local runtime not found for ${language}. Install one of: ${config.commandCandidates.join(', ')}`,
    }
  }

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const runDir = path.join(RUNNER_ROOT, runId)
  await fs.mkdir(runDir, { recursive: true })

  const sourceFilePath = path.join(runDir, `Main${config.extension}`)
  await fs.writeFile(sourceFilePath, code, 'utf8')

  let result

  if (config.type === 'single') {
    const args = [...(config.fixedArgs || []), sourceFilePath]
    result = await runCommand(command, args, runDir, 10000, stdin)
  } else if (config.type === 'cpp') {
    const executable = process.platform === 'win32' ? 'app.exe' : 'app'
    const compileResult = await runCommand(command, [sourceFilePath, '-o', executable], runDir)

    if (compileResult.code !== 0) {
      await fs.rm(runDir, { recursive: true, force: true })
      return {
        success: false,
        output: compileResult.stderr || compileResult.stdout || 'Compilation failed',
      }
    }

    const binaryPath = path.join(runDir, executable)
    result = await runCommand(binaryPath, [], runDir, 10000, stdin)
  } else {
    const compileResult = await runCommand(command, [sourceFilePath], runDir)

    if (compileResult.code !== 0) {
      await fs.rm(runDir, { recursive: true, force: true })
      return {
        success: false,
        output: compileResult.stderr || compileResult.stdout || 'Compilation failed',
      }
    }

    result = await runCommand('java', ['-cp', runDir, 'Main'], runDir, 10000, stdin)
  }

  await fs.rm(runDir, { recursive: true, force: true })

  const merged = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

  return {
    success: result.code === 0,
    output: result.timedOut
      ? `Execution timed out.\n${merged || 'No output'}`
      : merged || (result.code === 0 ? 'Program executed successfully.' : 'Execution failed.'),
    mode: 'local',
  }
}

async function getExternalRuntimes() {
  const now = Date.now()
  if (runtimeCache.items.length > 0 && now - runtimeCache.loadedAt < 5 * 60 * 1000) {
    return runtimeCache.items
  }

  try {
    const response = await fetch(EXTERNAL_RUNTIMES_URL)
    if (!response.ok) {
      return runtimeCache.items
    }

    const runtimes = await response.json()
    const sanitized = Array.isArray(runtimes)
      ? runtimes.map((item) => ({
          language: normalizeLanguage(item.language),
          version: item.version || '*',
          aliases: Array.isArray(item.aliases) ? item.aliases.map((a) => normalizeLanguage(a)) : [],
        }))
      : []

    runtimeCache = {
      loadedAt: now,
      items: sanitized,
    }

    return sanitized
  } catch {
    return runtimeCache.items
  }
}

function findExternalRuntime(runtimes, language) {
  const normalized = normalizeLanguage(language)
  return runtimes.find(
    (item) =>
      item.language === normalized ||
      item.aliases.includes(normalized),
  )
}

async function runCodeExternal(language, code, stdin = '') {
  const runtimes = await getExternalRuntimes()
  const runtime = findExternalRuntime(runtimes, language)

  if (!runtime) {
    return {
      success: false,
      output: `External runtime not found for ${language}.`,
      mode: 'external',
    }
  }

  const payload = {
    language: runtime.language,
    version: runtime.version || '*',
    files: [{ name: `Main.${runtime.language}`, content: code }],
    stdin,
    compile_timeout: 10000,
    run_timeout: 10000,
  }

  try {
    const response = await fetch(EXTERNAL_EXECUTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        output: data.message || 'External execution request failed.',
        mode: 'external',
      }
    }

    const compileOut = data.compile?.output || ''
    const runOut = data.run?.output || ''
    const merged = [compileOut, runOut].filter(Boolean).join('\n').trim()

    return {
      success: (data.run?.code ?? 1) === 0,
      output: merged || ((data.run?.code ?? 1) === 0 ? 'Program executed successfully.' : 'Execution failed.'),
      mode: 'external',
    }
  } catch (error) {
    return {
      success: false,
      output: `External execution unavailable: ${error.message}`,
      mode: 'external',
    }
  }
}

async function runCode(language, code, stdin = '') {
  const normalized = normalizeLanguage(language)

  const localResult = await runCodeLocally(normalized, code, stdin)
  if (localResult.success) {
    return localResult
  }

  const externalResult = await runCodeExternal(normalized, code, stdin)
  if (externalResult.success) {
    return externalResult
  }

  return {
    success: false,
    output: `${localResult.output}\n\n${externalResult.output}`,
    mode: 'mixed',
  }
}

function extractApiKey(req) {
  const keyFromHeader = req.headers['x-api-key']
  const keyFromBody = req.body?.apiKey
  return keyFromHeader || keyFromBody || process.env.AI_API_KEY || ''
}

function detectAiProvider() {
  const url = String(AI_BASE_URL || '').toLowerCase()

  if (url.includes('anthropic.com')) {
    return 'anthropic'
  }

  return 'openai-compatible'
}

async function parseJsonResponse(response) {
  const raw = await response.text()

  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw)
  } catch {
    return { raw }
  }
}

function buildAiRequest({ apiKey, systemPrompt, userPrompt, temperature }) {
  const provider = detectAiProvider()

  if (provider === 'anthropic') {
    return {
      provider,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: {
        model: AI_MODEL,
        max_tokens: 1024,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
    }
  }

  return {
    provider,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    },
  }
}

function extractAiText(data, provider) {
  if (provider === 'anthropic') {
    const parts = Array.isArray(data?.content) ? data.content : []
    return parts
      .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
      .map((item) => item.text.trim())
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return data?.choices?.[0]?.message?.content?.trim() || ''
}

function extractAiError(data) {
  if (typeof data?.error === 'string') {
    return data.error
  }

  if (typeof data?.error?.message === 'string') {
    return data.error.message
  }

  if (typeof data?.message === 'string') {
    return data.message
  }

  if (typeof data?.raw === 'string') {
    return data.raw
  }

  return ''
}

async function requestAiCompletion({ apiKey, systemPrompt, userPrompt, temperature = 0.2 }) {
  const requestConfig = buildAiRequest({ apiKey, systemPrompt, userPrompt, temperature })
  const response = await fetch(AI_BASE_URL, {
    method: 'POST',
    headers: requestConfig.headers,
    body: JSON.stringify(requestConfig.body),
  })
  const data = await parseJsonResponse(response)

  return {
    ok: response.ok,
    provider: requestConfig.provider,
    status: response.status,
    text: extractAiText(data, requestConfig.provider),
    error: extractAiError(data),
  }
}

function generateOfflineDebugSuggestion({ language, errorOutput = '' }) {
  const lower = errorOutput.toLowerCase()
  const steps = [
    `Language: ${language}`,
    'AI service is currently using local fallback help.',
  ]

  if (lower.includes('syntaxerror') || lower.includes('syntax error')) {
    steps.push('Possible syntax issue: check missing brackets, semicolons, or quotes near the reported line.')
  }

  if (lower.includes('module not found') || lower.includes('cannot find module')) {
    steps.push('Dependency/path issue: verify import path and install missing package/runtime.')
  }

  if (lower.includes('no line found') || lower.includes('scanner')) {
    steps.push('Input required: provide stdin in Execution Input box before running code.')
  }

  if (lower.includes('timed out')) {
    steps.push('Execution timeout: reduce heavy loops or wait for input only when stdin is provided.')
  }

  steps.push('Set AI_API_KEY on the backend to enable deeper AI debugging when credits and billing are active.')
  return steps.join('\n- ').replace('\n- Language', 'Language')
}

function generateOfflineExplanation({ language }) {
  return [
    `Language: ${language}`,
    'AI service is currently using a local explanation fallback.',
    'Set AI_API_KEY in the backend and make sure provider billing is active to enable full AI explanations.',
  ].join('\n')
}

function classifyAiFailure(errorMessage = '') {
  const message = String(errorMessage || '').toLowerCase()

  if (!message) {
    return 'unknown'
  }

  if (message.includes('credit balance is too low') || message.includes('billing') || message.includes('purchase credits')) {
    return 'billing'
  }

  if (message.includes('invalid x-api-key') || message.includes('invalid api key') || message.includes('authentication')) {
    return 'auth'
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'rate_limit'
  }

  return 'unknown'
}

async function generateAssistantReply({ apiKey, message, language, code }) {
  if (!apiKey) {
    return {
      success: true,
      reply: `Mainne suna: ${message}. Abhi AI key configured nahi hai, phir bhi main basic help de sakta hoon. Language ${language} selected hai.`,
    }
  }

  const systemPrompt =
    'You are a helpful bilingual (Hindi + English) voice coding assistant. Keep responses short, practical, and friendly.'

  const userPrompt = [
    `User voice message: ${message}`,
    `Current language: ${language}`,
    'Current code context:',
    code || 'No code provided.',
    'Reply conversationally and provide useful next step.',
  ].join('\n\n')

  try {
    const aiResult = await requestAiCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
      temperature: 0.4,
    })

    if (!aiResult.ok) {
      return {
        success: true,
        reply: `Mainne suna: ${message}. AI service abhi unavailable hai, lekin main basic guidance de sakta hoon. Aap code run/debug command bol sakte ho. ${aiResult.error ? `Reason: ${aiResult.error}` : ''}`.trim(),
      }
    }

    const reply = aiResult.text

    if (!reply) {
      return {
        success: true,
        reply: `Mainne suna: ${message}. Aap thoda detail me phir bol sakte ho?`,
      }
    }

    return { success: true, reply }
  } catch {
    return {
      success: true,
      reply: `Mainne suna: ${message}. Network issue ki wajah se detailed AI reply nahi aa paya.`,
    }
  }
}

async function generateDebugSuggestion({ apiKey, language, code, errorOutput }) {
  const fallbackSuggestion = generateOfflineDebugSuggestion({ language, errorOutput, code })

  if (!apiKey) {
    return {
      success: true,
      suggestion: fallbackSuggestion,
      ai: {
        configured: false,
        available: false,
        provider: detectAiProvider(),
        reason: 'missing_key',
        message: 'AI_API_KEY is not configured on the backend.',
      },
    }
  }

  const systemPrompt =
    'You are a senior programming debugger. Return concise fixes with root cause, corrected code snippet, and prevention tips.'

  const userPrompt = [
    `Language: ${language}`,
    'Code:',
    code,
    'Error/Output:',
    errorOutput || 'No error text provided.',
    'Give the best fix with corrected code.',
  ].join('\n\n')

  try {
    const aiResult = await requestAiCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    })

    if (!aiResult.ok) {
      const failureReason = classifyAiFailure(aiResult.error)
      return {
        success: true,
        suggestion: `${fallbackSuggestion}\n\nNote: AI debug service unavailable right now.${aiResult.error ? ` ${aiResult.error}` : ''} Showing local debug help.`,
        ai: {
          configured: true,
          available: false,
          provider: aiResult.provider,
          reason: failureReason,
          message: aiResult.error || 'AI request failed.',
        },
      }
    }

    const suggestion = aiResult.text

    if (!suggestion) {
      return {
        success: true,
        suggestion: `${fallbackSuggestion}\n\nNote: AI response was empty, so local debug help is shown.`,
      }
    }

    return {
      success: true,
      suggestion,
      ai: {
        configured: true,
        available: true,
        provider: aiResult.provider,
        reason: 'ok',
        message: '',
      },
    }
  } catch (error) {
    return {
      success: true,
      suggestion: `${fallbackSuggestion}\n\nNote: AI debug service unavailable (${error.message}). Showing local debug help.`,
      ai: {
        configured: true,
        available: false,
        provider: detectAiProvider(),
        reason: 'network',
        message: error.message || 'Network error while contacting AI provider.',
      },
    }
  }
}

function generateLocalExplanation({ language, code }) {
  const source = String(code || '')
  const lines = source.split('\n').map((l) => l.trim()).filter(Boolean)
  const lineCount = lines.length
  const firstLine = lines[0] || ''
  const lang = String(language || '').toLowerCase()

  if (lang === 'python') {
    const funcs = (source.match(/\bdef\s+\w+/g) || []).length
    const imports = (source.match(/^import |^from /gm) || []).length
    return `Language: python\nLines: ${lineCount}\nFunctions: ${funcs}\nImports: ${imports}\nFirst line: ${firstLine}\n\nSummary: This Python snippet defines ${funcs} function(s) and ${imports} import(s).`
  }

  if (lang === 'javascript' || lang === 'js' || lang === 'jsx' || lang === 'typescript' || lang === 'ts') {
    const funcs = (source.match(/function\s+\w+\s*\(|=>/g) || []).length
    const logs = (source.match(/console\.log\(/g) || []).length
    const imports = (source.match(/\b(import |require\()/g) || []).length
    return `Language: ${lang}\nLines: ${lineCount}\nFunctions/arrow usage: ${funcs}\nConsole logs: ${logs}\nImports/Requires: ${imports}\nFirst line: ${firstLine}\n\nSummary: This ${lang} code appears to ${logs ? 'log output' : 'perform computations'}.`
  }

  if (lang === 'html') {
    const tags = Math.min(10, (source.match(/<[^>]+>/g) || []).length)
    return `Language: html\nLines: ${lineCount}\nTag count (sample): ${tags}\nFirst line: ${firstLine}\n\nSummary: This looks like HTML markup; open in a browser to preview.`
  }

  if (lang === 'cpp' || lang === 'c++') {
    const includes = (source.match(/#include/g) || []).length
    return `Language: cpp\nLines: ${lineCount}\nIncludes: ${includes}\nFirst line: ${firstLine}\n\nSummary: C/C++ code that may need compilation.`
  }

  return `Language: ${lang || 'unknown'}\nLines: ${lineCount}\nFirst line: ${firstLine}\n\nSummary: Basic static summary generated locally. For deeper explanations, set AI_API_KEY in the server environment.`
}

async function generateCodeExplanation({ apiKey, language, code }) {
  const fallback = generateLocalExplanation({ language, code })

  if (!apiKey) {
    return {
      success: true,
      explanation: fallback,
      ai: {
        configured: false,
        available: false,
        provider: detectAiProvider(),
        reason: 'missing_key',
        message: 'AI_API_KEY is not configured on the backend.',
      },
    }
  }

  const systemPrompt =
    'You are a senior programming mentor. Explain code clearly, then list actionable improvements and a safer/faster version when needed.'

  const userPrompt = [
    `Language: ${language}`,
    'Code:',
    code,
    'Explain what this code does in simple steps, point out issues, and suggest improvements.',
  ].join('\n\n')

  try {
    const aiResult = await requestAiCompletion({
      apiKey,
      systemPrompt,
      userPrompt,
      temperature: 0.2,
    })

    if (!aiResult.ok) {
      const failureReason = classifyAiFailure(aiResult.error)
      return {
        success: true,
        explanation: `${fallback}\n\nNote: AI service response unavailable right now.${aiResult.error ? ` ${aiResult.error}` : ''} Showing local explanation.`,
        ai: {
          configured: true,
          available: false,
          provider: aiResult.provider,
          reason: failureReason,
          message: aiResult.error || 'AI request failed.',
        },
      }
    }

    const explanation = aiResult.text
    if (!explanation) {
      return {
        success: true,
        explanation: `${fallback}\n\nNote: AI response was empty, so local explanation shown.`,
      }
    }

    return {
      success: true,
      explanation,
      ai: {
        configured: true,
        available: true,
        provider: aiResult.provider,
        reason: 'ok',
        message: '',
      },
    }
  } catch (error) {
    return {
      success: true,
      explanation: `${fallback}\n\nNote: AI explanation service unavailable (${error.message}). Showing local explanation.`,
      ai: {
        configured: true,
        available: false,
        provider: detectAiProvider(),
        reason: 'network',
        message: error.message || 'Network error while contacting AI provider.',
      },
    }
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/ai/status', (_req, res) => {
  const apiKey = process.env.AI_API_KEY || ''
  res.json({
    configured: Boolean(apiKey),
    provider: detectAiProvider(),
    model: AI_MODEL,
    baseUrl: AI_BASE_URL,
    keyPreview: apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : '',
  })
})

app.get('/api/auth/providers', (_req, res) => {
  res.json({
    googleConfigured: Boolean(GOOGLE_CLIENT_ID),
    githubConfigured: Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET),
  })
})

app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body || {}
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' })
      return
    }

    const googleProfile = await verifyGoogleIdToken(idToken)
    const dbUser = await upsertGoogleUser({ email: googleProfile.email, name: googleProfile.name })
    const sessionToken = issueJwt(dbUser)
    res.json({
      token: sessionToken,
      user: dbUser,
    })
  } catch (error) {
    res.status(401).json({ error: error.message || 'Google authentication failed' })
  }
})

app.get('/api/auth/github/start', (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    const redirectUrl = frontendAuthRedirectUrl({
      auth_error: 'GitHub auth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
    })
    res.redirect(redirectUrl)
    return
  }

  const state = createGithubOauthState()
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize')
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID)
  githubAuthUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI)
  githubAuthUrl.searchParams.set('scope', 'read:user user:email')
  githubAuthUrl.searchParams.set('state', state)

  res.redirect(githubAuthUrl.toString())
})

app.get('/api/auth/github/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '')
    const state = String(req.query.state || '')

    if (!code) {
      throw new Error('Missing GitHub authorization code')
    }

    if (!consumeGithubOauthState(state)) {
      throw new Error('Invalid or expired GitHub OAuth state')
    }

    const accessToken = await exchangeGithubCodeForToken(code)
    const profile = await fetchGithubProfile(accessToken)
    const dbUser = await upsertGithubUser(profile)
    const token = issueJwt(dbUser)

    const redirectUrl = frontendAuthRedirectUrl({
      auth_token: token,
      auth_provider: 'GitHub',
      name: dbUser.name || '',
      email: dbUser.email || '',
      picture: dbUser.picture || '',
    })
    res.redirect(redirectUrl)
  } catch (error) {
    const redirectUrl = frontendAuthRedirectUrl({
      auth_error: error.message || 'GitHub authentication failed',
    })
    res.redirect(redirectUrl)
  }
})

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {}

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' })
      return
    }

    const existing = await findUserByEmail(email)
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const user = await createUserLocal({ email, name, password })
    const token = issueJwt(user)
    res.json({ token, user })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Signup failed' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }

    const user = await findUserByEmail(email)
    if (!user || user.provider !== 'local' || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const ok = bcrypt.compareSync(password, user.passwordHash)
    if (!ok) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const token = issueJwt(user)
    res.json({ token, user })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Login failed' })
  }
})

// Protect all API routes after this point (disabled unless AUTH_REQUIRED=true)
app.use((req, res, next) => {
  if (!AUTH_REQUIRED) {
    next()
    return
  }

  const openPaths = [
    '/api/health',
    '/api/auth/google',
    '/api/auth/github/start',
    '/api/auth/github/callback',
    '/api/auth/signup',
    '/api/auth/login',
  ]
  if (openPaths.includes(req.path)) {
    next()
    return
  }

  requireAuth(req, res, next)
})

app.get('/api/languages', async (_req, res) => {
  const external = await getExternalRuntimes()
  const local = Object.keys(localLanguageConfigs).map((id) => ({
    language: id,
    version: 'local',
    aliases: [],
  }))

  const mergedMap = new Map()
  for (const item of [...external, ...local, ...editorOnlyLanguages]) {
    if (!mergedMap.has(item.language)) {
      mergedMap.set(item.language, item)
    }
  }

  res.json({ languages: Array.from(mergedMap.values()) })
})

app.get('/api/files', async (_req, res) => {
  try {
    const tree = await readTree(WORKSPACE_ROOT)
    res.json({ tree })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/file-content', async (req, res) => {
  try {
    const filePath = resolveSafePath(req.query.path || '')
    const content = await fs.readFile(filePath, 'utf8')
    res.json({ content })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/file-content', async (req, res) => {
  console.log('PUT /api/file-content called', { method: req.method })
  try {
    const { path: relativePath, content } = req.body

    if (!relativePath) {
      res.status(400).json({ error: 'path is required' })
      return
    }

    const filePath = resolveSafePath(relativePath)
    await fs.writeFile(filePath, content ?? '', 'utf8')
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/files', async (req, res) => {
  try {
    const { path: relativePath, type, content } = req.body

    if (!relativePath || !type) {
      res.status(400).json({ error: 'path and type are required' })
      return
    }

    const targetPath = resolveSafePath(relativePath)

    if (type === 'folder') {
      await fs.mkdir(targetPath, { recursive: true })
      res.json({ ok: true })
      return
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content ?? '', 'utf8')
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/files', async (req, res) => {
  try {
    const relativePath = req.query.path || ''
    const targetPath = resolveSafePath(relativePath)
    await fs.rm(targetPath, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.post('/api/run', async (req, res) => {
  try {
    const { language, code, stdin } = req.body

    if (!language || typeof code !== 'string') {
      res.status(400).json({ error: 'language and code are required' })
      return
    }

    const result = await runCode(language, code, stdin)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Snapshot endpoints: store previous versions for undo-safe saves
app.post('/api/snapshots', async (req, res) => {
  try {
    const { path: relativePath, content } = req.body

    if (!relativePath) {
      res.status(400).json({ error: 'path is required' })
      return
    }

    const sanitized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    const snapDir = path.join(WORKSPACE_ROOT, '.snapshots', sanitized)
    await fs.mkdir(snapDir, { recursive: true })

    const timestamp = Date.now()
    const snapFile = path.join(snapDir, `${timestamp}.snap`)
    await fs.writeFile(snapFile, content ?? '', 'utf8')

    res.json({ ok: true, snapshot: { path: snapFile, ts: timestamp } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/snapshots', async (req, res) => {
  try {
    const relativePath = String(req.query.path || '')
    if (!relativePath) {
      res.status(400).json({ error: 'path query required' })
      return
    }

    const sanitized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    const snapDir = path.join(WORKSPACE_ROOT, '.snapshots', sanitized)

    let files = []
    try {
      const items = await fs.readdir(snapDir)
      files = await Promise.all(
        items.map(async (f) => {
          const abs = path.join(snapDir, f)
          const stat = await fs.stat(abs)
          return { name: f, ts: stat.mtimeMs, path: abs }
        }),
      )
    } catch {
      files = []
    }

    files.sort((a, b) => b.ts - a.ts)
        res.json({ snapshots: files })
      } catch (error) {
        res.status(500).json({ error: error.message })
      }
    })

app.post('/api/debug', async (req, res) => {
  try {
    const { language, code, errorOutput } = req.body

    if (!language || typeof code !== 'string') {
      res.status(400).json({ error: 'language and code are required' })
      return
    }

    const apiKey = extractApiKey(req)
    const result = await generateDebugSuggestion({ apiKey, language, code, errorOutput })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/explain', async (req, res) => {
  try {
    const { language: languageFromBody, code } = req.body

    if (typeof code !== 'string') {
      res.status(400).json({ error: 'code is required' })
      return
    }

    const language = languageFromBody || detectLanguageFromCode(code)

    const apiKey = extractApiKey(req)
    const result = await generateCodeExplanation({ apiKey, language, code })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/assistant', async (req, res) => {
  try {
    const { message, language, code } = req.body

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' })
      return
    }

    const apiKey = extractApiKey(req)
    const result = await generateAssistantReply({
      apiKey,
      message,
      language: language || 'javascript',
      code: typeof code === 'string' ? code : '',
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

await ensureWorkspaceBootstrapped()

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT} | AUTH_REQUIRED=${AUTH_REQUIRED}`)
})
