import { render, screen } from '@testing-library/react';
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
    render(
      <WidgetGrid data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/gridContainer/);
  });

  it('applies 1 column layout', () => {
    render(
      <WidgetGrid columns={1} data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/cols_1/);
  });

  it('applies 2 column layout', () => {
    render(
      <WidgetGrid columns={2} data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/cols_2/);
  });

  it('applies 3 column layout', () => {
    render(
      <WidgetGrid columns={3} data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/cols_3/);
  });

  it('applies 4 column layout by default', () => {
    render(
      <WidgetGrid data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/cols_4/);
  });

  it('applies small gap', () => {
    render(
      <WidgetGrid gap="sm" data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/gap_sm/);
  });

  it('applies medium gap by default', () => {
    render(
      <WidgetGrid data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/gap_md/);
  });

  it('applies large gap', () => {
    render(
      <WidgetGrid gap="lg" data-testid="grid">
        <div>Widget</div>
      </WidgetGrid>
    );
    expect(screen.getByTestId('grid').className).toMatch(/gap_lg/);
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
