import { useState, ChangeEvent, ReactNode } from 'react';
import { AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { parseGCSText, validateCharacter } from '../../utils/gcsParser';
import { Modal } from '../ui/Modal';

type Confidence = 'high' | 'medium' | 'low';

interface CharacterData {
  name?: string;
  category: string;
  st: number;
  dx: number;
  iq: number;
  ht: number;
  hp: number;
  fp: number;
  mp: number;
  basicSpeed: number;
  basicMove: number;
  dodge: number;
  parry: number;
  block: number;
  dr: number;
}

interface ParseResult {
  data: CharacterData;
  confidence: Confidence;
  needsReview: boolean;
  issues: string[];
}

interface GCSImportModalProps {
  onImport: (data: CharacterData) => void;
  onCancel: () => void;
}

/**
 * GCS Import Modal
 * Handles importing character data from GCS text format
 * Shows preview, issues, and confidence level
 */
export default function GCSImportModal({ onImport, onCancel }: GCSImportModalProps) {
  const [gcsText, setGcsText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleParse = () => {
    if (!gcsText.trim()) {
      alert('Please paste GCS text first');
      return;
    }

    const result = parseGCSText(gcsText) as ParseResult;
    setParseResult(result);
    setShowPreview(true);
  };

  const handleImport = () => {
    if (!parseResult) return;

    const errors = validateCharacter(parseResult.data) as string[];
    if (errors.length > 0) {
      alert('Character validation failed:\n' + errors.join('\n'));
      return;
    }

    onImport(parseResult.data);
  };

  const getConfidenceColor = (confidence: Confidence): string => {
    switch (confidence) {
      case 'high': return 'text-success-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-danger-400';
      default: return 'text-fg-muted';
    }
  };

  const getConfidenceIcon = (confidence: Confidence): ReactNode => {
    switch (confidence) {
      case 'high': return <CheckCircle size={20} className="text-success-400" />;
      case 'medium': return <AlertTriangle size={20} className="text-yellow-400" />;
      case 'low': return <AlertTriangle size={20} className="text-danger-400" />;
      default: return <FileText size={20} className="text-fg-muted" />;
    }
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Import from GCS"
      size="xl"
      closeOnBackdrop={false}
    >
        {!showPreview ? (
          // Step 1: Paste GCS Text
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2">
                Paste GCS Character Text
              </label>
              <textarea
                value={gcsText}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGcsText(e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 rounded font-mono text-sm"
                rows={20}
                placeholder="Paste your GCS character sheet text here...&#10;&#10;Example:&#10;Name: John Doe&#10;ST: 12&#10;DX: 14&#10;IQ: 10&#10;HT: 11&#10;HP: 12&#10;..."
              />
            </div>

            <div className="bg-accent-900 border border-accent-700 p-4 rounded">
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
                className="px-6 py-2 bg-surface-2 hover:bg-surface-3 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                className="px-6 py-2 bg-accent-600 hover:bg-accent-700 rounded"
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
            {parseResult && (
              <div className={`border rounded p-4 ${
                parseResult.needsReview ? 'border-danger-500 bg-danger-900 bg-opacity-20' : 'border-accent-500 bg-accent-900 bg-opacity-20'
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
                      <p className="text-sm text-danger-400">
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
            )}

            {/* Preview Data */}
            {parseResult && (
              <div className="bg-surface-0 border border-edge rounded p-4">
                <h3 className="font-semibold mb-4">Preview Character Data</h3>

                <div className="space-y-4">
                  {/* Basic Info */}
                  <div>
                    <h4 className="text-sm text-fg-muted uppercase mb-2">Basic Info</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Name: <span className="text-accent-400">{parseResult.data.name || '(unnamed)'}</span></div>
                      <div>Category: <span className="text-accent-400">{parseResult.data.category}</span></div>
                    </div>
                  </div>

                  {/* Attributes */}
                  <div>
                    <h4 className="text-sm text-fg-muted uppercase mb-2">Attributes</h4>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>ST: <span className="text-accent-400">{parseResult.data.st}</span></div>
                      <div>DX: <span className="text-accent-400">{parseResult.data.dx}</span></div>
                      <div>IQ: <span className="text-accent-400">{parseResult.data.iq}</span></div>
                      <div>HT: <span className="text-accent-400">{parseResult.data.ht}</span></div>
                    </div>
                  </div>

                  {/* Secondary */}
                  <div>
                    <h4 className="text-sm text-fg-muted uppercase mb-2">Secondary Characteristics</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>HP: <span className="text-accent-400">{parseResult.data.hp}</span></div>
                      <div>FP: <span className="text-accent-400">{parseResult.data.fp}</span></div>
                      <div>MP: <span className="text-accent-400">{parseResult.data.mp}</span></div>
                    </div>
                  </div>

                  {/* Combat */}
                  <div>
                    <h4 className="text-sm text-fg-muted uppercase mb-2">Combat Stats</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>Speed: <span className="text-accent-400">{parseResult.data.basicSpeed}</span></div>
                      <div>Move: <span className="text-accent-400">{parseResult.data.basicMove}</span></div>
                      <div>Dodge: <span className="text-accent-400">{parseResult.data.dodge}</span></div>
                    </div>
                  </div>

                  {/* Defenses */}
                  <div>
                    <h4 className="text-sm text-fg-muted uppercase mb-2">Defenses</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>Parry: <span className="text-accent-400">{parseResult.data.parry}</span></div>
                      <div>Block: <span className="text-accent-400">{parseResult.data.block}</span></div>
                      <div>DR: <span className="text-accent-400">{parseResult.data.dr}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setParseResult(null);
                }}
                className="px-6 py-2 bg-surface-2 hover:bg-surface-3 rounded"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-success-600 hover:bg-success-700 rounded"
              >
                Import Character
              </button>
            </div>
          </div>
        )}
    </Modal>
  );
}
