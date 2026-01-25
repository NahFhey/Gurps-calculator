📋 GURPS Party Tool Implementation Checklist
Phase 1: Foundation & Data Modeling
[ ] 1.1 Define Core Types & Interfaces

[ ] Character (with work skill object)

[ ] Inventory (Character vs. Party types)

[ ] ToolTemplate (Static modifiers)

[ ] ToolInstance (Unique IDs, condition links)

[ ] Facility (Modifier schema)

[ ] GlobalState (The "Single Source of Truth" structure)

[ ] 1.2 Mock Data Injection

[ ] Create a set of "Player" characters vs "NPC" characters for testing filters.

[ ] Create a library of Tool Templates (e.g., "Basic Shovel", "High-Tech Lab").

Phase 2: Inventory & Currency Logic
[ ] 2.1 Core Transfer Functions

[ ] Implement transferItem() logic.

[ ] Implement transferCurrency() logic.

[ ] Guard: Prevent negative currency balances.

[ ] 2.2 Currency Logging

[ ] Create CurrencyLog schema.

[ ] Hook transfer functions to auto-generate non-undoable logs.

[ ] 2.3 Tool Persistence

[ ] Verify ToolInstance properties (notes/condition) persist across transfers.

Phase 3: The Tool Reservation Engine
[ ] 3.1 Reservation Store

[ ] Create a tracker for reservedToolIds mapped to active activity sessions.

[ ] 3.2 Reservation Lifecycle

[ ] Implement reserveTool() (checks for double-dipping).

[ ] Implement invalidateReservation() (triggers if tool is moved or deleted).

[ ] 3.3 Condition Monitoring

[ ] Link ToolCondition labels to the reservation engine.

[ ] Guard: If a tool condition changes to "Broken," invalidate its current reservation.

Phase 4: Activity Math & Aggregation
[ ] 4.1 Modifier Aggregator

[ ] Logic to sum skillBonus, timeBonus, riskModifier, qualityModifier.

[ ] Rule: Implement "Yield Flat OR Yield Percent" logic (Exclusive).

[ ] Rule: Stack Facility modifiers with Tool modifiers.

[ ] 4.2 Worker Constraints

[ ] Filter logic: Only "Player" characters with required skill.

[ ] Logic: Limit one tool per worker (Primary and Helpers).

[ ] 4.3 Broken Item Hard-Stop

[ ] Create the "Hard Stop" flag for UI messages when broken tools/facilities are selected.

Phase 5: Validation & Resolution Pipeline
[ ] 5.1 Pre-Resolution Checklist

[ ] Function to return all errors/warnings (missing skill, missing consumables, reserved tools).

[ ] 5.2 Activity Resolution

[ ] Implement resolveActivity() function.

[ ] Logic: Deduct consumables from inventory on execution.

[ ] Implement GM Override bypass logic.

[ ] 5.3 Activity Logging

[ ] Create activityLogEntry generator (captures names of tools, workers, and totals).

Phase 6: Time & Cleanup
[ ] 6.1 Time Advancement

[ ] Implement advanceTimeSlot().

[ ] Logic: Clear all reservedToolIds.

[ ] Logic: Reset UI "Equipment Selection" states.

[ ] 6.2 State Persistence

[ ] Ensure reservations and logs survive a page refresh/local storage save.

Phase 7: UI Implementation (Frontend Integration)
[ ] 7.1 Character & Helper Selection

[ ] View: List eligible workers.

[ ] Event: Removing a helper automatically unreserves their specific tool.

[ ] 7.2 Equipment UI

[ ] View: Shared tool pool (Primary + Helpers).

[ ] View: Facility dropdown with "Implicit Basic +0" default.

[ ] 7.3 The Resolution Console

[ ] Display inline errors for the validation checklist.

[ ] Display "Resolve" button (disabled if invalid, unless GM Override toggled).

🧪 Testing Benchmarks (Definition of Done)
[ ] Unit Test: transferItem does not change the toolInstanceId.

[ ] Unit Test: Adding a second tool to the same worker throws an error.

[ ] Integration Test: Advancing time clears the "Reserved" status on all tools.

[ ] Integration Test: Resolving an activity with a GM Override still records consumed materials.

[ ] UI Test: Selecting a "Broken" tool displays the specific "How are you going to..." message.
