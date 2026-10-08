/**
 * SaveHealthBanner — tells the user when their campaign is NOT being saved.
 *
 * Three situations, most severe first:
 * - Load failure: the stored campaign could not be read or decoded, or a newer
 *   build of the app wrote it. Saving is
 *   paused (campaignStorage blocks it) so the blank session cannot overwrite
 *   the original. The user downloads the original and/or explicitly starts fresh.
 * - Conflict: another tab or window saved after this one loaded; this session's
 *   saves are refused until reload.
 * - Save failure: a save threw for any other reason. Cleared by the next
 *   successful save.
 *
 * Storage-quota failures have their own banner (StorageQuotaBanner).
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Download, RefreshCw, X } from 'lucide-react';
import {
  acknowledgeCampaignLoadIssue,
  getCampaignSaveHealth,
  CAMPAIGN_SAVE_FAILED_EVENT,
  CAMPAIGN_SAVE_HEALTH_EVENT,
  CAMPAIGN_SAVE_OK_EVENT,
  type CampaignSaveHealth,
} from '../../persistence/campaignStorage';

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking in the same task can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const buttonClass =
  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors';

export function SaveHealthBanner() {
  // Storage owns the load-issue and conflict state; it can change before this
  // mounts or long after, so read it now and on every health event.
  const [{ loadIssue, conflict }, setHealth] = useState<CampaignSaveHealth>(() => getCampaignSaveHealth());
  const [confirmingFresh, setConfirmingFresh] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const onHealth = () => setHealth(getCampaignSaveHealth());
    // Catch anything that changed between the initial render and this effect.
    onHealth();
    const onFailed = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setSaveError(detail?.message ?? 'Unknown error');
    };
    const onOk = () => setSaveError(null);
    window.addEventListener(CAMPAIGN_SAVE_HEALTH_EVENT, onHealth);
    window.addEventListener(CAMPAIGN_SAVE_FAILED_EVENT, onFailed);
    window.addEventListener(CAMPAIGN_SAVE_OK_EVENT, onOk);
    return () => {
      window.removeEventListener(CAMPAIGN_SAVE_HEALTH_EVENT, onHealth);
      window.removeEventListener(CAMPAIGN_SAVE_FAILED_EVENT, onFailed);
      window.removeEventListener(CAMPAIGN_SAVE_OK_EVENT, onOk);
    };
  }, []);

  const handleDownload = useCallback(() => {
    if (!loadIssue?.raw) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`campaign-unreadable-${stamp}.json`, loadIssue.raw);
  }, [loadIssue]);

  const handleStartFresh = useCallback(() => {
    // Fires the health event: this banner clears and the store saves any
    // changes made while saving was paused.
    acknowledgeCampaignLoadIssue();
    setConfirmingFresh(false);
  }, []);

  let content: ReactNode = null;

  if (loadIssue) {
    content = (
      <>
        <h3 className="text-sm font-semibold text-danger-100">
          {loadIssue.kind === 'newer-version'
            ? 'Your saved campaign is from a newer version of the app'
            : "Your saved campaign couldn't be loaded"}
        </h3>
        <p className="text-xs text-danger-300 mt-0.5">
          {loadIssue.kind === 'newer-version' && 'Update the app to open it. '}
          Saving is paused so the original isn&apos;t overwritten. You&apos;re looking at a blank campaign.
          {loadIssue.recoveryKey && ' A copy of the original has been kept in storage.'}
        </p>
        <p className="text-[11px] text-danger-400 mt-1 font-mono break-all">{loadIssue.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {loadIssue.raw && (
            <button
              type="button"
              onClick={handleDownload}
              className={`${buttonClass} bg-danger-800/60 hover:bg-danger-700/60 text-danger-100 border-danger-600/40`}
            >
              <Download className="h-3 w-3" aria-hidden="true" />
              Download original
            </button>
          )}
          {loadIssue.kind === 'unreadable' && (
            // The read itself failed, so the save may be intact; a reload
            // retries it before the user gives up on it.
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`${buttonClass} bg-danger-800/60 hover:bg-danger-700/60 text-danger-100 border-danger-600/40`}
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Reload and try again
            </button>
          )}
          {confirmingFresh ? (
            <>
              <button
                type="button"
                onClick={handleStartFresh}
                className={`${buttonClass} bg-danger-600 hover:bg-danger-500 text-fg-bright border-danger-400`}
              >
                Yes, replace it with this blank campaign
              </button>
              <button
                type="button"
                onClick={() => setConfirmingFresh(false)}
                className={`${buttonClass} text-danger-200 border-danger-600/40 hover:bg-danger-800/40`}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingFresh(true)}
              className={`${buttonClass} text-danger-200 border-danger-600/40 hover:bg-danger-800/40`}
            >
              Start fresh and resume saving…
            </button>
          )}
        </div>
      </>
    );
  } else if (conflict) {
    content = (
      <>
        <h3 className="text-sm font-semibold text-danger-100">Changes in this window aren&apos;t being saved</h3>
        <p className="text-xs text-danger-300 mt-0.5">
          This campaign was saved from another window or tab after this one opened. Reload to continue
          from the latest save.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${buttonClass} bg-danger-800/60 hover:bg-danger-700/60 text-danger-100 border-danger-600/40`}
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Reload
          </button>
        </div>
      </>
    );
  } else if (saveError) {
    content = (
      <>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-danger-100">Last save failed</h3>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="p-1 -m-1 rounded hover:bg-danger-800/50 text-danger-400 hover:text-danger-200 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-danger-300 mt-0.5">
          The app will try again on your next change.
        </p>
        <p className="text-[11px] text-danger-400 mt-1 font-mono break-all">{saveError}</p>
      </>
    );
  }

  if (!content) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3 pointer-events-none">
      <div
        role="alert"
        className="bg-danger-950/95 border border-danger-500/60 rounded-xl shadow-2xl p-4 max-w-lg w-full pointer-events-auto backdrop-blur-sm"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-danger-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">{content}</div>
        </div>
      </div>
    </div>
  );
}
