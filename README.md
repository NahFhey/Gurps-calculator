# GURPS Party Management Tool

**Version: 2.5.0**

A comprehensive management tool for GURPS tabletop RPG sessions, featuring inventory tracking, cooking recipes, crafting projects, gathering activities, advanced alchemy system with reagent identification mechanics, enterprise-grade performance monitoring, and schema-versioned data migration.

## Features

- **Inventory Management**: Track raw materials and food supplies with categories
- **Cooking System**: Create recipes, manage ingredients, and remake dishes with substitutions
- **Crafting System**: Design and craft items with material requirements, quality levels, and work tracking
- **Alchemy System**: Mix reagents, design formulas, and brew potions with aspect-based mechanics
- **Gathering System**: Manage fishing and foraging with species tracking, skill calculations, and yield generation
- **GM/Player Mode**: Toggle between GM and Player modes with password-protected content separation
- **Import/Export**: Save and load game state with optional encryption for player-safe exports
- **Performance Monitoring**: Real-time dashboard tracking renders, storage operations, state updates, API calls, and memory usage
- **Schema Versioning**: Automatic data migration infrastructure with backup and recovery
- **Configuration Manager**: Manage food types, material types, workers, projects, and templates

## Project Structure

```
src/
├── components/
│   ├── alchemy/
│   │   ├── ReagentsView.jsx           # Alchemy reagent management
│   │   ├── FormulasView.jsx           # Formula design and creation
│   │   ├── BatchesView.jsx            # Batch brewing and tracking
│   │   ├── TBBuilderPanel.jsx         # Trait Budget builder
│   │   ├── TallyWorksheetView.jsx     # Aspect tally worksheet
│   │   ├── AnalysisView.jsx           # Reagent identification
│   │   └── ConcentrationRefinementView.jsx # Reagent processing
│   ├── AlchemyTab.jsx                 # Main alchemy tab wrapper
│   ├── CookingTab.jsx                 # Cooking recipes and remake system
│   ├── CraftingTab.jsx                # Crafting projects and work tracking
│   ├── InventoryTab.jsx               # Materials and food inventory
│   ├── ManagerTab.jsx                 # Configuration and management
│   ├── ImportExportPanel.jsx          # Import/Export UI (NEW in v2.3.0)
│   └── GMLockModal.jsx                # GM password unlock modal (NEW in v2.3.0)
├── constants/
│   └── index.js                       # Game constants and templates
├── hooks/
│   └── useStorage.js                  # Storage hooks with flush & beforeunload
├── utils/
│   ├── alchemy.js                     # Alchemy-specific utilities
│   ├── helpers.js                     # General utility functions
│   ├── cryptoLock.js                  # Password encryption (NEW in v2.3.0)
│   └── exportImport.js                # State import/export (NEW in v2.3.0)
├── App.jsx                            # Main application component
├── index.jsx                          # React entry point
├── index.css                          # Global styles
└── version.js                         # Version and changelog
```

## Recent Updates

### Version 2.5.0 - Enterprise Performance Monitoring + Data Migration Infrastructure
This release focuses on observability, reliability, and data safety through comprehensive performance monitoring and schema versioning.

**Phase 5 - Performance Monitoring System**
- **Real-time Performance Dashboard** - Visual metrics for all operations
  - Live metric cards (render times, storage ops, state updates, API calls)
  - Statistics tables with min/max/avg tracking
  - Slow operations list for bottleneck identification
  - Memory usage monitoring with percentage indicators
  - CSV/JSON export capabilities
- **7 React Performance Hooks** - Easy component integration
  - `useRenderPerformance()` - Track component render times
  - `useStatePerformance()` - Monitor state changes and frequency
  - `useEffectPerformance()` - Measure effect execution timing
  - `useAsyncPerformance()` - Track async operation performance
  - `usePerformanceReporting()` - Periodic metric reports
  - `useMemoryTracking()` - Monitor memory usage
  - `useDetectSlowRender()` - Automatic slow render detection
- **Advanced Analysis Tools** - Benchmarking and optimization insights
  - Performance benchmarking for before/after comparison
  - Trend analysis for detecting performance degradation
  - Automatic bottleneck identification
  - Optimization recommendations with suggested solutions
  - Comprehensive performance report generation

**Phase 4 - Schema Versioning & Data Migration**
- **Semantic Data Versioning** (1.0.0 → 1.3.0)
  - Automatic schema detection and migration on app load
  - Timestamped backups created before each migration
  - Full recovery system for data restoration
  - Migration history tracking with logging
  - Zero data loss through comprehensive backup strategy
- **Migration Paths**: Upgrade from any version to current without data loss
  - v1.0.0 (Inventory) → v1.1.0 (Alchemy) → v1.2.0 (Combat) → v1.3.0 (Gathering)

**Phase 3 - Unit Testing Framework**
- **Vitest Configuration** - Modern test runner setup
  - jsdom environment for DOM testing
  - npm test, test:ui, test:coverage scripts
- **146+ Unit Tests** - Comprehensive test coverage
  - helpers.test.js: 34 tests ✅ (100% pass)
  - combatReducer.test.js: 15 tests
  - alchemy.test.js: 16 tests
  - gathering.test.js: 31 tests
  - schemaVersioning.test.js: 30+ tests

**Phase 2 - Type Safety with PropTypes**
- Added PropTypes validation to critical components:
  - CharacterSheet.jsx (15+ props)
  - ReagentsView.jsx (complex alchemy data)
  - FormulasView.jsx (formula validation)
  - BatchesView.jsx (batch management)
  - GatheringTab.jsx (18+ props)

**Phase 1 - Code Quality Assessment**
- Comprehensive code review identifying 50+ optimization opportunities
- 98% React optimization verification
- Performance baseline establishment

### Version 2.3.0 - GM/Player Mode + Import/Export + Enhanced Alchemy Engine (Previous)
- **GM/Player Separation**: Toggle between GM and Player modes with password-protected content
  - Unknown hazards display as "Unknown Complication" to players
  - GM mode reveals full hazard details, reagent secrets, and formula information
- **Import/Export System**: Save and share game state
  - Unlocked exports (GM only) - full plaintext JSON
  - Locked exports (player-safe) - GM content encrypted with AES-GCM + PBKDF2
  - Schema versioning for future-proof data migration
- **Alchemy Engine Fixes**: Critical bug fixes and improvements
  - Fixed hazard modifier application (DM-only hazards now work correctly)
  - Fixed catalyst bonus direction (DM increases, making rolls easier)
  - Refactored work-block resolution with delta accumulation (deterministic results)
  - Removed alert() calls; replaced with structured error returns
- **Storage Improvements**: Enhanced data persistence
  - Added flush() function for immediate saves
  - Beforeunload protection prevents data loss on tab close
  - localStorage fallback for better compatibility

### Version 2.2.2 - Reagent Processing & Refinement System
- **Concentration & Refinement**: Process reagents to increase potency
- **Refinement Levels**: Crude → Prepared → Refined
- **Concentration Steps**: Increase active ingredient strength

### Version 2.2.1 - Batch Creation UX Improvements
- Role dropdown restricted to valid roles for selected reagent

### Version 2.2.0 - Alchemy System Refactor & Data Persistence
- Auto-calculated tier from potency load
- Enforced role coverage validation with penalty system
- Hazard triggering system with real effects during brewing
- localStorage-based persistence system

### Version 2.1.0 - Reagent Identification & Formula Management
- **Reagent Identification System**: Progressive information revelation (levels 0-4) based on Analysis skill checks
- **Worker Skills**: Individual skill levels for cooking, designing, crafting, and alchemy with auto-fill
- **3d6 Dice Roller**: Color-coded dice display integrated across all tabs
- **Formula Management**: Centralized in Manager tab for GM control
- **Ad-hoc Batches**: Start experimental batches directly without pre-saved formulas
- **UI Improvements**: Persistent skill values, improved Batches tab layout

### Version 2.0.0 - Alchemy System Enhancements
- Trait Budget Builder for formula effect design
- GURPS 4e tier-based WR/DM calculation system
- Forecast and Micro-Assay mechanics
- Aspect Tally Worksheet
- Recipe auto-save on batch completion

### Version 1.0.0 - Initial Modular Release
- Refactored monolithic component into modular structure
- Extracted alchemy system into dedicated sub-components
- Replaced Flask icon with Beaker icon

## Tech Stack

- **React 18** - UI framework
- **Lucide React** - Icon library (including the new Beaker icon!)
- **Tailwind CSS** - Styling
- **Vite** - Build tool

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Features Detail

### Inventory
- Track raw materials by type (wood, metal, leather, etc.)
- Manage food supplies with multiple type tags
- Expandable item details for editing

### Cooking
- Create recipes with unique ingredients
- Calculate difficulty based on variety
- Remake recipes with ingredient substitutions
- Automatic penalty calculation for substitutions

### Crafting
- Multi-phase projects (Setup → Design → Craft)
- Material requirement system
- Quality levels from cheap to legendary
- Work shift tracking with GURPS skill rolls
- Material refund on project abandonment

### Alchemy
- **Reagents**: Manage ingredients with aspect system (Water, Air, Fire, etc.)
- **Formulas**: Design potions by combining reagents in specific roles
- **Batches**: Brew formulas with work blocks and contamination tracking
- **Identification**: Progressive reveal of reagent properties through Analysis checks
- **Processing**: Concentrate and refine reagents to enhance potency
- **Hazards**: Dynamic hazard system with player visibility control
- Refinement levels affect aspect contributions
- Concentration steps increase potency

### GM/Player Mode
- **Player Mode**: Limited access to prevent accidental spoilers
  - Unknown hazards display as "Unknown Complication"
  - Hidden reagent details and formula secrets
  - Safe for players to use during sessions
- **GM Mode**: Full access to all features
  - Complete hazard details with effects and triggers
  - Reagent and formula design information
  - Password-protected when using locked exports

### Import/Export
- **Export Formats**:
  - **Unlocked** (GM only): Complete plaintext JSON - includes all data
  - **Locked** (Player-safe): GM content encrypted with password
- **Security**: AES-GCM encryption + PBKDF2 key derivation (210k iterations)
- **Versioning**: Schema version tracking for safe migrations
- **State Management**: Import/export entire game state or merge GM data
- **Use Cases**:
  - Share player-safe exports with your group
  - Backup your campaign data
  - Transfer between devices
  - Prepare sessions offline

## Security Note

The password protection uses client-side WebCrypto API encryption (AES-GCM + PBKDF2) as a "casual lock" to prevent accidental viewing of GM content. This is **not** designed to be cryptographically unbreakable by a determined technical user, but it provides reasonable protection for typical tabletop gaming scenarios where you want to share files with players without spoiling secrets.

## License

MIT
