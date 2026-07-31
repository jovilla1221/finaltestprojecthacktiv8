'use client';

import * as React from 'react';
import { Send, Plus, Sparkles, X, Trash2, History, TrendingUp, AlertTriangle, PackageSearch, HelpCircle } from 'lucide-react';
import { useAiChat } from '@/hooks/use-ai-chat';
import { AiChatMessage, TypingIndicator } from './ai-chat-message';

const CATEGORIZED_QUICK_ACTIONS = [
  {
    category: 'Penjualan & Omzet',
    icon: TrendingUp,
    actions: [
      { label: 'Omzet hari ini', message: 'Berapa total omzet dan transaksi hari ini?' },
      { label: 'Produk terlaris', message: 'Produk apa yang paling laris minggu ini?' },
    ],
  },
  {
    category: 'Stok & Inventoris',
    icon: PackageSearch,
    actions: [
      { label: 'Stok menipis', message: 'Produk apa saja yang stoknya di bawah batas minimum?' },
      { label: 'Cari barang', message: 'Bagaimana cara mencari produk dengan barcode?' },
    ],
  },
];

export function AiChatPanel({ onClose }: { onClose: () => void }) {
  const {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    error,
    sendMessage,
    loadConversation,
    startNewConversation,
    removeConversation,
    loadConversations,
    messagesEndRef,
  } = useAiChat();

  const [input, setInput] = React.useState('');
  const [showHistory, setShowHistory] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Load conversations on mount
  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const msg = input;
    setInput('');
    await sendMessage(msg);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = async (message: string) => {
    setInput('');
    await sendMessage(message);
  };

  const handleDeleteConversation = async (id: string) => {
    setDeletingId(id);
    await removeConversation(id);
    setDeletingId(null);
  };

  return (
    <div className="ai-chat-panel flex flex-col w-full sm:w-[400px] h-[85vh] max-h-[580px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-[#047857] via-[#059669] to-[#10b981] text-white shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md border border-white/20 shadow-inner">
            <Sparkles className="h-5 w-5 text-emerald-100" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-800" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold leading-tight">Asisten AI</h3>
              <span className="text-[10px] font-semibold bg-emerald-800/60 px-1.5 py-0.5 rounded text-emerald-200">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/90 font-medium">MrikiPOS Real-time Data</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`rounded-lg p-2 transition-all ${
              showHistory ? 'bg-white/30 text-white' : 'text-emerald-100 hover:bg-white/20 hover:text-white'
            }`}
            title="Riwayat percakapan"
            aria-label="Buka riwayat percakapan"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={startNewConversation}
            className="rounded-lg p-2 text-emerald-100 transition-all hover:bg-white/20 hover:text-white"
            title="Percakapan baru"
            aria-label="Mulai percakapan baru"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-emerald-100 transition-all hover:bg-white/20 hover:text-white"
            title="Tutup (ESC)"
            aria-label="Tutup panel chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Conversation History Drawer */}
      {showHistory && (
        <div className="absolute top-[60px] left-0 right-0 bottom-0 z-20 bg-white dark:bg-slate-900 flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Riwayat Percakapan</h4>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                <History className="h-8 w-8 mb-2 stroke-1 opacity-50" />
                <p className="text-xs">Belum ada riwayat percakapan</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all border ${
                    currentConversationId === conv.id
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <button
                    onClick={() => {
                      loadConversation(conv.id);
                      setShowHistory(false);
                    }}
                    className="flex-1 text-left min-w-0 focus:outline-none"
                  >
                    <p className="text-xs font-semibold truncate">
                      {conv.title || 'Percakapan baru'}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {conv._count.messages} pesan • {new Date(conv.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    disabled={deletingId === conv.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 transition-all"
                    title="Hapus percakapan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#f8faf9] dark:bg-slate-950 relative">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-full py-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
              Halo! Ada yang bisa saya bantu? 👋
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-[280px] leading-relaxed">
              Tanyakan data omzet, stok produk, atau analisis transaksi toko Anda secara instan.
            </p>

            {/* Categorized Quick Actions */}
            <div className="w-full space-y-3">
              {CATEGORIZED_QUICK_ACTIONS.map((group) => {
                const IconComponent = group.icon;
                return (
                  <div key={group.category} className="text-left">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 px-1">
                      <IconComponent className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{group.category}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {group.actions.map((action) => (
                        <button
                          key={action.message}
                          onClick={() => handleQuickAction(action.message)}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 transition-all hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300 shadow-2xs active:scale-[0.99] flex items-center justify-between group"
                        >
                          <span>{action.label}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                            Tanya &rarr;
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <AiChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/50 border-t border-red-100 dark:border-red-900/50 shrink-0 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium truncate">{error}</p>
        </div>
      )}

      {/* Input Form Area */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-end gap-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 p-2.5 focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:bg-white dark:focus-within:bg-slate-900 border border-transparent focus-within:border-emerald-400 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan sesuatu tentang toko..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none max-h-[80px]"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#047857] hover:bg-[#065f46] text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 shadow-sm"
            aria-label="Kirim pesan"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-400">
          <span>Tekan <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">Enter</kbd> untuk mengirim</span>
          {input.length > 0 && <span>{input.length} karakter</span>}
        </div>
      </div>
    </div>
  );
}
