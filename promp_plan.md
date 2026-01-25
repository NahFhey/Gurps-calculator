🏗️ The Blueprint: GURPS Party Tool Architecture
1. Data & State Layer
Normalized State: Use a centralized store (Redux, Pinia, or a simple Reactive Object) where Characters, Tools, and Facilities are indexed by ID.

The "Registry": A read-only (for players) set of Tool Templates and Facility Definitions.

2. The Logic Engines
The Reservation Engine: A middleman service that tracks which toolInstanceId is currently "soft-locked" by an active UI session.

The Modifier Calculator: A pure function that takes a Worker, Helpers, Tools, and a Facility to output a final ModifierBundle.

The Validation Pipeline: A series of "Guard" functions that return success: boolean and reasons: string[].

3. The Lifecycle
Setup: Load data -> Filter Character Library for "Player" type.

Configuration: User selects Primary -> User selects Helpers -> System calculates available tools from combined inventories.

Execution: Validate -> Deduct Consumables -> Log Result -> Advance Time (Cleanup).

🚀 Iterative Breakdown
Phase 1: The Skeleton (Data Models)
Step 1.1: Define TypeScript interfaces for Characters, Items, Tools, and Inventories.

Step 1.2: Implement the base State object with mock data to ensure the structure holds.

Phase 2: Inventory & Tool Management
Step 2.1: Build the Transfer logic (moving items/currency between inventories).

Step 2.2: Build the ToolInstance factory (creating an instance from a template).

Phase 3: The Reservation Engine (Critical Path)
Step 3.1: Create a ReservationStore to track tool IDs used in current activities.

Step 3.2: Implement "Invalidation" logic (if a tool is deleted or its condition changes, the reservation breaks).

Phase 4: Activity & Math Logic
Step 4.1: The Modifier Aggregator. Logic to stack Facility + Primary Tool + Helper Tools.

Step 4.2: The Validation Engine. The checklist that blocks "Resolve" if conditions aren't met.

Phase 5: Logging & Time
Step 5.1: Currency and Activity loggers.

Step 5.2: The TimeAdvancement function to clear reservations.

🤖 LLM Implementation Prompts
The following prompts are designed to be fed to an LLM sequentially. Each prompt assumes the previous code has been implemented.

Prompt 1: Core Data Models & Types
Target: Define the foundational TypeScript interfaces.

Plaintext

Act as a senior TypeScript developer. Based on the GURPS Party Tool spec, create a set of interfaces and types. 

1. Define 'Character' with 'work' settings (enabled: boolean, skills: Record<string, number>).
2. Define 'Inventory' which can be owned by 'party' or 'character', containing items, tools, and currency.
3. Define 'ToolTemplate' (the static definition) and 'ToolInstance' (the unique item with a persistent ID and conditionId).
4. Define 'Facility' with the same modifier schema as Tools.
5. Create a 'GlobalState' interface that holds collections of these entities.

Ensure all IDs are strings. Export these types for use in a central state management file.
Prompt 2: Inventory Logic & Currency Transfers
Target: Implementation of the movement rules.

Plaintext

Using the types created in Prompt 1, implement an 'InventoryManager' class or set of functions.

1. Implement 'transferItem(sourceInvId, targetInvId, itemInstanceId)'.
2. Implement 'transferCurrency(sourceInvId, targetInvId, currencyKey, amount)'.
3. Rules: 
   - Transfers must be logged (create a basic 'CurrencyLog' entry).
   - Transfers are final and not undoable.
   - Currency cannot go below zero.
4. Write a unit test suite (using Vitest or Jest) to verify that moving a tool from a Character to the Party inventory preserves the tool's unique ID and condition.
Prompt 3: The Tool Reservation Engine
Target: Building the system that prevents double-dipping tools.

Plaintext

Implement a 'ReservationEngine' to manage tool usage during activities.

1. Create a state object 'activeReservations' which maps 'activitySessionId' to an array of 'toolInstanceIds'.
2. Implement 'reserveTool(sessionId, toolId)': This should fail if the tool is already reserved by another session.
3. Implement 'validateReservations(sessionId)': This checks if all toolIds in a session still exist in the inventories and are not in a 'Broken' condition.
4. Implement 'clearAllReservations()': This will be used for Time Slot advancement.
5. Integrate with the previous InventoryManager: If a tool is transferred, trigger a check that invalidates any reservation involving that toolId.
Prompt 4: Modifier Aggregator & Skill Logic
Target: The math of GURPS activity resolution.

Plaintext

Implement the 'ActivityCalculator'. This is a pure function that calculates the total bonuses for an activity.

1. Input: (PrimaryWorker, Helpers[], ToolsUsed[], Facility).
2. Logic:
   - Aggregate 'skillBonus', 'yieldFlat', 'yieldPercent', 'timeBonus', 'riskModifier', and 'qualityModifier'.
   - Rules: Yield can be flat OR percent. If both are present from different sources, prioritize flat then apply percent (or as per GURPS stacking rules).
   - Facility + Tools must fully stack.
   - Each worker (primary or helper) can only contribute ONE tool.
3. Include a 'checkBrokenStatus' function: If any selected tool or facility has a conditionId labeled 'Broken', return a 'hardStop' flag and a specific error message: "How are you going to perform this activity with a broken tool?"
Prompt 5: Validation Pipeline & Resolution
Target: The pre-flight checklist and execution.

Plaintext

Create an 'ActivityResolver' that handles the final step of an activity.

1. Implement 'preResolutionCheck(activityConfig)': This returns a list of warnings or blocking errors (e.g., "Worker lacks skill", "Tool reserved elsewhere", "Consumables missing").
2. Implement 'resolveActivity(activityConfig, isGMOverride)':
   - If !isGMOverride, run validation. If it fails, block execution.
   - If isGMOverride is true, execute anyway but add 'gmOverrideUsed: true' to the log.
   - Deduct consumables from the relevant inventory.
   - Generate an 'ActivityLogEntry' containing: primaryWorkerId, helperIds, tool names, total modifiers, and outcome.
3. Ensure no partial-unit math is performed.
Prompt 6: Time System & Wiring
Target: Connecting the UI state and the "End Turn" logic.

Plaintext

Create the 'TimeSystem' and wire the final pieces together.

1. Implement 'advanceTimeSlot()':
   - Call 'clearAllReservations()' from the ReservationEngine.
   - Clear all current UI 'Equipment Selections'.
   - Log the time transition.
2. Create a 'SystemInitialization' function that:
   - Sets up a 'Basic +0 Tool' available to everyone that doesn't require a specific instance.
   - Validates that only characters marked as 'Player' can be assigned as workers.
3. Provide a brief example of how a 'Cooking' module would call these services to resolve an activity.
