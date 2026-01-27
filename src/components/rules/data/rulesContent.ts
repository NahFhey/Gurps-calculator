/**
 * Rules Content Data
 *
 * Contains all the documentation content for the game systems.
 * Each section represents a major game system with subsections for specific mechanics.
 */

import type { RuleSection } from '../../../types/rules';

export const RULES_SECTIONS: RuleSection[] = [
  {
    id: 'inventory',
    title: 'Inventory System',
    icon: '📦',
    subsections: [
      {
        title: 'Raw Materials',
        content: `Raw materials are the foundation of crafting and alchemy. Each material has a type that determines its properties.

**Adding Materials:**
- Name: Unique identifier for the material
- Type: Determines material properties (HT, weight mod, HP mod)
- Quantity: Measured in pounds (lbs)
- Duplicate Prevention: Materials with matching name AND type are automatically merged
- Use Existing Item: Browse and add to existing material inventory

**Type Editing:**
- Material types can only be edited in GM mode
- Prevents players from changing material properties after creation
- Types determine crafting outcomes (HT, weight, HP modifiers)`
      },
      {
        title: 'Food Items',
        content: `Food items are used in cooking recipes and provide various benefits.

**Adding Food:**
- Name: Unique identifier for the food
- Types: Up to 4 types per food item (fruit, vegetable, meat, grain, dairy, spice, herb, etc.)
- Quantity: Measured in pounds (lbs)
- Duplicate Prevention: Food with matching name AND all types are automatically merged
- Use Existing Item: Browse and add to existing food inventory

**Type System:**
- Multiple types allow for flexible recipe substitution
- Types determine substitution penalties when remaking recipes
- Same type: -1 penalty
- Similar types (fruit ↔ vegetable): -3 penalty
- Unrelated types: -5 penalty

**GM Mode Restrictions:**
- Food types can only be edited in GM mode
- Prevents exploitation of the type system`
      }
    ]
  },
  {
    id: 'cooking',
    title: 'Cooking System',
    icon: '🍳',
    subsections: [
      {
        title: 'Recipe Creation',
        content: `Create recipes that grant skill bonuses to characters who consume them.

**Requirements:**
- Ingredients: Select unique food items
- People: Number of people to feed (default 10)
- Total Weight: Must equal number of people (each person = 1 lb food)
- Difficulty: -(unique ingredients - 1)
- Skill Rolls: floor(unique/2) + sum(extra types per food - 1) + critical success bonus

**Creation Process:**
1. Select ingredients and amounts
2. Choose worker (auto-fills cooking skill)
3. Select kitchen (provides rating bonus 0-4)
4. Roll 3d6 against effective skill
5. Record result and granted skills

**Critical Success (roll ≤4, or 5 at skill 15+, or 6 at skill 16+):**
- +1 quality level
- +1 additional skill roll

**Success (roll ≤ effective skill):**
- Recipe created successfully

**Failure (roll > effective skill):**
- Recipe may still be created but with reduced quality

**Critical Failure (roll 18, or 17 at skill 15-, or 16 at skill 6-):**
- Recipe fails completely`
      },
      {
        title: 'Recipe Library & Remaking',
        content: `Store and remake recipes with ingredient substitution.

**Recipe Library:**
- Collapsible recipe cards
- Shows ingredients, difficulty, granted skills
- Full creation history with results
- Make Recipe button to start remake process

**Remaking Recipes:**
1. Check ingredient availability
2. Substitute unavailable ingredients (optional)
3. Calculate new difficulty with substitution penalties
4. Select worker and kitchen
5. Roll against effective skill
6. Record results including substitutions used

**Substitution System:**
- Original ingredient unavailable → select substitutes
- Multiple substitutes can be added for one ingredient
- Penalty auto-calculated based on type matching:
  * Same type: -1
  * Similar type: -3
  * Unrelated: -5
- Manual penalty override available

**Creation History:**
- Worker, kitchen, skill used
- Roll result and MoS
- Substitutions logged (original → replacement)
- Color-coded results (green=crit success, blue=success, gray=failure, red=crit fail)`
      },
      {
        title: 'Kitchens & Skills',
        content: `Manage cooking facilities and available skills.

**Kitchens (Manager Tab):**
- Name and description
- Rating: 0-4 (provides skill bonus)
- Multiple kitchens can be created
- Rating adds directly to effective cooking skill
- Similar to alchemy labs

**Skills Table (Manager Tab, GM Locked):**
- Add any GURPS skill to the table
- Skills can be randomly selected when creating recipes
- Each granted skill slot gets a random button (🎲)
- Equal probability selection from all skills in table
- Manual override always available
- GM mode required to add/remove skills`
      }
    ]
  },
  {
    id: 'crafting',
    title: 'Crafting System',
    icon: '⚒️',
    subsections: [
      {
        title: 'Project Workflow',
        content: `Create weapons, armor, and equipment through a multi-phase process.

**Three Phases:**

**1. Setup Phase:**
- Select template type (weapons, ranged, armor, explosives)
- Choose specific template
- Select target quality (cheap, good, fine, very fine, legendary)
- Choose materials by type and amount
- Set start date and day

**2. Design Phase:**
- Create the blueprint for the item
- Target Hours: 2 × final HP
- Use Designing skill
- Work in shifts (add hours via skill rolls)
- Can save design when complete for reuse
- Quality can increase (crit success) or decrease (failures)

**3. Craft Phase:**
- Build the actual item
- Target Hours: final HP
- Use Crafting skill
- Work in shifts (add hours via skill rolls)
- Quality can change based on rolls
- Critical failure destroys project (materials refunded)

**Work Shifts:**
- Worker selection (auto-fills appropriate skill)
- 3d6 roll against effective skill
- Hours added based on result:
  * Design: Crit success=skill value, success=8h, marginal fail=6h/4h, fail=0h
  * Craft: Crit success=8h+quality, success=8h, fail=4h with quality penalty
- Track real-world date and in-game day

**Multiple Projects:**
- "New Project" button always available
- Work on multiple projects simultaneously
- Resume any project from list
- Progress bars show completion`
      },
      {
        title: 'Materials & Quality',
        content: `Materials and quality determine final item properties.

**Material Properties:**
- HT (Heat Tolerance): Average of selected materials
- Weight Modifier: Affects final weight
- HP Modifier: Affects final HP
- Multiple materials can be combined

**Quality Levels:**
1. Cheap: -1 HT
2. Good: +0 HT (default)
3. Fine: +1 HT
4. Very Fine: +2 HT
5. Legendary: +3 HT

**Final Calculations:**
- Weight = base × (1 + avg weight mod%) × material amounts
- HP = base × (1 + avg HP mod%)
- HT = avg material HT + quality HT bonus
- Difficulty = sum of quality modifiers

**Saved Designs:**
- Skip design phase entirely
- Start directly at craft phase
- Reuse successful designs
- Materials consumed immediately on craft start`
      },
      {
        title: 'Templates & Customization',
        content: `Create and manage item templates.

**Built-in Templates:**
- Weapons: damage, reach, parry, ST, cost
- Ranged: damage, Acc, range, RoF, shots, ST, bulk, RCl, LC
- Armor: location, DR, cost, LC
- Explosives: damage, fuse, cost, LC

**Custom Templates (Manager Tab):**
- Create new templates for each type
- Define base weight and HP
- Set material requirements (type and amount)
- Templates available across all projects

**Material Requirements:**
- Each template specifies required material types
- Amounts determine how much of each type needed
- Must have sufficient materials to start project`
      }
    ]
  },
  {
    id: 'alchemy',
    title: 'Alchemy System',
    icon: '⚗️',
    subsections: [
      {
        title: 'Reagents & Analysis',
        content: `Identify and work with alchemical reagents.

**Reagent Properties:**
- Aspects: Primary, Secondary, Tertiary (18 types)
- Base Potency: P0 to P4
- Hazards: Corrosive, Toxic, Addictive, Hallucinogenic, etc.
- Quantity: Measured in units (U)

**Identification Levels:**
0. Unidentified: No information
1. Partial: Primary aspect only
2. Basic: Primary + Secondary aspects
3. Complete Aspects: All three aspects
4. Full Profile: Aspects + Potency + Hazards

**Analysis Process:**
1. Select reagent (requires 1U)
2. Choose worker (auto-fills alchemy skill)
3. Select lab (provides rating bonus 0-4)
4. Roll 3d6 against effective skill
5. Identification level increases based on Margin of Success

**Analysis Results:**
- MoS 0-1: Level 1 (partial)
- MoS 2-3: Level 2 (basic)
- MoS 4-5: Level 3 (complete aspects)
- MoS 6+: Level 4 (full profile)
- Crit Success: Full profile immediately
- Crit Fail: False profile recorded (must correct in Manager)

**Sister Reagents:**
- Derived reagents share identityId with source
- Analysis of one updates all sisters
- Identification level syncs across all variants
- Quantities remain separate`
      },
      {
        title: 'Formulas & Batches',
        content: `Create alchemical formulas and brew batches.

**Formula Creation:**
- Select 2-5 reagent ingredients
- Assign roles: Active, Passive, Catalyzer, Stabilizer
- Calculate Work Required (WR)
- Determine dominant aspect
- Set tier (1-5) and vector (potion, salve, powder, etc.)

**Batch Brewing:**
- Select formula and amount
- Choose worker and lab
- Work in blocks (unit-by-unit with cumulative penalty)
- Each unit gets separate roll: -1, -2, -3, etc.
- Progress tracked as PP (Progress Points) / WR
- Risk system: failures add to risk pool

**Work Block Processing:**
- Roll 3d6 + penalty against alchemy skill + lab bonus
- Success: Add progress (typically 1 PP per unit)
- Failure: Add to risk, progress still added but reduced
- Critical results: Major effects on batch
- Can abort batch at any time

**Batch Completion:**
- Finalize when PP ≥ WR
- Risk resolution if any accumulated
- Final potency determined
- Effects calculated based on aspects and tier

**Progress Bars:**
- Visual indicator of PP/WR ratio
- Shows completion percentage
- Blue bar fills as work progresses`
      },
      {
        title: 'Concentration & Refinement',
        content: `Advanced reagent processing for enhanced potency.

**Concentration:**
- 2 units → 1 unit of higher potency
- Cost: 2U of same reagent
- Potency progression: P0→P1→P2→P3→P4
- Risk of failure based on Alchemy roll
- Creates derived reagent sharing identityId

**Refinement:**
- Remove hazards from reagents
- Cost: 1U per refinement attempt
- Difficulty based on hazard severity
- May require multiple attempts
- Creates refined variant with same aspects

**Processing History:**
- All concentration/refinement attempts logged
- Worker, lab, roll, and result recorded
- Success/failure tracking
- Material costs tracked

**Version 2.4.0 Features:**
- Unit-by-unit processing with visual feedback
- Cumulative batch penalty (-1 per unit)
- Individual dice rolls per unit
- Color-coded progress indicators
- Abort batch functionality
- Real-time risk calculation`
      }
    ]
  },
  {
    id: 'manager',
    title: 'Manager Tab',
    icon: '⚙️',
    subsections: [
      {
        title: 'GM Mode & Security',
        content: `Secure management of game data and rules.

**GM Mode:**
- Password protected
- Required for editing sensitive data
- Lock/unlock via toggle
- Password encrypted for GM Lock feature

**GM Lock (Import/Export):**
- Encrypt specific data fields
- Prevents players from viewing hidden info
- Set GM password for encryption
- Locked data appears as [GM LOCKED] to players
- Only GM can unlock and view/edit

**GM Mode Protected Features:**
- Material and food type editing
- Skills table editing
- Certain template modifications
- Critical game balance data`
      },
      {
        title: 'Workers, Labs & Kitchens',
        content: `Manage workers and facilities.

**Workers:**
- Name and four skill levels
- Cooking: For recipes
- Designing: For craft design phase
- Crafting: For craft build phase
- Alchemy: For potions and reagent analysis
- Skills default to 10

**Alchemy Labs:**
- Name, rating (0-4), description
- Rating provides bonus to alchemy skill
- Used for reagent analysis and batch brewing
- Multiple labs can be created

**Kitchens:**
- Name, rating (0-4), description
- Rating provides bonus to cooking skill
- Used for recipe creation and remaking
- Multiple kitchens can be created
- Works identically to labs but for cooking

**Skills Table (GM Locked):**
- Define available GURPS skills
- Used for random skill selection
- Any skill can be added
- Used in recipe granted skills system`
      },
      {
        title: 'Types & Templates',
        content: `Define material/food types and item templates.

**Material Types:**
- Name and color
- HT (Heat Tolerance): Default 10
- Weight Modifier: Percentage change
- HP Modifier: Percentage change
- Used in crafting calculations
- Cannot be renamed if in use

**Food Types:**
- Name and color
- Used in cooking system
- Determines substitution penalties
- Multiple types per food item

**Custom Templates:**
- Weapons, Ranged, Armor, Explosives
- Define all item properties
- Set material requirements
- Base weight and HP
- Available in crafting system

**Import/Export:**
- Export entire game state
- Import saved data
- GM Lock support for sensitive data
- Includes all systems: inventory, recipes, projects, batches, workers, etc.`
      }
    ]
  },
  {
    id: 'gathering',
    title: 'Gathering System',
    icon: '🎣',
    subsections: [
      {
        title: 'Overview',
        content: `The General Gathering System allows characters to gather resources from the environment.

**Available Modes:**
- Fishing: Catch fish using Line, Net, or Spear methods
- Foraging: Search for plants, fungi, and other forageable items
- Mining, Logging: (Coming soon)

**Shared Workflow:**
1. Select Mode and Environment
2. Choose Leader and Helpers (if any)
3. Configure mode-specific settings (method, target, etc.)
4. Select Tools and Consumables
5. Roll for Daily Event (once per day per group)
6. Roll for Skill Success
7. Roll on Appropriate Table (Catch/Find)
8. Handle Special Mechanics (struggle, hazards)
9. Calculate Yields
10. Commit to Inventory

**Day Planner Integration:**
- Tasks are created via Day Planner tab
- Manual dice rolling with colored 3d6 display
- Event rolls are separate from skill rolls
- Results are committed at end of day`
      },
      {
        title: 'Fishing Methods',
        content: `Three methods are available for fishing:

**Line Fishing:**
- Can target specific species or use random catch
- Uses Fishing skill
- Allows bait bonuses on catch table roll
- Large fish require struggle (Quick Contest ST vs ST)

**Net Fishing:**
- Random catch only, cannot target specific species
- Large fish are automatically rerolled (max 20 attempts)
- Catches fish regardless of size via reroll
- More reliable for smaller catches

**Spear Fishing:**
- Can target specific species
- Uses Spear skill instead of Fishing
- Stealth bonus applies
- Best for targeting specific large fish
- Large fish still require struggle`
      },
      {
        title: 'Skill Resolution',
        content: `Fishing uses standard GURPS skill resolution:

**Effective Skill Calculation:**
- Base: Worker's Fishing/Spear skill
- Tool Bonus: From selected equipment
- Bait Bonus: +1 for correct bait (attracts target species)
- Bait Penalty: -2 for inappropriate bait
- Large Fish Penalty: -2 when targeting large fish specifically
- Environment Modifier: Location-specific adjustment
- Retry Penalty: -1 cumulative per retry (max 3)

**Success Rolls (3d6):**
- Critical Success: 3-4 (extra fish)
- Success: Roll ≤ Effective Skill
- Failure: Roll > Effective Skill
- Critical Failure: 17-18 (lose bait, possible equipment damage)

**Fish Caught:**
- Line: 1 fish on success, 2 on critical
- Net: 1d fish on success, 1d+1 on critical
- Spear: 1 fish on success, 2 on critical`
      },
      {
        title: 'Daily Events',
        content: `Once per day per group, a dynamic event may occur:

**Event Roll (3d6):**
- 3-6: Rare Event (dangerous/valuable)
- 7-10: Mild Event (minor complication)
- 11-18: No Event (normal gathering)

**Group Key:**
- Events are tracked per unique group composition
- Same leader + helpers = same group
- Change party members = new group key
- Only one event roll per group per day

**Event Tables:**
- Each environment can define:
  - Rare Event Table
  - Mild Event Table
- Events are rolled on environment-specific tables
- Handle events before proceeding to fishing`
      },
      {
        title: 'Large Fish Struggle',
        content: `When catching large fish via Line or Spear, a struggle ensues:

**Quick Contest:**
- Character rolls 3d6 vs their ST
- Fish automatically rolls 3d6 vs its ST
- Winner = higher margin of success
- Tie goes to higher ST (char wins if equal)

**Fish ST:**
- Defined per species (default range 12-18)
- Default ST is 14 if not specified
- Higher ST = harder to land

**Results:**
- Character wins: Fish is landed, proceed to yields
- Fish wins: Fish escapes, no yield
- Net fishing skips struggle (rerolls large fish instead)`
      },
      {
        title: 'Yields & Inventory',
        content: `Successful catches produce yields:

**Yield Calculation:**
- Meat: Roll species' meat yield formula (e.g., 2d6+1)
- Secondary: Roll species' secondary formula if defined

**Inventory Naming:**
- Food items: "[Species Name] [Food Type]" (e.g., "Trout Fish")
- Materials: Uses secondary name override if set
- Default: "[Species Name] [Material Type]" (e.g., "Salmon Scales")

**Food Types:**
- Pull from existing food types in Manager
- Determines recipe compatibility
- Examples: fish, shellfish, etc.

**Secondary Materials:**
- Optional per species
- Examples: scales, bones, shells, oil, roe
- Stored in Materials inventory`
      },
      {
        title: 'Foraging System',
        content: `Search for plants, fungi, and other forageable resources:

**Foraging Skills:**
- Survival: General wilderness foraging
- Naturalist: Scientific plant knowledge
- Herb Lore: Medicinal and special plants

**Targeting:**
- Random: Roll on environment's find table
- Targeted: Search for specific item with rarity penalty
- Rarity Penalties: Common (0), Uncommon (-2), Rare (-4), Very Rare (-6), Legendary (-8)

**Context Modifiers:**
- Map/Local Guide: +1 (familiar with area)
- Unfamiliar/Hostile Region: -2 (unknown terrain)
- Peak Season: +2 (best harvest time)

**Success Resolution:**
- Critical Success: 1.5x yield multiplier, bonus find
- Success: 1.0x yield multiplier
- Failure (targeted): Falls back to random table
- Critical Failure: 0.5x yield multiplier + random hazard

**Hazards on Critical Failure:**
- Poison Ivy, Bee Sting, Twisted Ankle
- Thorn Scrape, Mild Allergic Reaction
- Encountered Predator, Lost Item`
      },
      {
        title: 'Foraging Items & Yields',
        content: `Forageable items are defined with direct properties:

**Item Properties:**
- Name: Unique identifier (e.g., "Tamrya Berries")
- Inventory Kind: food or material
- Type ID: References food/material types from Manager
- Yield Formula: Dice formula (e.g., "3d", "2d6+1")
- Rarity: Common/Uncommon/Rare/Very Rare/Legendary
- Description: Flavor text

**Tool Yield Bonuses:**
- Tools can grant +Xd to specific types
- Example: Berry Basket grants +1d to "berries" type
- Bonuses apply before multipliers
- Multiple tools stack

**Yield Calculation:**
1. Roll base yield formula (e.g., 3d6)
2. Apply tool bonuses (+1d, +2d, etc.)
3. Apply outcome multiplier (0.5x, 1.0x, 1.5x)
4. Round down to final units
5. Minimum 1 unit on successful finds

**Example:**
- Apples (food, "fruit" type, yield: 3d)
- Success roll: 3d = 11
- Berry Basket: +0d (doesn't apply to fruit)
- Multiplier: 1.0x (success)
- Final: 11 units`
      },
      {
        title: 'Manager: Forageable Items',
        content: `Define forageable items in the Items section:

**Item Creation:**
- Name: What the item is called
- Yield Formula: Base dice (1d, 2d, 3d+1, etc.)
- Inventory Type: food or material
- Type ID: Select from your food/material types
- Rarity: Determines targeting penalty
- Description: Optional notes

**Type Management:**
- Food/Material types managed in Manager tab
- Items pull from your custom type lists
- Tools can target specific types for bonuses
- Types determine inventory categorization

**Table Integration:**
- Find tables can reference items directly
- No category layer needed
- Select "Item" as result type in tables
- Choose specific item from dropdown`
      },
      {
        title: 'Manager: Species',
        content: `Define gatherable species (fish, shellfish, etc.):

**Properties:**
- Name: Unique identifier
- Type: fish, shellfish, crustacean
- Tags: LargeFish, DeepWater, Coastal, etc.
- Food Type: What type of food it produces
- Meat Formula: Dice formula for meat yield
- Secondary Material: Optional extra resource
- Secondary Formula: Dice for secondary yield
- Secondary Name Override: Custom name for material
- ST: Strength for struggle (large fish only, 12-18)

**Example:**
- Name: Giant Salmon
- Type: fish
- Tags: LargeFish
- Food Type: fish
- Meat Formula: 3d+2
- Secondary: scales
- Secondary Formula: 1d
- ST: 16`
      },
      {
        title: 'Manager: Tools, Tables & Environments',
        content: `Configure gathering equipment and locations:

**Tools:**
- Name, Type (fishing_rod, net, spear, etc.)
- Allowed Modes and Methods
- Skill Bonus: Added to fishing roll
- Durability: (tracking planned, not active)
- Notes: Special properties

**Tables:**
- Roll Method: 1d6, 2d6, or 3d6
- Entries must match roll outcomes exactly
- Entry types: species, nothing, event, special
- Each entry maps roll value to result

**Environments:**
- Name and Supported Modes
- Catch Table, Mild Event Table, Rare Event Table
- Skill Modifier: Location difficulty
- Must have at least one table assigned

**Bait:**
- Must attract at least one species
- Roll Bonus: Added to catch table roll (Line only)
- Tags for special properties
- Quantity tracking for consumption`
      }
    ]
  }
];
