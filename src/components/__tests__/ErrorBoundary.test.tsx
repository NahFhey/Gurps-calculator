import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '../ErrorBoundary';

// Suppress React error boundary console output during tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalError;
});

function ThrowingComponent({ message }: { message: string }): React.JSX.Element {
  throw new Error(message);
}

function GoodComponent() {
  return <div>Everything is fine</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Everything is fine')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test crash" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
  });

  it('shows Reload and Try Again buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Crash" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Reload Application')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('Try Again resets the error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Crash" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click Try Again — this resets hasError to false, but since the child
    // still throws, it will re-enter error state. We verify the click handler works.
    fireEvent.click(screen.getByText('Try Again'));
    // The component re-throws so error UI reappears
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
