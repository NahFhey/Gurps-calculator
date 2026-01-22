import React, { useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { RevealMode, updateReveal } from '../../utils/combatReveal';

/**
 * Reveal Panel (Phase 5)
 *
 * GM-only controls for revealing combat information to players.
 * Allows granular control over what enemies/objects reveal.
 */
export default function RevealPanel({ combatActive, combatReveal, saveCombatReveal, viewMode }) {
  const [expandedCombatants, setExpandedCombatants] = useState({});

  if (!combatActive || !combatReveal) return null;

  // Filter to only show enemies (players/allies/objects are always fully revealed)
  const controllableCombatants = combatActive.participants.filter(
    p => p.side === 'enemy'
  );

  if (controllableCombatants.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-gray-400 text-center">
        No enemy combatants to reveal (all participants are players/allies/objects)
      </div>
    );
  }

  const toggleExpanded = (instanceId) => {
    setExpandedCombatants(prev => ({
      ...prev,
      [instanceId]: !prev[instanceId]
    }));
  };

  const handleRevealChange = (instanceId, field, value) => {
    const newReveal = updateReveal(combatReveal, instanceId, field, value);
    saveCombatReveal(newReveal);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Eye size={20} />
        Reveal Controls (GM Only)
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Control what information is visible to players. Changes apply immediately.
      </p>

      <div className="space-y-2">
        {controllableCombatants.map(participant => {
          const reveal = combatReveal.byInstanceId[participant.instanceId];
          const isExpanded = expandedCombatants[participant.instanceId];

          return (
            <div key={participant.instanceId} className="bg-gray-900 rounded-lg border border-gray-700">
              {/* Header */}
              <div
                className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-850"
                onClick={() => toggleExpanded(participant.instanceId)}
              >
                <div>
                  <h4 className="font-semibold">{participant.name}</h4>
                  <p className="text-xs text-gray-400">
                    {participant.side} • {getRevealSummary(reveal)}
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>

              {/* Expanded Controls */}
              {isExpanded && (
                <div className="p-3 border-t border-gray-700 space-y-3">
                  {/* Name Reveal */}
                  <RevealControl
                    label="Name"
                    value={reveal.name}
                    options={[
                      { value: RevealMode.NAME_HIDDEN, label: 'Hidden ("Unknown Foe")' },
                      { value: RevealMode.NAME_PARTIAL, label: 'Partial ("Unknown #1234")' },
                      { value: RevealMode.NAME_FULL, label: `Full ("${participant.name}")` }
                    ]}
                    onChange={(value) => handleRevealChange(participant.instanceId, 'name', value)}
                  />

                  {/* HP Reveal */}
                  <RevealControl
                    label="HP"
                    value={reveal.hp.mode}
                    options={[
                      { value: RevealMode.NUMERIC_UNKNOWN, label: 'Unknown' },
                      { value: RevealMode.NUMERIC_BAND, label: 'Band (Healthy/Wounded/Critical)' },
                      { value: RevealMode.NUMERIC_EXACT, label: 'Exact (12/15)' }
                    ]}
                    onChange={(value) => handleRevealChange(participant.instanceId, 'hp.mode', value)}
                  />

                  {/* Defense Reveals */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-300">Defenses</div>
                    <div className="grid grid-cols-3 gap-2">
                      <RevealControl
                        label="Dodge"
                        value={reveal.defenses.dodge}
                        options={[
                          { value: RevealMode.DEFENSE_UNKNOWN, label: 'Unknown' },
                          { value: RevealMode.DEFENSE_APPROX, label: 'Approx' },
                          { value: RevealMode.DEFENSE_EXACT, label: 'Exact' }
                        ]}
                        onChange={(value) => handleRevealChange(participant.instanceId, 'defenses.dodge', value)}
                        compact
                      />
                      <RevealControl
                        label="Parry"
                        value={reveal.defenses.parry}
                        options={[
                          { value: RevealMode.DEFENSE_UNKNOWN, label: 'Unknown' },
                          { value: RevealMode.DEFENSE_APPROX, label: 'Approx' },
                          { value: RevealMode.DEFENSE_EXACT, label: 'Exact' }
                        ]}
                        onChange={(value) => handleRevealChange(participant.instanceId, 'defenses.parry', value)}
                        compact
                      />
                      <RevealControl
                        label="Block"
                        value={reveal.defenses.block}
                        options={[
                          { value: RevealMode.DEFENSE_UNKNOWN, label: 'Unknown' },
                          { value: RevealMode.DEFENSE_APPROX, label: 'Approx' },
                          { value: RevealMode.DEFENSE_EXACT, label: 'Exact' }
                        ]}
                        onChange={(value) => handleRevealChange(participant.instanceId, 'defenses.block', value)}
                        compact
                      />
                    </div>
                  </div>

                  {/* DR General Reveal */}
                  <div className="space-y-2">
                    <RevealControl
                      label="DR (General)"
                      value={reveal.dr.general}
                      options={[
                        { value: RevealMode.DR_UNKNOWN, label: 'Unknown' },
                        { value: RevealMode.DR_MIN_KNOWN, label: 'Minimum Known (DR ≥ X)' },
                        { value: RevealMode.DR_EXACT, label: `Exact (${participant.dr || 0})` }
                      ]}
                      onChange={(value) => handleRevealChange(participant.instanceId, 'dr.general', value)}
                    />

                    {/* DR Min input */}
                    {reveal.dr.general === RevealMode.DR_MIN_KNOWN && (
                      <div className="ml-4">
                        <label className="text-xs text-gray-400">Minimum DR:</label>
                        <input
                          type="number"
                          value={reveal.generalMin || 0}
                          onChange={(e) => handleRevealChange(participant.instanceId, 'generalMin', parseInt(e.target.value) || 0)}
                          className="w-20 ml-2 px-2 py-1 bg-gray-700 rounded text-sm"
                          min="0"
                        />
                      </div>
                    )}
                  </div>

                  {/* Attacks Reveal */}
                  <RevealControl
                    label="Attacks"
                    value={reveal.attacks}
                    options={[
                      { value: RevealMode.ATTACKS_HIDDEN, label: 'Hidden' },
                      { value: RevealMode.ATTACKS_NAMES_ONLY, label: 'Names Only' },
                      { value: RevealMode.ATTACKS_FULL, label: 'Full Stats' }
                    ]}
                    onChange={(value) => handleRevealChange(participant.instanceId, 'attacks', value)}
                  />

                  {/* Notes Reveal */}
                  <RevealControl
                    label="Notes"
                    value={reveal.notes}
                    options={[
                      { value: RevealMode.NOTES_HIDDEN, label: 'Hidden' },
                      { value: RevealMode.NOTES_FULL, label: 'Visible' }
                    ]}
                    onChange={(value) => handleRevealChange(participant.instanceId, 'notes', value)}
                  />

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-700">
                    <button
                      onClick={() => {
                        // Reveal all
                        handleRevealChange(participant.instanceId, 'name', RevealMode.NAME_FULL);
                        handleRevealChange(participant.instanceId, 'hp.mode', RevealMode.NUMERIC_EXACT);
                        handleRevealChange(participant.instanceId, 'defenses.dodge', RevealMode.DEFENSE_EXACT);
                        handleRevealChange(participant.instanceId, 'defenses.parry', RevealMode.DEFENSE_EXACT);
                        handleRevealChange(participant.instanceId, 'defenses.block', RevealMode.DEFENSE_EXACT);
                        handleRevealChange(participant.instanceId, 'dr.general', RevealMode.DR_EXACT);
                        handleRevealChange(participant.instanceId, 'attacks', RevealMode.ATTACKS_FULL);
                        handleRevealChange(participant.instanceId, 'notes', RevealMode.NOTES_FULL);
                      }}
                      className="flex-1 px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Reveal All
                    </button>
                    <button
                      onClick={() => {
                        // Hide all
                        handleRevealChange(participant.instanceId, 'name', RevealMode.NAME_HIDDEN);
                        handleRevealChange(participant.instanceId, 'hp.mode', RevealMode.NUMERIC_UNKNOWN);
                        handleRevealChange(participant.instanceId, 'defenses.dodge', RevealMode.DEFENSE_UNKNOWN);
                        handleRevealChange(participant.instanceId, 'defenses.parry', RevealMode.DEFENSE_UNKNOWN);
                        handleRevealChange(participant.instanceId, 'defenses.block', RevealMode.DEFENSE_UNKNOWN);
                        handleRevealChange(participant.instanceId, 'dr.general', RevealMode.DR_UNKNOWN);
                        handleRevealChange(participant.instanceId, 'attacks', RevealMode.ATTACKS_HIDDEN);
                        handleRevealChange(participant.instanceId, 'notes', RevealMode.NOTES_HIDDEN);
                      }}
                      className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single reveal control (dropdown selector)
 */
function RevealControl({ label, value, options, onChange, compact = false }) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <label className={`text-${compact ? 'xs' : 'sm'} font-medium text-gray-300`}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-2 py-${compact ? '1' : '1.5'} bg-gray-700 rounded text-${compact ? 'xs' : 'sm'} border border-gray-600 focus:border-blue-500 focus:outline-none`}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Get summary text for reveal state
 */
function getRevealSummary(reveal) {
  const parts = [];

  if (reveal.name === RevealMode.NAME_FULL) parts.push('Name');
  if (reveal.hp.mode === RevealMode.NUMERIC_EXACT) parts.push('HP');
  if (reveal.dr.general !== RevealMode.DR_UNKNOWN) parts.push('DR');
  if (reveal.attacks !== RevealMode.ATTACKS_HIDDEN) parts.push('Attacks');

  if (parts.length === 0) return 'Fully Hidden';
  if (parts.length >= 4) return 'Mostly Revealed';
  return `Revealed: ${parts.join(', ')}`;
}
