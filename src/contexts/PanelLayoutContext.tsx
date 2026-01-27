import { createContext, useContext, useReducer, useMemo, ReactNode } from 'react';

/**
 * Panel Layout Context - Manages panel expand/collapse states and modal overlays
 *
 * Part of Phase 2: Layout Restructure
 */

export type PanelMode = 'normal' | 'expanded' | 'collapsed';

export interface LayoutState {
  partyColumn: 'normal' | 'collapsed';
  centerPanel: PanelMode;
  rightPanel: PanelMode;
  modalContent: ReactNode | null;
  modalTitle: string | null;
}

type LayoutAction =
  | { type: 'SET_PARTY_COLUMN'; mode: 'normal' | 'collapsed' }
  | { type: 'SET_CENTER_PANEL'; mode: PanelMode }
  | { type: 'SET_RIGHT_PANEL'; mode: PanelMode }
  | { type: 'EXPAND_CENTER' }
  | { type: 'EXPAND_RIGHT' }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'OPEN_MODAL'; content: ReactNode; title?: string }
  | { type: 'CLOSE_MODAL' }
  | { type: 'TOGGLE_PARTY_COLUMN' };

const initialState: LayoutState = {
  partyColumn: 'normal',
  centerPanel: 'normal',
  rightPanel: 'normal',
  modalContent: null,
  modalTitle: null,
};

function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  switch (action.type) {
    case 'SET_PARTY_COLUMN':
      return { ...state, partyColumn: action.mode };

    case 'SET_CENTER_PANEL':
      return { ...state, centerPanel: action.mode };

    case 'SET_RIGHT_PANEL':
      return { ...state, rightPanel: action.mode };

    case 'EXPAND_CENTER':
      // When center expands, right collapses
      return {
        ...state,
        centerPanel: 'expanded',
        rightPanel: 'collapsed'
      };

    case 'EXPAND_RIGHT':
      // When right expands, center collapses
      return {
        ...state,
        centerPanel: 'collapsed',
        rightPanel: 'expanded'
      };

    case 'COLLAPSE_ALL':
      // Return all panels to normal
      return {
        ...state,
        centerPanel: 'normal',
        rightPanel: 'normal'
      };

    case 'TOGGLE_PARTY_COLUMN':
      return {
        ...state,
        partyColumn: state.partyColumn === 'normal' ? 'collapsed' : 'normal'
      };

    case 'OPEN_MODAL':
      return {
        ...state,
        modalContent: action.content,
        modalTitle: action.title || null
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        modalContent: null,
        modalTitle: null
      };

    default:
      return state;
  }
}

interface PanelLayoutContextValue {
  state: LayoutState;
  actions: {
    setPartyColumn: (mode: 'normal' | 'collapsed') => void;
    setCenterPanel: (mode: PanelMode) => void;
    setRightPanel: (mode: PanelMode) => void;
    expandCenter: () => void;
    expandRight: () => void;
    collapseAll: () => void;
    togglePartyColumn: () => void;
    openModal: (content: ReactNode, title?: string) => void;
    closeModal: () => void;
  };
}

const PanelLayoutContext = createContext<PanelLayoutContextValue | null>(null);

interface PanelLayoutProviderProps {
  children: ReactNode;
}

export function PanelLayoutProvider({ children }: PanelLayoutProviderProps) {
  const [state, dispatch] = useReducer(layoutReducer, initialState);

  const actions = useMemo(() => ({
    setPartyColumn: (mode: 'normal' | 'collapsed') =>
      dispatch({ type: 'SET_PARTY_COLUMN', mode }),

    setCenterPanel: (mode: PanelMode) =>
      dispatch({ type: 'SET_CENTER_PANEL', mode }),

    setRightPanel: (mode: PanelMode) =>
      dispatch({ type: 'SET_RIGHT_PANEL', mode }),

    expandCenter: () =>
      dispatch({ type: 'EXPAND_CENTER' }),

    expandRight: () =>
      dispatch({ type: 'EXPAND_RIGHT' }),

    collapseAll: () =>
      dispatch({ type: 'COLLAPSE_ALL' }),

    togglePartyColumn: () =>
      dispatch({ type: 'TOGGLE_PARTY_COLUMN' }),

    openModal: (content: ReactNode, title?: string) =>
      dispatch({ type: 'OPEN_MODAL', content, title }),

    closeModal: () =>
      dispatch({ type: 'CLOSE_MODAL' }),
  }), []);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <PanelLayoutContext.Provider value={value}>
      {children}
    </PanelLayoutContext.Provider>
  );
}

/**
 * Hook to access panel layout context
 * @throws {Error} If used outside of PanelLayoutProvider
 */
export function usePanelLayout(): PanelLayoutContextValue {
  const context = useContext(PanelLayoutContext);
  if (!context) {
    throw new Error('usePanelLayout must be used within a PanelLayoutProvider');
  }
  return context;
}

/**
 * Hook for components that may be used outside the provider
 * Returns null if no provider is found
 */
export function usePanelLayoutOptional(): PanelLayoutContextValue | null {
  return useContext(PanelLayoutContext);
}

export default PanelLayoutContext;
