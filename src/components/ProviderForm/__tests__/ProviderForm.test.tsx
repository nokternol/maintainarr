import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderForm from '../index';

describe('ProviderForm', () => {
  const mockOnTest = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    title: 'Sonarr',
    type: 'SONARR' as const,
    onTest: mockOnTest,
  };

  beforeEach(() => {
    mockOnTest.mockClear();
    mockOnSave.mockClear();
  });

  it('renders title, URL input, and API Key input', () => {
    render(<ProviderForm {...defaultProps} />);
    expect(screen.getByText('Sonarr')).toBeInTheDocument();
    expect(screen.getByLabelText(/URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
  });

  it('pre-populates inputs from initialValues', () => {
    render(
      <ProviderForm
        {...defaultProps}
        initialValues={{ url: 'http://sonarr:8989', apiKey: 'my-key' }}
      />
    );
    expect(screen.getByLabelText(/URL/i)).toHaveValue('http://sonarr:8989');
    expect(screen.getByLabelText(/API Key/i)).toHaveValue('my-key');
  });

  it('calls onTest with current field values when test button clicked', async () => {
    render(<ProviderForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: 'http://localhost:8989' } });
    fireEvent.change(screen.getByLabelText(/API Key/i), { target: { value: 'test-key' } });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));
    await waitFor(() => {
      expect(mockOnTest).toHaveBeenCalledWith({
        type: 'SONARR',
        url: 'http://localhost:8989',
        apiKey: 'test-key',
      });
    });
  });

  it('renders save button and calls onSave when onSave is provided', async () => {
    render(<ProviderForm {...defaultProps} onSave={mockOnSave} />);
    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: 'http://localhost:8989' } });
    fireEvent.change(screen.getByLabelText(/API Key/i), { target: { value: 'key' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        type: 'SONARR',
        url: 'http://localhost:8989',
        apiKey: 'key',
      });
    });
  });

  it('does not render save button when onSave is not provided', () => {
    render(<ProviderForm {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('shows saved confirmation text when isSaved is true', () => {
    render(<ProviderForm {...defaultProps} onSave={mockOnSave} isSaved />);
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it('renders settings textarea for Jellyfin', () => {
    render(<ProviderForm {...defaultProps} type="JELLYFIN" title="Jellyfin" />);
    expect(screen.getByLabelText(/settings/i)).toBeInTheDocument();
  });

  it('includes settings in onTest payload for Jellyfin', async () => {
    render(<ProviderForm {...defaultProps} type="JELLYFIN" title="Jellyfin" />);
    fireEvent.change(screen.getByLabelText(/URL/i), { target: { value: 'http://localhost:8096' } });
    fireEvent.change(screen.getByLabelText(/API Key/i), { target: { value: 'key' } });
    fireEvent.change(screen.getByLabelText(/settings/i), { target: { value: '{"userId":"abc"}' } });
    fireEvent.click(screen.getByRole('button', { name: /test/i }));
    await waitFor(() => {
      expect(mockOnTest).toHaveBeenCalledWith({
        type: 'JELLYFIN',
        url: 'http://localhost:8096',
        apiKey: 'key',
        settings: '{"userId":"abc"}',
      });
    });
  });
});
