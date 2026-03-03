/**
 * api/list-models.js
 * Debug endpoint — lists available Gemini models for the configured API key.
 * Remove this file once you've confirmed the correct model name.
 */
module.exports = async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({error: 'Missing API key'});

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );
  const data = await response.json();
  return res.status(200).json(data);
};
