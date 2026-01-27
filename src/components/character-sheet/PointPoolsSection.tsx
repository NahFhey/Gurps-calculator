import { Heart, Zap } from 'lucide-react';
import type { PointPools, PrimaryAttributes } from '../../types/characterSheet';

interface PointPoolsSectionProps {
  pools: PointPools;
  attributes: PrimaryAttributes;
  editMode: boolean;
  onChange: (pools: PointPools) => void;
}

export function PointPoolsSection({
  pools,
  attributes,
  editMode,
  onChange,
}: PointPoolsSectionProps) {
  const hpBase = attributes.ST;
  const fpBase = attributes.HT;

  const handleHPMaxChange = (max: number) => {
    const diff = max - hpBase;
    const points = diff * 2; // 2 pts per HP
    onChange({
      ...pools,
      HP: { ...pools.HP, max, points },
    });
  };

  const handleFPMaxChange = (max: number) => {
    const diff = max - fpBase;
    const points = diff * 3; // 3 pts per FP
    onChange({
      ...pools,
      FP: { ...pools.FP, max, points },
    });
  };

  const handleCurrentChange = (pool: 'HP' | 'FP', current: number) => {
    onChange({
      ...pools,
      [pool]: { ...pools[pool], current },
    });
  };

  const hpPercent = (pools.HP.current / pools.HP.max) * 100;
  const fpPercent = (pools.FP.current / pools.FP.max) * 100;

  const getBarColor = (percent: number) => {
    if (percent <= 25) return 'bg-red-600';
    if (percent <= 50) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">Point Pools</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HP */}
        <div className="bg-gray-700 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={18} className="text-red-500" />
            <span className="font-semibold text-gray-200">Hit Points (HP)</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            {editMode ? (
              <>
                <input
                  type="number"
                  value={pools.HP.current}
                  onChange={(e) => handleCurrentChange('HP', parseInt(e.target.value) || 0)}
                  className="w-16 text-xl font-bold bg-gray-600 border border-gray-500 rounded px-2 py-1 text-gray-100 text-center"
                />
                <span className="text-gray-400">/</span>
                <input
                  type="number"
                  value={pools.HP.max}
                  onChange={(e) => handleHPMaxChange(parseInt(e.target.value) || 1)}
                  className="w-16 text-xl font-bold bg-gray-600 border border-gray-500 rounded px-2 py-1 text-gray-100 text-center"
                />
              </>
            ) : (
              <span className="text-xl font-bold text-gray-100">
                {pools.HP.current} / {pools.HP.max}
              </span>
            )}
            <span className="text-sm text-gray-400">[{pools.HP.points >= 0 ? '+' : ''}{pools.HP.points}]</span>
          </div>

          {/* HP Bar */}
          <div className="h-2 bg-gray-600 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${getBarColor(hpPercent)}`}
              style={{ width: `${Math.max(0, Math.min(100, hpPercent))}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">Base: {hpBase} (ST) | Cost: 2 pts/level</div>
        </div>

        {/* FP */}
        <div className="bg-gray-700 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-yellow-500" />
            <span className="font-semibold text-gray-200">Fatigue Points (FP)</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            {editMode ? (
              <>
                <input
                  type="number"
                  value={pools.FP.current}
                  onChange={(e) => handleCurrentChange('FP', parseInt(e.target.value) || 0)}
                  className="w-16 text-xl font-bold bg-gray-600 border border-gray-500 rounded px-2 py-1 text-gray-100 text-center"
                />
                <span className="text-gray-400">/</span>
                <input
                  type="number"
                  value={pools.FP.max}
                  onChange={(e) => handleFPMaxChange(parseInt(e.target.value) || 1)}
                  className="w-16 text-xl font-bold bg-gray-600 border border-gray-500 rounded px-2 py-1 text-gray-100 text-center"
                />
              </>
            ) : (
              <span className="text-xl font-bold text-gray-100">
                {pools.FP.current} / {pools.FP.max}
              </span>
            )}
            <span className="text-sm text-gray-400">[{pools.FP.points >= 0 ? '+' : ''}{pools.FP.points}]</span>
          </div>

          {/* FP Bar */}
          <div className="h-2 bg-gray-600 rounded overflow-hidden">
            <div
              className={`h-full transition-all ${getBarColor(fpPercent)}`}
              style={{ width: `${Math.max(0, Math.min(100, fpPercent))}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">Base: {fpBase} (HT) | Cost: 3 pts/level</div>
        </div>
      </div>
    </div>
  );
}
