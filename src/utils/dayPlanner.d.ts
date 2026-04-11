/**
 * Type definitions for dayPlanner.js utilities
 * Imports canonical types from src/types/dayplanner
 */

import type { TimeSlot, TaskAssignment, PendingDayLedger } from '../types/dayplanner';

export type { TimeSlot, TaskAssignment, PendingDayLedger };

export interface ValidationResult {
  valid: boolean;
  error?: string | null;
}

export interface WorkerAssignmentValidation {
  valid: boolean;
  error?: string | null;
}

export interface SlotAdvancementResult {
  canAdvance: boolean;
  reason: string;
}

export interface NextSlotResult {
  nextDay: number;
  nextSlot: number;
  dayAdvanced: boolean;
}

export interface CommitResult {
  updatedFoods: any[];
  updatedMaterials: any[];
  committedLedger: PendingDayLedger;
}

// Time slot management
export function createTimeSlot(dayKey: number, slotIndex: number): TimeSlot;

// Task assignment management
export function createTaskAssignment(dayKey: number, slotIndex: number, orderIndex: number, mode: string): TaskAssignment;
export function getAssignedWorkersForSlot(tasks: TaskAssignment[], dayKey: number, slotIndex: number): string[];
export function isWorkerAssignedInSlot(tasks: TaskAssignment[], dayKey: number, slotIndex: number, workerId: string): boolean;
export function getTasksForSlot(tasks: TaskAssignment[], dayKey: number, slotIndex: number): TaskAssignment[];
export function validateWorkerAssignment(tasks: TaskAssignment[], dayKey: number, slotIndex: number, workerId: string, excludeTaskId?: string | null): WorkerAssignmentValidation;
export function updateTaskAssignedWorkers(task: TaskAssignment): TaskAssignment;

// Day ledger management
export function createPendingDayLedger(dayKey: number): PendingDayLedger;
export function addTaskSummaryToLedger(ledger: PendingDayLedger, task: TaskAssignment): PendingDayLedger;
export function commitPendingDayLedger(ledger: PendingDayLedger, currentFoods: any[], currentMaterials: any[]): CommitResult;

// Slot progression
export function canAdvanceSlot(tasks: TaskAssignment[], dayKey: number, slotIndex: number): SlotAdvancementResult;
export function advanceToNextSlot(currentDay: number, currentSlot: number): NextSlotResult;

// Time slot utilities
export function getCurrentSlot(timeSlots: TimeSlot[], dayKey: number, slotIndex: number): TimeSlot | null;
export function ensureDaySlotsExist(timeSlots: TimeSlot[], dayKey: number): TimeSlot[];
