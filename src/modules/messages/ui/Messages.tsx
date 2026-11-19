import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquarePlus, Search, Send, Trash2 } from 'lucide-react';
import { useLoad } from '../../../shared/hooks/useLoad';
import { Alert, Empty, PageHeader, askConfirm, fmtDate, fmtTime, toast } from '../../../shared/ui/ui';
import { messagesRepo } from '../data/repository';
import { conversations, useMessages } from '../hooks/useMessages';

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const manila = (iso: string) => new Date(iso).toLocaleString('en-CA', { timeZone: 'Asia/Manila', hour12: false }).replace(',', '');
const when = (iso: string) => { const [d, t] = manila(iso).split(' '); return { date: d, time: t.slice(0, 5) }; };

// One-to-one chat. Students write to the lab admin, staff and teachers; staff and teachers to anyone.
export default function Messages() {
  const { messages, reload, me } = useMessages();
  const contacts = useLoad(() => messagesRepo.messageContacts().catch(() => []));
  const [params, setParams] = useSearchParams();
  const open = params.get('to');
  const [picking, setPicking] = useState(false);
  const [find, setFind] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const convs = useMemo(() => conversations(messages ?? [], me), [messages, me]);
  const thread = (messages ?? []).filter((m) => open && (m.from_id === open || m.to_id === open));
  const other = convs.find((c) => c.id === open)?.name ?? contacts.data?.find((c) => c.id === open)?.full_name ?? '';
  const otherRole = contacts.data?.find((c) => c.id === open)?.role;

  // reading a conversation marks it read; new messages scroll into view
  const unreadHere = thread.some((m) => m.to_id === me && !m.read_at);
  useEffect(() => { if (open && unreadHere) messagesRepo.markRead(open).then(reload).catch(() => {}); }, [open, unreadHere, reload]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [thread.length, open]);

  const openWith = (id: string) => { setParams({ to: id }); setPicking(false); setFind(''); setError(null); };
  async function send() {
    if (!open || !draft.trim()) return;
    setBusy(true); setError(null);
    try { await messagesRepo.sendMessage(open, draft); setDraft(''); await reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function deleteChat(targetId?: string, targetName?: string) {
    const id = targetId ?? open;
    const name = targetName ?? other ?? 'this person';
    if (!id) return;
    const confirmed = await askConfirm({
      title: 'Delete conversation?',
      message: `Permanently delete your conversation with ${name}? All messages in this chat will be removed.`,
      confirmLabel: 'Delete conversation',
      danger: true,
    });
    if (!confirmed) return;
    setBusy(true); setError(null);
    try {
      await messagesRepo.deleteConversation(id);
      if (open === id) setParams({});
      await reload();
      toast('Conversation deleted');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const found = (contacts.data ?? []).filter((c) => !find.trim() || c.full_name.toLowerCase().includes(find.trim().toLowerCase()));

  return (
    <>
      <PageHeader title="Messages" sub="Ask the lab office or a teacher, and get answers here. Updates live." />
      <div className="card grid h-[calc(100dvh-13rem)] min-h-[28rem] overflow-hidden md:grid-cols-[19rem_1fr]">
        {/* conversations */}
        <aside className={`flex min-h-0 flex-col border-line md:border-r ${open ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex items-center justify-between gap-2 p-4">
            <h2 className="font-semibold text-ink">Chats</h2>
            <button onClick={() => setPicking(!picking)} className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110">
              <MessageSquarePlus size={14} />New
            </button>
          </div>
          {picking && (
            <div className="toast-in mx-3 mb-3 rounded-2xl border border-line bg-panel p-2 shadow-lg">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input autoFocus value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search people" aria-label="Search people"
                  className="h-9 w-full rounded-lg border border-line bg-panel pl-8 pr-2 text-sm text-ink outline-none focus:border-accent" />
              </div>
              <ul className="mt-1 max-h-56 overflow-y-auto">
                {found.length === 0 && <li className="px-2 py-2 text-xs text-muted">Nobody found.</li>}
                {found.map((c) => (
                  <li key={c.id}><button onClick={() => openWith(c.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-chalk">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{initials(c.full_name)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{c.full_name}</span><span className="text-[11px] capitalize text-muted">{c.role}</span>
                  </button></li>
                ))}
              </ul>
            </div>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {messages && convs.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No chats yet. Press <b>New</b> to start one.</li>}
            {convs.map((c) => (
              <li key={c.id} className="group relative">
                <button onClick={() => openWith(c.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${open === c.id ? 'bg-accent-soft' : 'hover:bg-chalk'}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{initials(c.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                      <span className="shrink-0 text-[11px] text-muted">{when(c.last.created_at).time}</span></span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${c.unread ? 'font-semibold text-ink' : 'text-muted'}`}>{c.last.from_id === me ? 'You: ' : ''}{c.last.body}</span>
                      {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-broken px-1 text-[10px] font-bold text-white">{c.unread}</span>}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); void deleteChat(c.id, c.name); }}
                  title="Delete conversation"
                  aria-label={`Delete conversation with ${c.name}`}
                  className="absolute right-2 top-2 hidden rounded-lg p-1.5 text-muted transition-colors hover:bg-rose-50 hover:text-broken group-hover:block"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* the open chat */}
        <section className={`flex min-h-0 flex-col ${open ? 'flex' : 'hidden md:flex'}`}>
          {!open ? <div className="grid flex-1 place-items-center"><Empty>Pick a chat, or press New to message someone.</Empty></div> : (
            <>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button onClick={() => setParams({})} aria-label="Back to chats" className="rounded-lg p-1 text-muted hover:bg-chalk md:hidden"><ArrowLeft size={18} /></button>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold text-white">{initials(other || '?')}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{other}</p>
                  {otherRole && <p className="text-xs capitalize text-muted">{otherRole}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void deleteChat()}
                  disabled={busy}
                  title="Delete conversation"
                  aria-label="Delete conversation"
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-rose-50 hover:text-broken disabled:opacity-50"
                >
                  <Trash2 size={16} />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto bg-chalk/40 px-4 py-4">
                {thread.length === 0 && <p className="py-10 text-center text-sm text-muted">Say hello. Your message goes straight to {other || 'them'}.</p>}
                <ul className="grid gap-2">
                  {thread.map((m, i) => {
                    const mine = m.from_id === me;
                    const w = when(m.created_at), prev = thread[i - 1] && when(thread[i - 1].created_at);
                    return (
                      <li key={m.id}>
                        {(!prev || prev.date !== w.date) && <p className="my-2 text-center text-[11px] font-medium text-muted">{fmtDate(w.date)}</p>}
                        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`toast-in max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-panel text-ink'}`}>
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>{fmtTime(w.time)}{mine && (m.read_at ? ' · Seen' : ' · Sent')}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div ref={bottom} />
              </div>
              {error && <div className="px-4 pt-3"><Alert>{error}</Alert></div>}
              <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-line p-3">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={1000} aria-label={`Message ${other}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line bg-panel px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
                <button disabled={busy || !draft.trim()} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-50">
                  <Send size={17} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
