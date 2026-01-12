# GURPS Party Management Tool

**Version: 2.1.0**

A comprehensive management tool for GURPS tabletop RPG sessions, featuring inventory tracking, cooking recipes, crafting projects, and an advanced alchemy system with reagent identification mechanics.

## Features

- **Inventory Management**: Track raw materials and food supplies with categories
- **Cooking System**: Create recipes, manage ingredients, and remake dishes with substitutions
- **Crafting System**: Design and craft items with material requirements, quality levels, and work tracking
- **Alchemy System**: Mix reagents, design formulas, and brew potions with aspect-based mechanics
- **Configuration Manager**: Manage food types, material types, workers, projects, and templates

## Project Structure

```
src/
├── components/
│   ├── alchemy/
│   │   ├── ReagentsView.jsx     # Alchemy reagent management
│   │   ├── FormulasView.jsx     # Formula design and creation
│   │   └── BatchesView.jsx      # Batch brewing and tracking
│   ├── AlchemyTab.jsx            # Main alchemy tab wrapper
│   ├── CookingTab.jsx            # Cooking recipes and remake system
│   ├── CraftingTab.jsx           # Crafting projects and work tracking
│   ├── InventoryTab.jsx          # Materials and food inventory
│   └── ManagerTab.jsx            # Configuration and management
├── constants/
│   └── index.js                  # Game constants and templates
├── hooks/
│   └── useStorage.js             # Storage hooks
├── utils/
│   ├── alchemy.js                # Alchemy-specific utilities
│   └── helpers.js                # General utility functions
├── App.jsx                       # Main application component
├── index.jsx                     # React entry point
└── index.css                     # Global styles
```

## Recent Updates

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
- Refinement levels affect aspect contributions
- Concentration steps increase potency

## License

MIT
