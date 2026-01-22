import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { parseGCSText, validateCharacter } from '../../utils/gcsParser';

/**
 * GCS Import Modal
 * Handles importing character data from GCS text format
 * Shows preview, issues, and confidence level
 */
export default function GCSImportModal({ onImport, onCancel }) {
  const [gcsText, setGcsText] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleParse = () => {
    if (!gcsText.trim()) {
      alert('Please paste GCS text first');
      return;
    }

    const result = parseGCSText(gcsText);
    setParseResult(result);
    setShowPreview(true);
  };

  const handleImport = () => {
    if (!parseResult) return;

    const errors = validateCharacter(parseResult.data);
    if (errors.length > 0) {
      alert('Character validation failed:\n' + errors.join('\n'));
      return;
    }

    onImport(parseResult.data);
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConfidenceIcon = (confidence) => {
    switch (confidence) {
      case 'high': return <CheckCircle size={20} className="text-green-400" />;
      case 'medium': return <AlertTriangle size={20} className="text-yellow-400" />;
      case 'low': return <AlertTriangle size={20} className="text-red-400" />;
      default: return <FileText size={20} className="text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Import from GCS</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {!showPreview ? (
          // Step 1: Paste GCS Text
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">
                Paste GCS Character Text
              </label>
              <textarea
                value={gcsText}
                onChange={(e) => setGcsText(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded font-mono text-sm"
                rows="20"
                placeholder="Paste your GCS character sheet text here...&#10;&#10;Example:&#10;Name: John Doe&#10;ST: 12&#10;DX: 14&#10;IQ: 10&#10;HT: 11&#10;HP: 12&#10;..."
              />
            </div>

            <div className="bg-blue-900 border border-blue-700 p-4 rounded">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FileText size={16} />
                How to Import from GCS
              </h3>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Open your character in GURPS Character Sheet (GCS)</li>
                <li>Select and copy the character text (usually the entire sheet)</li>
                <li>Paste it into the text area above</li>
                <li>Click "Parse & Preview" to see the extracted data</li>
                <li>Review any issues and adjust if needed</li>
                <li>Click "Import Character" to add to your library</li>
              </ul>
            </div>

            <div className="flex gap-4 justify-end">
              <button
                onClick={onCancel}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                disabled={!gcsText.trim()}
              >
                Parse & Preview
              </button>
            </div>
          </div>
        ) : (
          // Step 2: Preview & Import
          <div className="space-y-6">
            {/* Confidence & Issues */}
            <div className={`border rounded p-4 ${
              parseResult.needsReview ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-blue-500 bg-blue-900 bg-opacity-20'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                {getConfidenceIcon(parseResult.confidence)}
                <div>
                  <h3 className="font-semibold">
                    Import Confidence: <span className={getConfidenceColor(parseResult.confidence)}>
                      {parseResult.confidence.toUpperCase()}
                    </span>
                  </h3>
                  {parseResult.needsReview && (
                    <p className="text-sm text-red-400">
                      Review required - please verify the data below
                    </p>
                  )}
                </div>
              </div>

              {parseResult.issues.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Issues Found:</h4>
                  <ul className="text-sm space-y-1">
                    {parseResult.issues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Preview Data */}
            <div className="bg-gray-900 border border-gray-700 rounded p-4">
              <h3 className="font-semibold mb-4">Preview Character Data</h3>

              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Basic Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Name: <span className="text-blue-400">{parseResult.data.name || '(unnamed)'}</span></div>
                    <div>Category: <span className="text-blue-400">{parseResult.data.category}</span></div>
                  </div>
                </div>

                {/* Attributes */}
                <div>
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Attributes</h4>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>ST: <span className="text-blue-400">{parseResult.data.st}</span></div>
                    <div>DX: <span className="text-blue-400">{parseResult.data.dx}</span></div>
                    <div>IQ: <span className="text-blue-400">{parseResult.data.iq}</span></div>
                    <div>HT: <span className="text-blue-400">{parseResult.data.ht}</span></div>
                  </div>
                </div>

                {/* Secondary */}
                <div>
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Secondary Characteristics</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>HP: <span className="text-blue-400">{parseResult.data.hp}</span></div>
                    <div>FP: <span className="text-blue-400">{parseResult.data.fp}</span></div>
                    <div>MP: <span className="text-blue-400">{parseResult.data.mp}</span></div>
                  </div>
                </div>

                {/* Combat */}
                <div>
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Combat Stats</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>Speed: <span className="text-blue-400">{parseResult.data.basicSpeed}</span></div>
                    <div>Move: <span className="text-blue-400">{parseResult.data.basicMove}</span></div>
                    <div>Dodge: <span className="text-blue-400">{parseResult.data.dodge}</span></div>
                  </div>
                </div>

                {/* Defenses */}
                <div>
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Defenses</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>Parry: <span className="text-blue-400">{parseResult.data.parry}</span></div>
                    <div>Block: <span className="text-blue-400">{parseResult.data.block}</span></div>
                    <div>DR: <span className="text-blue-400">{parseResult.data.dr}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setParseResult(null);
                }}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded"
              >
                Import Character
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
