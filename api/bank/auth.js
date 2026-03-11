/**
 * api/bank/auth.js
 *
 * TrueLayer Data API — build the auth link for the bank connection.
 *
 * Flow:
 *   1. App calls GET /api/bank/auth
 *   2. This endpoint builds and returns a TrueLayer auth URL
 *   3. App opens the URL in a browser tab; user picks their bank and logs in
 *   4. TrueLayer redirects to TRUELAYER_REDIRECT_URI with ?code=<auth_code>
 *   5. /api/bank/callback exchanges the code for access + refresh tokens
 *
 * Environment variables required:
 *   TRUELAYER_CLIENT_ID     — from console.truelayer.com
 *   TRUELAYER_REDIRECT_URI  — e.g. https://budget-api-sigma.vercel.app/api/bank/callback
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});

  const clientId   = process.env.TRUELAYER_CLIENT_ID;
  const redirectUri = process.env.TRUELAYER_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({error: 'Server misconfigured — missing TRUELAYER_CLIENT_ID or TRUELAYER_REDIRECT_URI'});
  }

  // Build the TrueLayer auth URL.
  // providers: es-ob-all covers PSD2/Open Banking Spanish banks.
  // es-oauth-all covers banks that use OAuth (e.g. Revolut ES, N26).
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    scope:         'info accounts balance transactions cards offline_access',
    redirect_uri:  redirectUri,
    providers:     'es-ob-all es-oauth-all',
  });

  const authUrl = `https://auth.truelayer.com/?${params.toString()}`;

  return res.status(200).json({authUrl});
};
