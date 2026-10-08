import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveHealthBanner } from '../SaveHealthBanner';
import {
  loadCampaignState,
  resetRevisionGuard,
  getCampaignLoadIssue,
  CAMPAIGN_SAVE_FAILED_EVENT,
  CAMPAIGN_SAVE_OK_EVENT,
  CAMPAIGN_STATE_CONFLICT_EVENT,
  CampaignStateConflictError,
  saveCampaignState,
} from '../../../persistence/campaignStorage';
import { createCampaignState } from '../../../state/campaignReducer';

const fire = (name: string, detail?: unknown) =>
  act(() => { window.dispatchEvent(new CustomEvent(name, { detail })); });

/** jsdom's Blob has no text(). */
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

async function loadWithStoredCampaign(raw: string) {
  localStorage.setItem('campaignState', raw);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await loadCampaignState();
}

describe('SaveHealthBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    resetRevisionGuard();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing while saves are healthy', () => {
    const { container } = render(<SaveHealthBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  describe('load failure', () => {
    it('offers the original for download when the save was invalid', async () => {
      await loadWithStoredCampaign('not-valid-json{{{');
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:original');
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      render(<SaveHealthBanner />);

      expect(screen.getByRole('alert')).toHaveTextContent("Your saved campaign couldn't be loaded");
      expect(screen.getByRole('alert')).toHaveTextContent('A copy of the original has been kept');
      expect(screen.queryByRole('button', { name: /reload/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /download original/i }));
      expect(click).toHaveBeenCalledTimes(1);
      expect(await readBlob(createObjectURL.mock.calls[0][0])).toBe('not-valid-json{{{');
    });

    it('says a newer build wrote the save and keeps it downloadable', async () => {
      const stored = JSON.parse(JSON.stringify(createCampaignState()));
      stored.meta.schemaVersion = '1.99.0';
      const raw = JSON.stringify(stored);
      await loadWithStoredCampaign(raw);
      expect(getCampaignLoadIssue()?.kind).toBe('newer-version');

      render(<SaveHealthBanner />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Your saved campaign is from a newer version of the app');
      // In the plain-language summary, not only in the raw error detail line.
      expect(screen.getByText(/Saving is paused/)).toHaveTextContent('Update the app to open it.');
      expect(alert).toHaveTextContent('Saving is paused');
      expect(alert).not.toHaveTextContent("couldn't be loaded");
      expect(screen.getByRole('button', { name: /download original/i })).toBeInTheDocument();
    });

    it('needs a confirmation before starting fresh, then resumes saving', async () => {
      await loadWithStoredCampaign('not-valid-json{{{');
      render(<SaveHealthBanner />);

      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }));
      expect(getCampaignLoadIssue()).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByRole('button', { name: /yes, replace/i })).not.toBeInTheDocument();
      expect(getCampaignLoadIssue()).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /start fresh/i }));
      fireEvent.click(screen.getByRole('button', { name: /yes, replace/i }));
      expect(getCampaignLoadIssue()).toBeNull();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('offers a reload but no download when the save could not be read', async () => {
      localStorage.setItem('campaignState', '{}');
      const realGetItem = Storage.prototype.getItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
        if (key === 'campaignState') throw new Error('disk I/O error');
        return realGetItem.call(this, key);
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await loadCampaignState();

      render(<SaveHealthBanner />);

      expect(screen.getByRole('alert')).toHaveTextContent('disk I/O error');
      expect(screen.queryByRole('button', { name: /download original/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload and try again/i })).toBeInTheDocument();
    });

    it('outranks a conflict or a failed save', async () => {
      await loadWithStoredCampaign('not-valid-json{{{');
      render(<SaveHealthBanner />);

      fire(CAMPAIGN_STATE_CONFLICT_EVENT);
      fire(CAMPAIGN_SAVE_FAILED_EVENT, { message: 'disk full' });

      expect(screen.getAllByRole('alert')).toHaveLength(1);
      expect(screen.getByRole('alert')).toHaveTextContent("Your saved campaign couldn't be loaded");
    });
  });

  describe('cross-tab conflict', () => {
    /** Another tab saves after this session's last write; this session's next save is refused. */
    async function raiseConflict() {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const state = createCampaignState();
      await saveCampaignState(state);
      localStorage.setItem('campaignStateRevision', '9');
      await expect(saveCampaignState(state)).rejects.toBeInstanceOf(CampaignStateConflictError);
    }

    it('asks for a reload after a cross-tab conflict', async () => {
      await loadCampaignState();
      render(<SaveHealthBanner />);

      await act(raiseConflict);

      expect(screen.getByRole('alert')).toHaveTextContent("Changes in this window aren't being saved");
      expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
      // A later successful-save event does not hide it: this session's saves stay refused.
      fire(CAMPAIGN_SAVE_OK_EVENT);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows a conflict raised before it mounted', async () => {
      await loadCampaignState();
      await raiseConflict();

      render(<SaveHealthBanner />);

      expect(screen.getByRole('alert')).toHaveTextContent("Changes in this window aren't being saved");
    });

    it('ignores a bare conflict event that storage did not record', () => {
      render(<SaveHealthBanner />);
      fire(CAMPAIGN_STATE_CONFLICT_EVENT);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('shows a load issue raised after it mounted', async () => {
    render(<SaveHealthBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await act(() => loadWithStoredCampaign('not-valid-json{{{'));

    expect(screen.getByRole('alert')).toHaveTextContent("Your saved campaign couldn't be loaded");
    expect(screen.getByRole('alert')).toHaveTextContent('A copy of the original has been kept');
  });

  describe('save failure', () => {
    it('shows the error until the next successful save', () => {
      render(<SaveHealthBanner />);

      fire(CAMPAIGN_SAVE_FAILED_EVENT, { message: 'disk full' });
      expect(screen.getByRole('alert')).toHaveTextContent('Last save failed');
      expect(screen.getByRole('alert')).toHaveTextContent('disk full');

      fire(CAMPAIGN_SAVE_OK_EVENT);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('can be dismissed', () => {
      render(<SaveHealthBanner />);
      fire(CAMPAIGN_SAVE_FAILED_EVENT, { message: 'disk full' });

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('falls back to a generic message when the event has no detail', () => {
      render(<SaveHealthBanner />);
      fire(CAMPAIGN_SAVE_FAILED_EVENT);
      expect(screen.getByRole('alert')).toHaveTextContent('Unknown error');
    });
  });
});
