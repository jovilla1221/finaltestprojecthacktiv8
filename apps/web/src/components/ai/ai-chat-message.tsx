'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiChatMessageProps {
  message: import('@/hooks/use-ai-chat').Message;
}

/** Custom-styled markdown components that match MrikiPOS design system */
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  // Paragraphs
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-slate-800 dark:text-slate-100">{children}</p>,

  // Bold / italic / code inline
  strong: ({ children }) => <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children, ...props }: any) => {
    const isInline = !className;
    return isInline ? (
      <code className="rounded bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-300">{children}</code>
    ) : (
      <code className={className} {...props}>{children}</code>
    );
  },

  // Headings
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-extrabold text-slate-900 dark:text-white first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-2.5 text-sm font-bold text-slate-900 dark:text-white first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-xs font-bold text-slate-900 dark:text-white first:mt-0">{children}</h3>,

  // Lists
  ul: ({ children }) => <ul className="mb-2.5 ml-1 list-disc space-y-1 pl-4 text-slate-800 dark:text-slate-200">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 ml-1 list-decimal space-y-1 pl-4 text-slate-800 dark:text-slate-200">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-3 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 pl-3 rounded-r-lg italic text-slate-700 dark:text-slate-300">
      {children}
    </blockquote>
  ),

  // Tables — compact, scrollable, dark header
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
      <table className="w-full border-collapse text-[11px] leading-snug">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-800 dark:bg-slate-900 text-white font-semibold">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/50">{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-[11px] uppercase tracking-wider text-slate-200">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{children}</td>,

  // Horizontal rule
  hr: () => <hr className="my-3 border-slate-200 dark:border-slate-800" />,

  // Links
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700">
      {children}
    </a>
  ),

  // Pre / code blocks
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-emerald-300 shadow-inner">{children}</pre>
  ),
};

export function AiChatMessage({ message }: AiChatMessageProps) {
  const isUser = message.role === 'user';
  const time = new Date(message.created_at).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3.5`}>
      <div
        className={`max-w-[88%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-2xs transition-all ${
          isUser
            ? 'bg-gradient-to-br from-[#047857] to-[#059669] text-white rounded-br-xs'
            : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-800 shadow-sm'
        }`}
      >
        {isUser ? (
          // User messages: plain text, preserve line breaks
          <div className="whitespace-pre-wrap break-words font-medium">{message.content}</div>
        ) : (
          // AI messages: full markdown rendering
          <div className="ai-markdown break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <div
          className={`mt-1.5 text-[9px] font-medium tracking-wide ${
            isUser ? 'text-emerald-200 text-right' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {time}
        </div>
      </div>
    </div>
  );
}

/** Typing indicator animation */
export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3.5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-xs px-4 py-3.5 flex items-center gap-1.5 shadow-sm">
        <span className="typing-dot h-2 w-2 rounded-full bg-emerald-500" style={{ animationDelay: '0ms' }} />
        <span className="typing-dot h-2 w-2 rounded-full bg-emerald-500" style={{ animationDelay: '150ms' }} />
        <span className="typing-dot h-2 w-2 rounded-full bg-emerald-500" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
