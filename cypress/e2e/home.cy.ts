describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('displays the application title', () => {
    cy.contains('h1', 'Maintainarr').should('be.visible');
  });

  it('shows the application description', () => {
    cy.contains('Task automation and metadata-driven grouping').should('be.visible');
  });

  it('displays development environment checklist', () => {
    cy.contains('Development Environment Ready').should('be.visible');
    cy.contains('Next.js + Express server running').should('be.visible');
    cy.contains('TypeScript configured with path aliases').should('be.visible');
    cy.contains('Tailwind CSS styling').should('be.visible');
  });

  it('shows port and tech stack information', () => {
    cy.contains('Port 5057').should('be.visible');
    cy.contains('tsx').should('be.visible');
    cy.contains('biome').should('be.visible');
  });
});
