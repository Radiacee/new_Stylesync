import { useState, useCallback } from 'react';
import type { StructuredStyleComparison } from '../lib/styleComparison';

interface UseStructuredComparisonReturn {
  comparison: StructuredStyleComparison | null;
  loading: boolean;
  error: string | null;
  fetchComparison: (userSample: string, original: string, paraphrased: string) => Promise<void>;
}

/**
 * Hook to fetch structured style comparison data from the API.
 * Step 5: Frontend hook for retrieving metric group data.
 */
export function useStructuredComparison(): UseStructuredComparisonReturn {
  const [comparison, setComparison] = useState<StructuredStyleComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(
    async (userSample: string, original: string, paraphrased: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/style-comparison', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userSampleText: userSample,
            originalText: original,
            paraphrasedText: paraphrased,
            structured: true, // Request new structured format
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch comparison');
        }

        const data = await response.json();

        if (!data.structured) {
          throw new Error('Invalid response format: missing structured data');
        }

        setComparison(data.structured);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Error fetching structured comparison:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    comparison,
    loading,
    error,
    fetchComparison,
  };
}
