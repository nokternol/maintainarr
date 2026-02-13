
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '..';
import { PlexOAuth } from '@app/lib/utils/plexOAuth';
import { describe, expect, it, vi } from "vitest";

vi.mock('@app/lib/utils/plexOAuth');

describe('LoginPage', () => {
  it('should display an error message if Plex login is cancelled', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockRejectedValue(new Error('Authentication cancelled'));
    vi.mocked(PlexOAuth).mockImplementation(() => ({
      login: mockLogin,
      initializeHeaders: vi.fn(),
      getPin: vi.fn(),
      openPopup: vi.fn(),
      pollForToken: vi.fn(),
    } as unknown as PlexOAuth));

    render(<LoginPage />);

    const loginButton = screen.getByRole('button', { name: /Sign in with Plex/i });
    await user.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Authentication cancelled')).toBeInTheDocument();
    });
  });
});
