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
    scope: 'accounts balance transactions offline_access',
    providers: 'mock',
    redirect_uri: redirectUri,
  });

  // Sandbox uses auth.truelayer-sandbox.com, live uses auth.truelayer.com
  const isSandbox = clientId.startsWith('sandbox-');
  const authBase = isSandbox ? 'https://auth.truelayer-sandbox.com' : 'https://auth.truelayer.com';
  const authUrl = `${authBase}/?${params.toString()}`;
  return res.status(200).json({authUrl});
};
