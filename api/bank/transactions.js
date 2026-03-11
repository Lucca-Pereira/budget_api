/**
 * api/bank/transactions.js
 *
 * TrueLayer Data API — fetch transactions using the user's access token.
 *
 * Query parameters:
 *   access_token  (required)
 *   date_from     optional YYYY-MM-DD
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});

  const {access_token, date_from} = req.query;

  if (!access_token) {
    return res.status(400).json({error: 'Missing access_token query parameter'});
  }

  const BASE = 'https://api.truelayer.com/data/v1';
  const headers = {Authorization: `Bearer ${access_token}`, Accept: 'application/json'};

  try {
    // 1. Fetch accounts
    const accountsRes = await fetch(`${BASE}/accounts`, {headers});

    if (accountsRes.status === 401) {
      return res.status(401).json({error: 'Bank session expired — please reconnect your bank'});
    }
    if (!accountsRes.ok) {
      const body = await accountsRes.text().catch(() => 'no body');
      throw new Error(`Accounts fetch failed (${accountsRes.status}): ${body}`);
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.results ?? [];

    // Also fetch cards
    const cardsRes = await fetch(`${BASE}/cards`, {headers});
    const cardsData = cardsRes.ok ? await cardsRes.json() : {results: []};
    const cards = cardsData.results ?? [];

    // Build date query string
    const toStr   = new Date().toISOString();
    const fromStr = date_from
      ? new Date(date_from).toISOString()
      : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString(); })();

    const allTransactions = [];

    // 2. Fetch transactions for each account
    for (const account of accounts) {
      const txRes = await fetch(
        `${BASE}/accounts/${account.account_id}/transactions?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`,
        {headers},
      );
      if (!txRes.ok) {
        const body = await txRes.text().catch(() => '');
        console.warn(`Skipping account ${account.account_id}: ${txRes.status} ${body}`);
        continue;
      }
      const txData = await txRes.json();
      for (const tx of txData.results ?? []) {
        allTransactions.push(normaliseTx(tx, account.account_id));
      }
    }

    // 3. Fetch transactions for each card
    for (const card of cards) {
      const txRes = await fetch(
        `${BASE}/cards/${card.account_id}/transactions?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`,
        {headers},
      );
      if (!txRes.ok) continue;
      const txData = await txRes.json();
      for (const tx of txData.results ?? []) {
        allTransactions.push(normaliseTx(tx, card.account_id));
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

/**
 * Normalise a TrueLayer transaction to PiggyBudget's shape.
 */
function normaliseTx(tx, accountId) {
  // TrueLayer amount: negative = debit (spending), positive = credit
  const rawAmount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount ?? '0');
  if (rawAmount === 0) return null;

  const type = rawAmount < 0 ? 'debit' : 'credit';

  const date =
    tx.timestamp?.split('T')[0] ??
    tx.booking_date ??
    new Date().toISOString().split('T')[0];

  const id =
    tx.transaction_id ??
    `${accountId}-${date}-${Math.abs(rawAmount)}-${(tx.description ?? '').slice(0, 8)}`;

  return {
    id,
    date,
    amount: Math.abs(rawAmount),
    type,
    description: tx.description ?? '',
    merchantName: tx.merchant_name ?? tx.description ?? null,
    category: tx.transaction_classification?.[0] ?? null,
    accountId,
  };
}
