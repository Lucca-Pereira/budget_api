/**
 * api/privacy.js
 * Serves the PiggyBudget privacy policy.
 */
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — PiggyBudget</title>
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
  <h1>Privacy Policy</h1>
  <p class="meta">PiggyBudget &nbsp;·&nbsp; Last updated: March 2026</p>

  <p>PiggyBudget ("we", "our", or "us") is a personal budget tracking application. This Privacy Policy explains how we collect, use, and protect your information when you use the PiggyBudget mobile app.</p>

  <h2>1. Information We Collect</h2>
  <ul>
    <li><strong>Budget data</strong> — categories, expenses, subscriptions, and settings you create are stored locally on your device using AsyncStorage. This data does not leave your device unless you explicitly use the bank integration feature.</li>
    <li><strong>Bank transaction data</strong> — if you connect your bank account, we access your account information and transactions via TrueLayer's Open Banking API. We only retrieve read-only data (account details, balances, transactions). We do not store this data on our servers — it is fetched on demand and displayed only within the app.</li>
    <li><strong>Receipt images</strong> — if you use the receipt scanning feature, images are temporarily sent to our backend server for processing by Google Gemini AI. Images are not stored after processing.</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>To provide and operate the PiggyBudget app</li>
    <li>To import bank transactions into your budget (only when you explicitly request it)</li>
    <li>To extract expense data from receipt images</li>
    <li>We do not use your data for advertising, profiling, or any purpose other than operating the app</li>
  </ul>

  <h2>3. Data Storage</h2>
  <ul>
    <li>All budget data is stored locally on your device and is not transmitted to our servers</li>
    <li>Bank access tokens are stored securely on your device and are only used to fetch your transaction data from TrueLayer</li>
    <li>We do not maintain a database of user data on our servers</li>
  </ul>

  <h2>4. Third-Party Services</h2>
  <ul>
    <li><strong>TrueLayer</strong> — we use TrueLayer to connect to your bank via Open Banking (PSD2). TrueLayer is authorised and regulated by the Financial Conduct Authority (FCA). Your bank credentials are entered directly on TrueLayer's or your bank's secure page and are never seen by PiggyBudget. See <a href="https://truelayer.com/privacy">TrueLayer's Privacy Policy</a>.</li>
    <li><strong>Google Gemini AI</strong> — receipt images are processed by Google's Gemini API. See <a href="https://policies.google.com/privacy">Google's Privacy Policy</a>.</li>
    <li><strong>Vercel</strong> — our backend API is hosted on Vercel. See <a href="https://vercel.com/legal/privacy-policy">Vercel's Privacy Policy</a>.</li>
  </ul>

  <h2>5. Data Retention</h2>
  <p>We do not retain any personal data on our servers. All your budget data lives on your device. If you uninstall the app, all locally stored data is deleted. You can disconnect your bank at any time within the app, which removes all stored bank tokens from your device.</p>

  <h2>6. Your Rights</h2>
  <p>Under GDPR and applicable data protection laws, you have the right to:</p>
  <ul>
    <li>Access the data we hold about you (we hold none server-side)</li>
    <li>Delete your data — uninstalling the app removes all local data; disconnecting your bank removes all bank tokens</li>
    <li>Withdraw consent for bank access at any time by disconnecting your bank in the app</li>
  </ul>

  <h2>7. Children's Privacy</h2>
  <p>PiggyBudget is not directed at children under 13. We do not knowingly collect data from children under 13.</p>

  <h2>8. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. We will notify users of significant changes through the app. Continued use of the app after changes constitutes acceptance of the updated policy.</p>

  <h2>9. Contact</h2>
  <p>If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:chumberagpt@gmail.com">chumberagpt@gmail.com</a></p>
</body>
</html>`);
};
