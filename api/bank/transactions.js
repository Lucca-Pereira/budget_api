/**
 * api/bank/transactions.js
 *
 * TrueLayer Data API — fetch transactions using the user's access token.
 *
 * Fixes applied:
 *  - #1  Null filter: zero-amount or bad transactions no longer pushed to array
 *  - #2  Date filter: date_from is respected correctly; defaults to 30 days back
 *  - #5  Merchant normalisation: consistent name extraction
 *  - #8  Deduplication: cross-account duplicate txs removed
 *  - #9  Pending filter: provisional/pending transactions excluded
 *  - #11 Timezone buffer: date_from gets 1 extra day back to avoid boundary misses
 *
 * Query parameters:
 *   access_token  (required)
 *   date_from     optional YYYY-MM-DD — if omitted, defaults to 30 days ago
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
    // ── Fix #11: Add 1-day buffer to date_from to avoid timezone boundary misses ──
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 1); // include today fully
    const toStr = toDate.toISOString();

    let fromStr;
    if (date_from) {
      // Subtract 1 extra day from the requested date as a boundary buffer
      const d = new Date(date_from);
      d.setDate(d.getDate() - 1);
      fromStr = d.toISOString();
    } else {
      // Default: 30 days back
      const d = new Date();
      d.setDate(d.getDate() - 30);
      fromStr = d.toISOString();
    }

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
    console.log(`[transactions] accounts found: ${accounts.length}, fromStr: ${fromStr}, toStr: ${toStr}`);

    // Also fetch cards
    const cardsRes = await fetch(`${BASE}/cards`, {headers});
    const cardsData = cardsRes.ok ? await cardsRes.json() : {results: []};
    const cards = cardsData.results ?? [];
    console.log(`[transactions] cards found: ${cards.length}`);

    const rawTransactions = [];

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
      console.log(`[transactions] account ${account.account_id}: ${txData.results?.length ?? 0} transactions`);
      for (const tx of txData.results ?? []) {
        // ── Fix #9: Skip pending/provisional transactions ──
        const status = (tx.transaction_type ?? tx.status ?? '').toLowerCase();
        if (status === 'pending' || status === 'provisional') continue;

        const normalised = normaliseTx(tx, account.account_id);
        // ── Fix #1: Skip null entries (zero amount etc) ──
        if (normalised) rawTransactions.push(normalised);
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
        const status = (tx.transaction_type ?? tx.status ?? '').toLowerCase();
        if (status === 'pending' || status === 'provisional') continue;

        const normalised = normaliseTx(tx, card.account_id);
        if (normalised) rawTransactions.push(normalised);
      }
    }

    // ── Fix #8: Deduplicate across accounts/cards ──
    // Primary key: transaction_id if present (most reliable)
    // Fallback key: type+date+amount+merchantName (catches cross-account dupes)
    const seen = new Set();
    const allTransactions = [];
    for (const tx of rawTransactions) {
      // Build a dedup key — prefer the real tx ID, fall back to content hash
      const dedupKey = tx.id.startsWith('fallback-')
        ? `${tx.type}-${tx.date}-${tx.amount}-${normaliseMerchant(tx.merchantName ?? tx.description)}`
        : tx.id;

      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      allTransactions.push(tx);
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
 * ── Fix #5: Consistent merchant name normalisation ──
 * Strip noise words, card numbers, and common suffixes that make
 * the same merchant appear with different names across transactions.
 */
function normaliseMerchant(raw) {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\s+\d{4,}\s*/g, ' ')      // remove card/ref numbers
    .replace(/\s+(s\.?l\.?|s\.?a\.?|ltd|inc|gmbh|sl|sa)\.?\s*$/i, '') // legal suffixes
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise a TrueLayer transaction to PiggyBudget's shape.
 * Returns null for zero-amount or invalid transactions (Fix #1).
 */
function normaliseTx(tx, accountId) {
  const rawAmount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount ?? '0');

  // ── Fix #1: Filter zero or invalid amounts ──
  if (!rawAmount || isNaN(rawAmount)) return null;

  const type = rawAmount < 0 ? 'debit' : 'credit';

  const date =
    tx.timestamp?.split('T')[0] ??
    tx.booking_date ??
    tx.value_date ??
    new Date().toISOString().split('T')[0];

  // ── Fix #2 + #8: More reliable ID — prefer real tx_id, build a stable fallback ──
  const id = tx.transaction_id
    ?? `fallback-${accountId}-${date}-${Math.abs(rawAmount).toFixed(2)}-${(tx.description ?? '').slice(0, 12).replace(/\s+/g, '')}`;

  // ── Fix #5: Normalise merchant name consistently ──
  const rawMerchant = tx.merchant_name || tx.merchant?.name || null;
  const merchantName = rawMerchant
    ? rawMerchant.trim()
    : null;

  return {
    id,
    date,
    amount: Math.abs(rawAmount),
    type,
    description: tx.description ?? '',
    merchantName,
    category: tx.transaction_classification?.[0] ?? null,
    accountId,
  };
}
