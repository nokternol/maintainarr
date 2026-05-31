import '@testing-library/jest-dom/vitest';
import { render, screen } from '@tests/helpers/component';
import { describe, expect, it } from 'vitest';
import { PlexIcon, WardenLogo } from '../index';

describe('WardenLogo', () => {
  it('renders an SVG with an accessible title', () => {
    render(<WardenLogo />);
    expect(screen.getByRole('img', { name: /warden logo/i })).toBeInTheDocument();
  });

  it('uses the provided id for the title element', () => {
    const { container } = render(<WardenLogo id="my-logo" />);
    expect(container.querySelector('#my-logo-title')).toBeInTheDocument();
  });

  it('defaults to the id "warden-logo"', () => {
    const { container } = render(<WardenLogo />);
    expect(container.querySelector('#warden-logo-title')).toBeInTheDocument();
  });

  it('renders the glow element when isLoader is false', () => {
    const { container } = render(<WardenLogo isLoader={false} />);
    expect(container.querySelector('[data-glow]')).toBeInTheDocument();
  });

  it('does not render the glow element when isLoader is true', () => {
    const { container } = render(<WardenLogo isLoader={true} />);
    expect(container.querySelector('[data-glow]')).not.toBeInTheDocument();
  });

  it('applies a custom className', () => {
    const { container } = render(<WardenLogo className="w-8 h-8 custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('PlexIcon', () => {
  it('renders an SVG with title "Plex"', () => {
    const { container } = render(<PlexIcon />);
    const title = container.querySelector('title');
    expect(title?.textContent).toBe('Plex');
  });

  it('applies a custom className', () => {
    const { container } = render(<PlexIcon className="w-8 h-8" />);
    expect(container.querySelector('svg')).toHaveClass('w-8');
  });
});
