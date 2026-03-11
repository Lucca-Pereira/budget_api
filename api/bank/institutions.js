/**
 * api/bank/institutions.js
 *
 * TrueLayer — returns the list of available providers for a country.
 * Uses the public TrueLayer providers API (no auth required).
 *
 * Query parameters:
 *   country  optional — ISO 3166-1 alpha-2, e.g. "es", "gb" (default: "es")
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});

  const country = (req.query.country ?? 'es').toLowerCase();

  try {
    // TrueLayer public providers endpoint — no authentication required
    const provRes = await fetch('https://auth.truelayer.com/api/providers', {
      headers: {Accept: 'application/json'},
    });

    if (!provRes.ok) {
      const body = await provRes.text().catch(() => 'no body');
      throw new Error(`Providers fetch failed (${provRes.status}): ${body}`);
    }

    const allProviders = await provRes.json();

    // Filter to providers that support the requested country and are live
    // TrueLayer provider IDs for Spain use the prefix "es-"
    const filtered = (Array.isArray(allProviders) ? allProviders : []).filter(p => {
      const id = (p.provider_id ?? '').toLowerCase();
      return id.startsWith(`${country}-`) && p.status === 'live';
    });

    // Normalise to the same shape BankScreen expects
    const institutions = filtered.map(p => ({
      id:                   p.provider_id,
      name:                 p.display_name ?? p.provider_id,
      logo:                 p.logo_url ?? null,
      transactionTotalDays: 90, // TrueLayer doesn't expose this per-provider; 90 is the standard max
    }));

    // Sort alphabetically
    institutions.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({institutions});

  } catch (err) {
    console.error('bank/institutions error:', err);
    return res.status(500).json({error: err?.message ?? 'Failed to fetch institutions'});
  }
};
