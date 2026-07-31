'use client';

import * as React from 'react';
import { Sparkles, X } from 'lucide-react';
import { AiChatPanel } from './ai-chat-panel';
import '@/styles/ai-assistant.css';

export function AiChatBubble() {
  const [isOpen, setIsOpen] = React.useState(false);

  // Close on ESC key for keyboard accessibility
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 print:hidden flex flex-col items-end">
      {/* Chat Panel Window */}
      {isOpen && (
        <div className="ai-slide-up mb-3 w-full max-w-[calc(100vw-2rem)] sm:max-w-none">
          <AiChatPanel onClose={() => setIsOpen(false)} />
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`ai-chat-fab group flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/50 ${
          isOpen
            ? 'bg-slate-800 hover:bg-slate-900 rotate-90 scale-95'
            : 'bg-gradient-to-br from-[#047857] via-[#059669] to-[#10b981] hover:from-[#065f46] hover:to-[#059669] ai-pulse-glow hover:scale-105'
        }`}
        title={isOpen ? 'Tutup asisten AI (ESC)' : 'Buka asisten AI'}
        aria-label={isOpen ? 'Tutup asisten AI' : 'Buka asisten AI'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="h-6 w-6 transition-transform duration-300" />
        ) : (
          <Sparkles className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
