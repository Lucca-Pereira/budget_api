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

  const prompt = `You are a personal finance assistant for a budget tracking app called PiggyBudget.
Assign each bank transaction below to the most appropriate category from the user's category list.

The user's categories are:
${JSON.stringify(categories, null, 2)}

The transactions to categorise are:
${JSON.stringify(transactions.map(t => ({id: t.id, merchant: t.merchantName, description: t.description, amount: t.amount, bankCategory: t.bankCategory ?? null})), null, 2)}

Rules:
- Match each transaction to the most appropriate categoryId from the list
- If a subcategory fits better, also set subCategoryId
- If no category fits at all, set categoryId to null
- Base your decision on the merchant name and description
- The bankCategory field is a hint from the bank (e.g. "Groceries", "Entertainment") — use it as supporting evidence but always map to the user's actual category IDs
- Common examples: supermarkets → Food/Groceries, restaurants → Food/Dining, Netflix/Spotify → Subscriptions, petrol stations → Transport, pharmacies → Health
- Respond ONLY with valid JSON, no preamble, no markdown fences

JSON shape:
{
  "assignments": [
    {
      "id": string,
      "categoryId": string | null,
      "subCategoryId": string | null
    }
  ]
}`;

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
        maxOutputTokens: 2048,
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
