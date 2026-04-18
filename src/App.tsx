import { useState, useEffect, useCallback } from 'react';
import { logger } from './utils/logger';
import { UnifiedShell } from './unified/UnifiedShell';
import { CampaignStoreProvider, useCampaignStore } from './state/campaignStore';
import { loadCampaignState, hydrateCampaignState } from './persistence/campaignStorage';
import { checkMigrationNeeded, migrateToV2 } from './persistence/dataMigration';
import { ToastProvider, ToastContainer, LoadingSpinner } from './components/ui';
import { StorageQuotaBanner } from './components/ui/StorageQuotaBanner';
import { SyncProvider } from './net/SyncProvider';
import type { CampaignState } from './state/campaignReducer';

type MigrationStatus = 'checking' | 'migrating' | 'ready';

/**
 * Inner wrapper that bridges SyncProvider with the campaign store.
 * Must be rendered inside CampaignStoreProvider so it can access dispatch.
 */
function SyncBridge({ children }: { children: React.ReactNode }) {
  const { dispatch } = useCampaignStore();

  const handleServerStateUpdate = useCallback((stateJson: string) => {
    try {
      const parsed = JSON.parse(stateJson);
      const hydrated = hydrateCampaignState(parsed as CampaignState);
      dispatch({ type: 'replaceState', payload: hydrated });
    } catch (err) {
      console.error('[SyncBridge] Failed to apply server state:', err);
    }
  }, [dispatch]);

  return (
    <SyncProvider onServerStateUpdate={handleServerStateUpdate}>
      {children}
    </SyncProvider>
  );
}

/**
 * Main App Component
 * Handles migration, initialization, and renders the Unified UI
 */
export default function GURPSPartyTool() {
  logger.log('GURPSPartyTool rendering');
  const [initialCampaignState, setInitialCampaignState] = useState<CampaignState | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('checking');

  // Check for migration on startup and load campaign state
  useEffect(() => {
    let cancelled = false;

    async function initializeApp() {
      try {
        logger.log('Checking for migration...');
        const needsMigration = await checkMigrationNeeded();

        if (needsMigration) {
          logger.log('Migration needed - running migration...');
          setMigrationStatus('migrating');

          const migratedState = await migrateToV2();

          if (migratedState && !cancelled) {
            logger.log('Migration successful');
            setInitialCampaignState(migratedState);
            setMigrationStatus('ready');
          } else {
            logger.error('Migration failed');
            setMigrationStatus('ready');
          }
        } else {
          logger.log('No migration needed - loading campaign state');
          const loadedState = await loadCampaignState();

          if (!cancelled) {
            setInitialCampaignState(loadedState);
            setMigrationStatus('ready');
          }
        }
      } catch (error) {
        logger.error('Error during initialization:', error);
        setMigrationStatus('ready');
      }
    }

    initializeApp();

    return () => {
      cancelled = true;
    };
  }, []);

  // Show loading screen while migration/initialization is in progress
  if (migrationStatus === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-100">
        <LoadingSpinner size="lg" label="Checking for updates..." />
      </div>
    );
  }

  if (migrationStatus === 'migrating') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-100">
        <LoadingSpinner size="lg" label="Migrating to new storage format..." />
      </div>
    );
  }

  // Wait for campaign state to load
  if (!initialCampaignState) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading campaign..." />
      </div>
    );
  }

  return (
    <ToastProvider>
      <CampaignStoreProvider initialCampaignState={initialCampaignState}>
        <SyncBridge>
          <UnifiedShell />
          <ToastContainer position="top-right" />
          <StorageQuotaBanner />
        </SyncBridge>
      </CampaignStoreProvider>
    </ToastProvider>
  );
}
