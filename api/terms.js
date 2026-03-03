/**
 * api/terms.js
 * Serves the PiggyBudget terms of service.
 */
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Terms of Service — PiggyBudget</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 760px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 700; margin-top: 36px; }
    p, li { font-size: 15px; color: #333; }
    ul { padding-left: 20px; }
    .meta { color: #888; font-size: 13px; margin-bottom: 40px; }
    a { color: #3b82f6; }
  </style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p class="meta">PiggyBudget &nbsp;·&nbsp; Last updated: March 2026</p>

  <p>Please read these Terms of Service ("Terms") carefully before using the PiggyBudget mobile application ("the App"). By using the App, you agree to be bound by these Terms.</p>

  <h2>1. About PiggyBudget</h2>
  <p>PiggyBudget is a personal budget tracking application designed to help individuals manage their finances. The App allows you to track expenses, connect bank accounts via Open Banking, and scan receipts.</p>

  <h2>2. Acceptance of Terms</h2>
  <p>By downloading or using PiggyBudget, you confirm that you are at least 18 years old (or 13 years old with parental consent) and agree to these Terms.</p>

  <h2>3. Not Financial Advice</h2>
  <p>PiggyBudget is a budgeting tool only. Nothing in the App constitutes financial, investment, tax, or legal advice. Always consult a qualified professional for financial decisions.</p>

  <h2>4. Bank Integration</h2>
  <ul>
    <li>Bank connectivity is provided via TrueLayer, an FCA-regulated Open Banking provider</li>
    <li>By connecting your bank, you authorise TrueLayer to access your account data on your behalf</li>
    <li>PiggyBudget has read-only access to your transaction data — we cannot initiate payments or modify your accounts</li>
    <li>You can revoke bank access at any time by disconnecting your bank in the App</li>
    <li>Bank connections may expire after 90 days as required by Open Banking regulations, after which you will need to reconnect</li>
  </ul>

  <h2>5. Your Data</h2>
  <ul>
    <li>Your budget data is stored locally on your device and belongs to you</li>
    <li>You are responsible for maintaining backups of your data</li>
    <li>We are not liable for any loss of data resulting from device loss, damage, or app uninstallation</li>
  </ul>

  <h2>6. Acceptable Use</h2>
  <p>You agree not to:</p>
  <ul>
    <li>Use the App for any unlawful purpose</li>
    <li>Attempt to reverse engineer, modify, or tamper with the App</li>
    <li>Use the App to process data belonging to another person without their consent</li>
    <li>Abuse the receipt scanning or bank integration features</li>
  </ul>

  <h2>7. Availability</h2>
  <p>We aim to keep PiggyBudget available at all times but do not guarantee uninterrupted access. We may update, suspend, or discontinue the App or any feature at any time without notice.</p>

  <h2>8. Limitation of Liability</h2>
  <p>To the maximum extent permitted by law, PiggyBudget and its developers shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App, including but not limited to financial losses based on budget data shown in the App.</p>

  <h2>9. Changes to These Terms</h2>
  <p>We may update these Terms from time to time. Continued use of the App after changes constitutes acceptance of the updated Terms.</p>

  <h2>10. Governing Law</h2>
  <p>These Terms are governed by the laws of Spain. Any disputes shall be resolved in the courts of Spain.</p>

  <h2>11. Contact</h2>
  <p>If you have any questions about these Terms, please contact us at: <a href="mailto:chumberagpt@gmail.com">chumberagpt@gmail.com</a></p>
</body>
</html>`);
};
