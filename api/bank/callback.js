/**
 * api/bank/callback.js
 *
 * TrueLayer redirects here after the user authenticates with their bank.
 * TrueLayer appends ?code=<auth_code> to the redirect URI.
 *
 * This endpoint:
 *   1. Exchanges the code for access_token + refresh_token
 *   2. Passes both back to the app via deep link
 *
 * Environment variables required:
 *   TRUELAYER_CLIENT_ID
 *   TRUELAYER_CLIENT_SECRET
 *   TRUELAYER_REDIRECT_URI
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {code, error, error_description} = req.query;

  if (error) {
    const message = error_description ?? error;
    console.error('TrueLayer callback error:', message);
    return res.redirect(302, `piggybudget://bank/callback?error=${encodeURIComponent(message)}`);
  }

  if (!code) {
    return res.redirect(302, `piggybudget://bank/callback?error=${encodeURIComponent('Missing authorisation code')}`);
  }

  const clientId     = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
  const redirectUri  = process.env.TRUELAYER_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(302, `piggybudget://bank/callback?error=${encodeURIComponent('Server misconfigured')}`);
  }

  try {
    // Exchange authorisation code for tokens
    const tokenRes = await fetch('https://auth.truelayer.com/connect/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        code,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => 'no body');
      console.error('TrueLayer token exchange failed:', tokenRes.status, body);
      return res.redirect(302, `piggybudget://bank/callback?error=${encodeURIComponent('Token exchange failed')}`);
    }

    const tokens = await tokenRes.json();
    const {access_token, refresh_token} = tokens;

    if (!access_token) {
      return res.redirect(302, `piggybudget://bank/callback?error=${encodeURIComponent('No access token returned')}`);
    }

    // Pass tokens back to app via deep link
    const params = new URLSearchParams({access_token});
    if (refresh_token) params.set('refresh_token', refresh_token);

    return res.redirect(302, `piggybudget://bank/callback?${params.toString()}`);

  } catch (err) {
    console.error('bank/callback error:', err);
    return res.redirect(302, `piggybudget://bank/callback?error=${encodeURIComponent('Callback failed')}`);
  }
};
