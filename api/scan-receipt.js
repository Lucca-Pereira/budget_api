/**
 * api/scan-receipt.js
 *
 * Receives a receipt image from the PiggyBudget app,
 * calls Gemini Vision to extract line items,
 * and returns structured JSON matching the ReceiptResult shape.
 *
 * Environment variable required:
 *   GEMINI_API_KEY — set this in Vercel project settings, never in code
 */

const {GoogleGenerativeAI} = require('@google/generative-ai');

const MODEL = 'gemini-2.0-flash';

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {image, mediaType, categories} = req.body ?? {};

  if (!image || !categories) {
    return res.status(400).json({error: 'Missing image or categories'});
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({error: 'Server misconfigured — missing API key'});
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({model: MODEL});

    const prompt = `You are a receipt scanning assistant for a budget tracking app called PiggyBudget.
Extract all line items from this receipt image and match them to the user's budget categories.

The user's categories are:
${JSON.stringify(categories, null, 2)}

Rules:
- Extract every distinct purchased item with its amount
- Match each item to the most appropriate categoryId and subCategoryId from the list above
- If no category fits, set suggestedCategoryId to null
- Set confidence: "high" if obvious match, "medium" if reasonable guess, "low" if uncertain
- The date should be in "YYYY-MM-DD" format, or null if not visible
- Amounts must be positive numbers (no currency symbols)
- Respond ONLY with valid JSON, no preamble, no markdown fences

JSON shape:
{
  "storeName": string | null,
  "date": string | null,
  "items": [
    {
      "description": string,
      "amount": number,
      "suggestedCategoryId": string | null,
      "suggestedSubCategoryId": string | null,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "total": number | null
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mediaType ?? 'image/jpeg',
          data: image,
        },
      },
      prompt,
    ]);

    const raw = result.response.text();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('scan-receipt error:', err);
    return res.status(500).json({
      error: err?.message ?? 'Failed to scan receipt',
    });
  }
};
