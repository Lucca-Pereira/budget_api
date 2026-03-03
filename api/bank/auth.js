/**
 * api/bank/auth.js
 *
 * Initiates TrueLayer OAuth flow.
 * Returns the URL the app should open in a WebView for the user to log in.
 *
 * Environment variables required:
 *   TRUELAYER_CLIENT_ID
 *   TRUELAYER_REDIRECT_URI
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});

  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const redirectUri = process.env.TRUELAYER_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({error: 'Server misconfigured — missing TrueLayer credentials'});
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'info accounts balance transactions offline_access',
    redirect_uri: redirectUri,
    providers: 'es-ob-sabadell',
  });

  const authUrl = `https://auth.truelayer.com/?${params.toString()}`;
  return res.status(200).json({authUrl});
};
