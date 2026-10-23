'use client';

import { BrainCircuit } from 'lucide-react';

export default function AppHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="max-w-[900px] mx-auto px-6 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-[6px] bg-primary flex items-center justify-center">
          <BrainCircuit className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">ErrorSnap</h1>
          <p className="text-xs text-muted-foreground">Coding error assistant</p>
        </div>
      </div>
    </header>
  );
}