/**
 * api/health.js
 * Simple health check — GET /api/health should return 200.
 */
module.exports = (req, res) => {
  res.status(200).json({status: 'ok', service: 'piggybudget-api'});
};
