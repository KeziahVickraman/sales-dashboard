/**
 * config.js
 * ─────────
 * Add your Anthropic API key here to enable the AI Insights tab.
 *
 * ⚠️  IMPORTANT: Never commit this file to a public repo with a real key.
 *     For production, use a backend proxy instead of calling the API from
 *     the browser directly.
 *
 * Get your key at: https://console.anthropic.com/
 */

const CONFIG = {
  ANTHROPIC_API_KEY: 'YOUR_API_KEY_HERE',   // ← replace this
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 1000,
};
