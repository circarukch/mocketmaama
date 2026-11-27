// Extends app.json. EXPO_BASE_URL lets the web build live under a sub-path,
// e.g. /mocketmaama on GitHub Pages (set in .github/workflows/deploy-web.yml).
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, baseUrl: process.env.EXPO_BASE_URL || undefined },
});
