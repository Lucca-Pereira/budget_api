/**
 * api/bank/transactions.js
 *
 * Fetches transactions from TrueLayer for the last 30 days.
 * Expects Authorization: Bearer <access_token> header from the app.
 *
 * Returns transactions in a normalised format ready for PiggyBudget.
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({error: 'Missing access token'});
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    // 1. Get accounts (sandbox vs live)
    const clientId = process.env.TRUELAYER_CLIENT_ID ?? '';
    const isSandbox = clientId.startsWith('sandbox-');
    const apiBase = isSandbox ? 'https://api.truelayer-sandbox.com' : 'https://api.truelayer.com';

    const accountsRes = await fetch(`${apiBase}/data/v1/accounts`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });

    if (!accountsRes.ok) {
      const err = await accountsRes.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? 'Failed to fetch accounts');
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.results ?? [];

    if (accounts.length === 0) {
      return res.status(200).json({transactions: []});
    }

    // 2. Fetch transactions for each account (last 30 days)
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = new Date().toISOString().split('T')[0];

    const allTransactions = [];

    for (const account of accounts) {
      const txRes = await fetch(
        `${apiBase}/data/v1/accounts/${account.account_id}/transactions?from=${fromStr}&to=${toStr}`,
        {headers: {Authorization: `Bearer ${accessToken}`}},
      );

      if (!txRes.ok) continue;

      const txData = await txRes.json();
      const txs = txData.results ?? [];

      for (const tx of txs) {
        // Only include debits (spending), skip credits (income)
        if (tx.amount >= 0) continue;

        allTransactions.push({
          id: tx.transaction_id,
          date: tx.timestamp.split('T')[0],         // "YYYY-MM-DD"
          amount: Math.abs(tx.amount),               // positive number
          description: tx.description ?? '',
          merchantName: tx.merchant_name ?? null,
          category: tx.transaction_category ?? null, // TrueLayer's own category hint
          accountId: account.account_id,
        });
      }
    }

    // Sort newest first
    allTransactions.sort((a, b) => b.date.localeCompare(a.date));

    return res.status(200).json({transactions: allTransactions});

  } catch (err) {
    console.error('bank/transactions error:', err);
    return res.status(500).json({error: err?.message ?? 'Failed to fetch transactions'});
  }
};
