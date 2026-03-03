/**
 * api/bank/refresh.js
 *
 * Refreshes an expired TrueLayer access token using the refresh token.
 * The app calls this when it gets a 401 from /api/bank/transactions.
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const {refresh_token} = req.body ?? {};
  if (!refresh_token) return res.status(400).json({error: 'Missing refresh_token'});

  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;

  try {
    const tokenRes = await fetch('https://auth.truelayer.com/connect/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err?.error_description ?? 'Token refresh failed');
    }

    const tokens = await tokenRes.json();
    return res.status(200).json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? refresh_token,
    });

  } catch (err) {
    console.error('bank/refresh error:', err);
    return res.status(500).json({error: err?.message ?? 'Failed to refresh token'});
  }
};
