// Import commands
import './commands';

// Cypress global configuration
Cypress.on('uncaught:exception', (_err, _runnable) => {
  // Returning false here prevents Cypress from failing the test
  // You can customize this to only catch specific errors
  return false;
});
