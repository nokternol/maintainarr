import '@testing-library/jest-dom/vitest';
import { render, screen } from '@tests/helpers/component';
import { describe, expect, it } from 'vitest';
import { MediaGrid } from '../index';

describe('MediaGrid', () => {
  it('renders all provided items using the renderItem callback', () => {
    const items = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ];

    render(
      <MediaGrid
        items={items}
        renderItem={(item: { id: number; name: string }) => (
          <div key={item.id} data-testid="grid-item">
            {item.name}
          </div>
        )}
      />
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getAllByTestId('grid-item')).toHaveLength(2);
  });

  it('displays a loading indicator when isLoading is true', () => {
    const items = [{ id: 1, name: 'Item 1' }];
    render(
      <MediaGrid
        items={items}
        renderItem={(item: { id: number; name: string }) => <div key={item.id}>{item.name}</div>}
        isLoading={true}
      />
    );
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('displays a load more trigger when hasMore is true and not loading', () => {
    const items = [{ id: 1, name: 'Item 1' }];
    render(
      <MediaGrid
        items={items}
        renderItem={(item: { id: number; name: string }) => <div key={item.id}>{item.name}</div>}
        hasMore={true}
        isLoading={false}
      />
    );
    expect(screen.getByTestId('load-more-trigger')).toBeInTheDocument();
  });
});
