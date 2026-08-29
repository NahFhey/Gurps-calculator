/**
 * CharacterContextMenu
 * Right-click context menu for character cards in the Party Column
 * Options: View Sheet, Edit, Duplicate, Export (JSON), Delete
 */

import { useEffect, useRef } from 'react';
import { Eye, Edit2, Copy, Download, FileText, Trash2, Coins } from 'lucide-react';

export interface CharacterContextMenuAction {
  type: 'view' | 'edit' | 'spendPoints' | 'duplicate' | 'export' | 'exportText' | 'delete';
  characterId: string;
}

interface CharacterContextMenuProps {
  characterId: string;
  characterName: string;
  position: { x: number; y: number };
  onAction: (action: CharacterContextMenuAction) => void;
  onClose: () => void;
}

export function CharacterContextMenu({
  characterId,
  characterName,
  position,
  onAction,
  onClose,
}: CharacterContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  // Close menu when clicking outside
  useEffect(() => {
    cancelledRef.current = false;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Use setTimeout to avoid immediately closing from the same click that opened it.
    // Guard with `cancelledRef` so listeners aren't added after cleanup runs.
    const timerId = setTimeout(() => {
      if (cancelledRef.current) return;
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      cancelledRef.current = true;
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position if menu would overflow right edge
      if (rect.right > viewportWidth) {
        menu.style.left = `${position.x - rect.width}px`;
      }

      // Adjust vertical position if menu would overflow bottom edge
      if (rect.bottom > viewportHeight) {
        menu.style.top = `${position.y - rect.height}px`;
      }
    }
  }, [position]);

  const handleAction = (type: CharacterContextMenuAction['type']) => {
    onAction({ type, characterId });
    onClose();
  };

  const menuItems = [
    { type: 'view' as const, label: 'View Sheet', icon: Eye },
    { type: 'edit' as const, label: 'Edit', icon: Edit2 },
    { type: 'spendPoints' as const, label: 'Spend Points', icon: Coins },
    { type: 'duplicate' as const, label: 'Duplicate', icon: Copy },
    { type: 'export' as const, label: 'Export (JSON)', icon: Download },
    { type: 'exportText' as const, label: 'Export (GCS Text)', icon: FileText },
    { type: 'delete' as const, label: 'Delete', icon: Trash2, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      {/* Character name header */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="text-xs text-gray-400">Character</div>
        <div className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
          {characterName}
        </div>
      </div>

      {/* Menu items */}
      <div className="py-1">
        {menuItems.map((item, index) => (
          <div key={item.type}>
            {item.danger && index > 0 && (
              <div className="border-t border-gray-700 my-1" />
            )}
            <button
              type="button"
              onClick={() => handleAction(item.type)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-gray-200 hover:bg-gray-700'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
