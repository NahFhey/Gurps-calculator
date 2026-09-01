import { useEffect, useRef } from 'react';
import { useCampaignSelector } from '../../state/campaignStore';
import type { CampaignState, LogEntry } from '../../state/campaignReducer';
import { useToast } from './Toast';
import type { ToastType } from './Toast';

const selectLogEntries = (state: CampaignState) => state.logs.entries;
const selectGmMode = (state: CampaignState) => state.ui.gmModeEnabled;

/** Event types worth a toast beyond the completed/resolved suffix rule. */
const NOTIFY_TYPES = new Set([
  'weather.changed',
  'location.changed',
  'travel.arrived',
  'travel.drifted',
  'combat.defeated',
  'study.point_awarded',
  'campaign.rollback',
]);

const isNotifiable = (type: string): boolean =>
  NOTIFY_TYPES.has(type) || type.endsWith('_resolved') || type.endsWith('_completed');

const toastTypeFor = (type: string): ToastType => {
  if (type.endsWith('_resolved') || type.endsWith('_completed') || type === 'study.point_awarded') {
    return 'success';
  }
  if (type === 'campaign.rollback' || type === 'travel.drifted') return 'warning';
  return 'info';
};

const MAX_TOASTS_PER_BATCH = 3;

/**
 * Notification system (Phase 15c): bridges the campaign log to toasts.
 * Watches logs.entries and surfaces completed activities, arrivals, and
 * status changes as they land, respecting log visibility for non-GM view.
 * Mounted once inside CampaignStoreProvider (and under ToastProvider).
 */
export function NotificationBridge() {
  const entries = useCampaignSelector(selectLogEntries);
  const gmMode = useCampaignSelector(selectGmMode);
  const { toast } = useToast();
  // null means "the log was empty when last seen".
  const lastSeenIdRef = useRef<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    const lastSeen = lastSeenIdRef.current;
    const topId = entries[0]?.id ?? null;
    if (topId === lastSeen) return;

    let newCount = entries.length;
    if (lastSeen !== null) {
      const idx = entries.findIndex((entry) => entry.id === lastSeen);
      if (idx === -1) {
        // Non-append change (undo, import, restore) — resync without toasting.
        lastSeenIdRef.current = topId;
        return;
      }
      newCount = idx;
    }
    lastSeenIdRef.current = topId;

    const fresh = entries
      .slice(0, newCount)
      .filter((entry) => isNotifiable(entry.type))
      .filter((entry) => gmMode || entry.visibility !== 'gmOnly');

    const shown = fresh.slice(0, MAX_TOASTS_PER_BATCH);
    // Oldest first, so toasts stack in chronological order.
    for (const entry of [...shown].reverse()) {
      const message = messageFor(entry, gmMode);
      if (message) {
        toast({ type: toastTypeFor(entry.type), message });
      }
    }
    if (fresh.length > shown.length) {
      toast({ type: 'info', message: `+${fresh.length - shown.length} more events in the Changelog` });
    }
  }, [entries, gmMode, toast]);

  return null;
}

function messageFor(entry: LogEntry, gmMode: boolean): string | null {
  const payload = entry.payload as { message?: unknown; maskedMessage?: unknown };
  const raw =
    !gmMode && entry.visibility === 'mixed' && typeof payload.maskedMessage === 'string'
      ? payload.maskedMessage
      : payload.message;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export default NotificationBridge;
