// Version and changelog information
export const VERSION = '2.2.2';

export const CHANGELOG = [
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
