/**
 * Type definitions for exportImport.js utilities
 */

import type { CampaignState } from '../state/campaignReducer';

export const SCHEMA_VERSION: string;

export interface ImportResult {
  ok: boolean;
  error?: string;
  data?: any;
  warnings?: string[];
  isLocked?: boolean;
}

export interface GMLockData {
  exportType: 'locked';
  encryptedData: string;
  salt: string;
  iv: string;
}

export interface ExportData {
  schemaVersion: string;
  exportDate: string;
  exportType: 'locked' | 'unlocked';
  public: any;
  gm?: any;
  gmLock?: any;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface SplitStateResult {
  public: any;
  gm: any;
}

export interface UnlockResult {
  ok: boolean;
  gmData?: any;
  error?: string;
}

// State splitting and merging
export function splitState(state: any): SplitStateResult;
export function mergeGM(publicState: any, gmPayload: any): any;

// Export functions
export function exportUnlocked(state: any): ExportData;
export function exportLocked(state: any, password: string, options?: any): Promise<ExportData>;

// Import and validation
export function validateImport(data: any): ValidationResult;
export function migrateImport(data: any): any;
export function importFile(jsonInput: string | any): Promise<ImportResult>;

// Decryption
export function unlockGMData(importData: any, password: string): Promise<UnlockResult>;

// Download helper
export function downloadJSON(data: any, filename: string): void;
