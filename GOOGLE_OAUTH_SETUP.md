# Google OAuth Setup Guide

Google authentication has been added to your AI Coding IDE! Follow these steps to enable it.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown and select **"New Project"**
3. Enter a project name (e.g., "AI Coding IDE")
4. Click **"Create"**
5. Wait for the project to be created

## Step 2: Enable Google+ API

1. In the Cloud Console, go to **APIs & Services** → **Library**
2. Search for **"Google Identity Services"**
3. Click on it and then click **"Enable"**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ Create Credentials"** and select **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen first:
   - Choose **"External"** user type
   - Fill in the required fields (App name, Email, etc.)
   - Click **Save and Continue** and complete the scopes
4. Back on the Credentials page, click **"+ Create Credentials"** → **"OAuth client ID"** again
5. Select **"Web application"** as the application type
6. Fill in the name (e.g., "AI Coding IDE Web")

## Step 4: Configure Authorized Origins and Redirect URIs

For local development:

**Authorized JavaScript origins:**
```
http://localhost:5173
http://localhost:4000
```

**Authorized redirect URIs:**
```
http://localhost:4000/api/auth/google/callback
```

For production, replace `localhost:5173` and `localhost:4000` with your actual domain.

## Step 5: Copy Your Client ID

1. After creating the OAuth client, you'll see your credentials
2. Copy the **Client ID** (long string, looks like: `xxxxx.apps.googleusercontent.com`)
3. **Do NOT share this publicly!**

## Step 6: Update Your .env Files

Update the `.env` file in your project root:

```
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
```

Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with the Client ID you copied.

## Step 7: Test Google Login

1. Start your development server:
   ```bash
   npm run dev:full
   ```

2. Open `http://localhost:5173` in your browser

3. On the login page, you should see a **"Sign in with Google"** button

4. Click it and sign in with your Google account

## How It Works

- When you click "Sign in with Google", the Google Sign-In widget appears
- After you authenticate with Google, your credentials are verified by the backend
- A user account is automatically created (if it doesn't exist) using your Google profile (name, email)
- You're logged in and redirected to the home page
- Your session is maintained using JWT tokens

## Environment Variables Reference

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_GOOGLE_CLIENT_ID` | `.env` (root) | Client ID for frontend Google Sign-In widget |
| `GOOGLE_CLIENT_ID` | `.env` (root) | Client ID for backend token verification |
| `APP_JWT_SECRET` | `.env` (root) | Secret for signing JWT session tokens |

## Troubleshooting

### "Google Sign-In button not appearing"
- Make sure `VITE_GOOGLE_CLIENT_ID` is set in `.env` and correct
- Check browser console for errors (F12 → Console tab)
- Ensure `http://localhost:5173` is in Authorized JavaScript origins

### "Google authentication failed"
- Verify both `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` are the same in `.env`
- Check that `GOOGLE_CLIENT_ID` matches in `.env`
- Ensure the backend is running (`npm run server`)

### "Invalid redirect URI"
- Make sure `http://localhost:4000/api/auth/google/callback` is in your Authorized redirect URIs
- Check that `FRONTEND_ORIGIN=http://localhost:5173` in `.env`

## Security Notes

⚠️ **Important:**
- Never commit `.env` files with real credentials to version control
- Use `.gitignore` to exclude `.env` files
- For production, use environment variables from your hosting platform
- The `APP_JWT_SECRET` should be a strong, random string in production

## Next Steps

- Your user data is stored in `server/data/users.json`
- Google-authenticated users have `provider: "google"` in their profile
- You can now add more OAuth providers (GitHub, Facebook, etc.) using the same pattern

## Support

For issues with:
- **Google OAuth**: Check [Google Sign-In documentation](https://developers.google.com/identity/gsi/web)
- **Your app**: Check the browser console and server logs for error messages