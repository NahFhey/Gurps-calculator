import type { ReactNode } from 'react';

export interface TravelViewProps {
  children: ReactNode;
  onBack: () => void;
}

export function TravelView({ children, onBack }: TravelViewProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">Travel</h3>
        <button onClick={onBack} className="text-gray-400 hover:text-gray-200">
          Back
        </button>
      </div>
      {children}
    </div>
  );
}
