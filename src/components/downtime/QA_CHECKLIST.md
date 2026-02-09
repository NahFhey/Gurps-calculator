# Downtime System QA Checklist

Manual QA testing checklist for the Downtime System. Run through this list before releases to ensure all functionality works correctly.

## Navigation

- [ ] Downtime appears in navigation rail/sidebar
- [ ] Clicking Downtime opens the Downtime Panel
- [ ] Back button returns to previous view

## Tile Grid

- [ ] All four activity tiles display (Fishing, Foraging, Alchemy, Crafting)
- [ ] Each tile shows correct icon
- [ ] Hovering tiles shows hover state
- [ ] Clicking tile opens correct activity view
- [ ] Activity view shows back button to return to tiles

## Character Selection

### Leader Selection
- [ ] Dropdown shows all party characters
- [ ] Already assigned characters show "(Activity Name)" suffix
- [ ] Already assigned characters are disabled
- [ ] Selecting assigned character shows error
- [ ] Character fatigue status displays correctly
- [ ] Tired characters show yellow warning badge
- [ ] Exhausted characters show red warning badge

### Helper Selection
- [ ] Multi-select shows available characters
- [ ] Leader is excluded from helper list
- [ ] Already assigned characters are disabled
- [ ] Selected helpers show checkmark
- [ ] Helper fatigue status displays

## Tool Selection

- [ ] Tool list shows all applicable tools
- [ ] Reserved tools show "In use" badge
- [ ] Reserved tools are disabled
- [ ] Selecting reserved tool shows error
- [ ] Selected tools show checkmark
- [ ] Tool condition displays (if applicable)

## Task Creation

### Fishing
- [ ] Species dropdown populates
- [ ] Spot dropdown populates
- [ ] Tool selection works
- [ ] Skill modifier input accepts numbers
- [ ] Target yield input works
- [ ] Submit creates pending task
- [ ] Validation errors display inline

### Foraging
- [ ] Biome dropdown populates
- [ ] Node dropdown populates
- [ ] Loot table selection works
- [ ] Tool selection works
- [ ] Submit creates pending task

### Alchemy
- [ ] Recipe dropdown populates
- [ ] Formula selection works
- [ ] Reagent selection shows inventory
- [ ] Batch size input works
- [ ] Lab equipment selection works
- [ ] Submit creates pending task

### Crafting
- [ ] Recipe dropdown populates
- [ ] Material selection from inventory
- [ ] Quality target selection works
- [ ] Tool selection works
- [ ] Submit creates pending task

## Task Cards

### Display
- [ ] Task card shows activity type icon
- [ ] Leader name displays correctly
- [ ] Helper names display (if any)
- [ ] Activity-specific details show
- [ ] Status badge shows correct state
- [ ] Border color matches status

### Pending Tasks
- [ ] Resolve button is visible
- [ ] Cancel button is visible
- [ ] Clicking Resolve starts resolution
- [ ] Clicking Cancel shows confirmation

### In Progress Tasks
- [ ] Status shows "In Progress"
- [ ] Resolve button shows "Resolving..."
- [ ] Buttons are disabled during resolution

### Resolved Tasks
- [ ] Status shows "Resolved"
- [ ] Results section displays
- [ ] Success shows green background
- [ ] Failure shows gray background
- [ ] Inventory changes list correctly
- [ ] XP gained displays
- [ ] Action buttons are hidden

### Cancelled Tasks
- [ ] Status shows "Cancelled"
- [ ] Cancelled message displays
- [ ] Task remains visible in list
- [ ] Action buttons are hidden

## Validation Enforcement

### Single Assignment
- [ ] Cannot assign same character as leader twice in slot
- [ ] Cannot assign helper who is already leader
- [ ] Cannot assign leader who is already helper
- [ ] Clear error message on assignment conflict

### Lock-on-Create
- [ ] Cannot recreate cancelled task with same target
- [ ] Can create task with different target after cancel
- [ ] Clear error message on lock conflict

### Tool Exclusivity
- [ ] Cannot use tool reserved by another task
- [ ] Cancelled task frees its tools
- [ ] Resolved task frees its tools
- [ ] Clear error message on tool conflict

## Time Advancement

- [ ] Blocking indicator shows when tasks pending
- [ ] Blocking indicator lists task count
- [ ] "Jump to tasks" link scrolls to pending
- [ ] Can advance when all tasks resolved/cancelled
- [ ] Empty slot allows advancement

## Fatigue Tracking

- [ ] Working once shows "Tired" status
- [ ] Working while tired shows "Exhausted"
- [ ] Resting clears fatigue
- [ ] Not working (implicit rest) clears fatigue
- [ ] Fatigue persists across slots within day
- [ ] Fatigue resets on new day

## Party Sidebar Integration

- [ ] Assigned characters show activity badge
- [ ] Badge tooltip shows activity name
- [ ] Tired characters show warning icon
- [ ] Exhausted characters show danger icon
- [ ] Clicking badge navigates to task

## Save/Load

- [ ] Downtime state saves with campaign
- [ ] Saved state loads correctly
- [ ] Old format migrates successfully
- [ ] Task history preserved after reload
- [ ] Pending tasks remain pending after reload

## Edge Cases

- [ ] Empty party handles gracefully
- [ ] No available characters shows message
- [ ] No available tools shows message
- [ ] Very long task lists scroll
- [ ] Multiple tasks resolve in sequence
- [ ] Rapid clicks don't create duplicates

## Accessibility

- [ ] Tab navigation works through all elements
- [ ] Enter/Space activates buttons
- [ ] Focus indicators visible
- [ ] Screen reader announces status changes
- [ ] Color is not only status indicator

## Browser Compatibility

- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Works on mobile viewport

---

## Sign-off

| Tester | Date | Version | Pass/Fail | Notes |
|--------|------|---------|-----------|-------|
|        |      |         |           |       |
|        |      |         |           |       |

## Known Issues

Document any known issues found during QA:

1.
2.
3.
