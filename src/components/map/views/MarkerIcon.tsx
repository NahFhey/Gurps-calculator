/**
 * MarkerIcon — small icon for different marker types on tiles.
 */

import { memo } from 'react';
import { MapPin, Gem, Home, AlertTriangle, StickyNote } from 'lucide-react';

const MARKER_ICONS: Record<string, { icon: typeof MapPin; color: string }> = {
  mining_node: { icon: Gem, color: '#f59e0b' },
  settlement: { icon: Home, color: '#10b981' },
  danger: { icon: AlertTriangle, color: '#ef4444' },
  note: { icon: StickyNote, color: '#8b5cf6' },
  location: { icon: MapPin, color: '#10b981' },
};

interface MarkerIconProps {
  type: string;
  size?: number;
}

export const MarkerIcon = memo(function MarkerIcon({ type, size = 10 }: MarkerIconProps) {
  const config = MARKER_ICONS[type] ?? { icon: MapPin, color: '#94a3b8' };
  const Icon = config.icon;
  return <Icon style={{ width: size, height: size, color: config.color }} />;
});
