export default {
  '*.{ts,tsx,js,jsx,json,css}': 'biome check --write --error-on-warnings --no-errors-on-unmatched',
  'server/**/*.ts': () => 'yarn typecheck:server',
  'src/**/*.{ts,tsx}': () => 'yarn typecheck:client',
};
