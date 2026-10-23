'use client';

import { Copy, CheckCircle2, AlertCircle, Database, Cpu } from 'lucide-react';
import { useState } from 'react';
import { SolveResponse } from '@/lib/types';

interface SolutionResultProps {
  result: SolveResponse;
}

export default function SolutionResult({ result }: SolutionResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCodeBlock = (code: string) => (
    <div className="relative">
      <pre className="code-block">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => handleCopy(code)}
        className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-[4px] bg-secondary px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );

  if (result.status === 'insufficient_evidence') {
    return (
      <div className="panel p-6 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="text-[15px] font-semibold text-amber-800">Insufficient Evidence</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              No matching knowledge base record was found for your query with a sufficiently high
              relevance score. The retrieved evidence did not support a confident diagnosis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === 'generation_unavailable') {
    return (
      <div className="panel p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-[15px] font-semibold">Retrieval-Only Result</h2>
        </div>

        {result.likelyCause && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Likely Cause</h3>
            <p className="text-sm text-foreground">{result.likelyCause}</p>
          </div>
        )}

        {result.recommendedFix && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Recommended Fix</h3>
            <p className="text-sm text-foreground">{result.recommendedFix}</p>
          </div>
        )}

        {result.exampleCode && renderCodeBlock(result.exampleCode)}

        <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
          The local LLM is not configured or unavailable. This result is retrieval-only, based on the
          top matching knowledge base records. A generated answer will appear once an OpenRouter API key
          is configured.
        </p>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="panel p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="text-[15px] font-semibold text-red-800">Error</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {result.error || 'An error occurred while processing your request.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success status
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border px-6 py-5 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <h2 className="text-[15px] font-semibold">Solution Found</h2>
        </div>
        <p className="text-xs text-muted-foreground">Based on retrieved knowledge base evidence</p>
      </div>

      <div className="p-6 space-y-6">
        {result.likelyCause && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Likely Cause
            </h3>
            <p className="text-sm text-foreground leading-relaxed">{result.likelyCause}</p>
          </div>
        )}

        {result.recommendedFix && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Recommended Fix</h3>
            <p className="text-sm text-foreground leading-relaxed">{result.recommendedFix}</p>
          </div>
        )}

        {result.generatedAnswer && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Generated Answer</h3>
            <div className="rounded-[6px] border border-border bg-secondary p-4 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {result.generatedAnswer}
            </div>
          </div>
        )}

        {result.exampleCode && renderCodeBlock(result.exampleCode)}

        <div className="border-t border-border pt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Cpu className="h-4 w-4" />
          <span>
            Mode: {result.mode === 'rag' ? 'Generated (RAG)' : 'Retrieval-only'}
          </span>
        </div>
      </div>
    </div>
  );
}