/**
 * Rules System Types
 *
 * TypeScript interfaces for the rules documentation system.
 */

// ============================================================================
// CONTENT TYPES
// ============================================================================

export interface RuleSubsection {
  title: string;
  content: string;
}

export interface RuleSection {
  id: string;
  title: string;
  icon: string;
  subsections: RuleSubsection[];
}

// ============================================================================
// VIEW PROPS INTERFACES
// ============================================================================

export interface RuleSectionViewProps {
  section: RuleSection;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface QuickNavigationProps {
  // Currently no props needed, but interface for future expansion
}

export interface RulesTabProps {
  initialSection?: string | null;
}

// ============================================================================
// STATE TYPES
// ============================================================================

export type ExpandedSections = Record<string, boolean>;
