import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Icon from '../index';

const TestSvg = () => (
  <svg data-testid="test-svg" role="img" aria-label="Test icon">
    <path d="M0 0" />
  </svg>
);

describe('Icon', () => {
  it('renders children correctly', () => {
    const { getByTestId } = render(
      <Icon>
        <TestSvg />
      </Icon>
    );
    expect(getByTestId('test-svg')).toBeInTheDocument();
  });

  it('applies extra small size styles', () => {
    render(
      <Icon size="xs" data-testid="icon">
        X
      </Icon>
    );
    expect(screen.getByTestId('icon').className).toMatch(/xs/);
  });

  it('applies small size styles', () => {
    render(
      <Icon size="sm" data-testid="icon">
        S
      </Icon>
    );
    expect(screen.getByTestId('icon').className).toMatch(/sm/);
  });

  it('applies medium size styles by default', () => {
    render(<Icon data-testid="icon">M</Icon>);
    expect(screen.getByTestId('icon').className).toMatch(/md/);
  });

  it('applies large size styles', () => {
    render(
      <Icon size="lg" data-testid="icon">
        L
      </Icon>
    );
    expect(screen.getByTestId('icon').className).toMatch(/lg/);
  });

  it('applies extra large size styles', () => {
    render(
      <Icon size="xl" data-testid="icon">
        XL
      </Icon>
    );
    expect(screen.getByTestId('icon').className).toMatch(/xl/);
  });

  it('accepts custom className', () => {
    const { container } = render(
      <Icon className="text-teal-400">
        <TestSvg />
      </Icon>
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('text-teal-400');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(
      <Icon data-testid="custom-icon">
        <TestSvg />
      </Icon>
    );
    expect(container.querySelector('[data-testid="custom-icon"]')).toBeInTheDocument();
  });
});
