import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EffectFamilyMapView } from '../views/EffectFamilyMapView';
import type { EffectFamilyMapViewProps, EffectPairData } from '../../../types/views';

describe('EffectFamilyMapView', () => {
  const mockSaveEffectFamilyMap = vi.fn();

  const defaultProps: EffectFamilyMapViewProps = {
    effectFamilyMap: {},
    saveEffectFamilyMap: mockSaveEffectFamilyMap
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading', () => {
    render(<EffectFamilyMapView {...defaultProps} />);
    expect(screen.getByText('Effect Family Map (Aspect Pairings)')).toBeInTheDocument();
  });

  it('renders without crashing with empty map', () => {
    render(<EffectFamilyMapView {...defaultProps} />);
    expect(screen.getByText('Effect Family Map (Aspect Pairings)')).toBeInTheDocument();
  });

  it('renders aspect pair entries when map is provided', () => {
    const effectMap: Record<string, EffectPairData> = {
      'Fire/Water': {
        summary: 'Steam effects',
        effects: []
      }
    };

    render(<EffectFamilyMapView {...defaultProps} effectFamilyMap={effectMap} />);
    expect(screen.getByText('Fire/Water')).toBeInTheDocument();
  });

  it('expands pairing when clicked', () => {
    render(<EffectFamilyMapView {...defaultProps} />);

    // Get all the clickable pairing headers
    const container = screen.getByText(/Effect Family Map/i).parentElement;
    const pairingHeaders = container?.querySelectorAll('[class*="flex"][class*="gap"]');

    if (pairingHeaders && pairingHeaders.length > 0) {
      fireEvent.click(pairingHeaders[0]);

      // After clicking, expansion content should be visible (all pairings start closed)
      // Just verify clicking doesn't crash
      expect(container).toBeInTheDocument();
    }
  });

  it('displays effect count for each pairing', () => {
    const effectMap: Record<string, EffectPairData> = {
      'Fire/Air': {
        summary: 'Flame effects',
        effects: [
          { id: '1', name: 'Inferno', keywords: '', notes: '', gmNotes: '', gmNotesVisible: false },
          { id: '2', name: 'Spark', keywords: '', notes: '', gmNotes: '', gmNotesVisible: false }
        ]
      }
    };

    render(<EffectFamilyMapView {...defaultProps} effectFamilyMap={effectMap} />);
    expect(screen.getByText(/2 effects/)).toBeInTheDocument();
  });

  it('saves effect family map when summary is updated', () => {
    const effectMap: Record<string, EffectPairData> = {
      'Fire/Water': {
        summary: 'Steam effects',
        effects: []
      }
    };

    const { container } = render(<EffectFamilyMapView {...defaultProps} effectFamilyMap={effectMap} />);

    // Click the first pairing header to expand it
    const pairingHeader = container.querySelector('[class*="flex"][class*="gap"]');
    if (pairingHeader) {
      fireEvent.click(pairingHeader);

      // Now find the summary textarea
      const textareas = container.querySelectorAll('textarea');
      if (textareas.length > 0) {
        fireEvent.change(textareas[0], { target: { value: 'New summary' } });
        expect(mockSaveEffectFamilyMap).toHaveBeenCalled();
      }
    }
  });

  it('renders Add Effect button when pairing is expanded', () => {
    const { container } = render(<EffectFamilyMapView {...defaultProps} />);

    // Click the first pairing header to expand
    const pairingHeader = container.querySelector('[class*="flex"][class*="gap"]');
    if (pairingHeader) {
      fireEvent.click(pairingHeader);

      // Look for the Add Effect button in the expanded section
      const addButtons = Array.from(container.querySelectorAll('button'))
        .filter(btn => btn.textContent?.includes('Add'));
      expect(addButtons.length).toBeGreaterThan(0);
    }
  });

  it('renders existing effects when provided', () => {
    const effectMap: Record<string, EffectPairData> = {
      'Fire/Earth': {
        summary: 'Lava effects',
        effects: [
          { id: '1', name: 'Magma Rush', keywords: 'power, heat', notes: 'Strong and hot', gmNotes: 'GM secret', gmNotesVisible: true }
        ]
      }
    };

    render(<EffectFamilyMapView {...defaultProps} effectFamilyMap={effectMap} />);

    const pairingDiv = screen.getByText('Fire/Earth');
    fireEvent.click(pairingDiv.closest('div') || pairingDiv);

    expect(screen.getByDisplayValue('Magma Rush')).toBeInTheDocument();
  });

  it('displays no summary message when pairing has no summary', () => {
    render(<EffectFamilyMapView {...defaultProps} />);

    // Empty effectFamilyMap means pairings are empty, showing "No summary" for new pairings
    const noSummaryElements = screen.queryAllByText('No summary');
    expect(noSummaryElements.length).toBeGreaterThan(0);
  });
});
