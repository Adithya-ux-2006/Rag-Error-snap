'use client';

import { Database } from 'lucide-react';
import { RetrievedEvidence } from '@/lib/types';

interface EvidenceListProps {
  evidence: RetrievedEvidence[];
}

export default function EvidenceList({ evidence }: EvidenceListProps) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 panel p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-[14px] font-semibold">Retrieved Evidence</h3>
      </div>

      <div className="space-y-3">
        {evidence.map((item, index) => (
          <div key={item.record.id} className="flex flex-col gap-2 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                #{index + 1} · {item.record.id}
              </span>
              <span className="text-[11px] font-mono font-semibold text-muted-foreground">
                Score: {item.score.toFixed(3)}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-foreground">{item.record.error_name}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.record.likely_cause}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}