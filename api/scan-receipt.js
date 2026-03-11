/**
 * api/scan-receipt.js
 *
 * Receives a receipt image from the PiggyBudget app,
 * calls Gemini Vision to extract line items,
 * and returns structured JSON matching the ReceiptResult shape.
 *
 * Environment variable required:
 *   GEMINI_API_KEY — set in Vercel project settings
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const {image, mediaType, categories} = req.body ?? {};
  if (!image || !categories) return res.status(400).json({error: 'Missing image or categories'});

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({error: 'Server misconfigured — missing API key'});

  // Slim down category payload — only what Gemini needs to match
  const categoryList = categories.map(c => ({
    id: c.id,
    name: c.name,
    subs: (c.subCategories ?? []).map(s => ({id: s.id, name: s.name})),
  }));

  const prompt = [
    'You are a receipt scanner for a budgeting app.',
    '',
    'CATEGORIES (use the exact id values when matching):',
    JSON.stringify(categoryList),
    '',
    'Look at the receipt image and respond with ONLY a JSON object — no markdown, no explanation, nothing else.',
    '',
    'The JSON must have this exact structure:',
    '{',
    '  "storeName": "string or null",',
    '  "date": "YYYY-MM-DD or null",',
    '  "total": 0.00,',
    '  "items": [',
    '    {',
    '      "description": "item name from receipt",',
    '      "amount": 0.00,',
    '      "suggestedCategoryId": "id from CATEGORIES above, or null",',
    '      "suggestedSubCategoryId": "sub id from CATEGORIES above, or null",',
    '      "confidence": "high or medium or low"',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Copy category ids exactly as they appear in the CATEGORIES list above',
    '- If nothing fits, use null for suggestedCategoryId',
    '- amounts are positive numbers without currency symbols',
    '- confidence is "high" for obvious matches, "medium" for guesses, "low" for uncertain',
  ].join('\n');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mediaType ?? 'image/jpeg',
                data: image,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
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
    const finishReason = data?.candidates?.[0]?.finishReason;
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    console.log('[scan-receipt] finishReason:', finishReason);
    console.log('[scan-receipt] raw length:', raw.length);
    console.log('[scan-receipt] raw:', raw.slice(0, 500));

    if (!raw) {
      console.error('[scan-receipt] empty response:', JSON.stringify(data));
      throw new Error('Gemini returned an empty response');
    }

    // Strip any accidental markdown fences
    const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/,'').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('[scan-receipt] parse failed, raw was:', clean.slice(0, 500));
      throw new Error('Receipt scan failed — please try a clearer photo');
    }

    // Validate that suggestedCategoryIds actually exist in our category list
    const validIds = new Set(categoryList.map(c => c.id));
    const validSubIds = new Set(categoryList.flatMap(c => c.subs.map(s => s.id)));
    if (parsed.items) {
      parsed.items = parsed.items.map(item => ({
        ...item,
        suggestedCategoryId: validIds.has(item.suggestedCategoryId) ? item.suggestedCategoryId : null,
        suggestedSubCategoryId: validSubIds.has(item.suggestedSubCategoryId) ? item.suggestedSubCategoryId : null,
      }));
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('[scan-receipt] error:', err);
    return res.status(500).json({error: err?.message ?? 'Failed to scan receipt'});
  }
};
