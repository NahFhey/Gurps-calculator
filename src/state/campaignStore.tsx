import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  campaignReducer,
  createCampaignState,
  CampaignState,
  LegacyAppState,
  LogEntry
} from './campaignReducer';
import { saveCampaignState } from '../persistence/campaignStorage';

type CampaignStoreValue = {
  state: CampaignState;
  actions: {
    setActiveModule: (moduleId: string) => void;
    selectCharacter: (id: string | null) => void;
    toggleGmMode: () => void;
    setGmUnlocked: (value: boolean) => void;
    toggleDebug: () => void;
    setActivitiesSubview: (view: string | null) => void;
    advanceTime: () => void;
    setPausedSessionIds: (ids: string[]) => void;
    setActivitiesState: (payload: Partial<CampaignState['activities']>) => void;
    setPartyToolState: (payload: CampaignState['activities']['partyToolState']) => void;
    setToolReservations: (payload: Record<string, string[]>) => void;
    addLogEntry: (payload: LogEntry) => void;
    setLogsEntries: (payload: LogEntry[]) => void;
    createCheckpoint: (label: string) => void;
    restoreCheckpoint: (id: string) => void;
    importCampaignState: (state: CampaignState, label?: string) => void;
    startCombat: (encounterId?: string) => void;
    registerCombatDamage: (targetId: string, remainingHp: number) => void;
    registerCombatDefenseSuccess: (targetId: string, defense: { dodge?: number }) => void;
    applyDebugState: (state: CampaignState) => void;
  };
};

const CampaignStoreContext = createContext<CampaignStoreValue | undefined>(undefined);

type CampaignStoreProviderProps = {
  children: React.ReactNode;
  initialLegacyAppState?: LegacyAppState;
  initialCampaignState?: CampaignState;
};

export function CampaignStoreProvider({
  children,
  initialLegacyAppState,
  initialCampaignState
}: CampaignStoreProviderProps) {
  const [state, dispatch] = useReducer(
    campaignReducer,
    initialCampaignState ?? initialLegacyAppState,
    (initialArg) => {
      if (initialArg && typeof initialArg === 'object' && 'ui' in initialArg) {
        return initialArg as CampaignState;
      }
      return createCampaignState(initialArg as LegacyAppState | undefined);
    }
  );
  const saveTimeoutRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  const actions = useMemo(
    () => ({
      setActiveModule: (moduleId: string) => dispatch({ type: 'setActiveModule', payload: moduleId }),
      selectCharacter: (id: string | null) => dispatch({ type: 'selectCharacter', payload: id }),
      toggleGmMode: () => dispatch({ type: 'toggleGmMode' }),
      setGmUnlocked: (value: boolean) => dispatch({ type: 'setGmUnlocked', payload: value }),
      toggleDebug: () => dispatch({ type: 'toggleDebug' }),
      setActivitiesSubview: (view: string | null) => dispatch({ type: 'setActivitiesSubview', payload: view }),
      advanceTime: () => dispatch({ type: 'advanceTime' }),
      setPausedSessionIds: (ids: string[]) => dispatch({ type: 'setPausedSessionIds', payload: ids }),
      setActivitiesState: (payload: Partial<CampaignState['activities']>) =>
        dispatch({ type: 'setActivitiesState', payload }),
      setPartyToolState: (payload: CampaignState['activities']['partyToolState']) =>
        dispatch({ type: 'setPartyToolState', payload }),
      setToolReservations: (payload: Record<string, string[]>) =>
        dispatch({ type: 'setToolReservations', payload }),
      addLogEntry: (payload: LogEntry) => dispatch({ type: 'addLogEntry', payload }),
      setLogsEntries: (payload: LogEntry[]) => dispatch({ type: 'setLogsEntries', payload }),
      createCheckpoint: (label: string) => dispatch({ type: 'createCheckpoint', payload: label }),
      restoreCheckpoint: (id: string) => dispatch({ type: 'restoreCheckpoint', payload: id }),
      importCampaignState: (state: CampaignState, label?: string) =>
        dispatch({ type: 'importCampaignState', payload: { state, label } }),
      startCombat: (encounterId?: string) =>
        dispatch({ type: 'startCombat', payload: encounterId ? { encounterId } : undefined }),
      registerCombatDamage: (targetId: string, remainingHp: number) =>
        dispatch({ type: 'registerCombatDamage', payload: { targetId, remainingHp } }),
      registerCombatDefenseSuccess: (targetId: string, defense: { dodge?: number }) =>
        dispatch({ type: 'registerCombatDefenseSuccess', payload: { targetId, defense } }),
      applyDebugState: (state: CampaignState) => dispatch({ type: 'applyDebugState', payload: state })
    }),
    []
  );

  const value = useMemo(
    () => ({
      state: {
        ...state,
        legacy: {
          appState: initialLegacyAppState ?? state.legacy.appState
        }
      },
      actions
    }),
    [actions, initialLegacyAppState, state]
  );

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      saveCampaignState(state).catch((error) => {
        console.error('Failed to save campaign state', error);
      });
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  return <CampaignStoreContext.Provider value={value}>{children}</CampaignStoreContext.Provider>;
}

export function useCampaignStore() {
  const context = useContext(CampaignStoreContext);
  if (!context) {
    throw new Error('useCampaignStore must be used within CampaignStoreProvider');
  }
  return context;
}

export function useLegacyAppState() {
  return useCampaignStore().state.legacy.appState;
}

export function useCampaignCharacters() {
  const { state } = useCampaignStore();
  return Object.values(state.entities.characters);
}

export function useSelectedCharacterId() {
  return useCampaignStore().state.ui.selectedCharacterId;
}

export function useSelectedCharacter() {
  const { state } = useCampaignStore();
  const selectedId = state.ui.selectedCharacterId;
  return selectedId ? state.entities.characters[selectedId] : null;
}
