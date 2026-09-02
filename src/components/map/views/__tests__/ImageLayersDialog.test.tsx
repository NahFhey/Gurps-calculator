import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageLayersDialog } from '../ImageLayersDialog';
import { createNewMap } from '../../../../utils/mapUtils';
import type { MapImageLayer } from '../../../../types/map';

const makeLayer = (overrides: Partial<MapImageLayer> = {}): MapImageLayer => ({
  id: 'img-1',
  name: 'Battlemap',
  src: 'data:image/jpeg;base64,xyz',
  placement: 'underlay',
  opacity: 1,
  visible: true,
  gmOnly: false,
  x: 1.4,
  y: 2.6,
  width: 8.3,
  height: 5.7,
  elevation: 1,
  ...overrides,
});

function mount(layer: MapImageLayer) {
  const map = createNewMap({ name: 'M', scaleMilesPerTile: 12, startTerrainId: 'terrain-plains' });
  map.imageLayers = [layer];
  const onUpdateLayer = vi.fn();
  const onStartAlign = vi.fn();
  render(
    <ImageLayersDialog
      map={map}
      onAddLayer={vi.fn()}
      onUpdateLayer={onUpdateLayer}
      onRemoveLayer={vi.fn()}
      onStartAlign={onStartAlign}
      onClose={vi.fn()}
    />
  );
  return { map, onUpdateLayer, onStartAlign };
}

describe('ImageLayersDialog size-to-grid', () => {
  it('applies the entered grid dimensions and snaps the corner to a tile', () => {
    const { onUpdateLayer } = mount(makeLayer());

    fireEvent.change(screen.getByLabelText(/grid cols/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/grid rows/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /size to grid/i }));

    expect(onUpdateLayer).toHaveBeenCalledWith('img-1', {
      width: 30,
      height: 20,
      x: 1,
      y: 3,
    });
  });

  it('snap rounds position and size to whole tiles', () => {
    const { onUpdateLayer } = mount(makeLayer());

    fireEvent.click(screen.getByRole('button', { name: /snap/i }));

    expect(onUpdateLayer).toHaveBeenCalledWith('img-1', {
      x: 1,
      y: 3,
      width: 8,
      height: 6,
    });
  });

  it('fit map stretches the layer across the whole grid', () => {
    const { map, onUpdateLayer } = mount(makeLayer());

    fireEvent.click(screen.getByRole('button', { name: /fit map/i }));

    expect(onUpdateLayer).toHaveBeenCalledWith('img-1', {
      x: 0,
      y: 0,
      width: map.cols,
      height: map.rows,
    });
  });

  it('prefills the grid inputs from the layer size', () => {
    mount(makeLayer({ width: 12, height: 9 }));
    expect(screen.getByLabelText(/grid cols/i)).toHaveValue(12);
    expect(screen.getByLabelText(/grid rows/i)).toHaveValue(9);
  });

  it('starts align mode for the layer when Align 3×3 is clicked', () => {
    const { onStartAlign } = mount(makeLayer());

    fireEvent.click(screen.getByRole('button', { name: /align 3×3/i }));

    expect(onStartAlign).toHaveBeenCalledWith('img-1');
  });
});
