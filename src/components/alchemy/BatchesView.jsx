import React, { useState } from 'react';
import { applyWorkBlockResult } from '../../utils/alchemy';

export function BatchesView({ batches, workers, saveBatches }) {
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [workerName, setWorkerName] = useState('');
  const [skill, setSkill] = useState('');
  const [roll, setRoll] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);

  const activeBatches = batches.filter(b => b.phase === 'brewing');
  const completedBatches = batches.filter(b => b.phase !== 'brewing');

  function addWorkBlock() {
    if (!selectedBatch || !workerName || !skill || !roll) {
      alert('Fill all fields');
      return;
    }

    const updated = applyWorkBlockResult(
      selectedBatch,
      parseInt(skill),
      parseInt(roll),
      workerName,
      currentDate
    );

    const newBatches = batches.map(b => b.id === selectedBatch.id ? updated : b);
    saveBatches(newBatches);

    if (updated.phase === 'completed') {
      alert(`Batch complete! Quality: ${updated.quality}`);
      setSelectedBatch(null);
    } else if (updated.phase === 'failed') {
      alert(`Batch failed! Mishap occurred.`);
      setSelectedBatch(null);
    } else {
      setSelectedBatch(updated);
    }

    setSkill('');
    setRoll('');
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Alchemy Batches</h2>

      {selectedBatch ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">{selectedBatch.formulaName}</h3>
            <button onClick={() => setSelectedBatch(null)} className="bg-gray-600 px-4 py-2 rounded">
              ← Back to List
            </button>
          </div>

          <div className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress: {selectedBatch.PP} / {selectedBatch.WR}</span>
              <span>Contamination: {selectedBatch.CP}</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-4 mb-2">
              <div
                className="bg-blue-600 h-4 rounded-full"
                style={{width: `${Math.min(100, (selectedBatch.PP / selectedBatch.WR) * 100)}%`}}
              />
            </div>
            <div className="text-xs text-gray-400 grid grid-cols-2 gap-2">
              <div>Difficulty: {selectedBatch.DM}</div>
              <div>Dominant: {selectedBatch.dominantAspect}</div>
              <div>Potency: {selectedBatch.potency}</div>
              <div>Started: {new Date(selectedBatch.startDate).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="bg-gray-700 p-4 rounded space-y-3">
            <h4 className="font-semibold">Add Work Block</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1">Worker</label>
                <select
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                >
                  <option value="">Select worker...</option>
                  {workers.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Date</label>
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Alchemy Skill</label>
                <input
                  type="number"
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                  placeholder="e.g., 14"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Effective: {skill ? parseInt(skill) + selectedBatch.DM : '?'}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1">Roll (3d6)</label>
                <input
                  type="number"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  className="w-full bg-gray-600 px-3 py-2 rounded"
                  placeholder="3-18"
                  min="3"
                  max="18"
                />
              </div>
            </div>
            <button onClick={addWorkBlock} className="w-full bg-green-600 px-4 py-2 rounded">
              Add Work Block
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Work History</h4>
            {selectedBatch.shifts.map((s, i) => (
              <div key={s.id} className="bg-gray-700 p-3 rounded text-sm">
                <div className="flex justify-between">
                  <span>Block {i+1}: {s.result}</span>
                  <span className="text-gray-400">{s.date}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {s.worker} | Skill {s.skill} → Effective {s.effectiveSkill} |
                  Roll: {s.roll} | PP +{s.ppAdded} |
                  CP {s.cpChange > 0 ? '+' : ''}{s.cpChange}
                </div>
              </div>
            ))}
            {selectedBatch.shifts.length === 0 && (
              <div className="text-gray-500 text-center py-4">No work blocks yet</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Active Batches ({activeBatches.length})</h3>
            {activeBatches.map(b => (
              <div key={b.id} className="bg-gray-700 p-3 rounded mb-2 cursor-pointer hover:bg-gray-600" onClick={() => setSelectedBatch(b)}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{b.formulaName}</span>
                  <span className="text-sm text-gray-400">{b.PP}/{b.WR} PP | CP: {b.CP}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {b.dominantAspect} | Potency {b.potency} | {b.shifts.length} work blocks
                </div>
              </div>
            ))}
            {activeBatches.length === 0 && (
              <div className="text-gray-500 text-center py-4">No active batches</div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Completed Batches ({completedBatches.length})</h3>
            {completedBatches.slice(0, 5).map(b => (
              <div key={b.id} className="bg-gray-700 p-3 rounded mb-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{b.formulaName}</span>
                  <span className={`text-sm ${b.quality === 'Clean' ? 'text-green-400' : b.quality?.includes('Mishap') ? 'text-red-400' : 'text-yellow-400'}`}>
                    {b.quality}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Completed: {new Date(b.completedDate).toLocaleDateString()} | {b.shifts.length} work blocks
                </div>
              </div>
            ))}
            {completedBatches.length === 0 && (
              <div className="text-gray-500 text-center py-4">No completed batches yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
