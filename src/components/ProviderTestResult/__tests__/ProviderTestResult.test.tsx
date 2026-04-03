import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProviderTestResult from '../index';

describe('ProviderTestResult', () => {
  it('renders nothing when no props are provided', () => {
    const { container } = render(<ProviderTestResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders labelled data sections when data is provided', () => {
    const data = {
      series: [{ id: 1, title: 'Breaking Bad' }],
      qualityProfiles: [{ id: 1, name: 'HD-1080p' }],
    };
    render(<ProviderTestResult data={data} />);
    expect(screen.getByText('series')).toBeInTheDocument();
    expect(screen.getByText('qualityProfiles')).toBeInTheDocument();
  });

  it('renders error message when error prop is provided', () => {
    render(<ProviderTestResult error="Connection refused" />);
    expect(screen.getByText(/connection refused/i)).toBeInTheDocument();
  });

  it('renders a loading indicator when isLoading is true', () => {
    render(<ProviderTestResult isLoading />);
    const loadingEls = screen.getAllByText(/loading/i);
    expect(loadingEls.length).toBeGreaterThan(0);
  });
});
