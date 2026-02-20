import { render } from '@testing-library/react';
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
    const { container } = render(
      <Icon size="xs">
        <TestSvg />
      </Icon>
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('w-3');
    expect(icon).toHaveClass('h-3');
  });

  it('applies small size styles', () => {
    const { container } = render(
      <Icon size="sm">
        <TestSvg />
      </Icon>
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('w-4');
    expect(icon).toHaveClass('h-4');
  });

  it('applies medium size styles by default', () => {
    const { container } = render(
      <Icon>
        <TestSvg />
      </Icon>
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('w-5');
    expect(icon).toHaveClass('h-5');
  });

  it('applies large size styles', () => {
    const { container } = render(
      <Icon size="lg">
        <TestSvg />
      </Icon>
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('w-6');
    expect(icon).toHaveClass('h-6');
  });

  it('applies extra large size styles', () => {
    const { container } = render(
      <Icon size="xl">
        <TestSvg />
      </Icon>
    );
    const icon = container.firstChild as HTMLElement;
    expect(icon).toHaveClass('w-8');
    expect(icon).toHaveClass('h-8');
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
