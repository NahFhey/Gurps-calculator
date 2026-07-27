// Version and changelog information
export const VERSION = '2.5.0';

export interface ChangelogCategory {
  category: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: ChangelogCategory[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.5.0',
    date: '2026-01-23',
    title: 'Enterprise Performance Monitoring + Data Migration Infrastructure',
    changes: [
      {
        category: 'Phase 5: Performance Monitoring System',
        items: [
          'Real-time Performance Dashboard with live metric cards',
          'Live statistics tracking renders, storage ops, state updates, API calls',
          'Slow operations detection and memory usage monitoring',
          'Auto-export to CSV and JSON formats',
          '7 React performance hooks: useRenderPerformance, useStatePerformance, useEffectPerformance, useAsyncPerformance, usePerformanceReporting, useMemoryTracking, useDetectSlowRender',
          'Advanced analysis tools: PerformanceBenchmark, BenchmarkComparison, PerformanceTrendAnalysis',
          'Automated optimization recommendations and bottleneck detection',
          '1,700+ lines of performance monitoring infrastructure'
        ]
      },
      {
        category: 'Phase 4: Schema Versioning & Data Migration',
        items: [
          'Semantic data versioning system (v1.0.0 → v1.3.0)',
          'Automatic schema detection and migration on app load',
          'Timestamped backups created before each migration',
          'Full recovery system for data restoration',
          'Migration paths: v1.0.0 (Inventory) → v1.1.0 (Alchemy) → v1.2.0 (Combat) → v1.3.0 (Gathering)',
          'Migration history tracking with detailed logging',
          'Zero data loss guarantee with comprehensive backup strategy'
        ]
      },
      {
        category: 'Phase 3: Unit Testing Framework',
        items: [
          'Vitest configuration with jsdom environment',
          '146+ unit tests across 5 test suites',
          'helpers.test.js: 34 tests (100% pass rate)',
          'combatReducer.test.js, alchemy.test.js, gathering.test.js, schemaVersioning.test.js',
          'npm test, test:ui, test:coverage scripts added',
          'Comprehensive test coverage for reducers, utilities, and migration system'
        ]
      },
      {
        category: 'Phase 2: Type Safety with PropTypes',
        items: [
          'PropTypes validation on 5 critical components',
          'CharacterSheet.jsx: 15+ prop validations',
          'ReagentsView.jsx, FormulasView.jsx, BatchesView.jsx, GatheringTab.jsx enhanced',
          'IDE autocomplete and IntelliSense support',
          'Runtime prop validation in development mode'
        ]
      },
      {
        category: 'Phase 1: Code Quality Assessment',
        items: [
          'Comprehensive code review identifying 50+ optimization opportunities',
          '98% React optimization patterns verified',
          'Baseline performance metrics established',
          'Memory leak detection and analysis'
        ]
      },
      {
        category: 'Documentation',
        items: [
          'Updated version to 2.5.0 in package.json and README',
          'Added comprehensive CHANGELOG.md with all phases documented',
          'Performance monitoring documentation with hook examples',
          'Schema versioning guide with migration instructions',
          'Performance analysis tools documentation'
        ]
      }
    ]
  },
  {
    version: '2.4.2',
    date: '2026-01-20',
    title: 'Foraging System & Bug Fixes',
    changes: [
      {
        category: 'Foraging System',
        items: [
          'Complete foraging mode implementation with skill-based searching',
          'Three foraging skills supported: Survival, Naturalist, Herb Lore',
          'Target-specific items or random foraging with rarity penalties',
          'Context modifiers: Map/Guide (+1), Unfamiliar (-2), Peak Season (+2)',
          'Critical success grants 1.5x yield and bonus finds',
          'Critical failure applies random hazards (poison ivy, bee sting, etc.)',
          'Day Planner integration with manual dice rolling',
          'Separate event rolls from skill rolls for better outcomes'
        ]
      },
      {
        category: 'Item System Overhaul',
        items: [
          'Removed category system in favor of direct item types',
          'Items now reference food/material types directly from Manager',
          'Each item has its own yield formula (XdY format)',
          'Items specify inventory kind (food/material) and type ID',
          'Tool yield bonuses now apply to specific type IDs',
          'Tables can reference items directly without category layer',
          'Minimum 1 unit guarantee on successful foraging'
        ]
      },
      {
        category: 'Day Planner Enhancement',
        items: [
          'Event Check now separate from Skill Roll (4 rolls total)',
          'Event probability removed from UI label for cleaner display',
          'Mode-specific configuration panels (Fishing, Foraging)',
          'Fishing config: Method, Bait, Target Species',
          'Foraging config: Skill, Target Item, Context Modifiers, Rarity',
          'Manual roll system with colored 3d6 dice display',
          'Results commit at end of day with delta tracking'
        ]
      },
      {
        category: 'Manager Updates',
        items: [
          'Removed Categories tab (no longer needed)',
          'Items tab: Create forageable items with direct properties',
          'Type ID dropdowns now pull from editable food/material types',
          'Tool yield bonus configuration for foraging tools',
          'Tools can grant +Xd to specific food/material types',
          'Table entries support "Item" result type',
          'Item selection dropdowns in table configuration'
        ]
      },
      {
        category: 'Bug Fixes',
        items: [
          'Fixed crash when clicking foods with no type assigned',
          'Fixed crash when viewing legacy crafting projects',
          'Added defensive checks for undefined/null food types',
          'Added defensive checks for malformed craft data',
          'Filter out invalid entries in craft lists',
          'Improved error handling for missing template data',
          'Handle empty or whitespace yield formulas gracefully'
        ]
      },
      {
        category: 'Documentation',
        items: [
          'Added Foraging System section to Rules tab',
          'Documented foraging skills, targeting, and modifiers',
          'Added foraging items and yield calculation guide',
          'Updated Gathering System overview for both modes',
          'Documented Day Planner workflow and integration'
        ]
      }
    ]
  },
  {
    version: '2.4.1',
    date: '2026-01-14',
    title: 'Lab System Integration & UI Improvements',
    changes: [
      {
        category: 'Lab Integration',
        items: [
          'Analysis tab: Lab selection with skill bonuses applied to identification rolls',
          'Analysis tab: Lab info recorded in analysis history (lab name, rating, effective skill)',
          'Batches tab: Lab selected at batch creation and locked for entire batch lifecycle',
          'Batches tab: Lab rating applies to all work block skill calculations',
          'Batches tab: Lab info displayed in batch details and work history',
          'Consistent lab rating application across all alchemy operations'
        ]
      },
      {
        category: 'UI Improvements',
        items: [
          'Processing tab: Replaced GM mode toggle with DiceRoller button (matching Analysis UI)',
          'Processing tab: Manual roll adjustment still available after dice roll',
          'Analysis tab: Expanded to 3-column grid layout for worker, lab, and skill inputs',
          'Analysis tab: Real-time effective skill calculation display with lab bonus breakdown',
          'Batches tab: Detailed effective skill breakdown in work blocks showing lab contribution',
          'Work history: Lab name and rating now displayed in shift records'
        ]
      }
    ]
  },
  {
    version: '2.4.0',
    date: '2026-01-14',
    title: 'Reagent Processing System Overhaul',
    changes: [
      {
        category: 'Processing System',
        items: [
          'Complete rewrite of concentration and refinement mechanics',
          'Material cost system: 2U input → 1U output for all processing',
          'Sequential batch processing with individual roll results per output unit',
          'Risk mechanics: Success/Minor Failure/Failure/Critical outcomes',
          'Minor failures (MoF -1 to -2) produce output but add hazards',
          'Regular failures (MoF ≥ 3) consume input without producing output',
          'Critical success may reclaim +1U input material',
          'GM Mode (auto-roll) and Player Mode (manual input) support'
        ]
      },
      {
        category: 'Derived Reagents',
        items: [
          'Processing creates new reagent variants instead of upgrading in-place',
          'Variants share identityId for unified identification progress',
          'Hazards from processing apply only to output variant',
          'Automatic naming: "Reagent (Prepared) +2" format',
          'baseReagentName tracks original material for all variants',
          'Processing logs stored per variant with complete attempt history'
        ]
      },
      {
        category: 'Difficulty Calculation',
        items: [
          'Process Step DM: Crude→Prepared (-1), Prepared→Refined (-2), Concentrate (-2)',
          'Batch Size Penalty: -1 or -2 per output unit attempted',
          'Potency Control Penalty: -(potency index) for target potency',
          'Lab Rating Bonus: +0 to +4 based on equipment quality',
          'Complete difficulty breakdown displayed before processing'
        ]
      },
      {
        category: 'Hazard Accretion',
        items: [
          'Auto-escalating hazard system for minor failures',
          'First failure: adds Volatile',
          'Has Volatile: adds Flammable',
          'Has 2+ hazards: adds Unstable',
          'Hazards accumulate on output only, not input reagent'
        ]
      },
      {
        category: 'Lab Management',
        items: [
          'New Labs section in Manager tab',
          'Create/edit/delete alchemy labs with ratings 0-4',
          'Lab descriptions for notes and flavor',
          'Labs integrated into import/export system',
          'Lab selection in Processing tab affects difficulty'
        ]
      },
      {
        category: 'UI Enhancements',
        items: [
          'Derived reagent indicator (⚗️ badge) in Reagents view',
          'Complete processing history display with expandable logs',
          'Shows worker, lab, input/output, and roll outcomes per attempt',
          'Color-coded result feedback (green=success, yellow=minor fail, red=fail)',
          'Real-time difficulty calculation with detailed breakdowns',
          'Base material reference for all derived reagents'
        ]
      },
      {
        category: 'Documentation Fixes',
        items: [
          'Corrected refinement aspect system documentation (was backwards)',
          'Crude: Primary (3) + Secondary (2) + Tertiary (1) - all aspects',
          'Prepared: Primary (3) + Secondary (2) - tertiary removed',
          'Refined: Primary (3) only - secondary and tertiary removed'
        ]
      }
    ]
  },
  {
    version: '2.3.0',
    date: '2026-01-13',
    title: 'GM/Player Mode + Import/Export + Enhanced Alchemy Engine',
    changes: [
      {
        category: 'GM/Player Separation',
        items: [
          'Added GM/Player mode toggle in Manager tab',
          'Password-protected exports encrypt GM content (hazards, secret notes, reagent details)',
          'Player-safe exports allow player use while keeping GM secrets locked',
          'GM Lock modal for password entry when accessing locked imports',
          'Hazard visibility system: unknown hazards display as "Unknown Complication" to players',
          'GM mode reveals full hazard details, reagent secrets, and formula design information'
        ]
      },
      {
        category: 'Import/Export System',
        items: [
          'New Import/Export panel in Manager tab',
          'Export formats: Unlocked (GM only) and Locked (player-safe with encryption)',
          'Schema versioning with migration support for future updates',
          'AES-GCM + PBKDF2 encryption (210k iterations) for casual security',
          'Validation and error handling for imported files',
          'Automatic state merging for locked imports after password entry'
        ]
      },
      {
        category: 'Alchemy Engine Fixes',
        items: [
          'Fixed hazard modifier application: DM-only hazards now apply correctly',
          'Fixed catalyst bonus direction: DM now increases (makes rolls easier) instead of decreasing',
          'Refactored work-block resolution to use delta accumulation for deterministic hazard ordering',
          'Removed alert() from engine; replaced with structured error returns',
          'Added hazard snapshot system with public/GM visibility layers',
          'Hazard effects now trigger based on roll classification, not evaluation order'
        ]
      },
      {
        category: 'Storage Improvements',
        items: [
          'Added flush() function to useStorage hook for immediate saves',
          'Implemented beforeunload protection to prevent data loss on tab close',
          'Added localStorage fallback when window.storage unavailable',
          'Debounced saves now track pending data for better reliability'
        ]
      },
      {
        category: 'Developer Experience',
        items: [
          'New crypto utility module (cryptoLock.js) for password encryption',
          'New import/export utility module (exportImport.js) with state splitting',
          'Structured error returns from alchemy engine functions',
          'Updated FormulasView to handle new error format',
          'Added GMLockModal and ImportExportPanel components'
        ]
      }
    ]
  },
  {
    version: '2.2.2',
    date: '2026-01-12',
    title: 'Reagent Processing & Refinement System',
    changes: [
      {
        category: 'Alchemy System',
        items: [
          'Added Concentration & Refinement tab for processing reagents',
          'Reagents can now be refined: Crude → Prepared → Refined',
          'Reagents can be concentrated to increase concentration steps',
          'Refinement level in batch creation now pulled from reagent (read-only)',
          'Processing operations consume reagent units',
          'Visual status display shows current refinement, concentration, potency, and quantity'
        ]
      }
    ]
  },
  {
    version: '2.2.1',
    date: '2026-01-12',
    title: 'Batch Creation UX Improvements',
    changes: [
      {
        category: 'Alchemy System',
        items: [
          'Reagent role dropdown now only shows roles that the selected reagent actually has',
          'Prevents invalid role assignments during batch creation'
        ]
      }
    ]
  },
  {
    version: '2.2.0',
    date: '2026-01-12',
    title: 'Alchemy System Refactor & Data Persistence',
    changes: [
      {
        category: 'Data Persistence',
        items: [
          'Implemented localStorage-based persistence system',
          'Data now persists across server restarts',
          'Async storage wrapper for future backend migration'
        ]
      },
      {
        category: 'Alchemy System Overhaul',
        items: [
          'Tier now auto-calculated from potency load: Σ((potency_index + conc_steps) × units)',
          'Added enforced role coverage validation with penalty system',
          'Active and Tool roles now required for all vectors (blocks formula creation)',
          'Missing optional roles apply penalties: Stabilizer/Solvent/Binder (+2 WR, -1 DM), Catalyst (+1 WR)',
          'Enforced batch constraints: max 8 reagents, role-specific unit limits',
          'Implemented hazard triggering system with real effects during brewing',
          'Unstable hazard adds +1 CP when triggered by failure/mishap',
          'Volatile hazard destroys entire batch when triggered',
          'Flammable hazard activates on batch completion with Unstable+ quality',
          'Validation warnings prevent invalid batch creation',
          'Canonicalized Effect Family Map keys for consistency'
        ]
      },
      {
        category: 'UI Improvements',
        items: [
          'Removed manual tier selection dropdown (now auto-calculated)',
          'Added color-coded validation warning banners (red/yellow/orange severity)',
          'Tally Worksheet now respects reagent identification levels',
          'Only shows known aspects based on identification progress',
          'Added confirmation prompts for batches with non-blocking warnings'
        ]
      }
    ]
  },
  {
    version: '2.1.0',
    date: '2026-01-12',
    title: 'Reagent Identification & Formula Management',
    changes: [
      {
        category: 'Alchemy System',
        items: [
          'Added reagent identification system with Analysis tab',
          'Progressive information revelation based on identification level (0-4)',
          'Analysis attempts consume 1U and reveal aspects/potency/hazards',
          'Critical success grants full identification, critical failure creates false profiles',
          'Added toggle for "obvious physical roles" (Solvent, Binder, Tool)',
          'Moved formula design to Manager tab for GM control',
          'Simplified Formulas tab to display-only for players',
          'Added ability to start ad-hoc batches directly from Batches tab',
          'Reagent management now centralized in Manager tab'
        ]
      },
      {
        category: 'Worker Skills',
        items: [
          'Workers now have individual skill levels for cooking, designing, crafting, and alchemy',
          'Worker selection auto-fills skill boxes in all tabs',
          'Backward-compatible migration from simple name list to skill-based system'
        ]
      },
      {
        category: 'Dice Roller',
        items: [
          'Added 3d6 dice roller component with colored display',
          'Integrated into Alchemy work blocks, Crafting shifts, and Design phases',
          'Shows individual dice values in different colors: (red)+(green)+(blue) = (total)',
          'Manual editing still available after rolling'
        ]
      },
      {
        category: 'UI Improvements',
        items: [
          'Worker and skill values now persist after adding work blocks',
          'Only roll value clears, allowing quick successive work block entries',
          'Fixed duplicate headings in Batches tab',
          'Improved Manager tab organization with Formulas section'
        ]
      }
    ]
  },
  {
    version: '2.0.0',
    date: '2026-01-09',
    title: 'Alchemy System Enhancements',
    changes: [
      {
        category: 'Alchemy Features',
        items: [
          'Added Trait Budget (TB) Builder for formula effect design',
          'Implemented GURPS 4e tier-based WR/DM calculation system',
          'Added Forecast and Micro-Assay mechanics for batches',
          'Added Aspect Tally Worksheet for dominant aspect calculation',
          'Recipe auto-save prompt on successful batch completion',
          'Updated potency system to P0-P4 scale',
          'Support for multiple reagent roles and hazards'
        ]
      },
      {
        category: 'Crafting System',
        items: [
          'Added craft design saving system',
          'Color palette system for food types and crafting phases',
          'Improved template stats display'
        ]
      },
      {
        category: 'Manager Tab',
        items: [
          'Added Lab Rating and Work Block settings',
          'Added Effect Family Map Manager',
          'Centralized configuration for alchemy parameters'
        ]
      }
    ]
  },
  {
    version: '1.0.0',
    date: '2026-01-06',
    title: 'Initial Modular Release',
    changes: [
      {
        category: 'Code Organization',
        items: [
          'Refactored monolithic component into modular structure',
          'Split into separate directories: components/, constants/, utils/, hooks/',
          'Extracted alchemy system into dedicated sub-components',
          'Created reusable utility functions'
        ]
      },
      {
        category: 'Core Features',
        items: [
          'Inventory Management: Track raw materials and food supplies',
          'Cooking System: Recipe creation and remake with substitutions',
          'Crafting System: Multi-phase projects with material tracking',
          'Alchemy System: Reagent mixing, formula design, batch brewing',
          'Manager Tab: Configuration for all game systems'
        ]
      },
      {
        category: 'Visual Changes',
        items: [
          'Replaced Flask icon with Beaker icon for Alchemy tab'
        ]
      }
    ]
  }
];
