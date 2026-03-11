/**
 * api/bank/cancel.js
 *
 * TrueLayer redirects here if the user cancels the bank connection flow.
 * We simply pass a cancellation signal back to the app via deep link.
 */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Pass cancellation back to the app
  return res.redirect(302, 'piggybudget://bank/callback?cancelled=true');
};
