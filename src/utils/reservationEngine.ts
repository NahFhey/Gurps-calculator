import type { GlobalState, Id } from '../types/partyTool';

export type ReservationMap = Record<Id, Id[]>;

export class ReservationEngine {
  private state: GlobalState;
  activeReservations: ReservationMap;

  constructor(state: GlobalState, activeReservations: ReservationMap = {}) {
    this.state = state;
    this.activeReservations = activeReservations;
  }

  reserveTool(sessionId: Id, toolId: Id) {
    const existingSession = this.findSessionForTool(toolId);
    if (existingSession && existingSession !== sessionId) {
      throw new Error(`Tool already reserved by session: ${existingSession}`);
    }

    const toolsForSession = this.activeReservations[sessionId] ?? [];
    if (!toolsForSession.includes(toolId)) {
      toolsForSession.push(toolId);
      this.activeReservations[sessionId] = toolsForSession;
    }
  }

  validateReservations(sessionId: Id): boolean {
    const toolIds = this.activeReservations[sessionId] ?? [];
    if (toolIds.length === 0) {
      return true;
    }

    const availableToolIds = new Set<Id>();
    Object.values(this.state.inventories).forEach(inventory => {
      inventory.tools.forEach(tool => {
        availableToolIds.add(tool.toolId);
      });
    });

    return toolIds.every(toolId => {
      if (!availableToolIds.has(toolId)) {
        return false;
      }

      const tool = this.state.toolInstances[toolId];
      if (!tool) {
        return false;
      }

      return tool.conditionId !== 'Broken';
    });
  }

  invalidateReservationsForTool(toolId: Id) {
    Object.entries(this.activeReservations).forEach(([sessionId, toolIds]) => {
      if (toolIds.includes(toolId)) {
        delete this.activeReservations[sessionId];
      }
    });
  }

  clearAllReservations() {
    this.activeReservations = {};
  }

  private findSessionForTool(toolId: Id): Id | null {
    const entries = Object.entries(this.activeReservations);
    for (const [sessionId, toolIds] of entries) {
      if (toolIds.includes(toolId)) {
        return sessionId;
      }
    }
    return null;
  }
}
