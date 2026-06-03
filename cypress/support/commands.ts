/// <reference types="cypress" />

// Custom commands for Warden

declare global {
    namespace Cypress {
        interface Chainable {
            /**
             * Custom command to visit the home page
             * @example cy.visitHome()
             */
            visitHome(): Chainable<void>;
        }
    }
}

Cypress.Commands.add("visitHome", () => {
    cy.visit("/");
});

export {};
