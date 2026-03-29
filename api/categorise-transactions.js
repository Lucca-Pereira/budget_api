/**
 * api/categorise-transactions.js
 *
 * Receives a list of bank transactions and the user's categories,
 * calls Gemini to assign the best matching category to each transaction,
 * and returns the assignments.
 *
 * Fixes applied:
 *  - #3  Better Gemini prompt with richer context + keyword pre-matching
 *  - #4  Null/failed results are returned explicitly so app can cache them
 *  - #5  Merchant name normalised before matching
 *
 * POST body:
 *   {
 *     transactions: Array<{ id, merchantName, description, amount, bankCategory? }>,
 *     categories:   Array<{ id, name, icon, subCategories: Array<{ id, name, icon }> }>
 *   }
 *
 * Response:
 *   {
 *     assignments: Array<{ id, categoryId: string|null, subCategoryId: string|null }>
 *   }
 */

// ── Fix #3: Keyword pre-matching — catches obvious merchants without Gemini ──
// Keys are lowercase partial merchant names; value is a category name hint
// that gets matched against the user's actual category names.
const KEYWORD_HINTS = [
  // Food & Groceries
  {keywords: ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'eroski', 'consum', 'alcampo', 'hipercor', 'supercor', 'bm supermercados', 'ahorramas', 'supersol', 'simply', 'walmart', 'tesco', 'sainsbury', 'asda', 'waitrose', 'morrisons', 'spar', 'coop'], hint: 'groceries food supermarket'},
  // Restaurants & Dining
  {keywords: ['mcdonald', 'burger king', 'kfc', 'subway', 'domino', 'pizza hut', 'telepizza', 'just eat', 'glovo', 'ubereats', 'deliveroo', 'wolt', 'restaurante', 'cafeteria', 'bar ', 'cafe ', 'cafè', 'starbucks', 'costa coffee'], hint: 'restaurant dining eating out food'},
  // Transport & Fuel
  {keywords: ['repsol', 'cepsa', 'bp ', 'shell', 'galp', 'petronor', 'campsa', 'petrol', 'gasolinera', 'renfe', 'fgc', 'metro ', 'bus ', 'taxi', 'uber', 'cabify', 'blablacar', 'parking'], hint: 'transport fuel car petrol travel'},
  // Subscriptions & Streaming
  {keywords: ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple.com', 'google play', 'youtube premium', 'twitch', 'adobe', 'microsoft 365', 'dropbox', 'icloud'], hint: 'subscriptions streaming entertainment'},
  // Health & Pharmacy
  {keywords: ['farmacia', 'pharmacy', 'boots', 'lloyds pharmacy', 'medicamento', 'clinica', 'hospital', 'doctor', 'dentista', 'optica', 'gym', 'fitness', 'decathlon'], hint: 'health pharmacy medical'},
  // Shopping & Clothing
  {keywords: ['zara', 'h&m', 'primark', 'mango', 'el corte ingles', 'amazon', 'ebay', 'aliexpress', 'fnac', 'media markt', 'leroy merlin', 'ikea', 'bershka', 'pull&bear', 'massimo dutti'], hint: 'shopping clothing retail'},
  // Utilities & Bills
  {keywords: ['endesa', 'iberdrola', 'naturgy', 'vodafone', 'movistar', 'orange', 'masmovil', 'jazztel', 'electricidad', 'gas natural', 'agua ', 'internet', 'telefonica'], hint: 'utilities bills electricity gas phone internet'},
  // Housing & Rent
  {keywords: ['alquiler', 'renta ', 'hipoteca', 'comunidad', 'ibi ', 'rent ', 'mortgage', 'landlord'], hint: 'housing rent mortgage'},
];

/**
 * Try to match a merchant against keyword hints before calling Gemini.
 * Returns a hint string or null.
 */
function keywordHint(merchantName, description) {
  const text = ((merchantName ?? '') + ' ' + (description ?? '')).toLowerCase();
  for (const entry of KEYWORD_HINTS) {
    for (const kw of entry.keywords) {
      if (text.includes(kw)) return entry.hint;
    }
  }
  return null;
}

/**
 * Normalise a merchant name for consistent matching.
 */
function normaliseMerchant(raw) {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\s+\d{4,}\s*/g, ' ')
    .replace(/\s+(s\.?l\.?|s\.?a\.?|ltd|inc|gmbh|sl|sa)\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

  // Build a valid category ID set for validation
  const validCategoryIds = new Set(categories.map(c => c.id));
  const validSubIds = new Set(
    categories.flatMap(c => (c.subCategories ?? []).map(s => s.id))
  );

  // ── Fix #3: Keyword pre-matching — resolve obvious merchants without Gemini ──
  const preMatched = [];
  const needsGemini = [];

  for (const tx of transactions) {
    const hint = keywordHint(tx.merchantName, tx.description);
    if (hint) {
      // Find best category match for this hint
      const hintWords = hint.split(' ');
      let bestCat = null;
      let bestScore = 0;

      for (const cat of categories) {
        const catText = (cat.name + ' ' + (cat.icon ?? '')).toLowerCase();
        const score = hintWords.filter(w => catText.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestCat = cat;
        }
      }

      if (bestCat && bestScore > 0) {
        preMatched.push({id: tx.id, categoryId: bestCat.id, subCategoryId: null});
        continue;
      }
    }
    needsGemini.push(tx);
  }

  // If everything was pre-matched, return immediately
  if (needsGemini.length === 0) {
    return res.status(200).json({assignments: preMatched});
  }

  // ── Fix #3: Improved Gemini prompt with richer category context ──
  const categoryList = categories.map(c => ({
    id: c.id,
    name: c.name,
    subs: (c.subCategories ?? []).map(s => ({id: s.id, name: s.name})),
  }));

  const txList = needsGemini.map(t => ({
    id: t.id,
    merchant: normaliseMerchant(t.merchantName) || normaliseMerchant(t.description),
    rawDescription: t.description,
    bankCategory: t.bankCategory ?? null,
    amount: t.amount,
  }));

  const prompt = `You are a personal finance assistant categorising bank transactions for a budgeting app.

USER'S BUDGET CATEGORIES:
${JSON.stringify(categoryList, null, 2)}

TRANSACTIONS TO CATEGORISE:
${JSON.stringify(txList, null, 2)}

INSTRUCTIONS:
- Assign each transaction to the most appropriate category from the user's list above
- Use the exact "id" strings — do not invent or modify them
- Set subCategoryId only when a sub-category is a clearly better fit, otherwise null
- Set categoryId to null ONLY if the transaction genuinely fits no category (e.g. bank fees, transfers between own accounts, ATM withdrawals)
- Use bankCategory and amount as additional signals when merchant name is unclear
- Common patterns: supermarkets=food/groceries, streaming services=subscriptions/entertainment, petrol stations=transport/fuel, pharmacies=health, clothing shops=shopping

Respond ONLY with minified JSON, no markdown, no explanation:
{"assignments":[{"id":"tx-id","categoryId":"cat-id-or-null","subCategoryId":"sub-id-or-null"}]}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{parts: [{text: prompt}]}],
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

    if (!Array.isArray(parsed.assignments)) {
      throw new Error('Unexpected Gemini response shape');
    }

    // Validate IDs — null out any hallucinated ones
    const geminiAssignments = parsed.assignments.map(a => ({
      id: a.id,
      categoryId: validCategoryIds.has(a.categoryId) ? a.categoryId : null,
      subCategoryId: validSubIds.has(a.subCategoryId) ? a.subCategoryId : null,
    }));

    // ── Fix #4: Include ALL transactions in response, even null-categorised ones ──
    // This lets the app cache null results and avoid re-querying the same merchant
    const geminiMap = new Map(geminiAssignments.map(a => [a.id, a]));

    // Ensure every needsGemini tx has an entry (fill missing with null)
    const allGeminiResults = needsGemini.map(tx => {
      return geminiMap.get(tx.id) ?? {id: tx.id, categoryId: null, subCategoryId: null};
    });

    // Combine pre-matched + Gemini results
    const allAssignments = [...preMatched, ...allGeminiResults];

    return res.status(200).json({assignments: allAssignments});

  } catch (err) {
    console.error('categorise-transactions error:', err);

    // ── Fix #4: On Gemini failure, return null assignments for all transactions ──
    // App can cache these to avoid hammering Gemini on every sync
    const fallbackAssignments = transactions.map(tx => ({
      id: tx.id,
      categoryId: null,
      subCategoryId: null,
    }));
    return res.status(200).json({assignments: fallbackAssignments, geminiError: true});
  }
};
