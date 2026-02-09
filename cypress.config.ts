import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5057',
    experimentalRunAllSpecs: true,
    setupNodeEvents(_on, _config) {
      // implement node event listeners here
    },
  },
  env: {
    API_URL: 'http://localhost:5057/api/v1',
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
  video: false,
  screenshotOnRunFailure: true,
});
