/**
 * LinksMenu — popup showing available links on the party's current tile.
 */

import type { LinkModel, MapModel, MapId } from '../../../types/map';
import { MAP_SCALES } from '../../../constants/map';
import { ExternalLink, X } from 'lucide-react';

interface LinksMenuProps {
  links: LinkModel[];
  maps: Record<MapId, MapModel>;
  onUseLink: (link: LinkModel) => void;
  onClose: () => void;
}

export function LinksMenu({ links, maps, onUseLink, onClose }: LinksMenuProps) {
  if (links.length === 0) return null;

  return (
    <div className="absolute bottom-12 right-4 z-40 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-medium text-gray-300">Available Links</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-gray-700">
          <X className="w-3 h-3 text-gray-400" />
        </button>
      </div>
      <div className="py-1">
        {links.map((link) => {
          const targetMap = maps[link.toMapId];
          const scale = targetMap
            ? MAP_SCALES.find((s) => s.value === targetMap.scaleMilesPerTile)
            : null;

          return (
            <button
              key={link.id}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700/50 flex items-center gap-2 transition-colors"
              onClick={() => onUseLink(link)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-gray-200 truncate">
                  {link.label || targetMap?.name || 'Unknown Map'}
                </div>
                {targetMap && (
                  <div className="text-[10px] text-gray-500">
                    {targetMap.name} {scale ? `(${scale.label})` : ''}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
