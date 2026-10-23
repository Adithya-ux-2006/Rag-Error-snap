'use client';

import { useState } from 'react';
import ErrorInput from '@/components/error-input';
import SolutionResult from '@/components/solution-result';
import AppHeader from '@/components/app-header';
import EvidenceList from '@/components/evidence-list';
import { Language, SolveResponse } from '@/lib/types';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SolveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSolve = async (query: string, language: Language, screenshot?: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, language, screenshot }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing your request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <div className="max-w-[900px] mx-auto px-6 py-10 sm:py-14">
        <div className="space-y-3 mb-8">
          <h2 className="text-[24px] font-semibold tracking-tight text-balance">
            Fix the error. Get back to building.
          </h2>
          <p className="text-sm text-muted-foreground">
            Find a relevant fix using retrieved coding knowledge.
          </p>
        </div>

        <ErrorInput onSolve={handleSolve} isLoading={isLoading} />

        {error && (
          <div className="panel p-4 mt-6">
            <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
          </div>
        )}

        {result && <SolutionResult result={result} />}

        {result?.evidence && result.evidence.length > 0 && (
          <EvidenceList evidence={result.evidence} />
        )}
      </div>
    </main>
  );
}
