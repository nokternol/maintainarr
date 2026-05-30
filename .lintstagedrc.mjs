export default {
  '*.{ts,tsx,js,jsx,json,css}': 'biome check --write',
  'server/**/*.ts': () => 'yarn typecheck:server',
  'src/**/*.{ts,tsx}': () => 'yarn typecheck:client',
};
