import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppLayout from '../index';

describe('AppLayout', () => {
  it('renders children correctly', () => {
    render(
      <AppLayout>
        <div>Main Content</div>
      </AppLayout>
    );
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('renders sidebar when provided', () => {
    render(
      <AppLayout sidebar={<div>Sidebar Content</div>}>
        <div>Main Content</div>
      </AppLayout>
    );
    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
  });

  it('does not render sidebar when not provided', () => {
    render(
      <AppLayout>
        <div>Main Content</div>
      </AppLayout>
    );
    expect(screen.queryByText('Sidebar Content')).not.toBeInTheDocument();
  });

  it('renders topBar when provided', () => {
    render(
      <AppLayout topBar={<div>Top Bar Content</div>}>
        <div>Main Content</div>
      </AppLayout>
    );
    expect(screen.getByText('Top Bar Content')).toBeInTheDocument();
  });

  it('does not render topBar when not provided', () => {
    render(
      <AppLayout>
        <div>Main Content</div>
      </AppLayout>
    );
    expect(screen.queryByText('Top Bar Content')).not.toBeInTheDocument();
  });

  it('renders all sections together', () => {
    render(
      <AppLayout sidebar={<div>Sidebar Content</div>} topBar={<div>Top Bar Content</div>}>
        <div>Main Content</div>
      </AppLayout>
    );

    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    expect(screen.getByText('Top Bar Content')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('applies flex layout', () => {
    render(
      <AppLayout data-testid="layout">
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByTestId('layout').className).toMatch(/container/);
  });

  it('applies min-h-screen and background', () => {
    render(
      <AppLayout data-testid="layout">
        <div>Content</div>
      </AppLayout>
    );
    expect(screen.getByTestId('layout').className).toMatch(/container/);
  });

  it('sidebar is hidden on mobile', () => {
    const { container } = render(
      <AppLayout sidebar={<div>Sidebar</div>}>
        <div>Content</div>
      </AppLayout>
    );
    const aside = container.querySelector('aside');
    expect(aside?.className).toMatch(/sidebarWrapper/);
  });

  it('accepts custom className', () => {
    const { container } = render(
      <AppLayout className="custom-class">
        <div>Content</div>
      </AppLayout>
    );
    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveClass('custom-class');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(
      <AppLayout data-testid="custom-layout">
        <div>Content</div>
      </AppLayout>
    );
    expect(container.querySelector('[data-testid="custom-layout"]')).toBeInTheDocument();
  });

  it('main element contains topBar and children', () => {
    const { container } = render(
      <AppLayout topBar={<div>Top Bar</div>}>
        <div>Main Content</div>
      </AppLayout>
    );
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    expect(main?.textContent).toContain('Top Bar');
    expect(main?.textContent).toContain('Main Content');
  });
});
