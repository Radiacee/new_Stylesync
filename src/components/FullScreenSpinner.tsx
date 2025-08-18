"use client";
import React from 'react';

export function FullScreenSpinner({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="h-12 w-12 rounded-full border-4 border-brand-400/40 border-t-brand-400 animate-spin" aria-label="Loading" />
      {label && <p className="text-sm text-slate-300">{label}</p>}
    </div>
  );
}
