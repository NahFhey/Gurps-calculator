GURPS Party Tool
Character-Centric Activity, Inventory, Tool, and Facility System

Developer Specification (v1.0)

1. Design Goals & Principles
Core Goals

Make Characters the single source of truth (combatants, workers, inventories).

Replace abstract “workers” with player characters only.

Support activity resolution driven by skills + tools + facilities, without hard-blocking play.

Preserve player agency: no hidden automation, no silent bonuses.

Ensure auditability: logs explain what happened, not how to optimize.

Keep the system permissive but strict: validate early, block only when explicitly required.

Non-Goals

No automation of tactical decisions.

No forced realism (activities always allow Basic +0).

No partial-unit math (no fractional costs).

2. High-Level Architecture
Core Domains
Character Library (authoritative)
 ├─ Stats / Skills
 ├─ Work Skills (opt-in)
 ├─ Personal Inventory
 └─ Currency

Inventory System (unified)
 ├─ Party Inventory
 ├─ Character Inventories
 └─ Tool Instances (persistent IDs)

Activity System (implicit modules)
 ├─ Gathering
 ├─ Crafting
 ├─ Cooking
 ├─ Alchemy
 └─ (future modules)

Tool & Facility System
 ├─ Tool Templates
 ├─ Tool Instances
 ├─ Facility Definitions
 └─ Global Tool Conditions

Logging & Time
 ├─ Activity Log
 ├─ Currency Log
 └─ Time Slot Advancement

3. Character System
Character Eligibility

Only Characters marked as Player may:

Act as primary workers

Act as helpers

Allies, Enemies, Objects are excluded from activities.

Work Skills
character.work = {
  enabled: boolean,
  skills: {
    [skillKey: string]: number
  }
}


Rules:

A character is eligible only if the skill exists.

No default skills are auto-created.

Helpers must also have the skill.

4. Inventory System
Inventories

Every character has a personal inventory.

There is a Party inventory.

Inventories are first-class objects.

inventory = {
  id: string,
  ownerType: "party" | "character",
  ownerId: string | null,
  currency: { [currencyKey: string]: number },
  items: ItemInstance[],
  tools: ToolInstance[],
  materials: MaterialEntry[],
  food: FoodEntry[]
}

Currency

Multiple GM-defined currencies

Transfers use a guided UI

Transfers are:

Logged

Final once committed

Not undoable

5. Tool System
Tool Templates

Defined in Templates tab.

toolTemplate = {
  templateId: string,
  name: string,
  activityCategories: {
    [categoryKey: string]: {
      skillBonus?: number,
      yieldFlat?: number,
      yieldPercent?: number,
      timeBonus?: number,
      riskModifier?: number,
      qualityModifier?: number
    }
  }
}


Rules:

One modifier set per category

Modifiers are static

Negative values allowed

Yield may be flat OR percent (never both)

Tool Instances

Tools are distinct instances, not stacks.

toolInstance = {
  toolId: string, // persistent unique ID
  templateId: string,
  conditionId: string,
  notes?: string
}


Condition and notes persist across transfers.

Tool ID persists across logs, reservations, inventories.

6. Tool Conditions (Global)

Managed in Manager Tab (GM-only).

toolCondition = {
  id: string,
  label: string,
  effectText?: string
}


Rules:

Conditions are labels only

No automatic math

“Broken” is just another label

Selecting a broken tool:

Hard-stops the activity

Shows message:

“How are you going to perform this activity with a broken tool?”

Players may edit conditions on tools they own.

7. Facility System

Facilities (Kitchens, Labs):

Use the exact same modifier schema as tools

Have conditions

Only one facility per activity

Facility + tools fully stack

Facility selection:

Defaults to implicit Basic +0

Broken facility hard-stops activity (mirror tools)

Facilities are logged separately from tools.

8. Activity System
Activity Characteristics

Activities are implicit (defined by UI modules).

Each activity module declares:

Required skill

Accepted modifier types

Activity category tag (e.g. "cooking")

Helper Rules

No hard cap on helpers

Helpers must:

Be Players

Have the skill

Each helper:

May contribute zero or one tool

Defaults to Basic +0 tool

Helpers must be selected before equipment

Removing a helper:

Automatically removes their tool

Silent recalculation

9. Equipment Selection
Equipment Rules

Explicit “Basic +0 Tool” entry

Only one tool per worker

Tools pulled from:

Primary + helper inventories (shared pool)

Same tool cannot be selected twice

Tools are reserved by tool ID

Reservation Rules

Reservation persists across save/load

Reservation clears:

On time slot advance (all at once)

Reserved tools:

Invisible elsewhere (silent)

If a reserved tool:

Changes condition

Is transferred

Is deleted
→ Reservation invalidates immediately and forces reselection

Deletion of reserved tools is blocked.

10. Validation System
Pre-Resolution Checklist (Blocking Only)

Displayed before Resolve.

Validated:

Skill availability

Tools (not broken, not reserved elsewhere)

Facility (if selected)

Consumables availability

Failures:

Highlighted inline

Specific reasons shown

Tool/facility warnings via tooltip

Resolution

Executes immediately if valid

No confirmation step

11. GM Override

GM may bypass all validations

Override is:

Explicitly logged

Still applies all modifiers and consumptions

Used overrides are visible in logs

12. Activity Resolution Rules

Modifiers apply regardless of success/failure

Crit thresholds are skill-only

All modifiers:

Aggregated first

Applied once

Consumables:

Deducted on activity resolution

Resolution blocked if unavailable

13. Logging
Activity Log Stores
activityLogEntry = {
  activityType: string,
  primaryWorker: characterId,
  helpers: characterId[],
  toolsUsed: string[],        // names only
  facilityUsed?: string,
  modifierTotals: {
    skill?: number,
    yield?: number,
    time?: number,
    risk?: number,
    quality?: number
  },
  gmOverrideUsed: boolean,
  outcome: string
}

Currency Log

Logs transfers only

Final, non-undoable

14. Time System

Time advances in slots

On time advance:

All tool reservations cleared

All equipment selections cleared

Activities must be reconfigured next slot

15. Error Handling Strategy
Scenario	Behavior
Broken tool selected	Hard stop + message
Broken facility selected	Hard stop + message
Missing consumables	Pause activity
Reservation invalidated	Pause + force reselection
GM override	Log explicitly
Invalid modifier type	Tooltip warning

No silent failures. Ever.

16. Testing Plan
Unit Tests

Tool reservation lifecycle

Modifier aggregation math

Validation blocking rules

Condition changes invalidating reservations

Integration Tests

Multi-helper tool sharing

Facility + tool stacking

Inventory transfers preserving tool state

Save/load persistence of reservations

UI Tests

Pre-resolution checklist accuracy

Inline error highlighting

Tooltip warnings

Equipment reset on time advance

Regression Tests

Old saves load without workers tab

Activities resolve with Basic +0 only

GM override does not skip consumption

17. Implementation Order (Recommended)

Data model & migrations

Tool + condition system

Inventory refactor & transfers

Reservation engine

Activity validation layer

Logging

UI polish
