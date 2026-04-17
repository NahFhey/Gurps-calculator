/**
 * Electron preload script — minimal contextBridge.
 */

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getAppVersion: () => process.versions.electron,
});
