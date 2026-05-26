import { useEffect, useState } from 'react';
import audioContext from '@/services/audioContext';

/**
 * React hook for audio context initialization and management
 */
export function useAudioContext() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAudioContext = async () => {
      try {
        await audioContext.initialize();
        setIsInitialized(true);
        setIsRunning(audioContext.isRunning());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Failed to initialize audio context:', err);
      }
    };

    // Initialize on first user interaction
    const handleInteraction = async () => {
      if (!isInitialized) {
        await initAudioContext();
      }
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [isInitialized]);

  return {
    isInitialized,
    isRunning,
    error,
    context: isInitialized ? audioContext.getContext() : null,
  };
}

export default useAudioContext;