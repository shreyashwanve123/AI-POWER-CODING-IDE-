# AI Powered Coding IDE

Lightweight local coding IDE that runs a Vite + React frontend and an Express backend for running and managing files in the workspace.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

Create env variables in project root `.env` (recommended). Server also reads `server/.env` if present.

```
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173

# AI provider
# For Anthropic, keep the base URL below and use your Anthropic key in AI_API_KEY.
# For OpenAI-compatible providers, set AI_BASE_URL to that provider's chat completions endpoint.
AI_BASE_URL=https://api.anthropic.com/v1/messages
AI_MODEL=claude-opus-4-1
AI_API_KEY=<your-ai-api-key>

# Google OAuth
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_ID=<your-google-client-id>

# GitHub OAuth
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
# Optional: defaults to http://localhost:4000/api/auth/github/callback
# GITHUB_REDIRECT_URI=http://localhost:4000/api/auth/github/callback

APP_JWT_SECRET=<set-a-strong-secret>
USERS_DB_PATH=./server/data/users.json
```

AI setup notes:
1) If you use Anthropic, the backend now sends the correct `x-api-key` and `anthropic-version` headers automatically.
2) If you use an OpenAI-compatible endpoint, keep `AI_API_KEY` and change `AI_BASE_URL` to that provider's chat completions URL.
3) To verify the backend sees your key, open `http://localhost:4000/api/ai/status` after starting the server.

Steps to obtain `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`:
1) In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
2) Add authorized JavaScript origins: `http://localhost:5173` (Vite) and `http://localhost:4000` (backend).
3) Copy the Client ID value into both env files above.

Steps to obtain `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`:
1) GitHub Developer Settings -> OAuth Apps -> New OAuth App.
2) Homepage URL: `http://localhost:5173`
3) Authorization callback URL: `http://localhost:4000/api/auth/github/callback`
4) Copy Client ID and generate a Client Secret, then set both env vars.

3. Start frontend and backend during development:

```bash
npm run dev:full
```

Login options:
- Google Sign-In (recommended) — uses your Google ID token and issues an app session.
- GitHub Sign-In — OAuth redirect flow via backend callback.
- Email + Password — use the Sign Up tab to create an account; credentials are stored in `server/data/users.json` with bcrypt hashing.

The frontend runs on the Vite dev server and the backend listens on `http://localhost:4000` by default.
