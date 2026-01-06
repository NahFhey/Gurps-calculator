# GURPS Party Management Tool

A comprehensive management tool for GURPS tabletop RPG sessions, featuring inventory tracking, cooking recipes, crafting projects, and an alchemy system.

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

## Changes from v1.0

### Icon Change
- **Flask** icon replaced with **Beaker** icon for the Alchemy tab (more fitting for potion brewing!)

### Code Organization
- Split monolithic 3000+ line component into modular, maintainable files
- Separated concerns: components, utilities, constants, and hooks
- Extracted alchemy system into dedicated sub-components
- Created reusable utility functions for common operations

### Improved Maintainability
- Each tab is now a separate component file
- Utility functions are organized by feature (alchemy, helpers)
- Constants extracted to dedicated file
- Custom hooks for storage operations

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
