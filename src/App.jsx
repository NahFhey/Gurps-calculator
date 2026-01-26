import React, { useState, useEffect } from 'react';
import { logger } from './utils/logger';
import { UnifiedShell } from './unified/UnifiedShell';
import { CampaignStoreProvider } from './state/campaignStore';
import { loadCampaignState } from './persistence/campaignStorage';
import { checkMigrationNeeded, migrateToV2 } from './persistence/dataMigration';

/**
 * Main App Component
 * Handles migration, initialization, and renders the Unified UI
 */
export default function GURPSPartyTool() {
  logger.log('GURPSPartyTool rendering');
  const [initialCampaignState, setInitialCampaignState] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState('checking'); // 'checking' | 'migrating' | 'ready'

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
        Checking for updates...
      </div>
    );
  }

  if (migrationStatus === 'migrating') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-100">
        <div className="text-center">
          <div className="text-xl mb-2">Migrating to new storage format...</div>
          <div className="text-sm text-gray-400">This may take a moment</div>
        </div>
      </div>
    );
  }

  // Wait for campaign state to load
  if (!initialCampaignState) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <CampaignStoreProvider initialCampaignState={initialCampaignState}>
      <UnifiedShell />
    </CampaignStoreProvider>
  );
}
