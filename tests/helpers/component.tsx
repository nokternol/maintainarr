import { type RenderOptions, type RenderResult, render as rtlRender } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';

/**
 * Custom render function that wraps components with common providers
 */
export function render(ui: ReactElement, options?: RenderOptions): RenderResult {
  // Add any global providers here (e.g., theme, router, etc.)
  // For now, just use the standard render
  return rtlRender(ui, options);
}

/**
 * Setup userEvent with common options
 */
export function setupUser() {
  return userEvent.setup();
}

/**
 * Helper to wait for async updates and loading states
 */
export async function waitForLoadingToFinish() {
  const { waitForElementToBeRemoved, screen } = await import('@testing-library/react');

  // Wait for any loading spinners to disappear
  const loadingElements = screen.queryAllByRole('img', { name: /loading/i });
  if (loadingElements.length > 0) {
    await waitForElementToBeRemoved(loadingElements);
  }
}

/**
 * Helper to find elements by test ID with better error messages
 */
export function getByTestId(container: HTMLElement, testId: string): HTMLElement {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`Unable to find element with data-testid="${testId}"`);
  }
  return element as HTMLElement;
}

/**
 * Helper to check if element has specific CSS class
 */
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * Helper to get computed styles
 */
export function getComputedStyles(element: HTMLElement): CSSStyleDeclaration {
  return window.getComputedStyle(element);
}

// Re-export commonly used testing library utilities
export * from '@testing-library/react';
export { userEvent };
