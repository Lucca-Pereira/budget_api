/**
 * api/categorise-transactions.js
 *
 * Receives a list of bank transactions and the user's categories,
 * calls Gemini to assign the best matching category to each transaction,
 * and returns the assignments.
 *
 * Environment variable required:
 *   GEMINI_API_KEY
 *
 * POST body:
 *   {
 *     transactions: Array<{ id, merchantName, description, amount }>,
 *     categories:   Array<{ id, name, icon, subCategories: Array<{ id, name, icon }> }>
 *   }
 *
 * Response:
 *   {
 *     assignments: Array<{ id, categoryId: string|null, subCategoryId: string|null }>
 *   }
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const {transactions, categories} = req.body ?? {};
  if (!transactions || !categories) {
    return res.status(400).json({error: 'Missing transactions or categories'});
  }
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(200).json({assignments: []});
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({error: 'Server misconfigured — missing GEMINI_API_KEY'});

  const categoryList = categories.map(c => ({
    id: c.id, name: c.name,
    subs: (c.subCategories ?? []).map(s => ({id: s.id, name: s.name})),
  }));

  const txList = transactions.map(t => ({
    id: t.id,
    merchant: t.merchantName ?? t.description,
    bankCategory: t.bankCategory ?? null,
  }));

  const prompt = `You are a personal finance assistant. Assign each bank transaction to the best matching budget category.

CATEGORIES (copy ids exactly):
${JSON.stringify(categoryList)}

TRANSACTIONS:
${JSON.stringify(txList)}

Rules:
- Use the exact id strings from CATEGORIES
- Set subCategoryId if a sub fits better, otherwise null
- If nothing fits, set categoryId to null
- Common matches: supermarkets=food, restaurants=dining, Netflix/Spotify=subscriptions, petrol=transport, pharmacies=health
- Reply ONLY with minified JSON, no markdown

{"assignments":[{"id":"tx-id","categoryId":"cat-id-or-null","subCategoryId":"sub-id-or-null"}]}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [{text: prompt}],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(JSON.stringify(err));
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // Validate the shape
    if (!Array.isArray(parsed.assignments)) {
      throw new Error('Unexpected Gemini response shape');
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('categorise-transactions error:', err);
    // Return empty assignments on error so the app can fall back gracefully
    return res.status(500).json({error: err?.message ?? 'Failed to categorise transactions'});
  }
};
