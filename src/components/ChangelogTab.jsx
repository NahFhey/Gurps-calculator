import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CHANGELOG } from '../version';

export function ChangelogTab() {
  const [expanded, setExpanded] = useState({ [CHANGELOG[0].version]: true });

  const toggleVersion = (version) => {
    setExpanded(prev => ({ ...prev, [version]: !prev[version] }));
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Changelog</h2>
      <div className="space-y-4">
        {CHANGELOG.map((release) => (
          <div key={release.version} className="bg-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleVersion(release.version)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expanded[release.version] ? (
                  <ChevronDown size={20} className="text-blue-400" />
                ) : (
                  <ChevronRight size={20} className="text-gray-400" />
                )}
                <div className="text-left">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-blue-400">v{release.version}</span>
                    <span className="text-sm text-gray-400">{release.date}</span>
                  </div>
                  <div className="text-sm text-gray-300 mt-1">{release.title}</div>
                </div>
              </div>
            </button>

            {expanded[release.version] && (
              <div className="px-4 pb-4 space-y-4">
                {release.changes.map((category, idx) => (
                  <div key={idx}>
                    <h3 className="text-lg font-semibold text-green-400 mb-2">
                      {category.category}
                    </h3>
                    <ul className="space-y-1 ml-4">
                      {category.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-blue-400 mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
