/**
 * api/bank/refresh.js
 *
 * TrueLayer Data API — refresh an expired access token using the refresh token.
 *
 * POST body: { refresh_token: string }
 * Returns:   { access_token, refresh_token }
 *
 * Environment variables required:
 *   TRUELAYER_CLIENT_ID
 *   TRUELAYER_CLIENT_SECRET
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const {refresh_token} = req.body ?? {};
  if (!refresh_token) return res.status(400).json({error: 'Missing refresh_token'});

  const clientId     = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({error: 'Server misconfigured — missing TrueLayer credentials'});
  }

  try {
    const tokenRes = await fetch('https://auth.truelayer.com/connect/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token,
      }).toString(),
    });

    if (tokenRes.status === 400 || tokenRes.status === 401) {
      // Refresh token is invalid or expired — user must reconnect
      return res.status(401).json({error: 'Bank session expired — please reconnect your bank'});
    }

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => 'no body');
      throw new Error(`Token refresh failed (${tokenRes.status}): ${body}`);
    }

    const tokens = await tokenRes.json();
    return res.status(200).json({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? refresh_token, // TrueLayer may reuse the same refresh token
    });

  } catch (err) {
    console.error('bank/refresh error:', err);
    return res.status(500).json({error: err?.message ?? 'Failed to refresh bank session'});
  }
};
