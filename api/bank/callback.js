/**
 * api/bank/callback.js
 *
 * TrueLayer redirects here after the user logs in with their bank.
 * Exchanges the auth code for tokens and returns them to the app.
 *
 * Environment variables required:
 *   TRUELAYER_CLIENT_ID
 *   TRUELAYER_CLIENT_SECRET
 *   TRUELAYER_REDIRECT_URI
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {code, error} = req.query;

  if (error) {
    // Redirect back to app with error
    return res.redirect(302, `piggybudget://bank/callback?error=${error}`);
  }

  if (!code) {
    return res.status(400).json({error: 'Missing auth code'});
  }

  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
  const redirectUri = process.env.TRUELAYER_REDIRECT_URI;

  try {
    // Exchange code for tokens (sandbox vs live)
    const clientId = process.env.TRUELAYER_CLIENT_ID ?? '';
    const isSandbox = clientId.startsWith('sandbox-');
    const tokenBase = isSandbox ? 'https://auth.truelayer-sandbox.com' : 'https://auth.truelayer.com';
    const tokenRes = await fetch(`${tokenBase}/connect/token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err?.error_description ?? 'Token exchange failed');
    }

    const tokens = await tokenRes.json();

    // Redirect back to app with tokens
    const params = new URLSearchParams({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? '',
    });

    return res.redirect(302, `piggybudget://bank/callback?${params.toString()}`);

  } catch (err) {
    console.error('bank/callback error:', err);
    return res.redirect(302, `piggybudget://bank/callback?error=${encodeURIComponent(err.message)}`);
  }
};
