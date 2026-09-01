import { useState, useEffect } from 'react';
import { logger } from './utils/logger';
import { UnifiedShell } from './unified/UnifiedShell';
import { CampaignStoreProvider } from './state/campaignStore';
import { loadCampaignState } from './persistence/campaignStorage';
import { checkMigrationNeeded, migrateToV2 } from './persistence/dataMigration';
import { ToastProvider, ToastContainer, LoadingSpinner } from './components/ui';
import { StorageQuotaBanner } from './components/ui/StorageQuotaBanner';
import { NotificationBridge } from './components/ui/NotificationBridge';
import type { CampaignState } from './state/campaignReducer';

type MigrationStatus = 'checking' | 'migrating' | 'ready';

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
      <div className="flex items-center justify-center h-screen bg-surface-0 text-fg-bright">
        <LoadingSpinner size="lg" label="Checking for updates..." />
      </div>
    );
  }

  if (migrationStatus === 'migrating') {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0 text-fg-bright">
        <LoadingSpinner size="lg" label="Migrating to new storage format..." />
      </div>
    );
  }

  // Wait for campaign state to load
  if (!initialCampaignState) {
    return (
      <div className="min-h-screen bg-surface-0 text-fg-bright flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading campaign..." />
      </div>
    );
  }

  return (
    <ToastProvider>
      <CampaignStoreProvider initialCampaignState={initialCampaignState}>
        <UnifiedShell />
        <NotificationBridge />
        <ToastContainer position="top-right" />
        <StorageQuotaBanner />
      </CampaignStoreProvider>
    </ToastProvider>
  );
}
