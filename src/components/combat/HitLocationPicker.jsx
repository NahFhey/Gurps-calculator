import React, { useState } from 'react';
import { Dices } from 'lucide-react';
import { getProfileLocations, rollHitLocation } from '../../utils/hitLocations';

/**
 * HitLocationPicker Component
 * Allows manual selection or random rolling of hit locations
 */
export default function HitLocationPicker({
  profileId = 'humanoid',
  onLocationSelected,
  selectedLocation = null
}) {
  const [rollResult, setRollResult] = useState(null);

  const locations = getProfileLocations(profileId);

  const handleRollLocation = () => {
    const result = rollHitLocation(profileId);

    if (!result.valid) {
      alert(`Roll error: ${result.error}`);
      return;
    }

    setRollResult(result);
    onLocationSelected(result.location, result.roll);
  };

  const handleManualSelect = (location) => {
    setRollResult(null);
    onLocationSelected(location, null);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Hit Location</h4>
        <button
          onClick={handleRollLocation}
          className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
        >
          <Dices size={16} />
          Roll 3d6
        </button>
      </div>

      {/* Roll Result Display */}
      {rollResult && (
        <div className="bg-purple-900/30 border border-purple-600 rounded p-3">
          <div className="text-sm text-gray-400 mb-1">Rolled</div>
          <div className="text-lg font-bold">
            {rollResult.roll.dice.map((die, index) => (
              <span key={index} className="text-purple-400 mr-1">[{die}]</span>
            ))}
            {' = '}
            {rollResult.roll.total}
            {' → '}
            <span className="text-yellow-400">{rollResult.location.label}</span>
          </div>
        </div>
      )}

      {/* Manual Selection Grid */}
      <div>
        <div className="text-sm text-gray-400 mb-2">Or select manually:</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {locations.map(location => {
            const isSelected = selectedLocation && selectedLocation.key === location.key;
            return (
              <button
                key={location.key}
                onClick={() => handleManualSelect(location)}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  isSelected
                    ? 'bg-yellow-600 hover:bg-yellow-700 font-semibold'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div>{location.label}</div>
                {location.toHitPenalty !== 0 && (
                  <div className="text-xs text-gray-400">
                    ({location.toHitPenalty >= 0 ? '+' : ''}{location.toHitPenalty})
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Location Display */}
      {selectedLocation && !rollResult && (
        <div className="bg-gray-800 rounded p-3">
          <div className="text-sm text-gray-400">Selected:</div>
          <div className="text-lg font-semibold text-yellow-400">
            {selectedLocation.label}
          </div>
        </div>
      )}
    </div>
  );
}
