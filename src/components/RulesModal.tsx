import React from 'react';
import { X, BookOpen } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type RulesSection = 'inventory' | 'cooking' | 'crafting' | 'alchemy' | 'manager';

export interface RulesContent {
  title: string;
  icon: string;
  content: string;
}

export interface RulesModalProps {
  section: RulesSection | null;
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const rulesContent: Record<RulesSection, RulesContent> = {
  inventory: {
    title: 'Inventory System Rules',
    icon: '📦',
    content: `**Raw Materials:**
- Materials have types that determine properties (HT, weight mod, HP mod)
- Duplicate prevention: Matching name AND type auto-merge
- Use existing item checkbox for browsing filtered inventory
- Type editing locked behind GM mode

**Food Items:**
- Can have up to 4 types per item
- Duplicate prevention: Matching name AND all types auto-merge
- Types determine substitution penalties in recipes
- Type editing locked behind GM mode

**GM Mode:**
- Required to edit material/food types
- Prevents exploitation of game mechanics
- Toggle in Manager tab`
  },
  cooking: {
    title: 'Cooking System Rules',
    icon: '🍳',
    content: `**Recipe Creation:**
- Ingredients must total weight = number of people
- Difficulty: -(unique ingredients - 1)
- Skill rolls: floor(unique/2) + extra types + crit bonus
- Worker + Kitchen rating bonus
- Roll 3d6 vs effective skill
- Record results and granted skills

**Remaking Recipes:**
- Can substitute unavailable ingredients
- Penalties: Same type (-1), Similar (-3), Unrelated (-5)
- Full creation history tracked
- Substitutions logged

**Kitchens & Skills:**
- Kitchens provide 0-4 rating bonus
- Skills table in Manager (GM locked)
- Random skill selection available`
  },
  crafting: {
    title: 'Crafting System Rules',
    icon: '⚒️',
    content: `**Three Phases:**
1. Setup: Choose template, quality, materials
2. Design: Create blueprint (2×HP hours)
3. Craft: Build item (HP hours)

**Work Shifts:**
- Worker skill + roll determine hours added
- Design: Crit=skill value, Success=8h, Fail=0-6h
- Craft: Crit=8h+quality, Success=8h, Fail=4h-penalty
- Track date and in-game day

**Quality Levels:**
- Cheap (-1 HT), Good (+0), Fine (+1), Very Fine (+2), Legendary (+3)
- Quality can change based on rolls
- Affects final HT and difficulty

**Multiple Projects:**
- "New Project" always available
- Work on multiple simultaneously
- Progress bars show completion`
  },
  alchemy: {
    title: 'Alchemy System Rules',
    icon: '⚗️',
    content: `**Reagent Analysis:**
- Costs 1U per analysis
- Worker + Lab rating bonus
- Roll 3d6 vs effective skill
- Identification levels:
  * MoS 0-1: Primary aspect
  * MoS 2-3: Primary + Secondary
  * MoS 4-5: All aspects
  * MoS 6+: Full profile
- Sister reagents share identityId

**Batch Brewing:**
- Unit-by-unit processing
- Cumulative penalty: -1, -2, -3, etc.
- Individual rolls per unit
- Risk accumulation on failures
- Abort batch anytime
- Progress bars show PP/WR

**Concentration & Refinement:**
- 2U → 1U higher potency
- Remove hazards
- Creates derived reagents
- Processing history tracked`
  },
  manager: {
    title: 'Manager Tab Rules',
    icon: '⚙️',
    content: `**GM Mode:**
- Password protected
- Required for sensitive edits
- Type editing, skills table
- GM Lock for import/export

**Workers:**
- Four skills: Cooking, Designing, Crafting, Alchemy
- Used across all systems
- Skills default to 10

**Facilities:**
- Labs: 0-4 rating for alchemy
- Kitchens: 0-4 rating for cooking
- Rating adds to effective skill

**Types & Templates:**
- Material types: HT, weight mod, HP mod
- Food types: Color-coded
- Custom templates for crafting
- Import/Export all data`
  }
};

// ============================================================================
// Component
// ============================================================================

/**
 * RulesModal Component - Displays a modal popup with rules for a specific game section
 *
 * Provides quick-reference rules summaries for each major system (inventory, cooking,
 * crafting, alchemy, manager). Used as a contextual help popup accessed from various
 * parts of the application.
 */
export function RulesModal({ section, onClose }: RulesModalProps): React.JSX.Element | null {
  if (!section) return null;

  const content = rulesContent[section];
  if (!content) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{content.icon}</span>
            <h2 className="text-xl font-bold">{content.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">
          <div className="text-gray-300 space-y-3 whitespace-pre-line">
            {content.content}
          </div>
          <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 border border-blue-600 rounded flex items-start gap-3">
            <BookOpen size={20} className="text-blue-400 flex-shrink-0 mt-1" />
            <div className="text-sm text-gray-300">
              For complete rules and detailed mechanics, visit the <button onClick={onClose} className="text-blue-400 hover:text-blue-300 underline">Rules tab</button>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
