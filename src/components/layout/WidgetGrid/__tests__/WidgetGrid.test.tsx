import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WidgetGrid from '../index';

describe('WidgetGrid', () => {
  it('renders children correctly', () => {
    const { container } = render(
      <WidgetGrid>
        <div>Widget 1</div>
        <div>Widget 2</div>
      </WidgetGrid>
    );
    expect(container.textContent).toContain('Widget 1');
    expect(container.textContent).toContain('Widget 2');
  });

  it('applies grid class', () => {
    const { container } = render(
      <WidgetGrid>
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('grid');
  });

  it('applies 1 column layout', () => {
    const { container } = render(
      <WidgetGrid columns={1}>
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('grid-cols-1');
  });

  it('applies 2 column layout', () => {
    const { container } = render(
      <WidgetGrid columns={2}>
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
  });

  it('applies 3 column layout', () => {
    const { container } = render(
      <WidgetGrid columns={3}>
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });

  it('applies 4 column layout by default', () => {
    const { container } = render(
      <WidgetGrid>
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
    expect(grid).toHaveClass('xl:grid-cols-4');
  });

  it('applies small gap', () => {
    const { container } = render(
      <WidgetGrid gap="sm">
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('gap-3');
  });

  it('applies medium gap by default', () => {
    const { container } = render(
      <WidgetGrid>
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('gap-4');
  });

  it('applies large gap', () => {
    const { container } = render(
      <WidgetGrid gap="lg">
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('gap-6');
  });

  it('accepts custom className', () => {
    const { container } = render(
      <WidgetGrid className="custom-class">
        <div>Widget</div>
      </WidgetGrid>
    );
    const grid = container.firstChild as HTMLElement;
    expect(grid).toHaveClass('custom-class');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(
      <WidgetGrid data-testid="custom-grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(container.querySelector('[data-testid="custom-grid"]')).toBeInTheDocument();
  });
});
