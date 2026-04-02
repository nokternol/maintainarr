describe('Login page', () => {
  beforeEach(() => {
    // Intercept Plex PIN creation — return a fake PIN
    cy.intercept('POST', 'https://plex.tv/api/v2/pins*', {
      statusCode: 201,
      body: { id: 99999, code: 'TESTCODE', authToken: null },
    }).as('createPin');

    // Intercept Plex PIN poll — return an auth token immediately
    cy.intercept('GET', 'https://plex.tv/api/v2/pins/99999*', {
      statusCode: 200,
      body: { id: 99999, code: 'TESTCODE', authToken: 'FAKE-TOKEN-12345' },
    }).as('pollPin');

    // Intercept our backend auth endpoint — simulate successful login
    cy.intercept('POST', '/api/auth/plex', {
      statusCode: 200,
      body: { success: true },
    }).as('plexAuth');

    cy.visit('/login');
  });

  it('redirects to /login from root when unauthenticated', () => {
    cy.visit('/');
    cy.url().should('include', '/login');
  });

  it('renders the sign in button', () => {
    cy.contains('button', 'Sign in with Plex').should('be.visible');
  });

  it('opens Plex OAuth popup directly to Plex auth URL when sign in button is clicked', () => {
    cy.window().then((win) => {
      cy.stub(win, 'open').as('windowOpen').returns({
        closed: false,
        close: cy.stub().as('popupClose'),
        location: { href: '' },
      });
    });

    cy.contains('button', 'Sign in with Plex').click();

    // Popup opens directly to Plex URL — a cross-origin proxy from the start,
    // so popup.closed correctly reports false while the window is open.
    cy.get('@windowOpen').should('have.been.calledWith',
      Cypress.sinon.match(/app\.plex\.tv\/auth/),
      'Plex-Auth'
    );
  });

  it('completes full auth flow: creates PIN, polls for token, posts to backend, navigates to /dashboard', () => {
    cy.window().then((win) => {
      const fakePopup = {
        closed: false,
        close: cy.stub().as('popupClose'),
        location: { href: 'about:blank' },
      };
      cy.stub(win, 'open').returns(fakePopup);
    });

    cy.contains('button', 'Sign in with Plex').click();

    cy.wait('@createPin');
    cy.wait('@pollPin');
    cy.wait('@plexAuth');

    cy.url().should('include', '/dashboard');
    cy.get('@popupClose').should('have.been.called');
  });
});
