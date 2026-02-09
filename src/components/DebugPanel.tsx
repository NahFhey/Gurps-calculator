import { useEffect, useMemo, useState, ChangeEvent } from 'react';
import { useCampaignStore } from '../state/campaignStore';
import { ConfirmDialog, useConfirmDialog } from './ui';
import type { CampaignState } from '../state/campaignReducer';

const serializeCampaignState = (state: CampaignState): string =>
  JSON.stringify(
    state,
    (_key, value) => {
      if (value instanceof Set) {
        return Array.from(value);
      }
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      return value;
    },
    2
  );

export function DebugPanel() {
  const { state, actions } = useCampaignStore();
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const serializedState = useMemo(() => serializeCampaignState(state), [state]);

  const applyDialog = useConfirmDialog({
    title: 'Apply Debug State',
    message: 'Overwrite campaign state with this JSON? This will replace all current data.',
    confirmLabel: 'Apply',
    variant: 'warning',
  });

  useEffect(() => {
    setJsonText(serializedState);
  }, [serializedState]);

  const handleApply = async () => {
    setError(null);
    let parsed: CampaignState;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setError('Invalid JSON. Please fix the syntax and try again.');
      return;
    }

    if (!parsed || !parsed.ui || !parsed.meta || !parsed.entities || !parsed.time) {
      setError('JSON does not look like a campaign state.');
      return;
    }

    const confirmed = await applyDialog.confirm();
    if (!confirmed) {
      return;
    }

    actions.applyDebugState(parsed);
    setError(null);
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Debug Mode</h3>
          <p className="text-xs text-gray-400">Edit raw campaign JSON and apply it directly.</p>
        </div>
        <button
          type="button"
          onClick={handleApply}
          className="rounded bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500"
        >
          Apply JSON
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded border border-red-700 bg-red-900/30 px-3 py-2 text-xs text-red-200" data-testid="debug-error">
          {error}
        </div>
      )}
      <textarea
        className="mt-4 h-80 w-full rounded bg-gray-900 px-3 py-2 text-xs text-gray-100"
        value={jsonText}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setJsonText(event.target.value)}
        data-testid="debug-json"
      />

      {/* Apply Confirmation Dialog */}
      <ConfirmDialog {...applyDialog.dialogProps} />
    </div>
  );
}
