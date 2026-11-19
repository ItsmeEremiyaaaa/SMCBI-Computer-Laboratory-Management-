import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/hooks/auth';
import type { Message } from '../../../shared/data/types';
import { messagesRepo } from '../data/repository';

/** My messages, kept live (new messages and read receipts arrive without a reload). */
export function useMessages() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const reload = useCallback(() => messagesRepo.listMessages().then(setMessages).catch(() => setMessages((m) => m ?? [])), []);
  useEffect(() => { if (profile) reload(); }, [profile, reload]);
  useEffect(() => messagesRepo.subscribeReservations(() => { reload(); }), [reload]);
  const unread = (messages ?? []).filter((m) => m.to_id === profile?.id && !m.read_at).length;
  return { messages, reload, unread, me: profile?.id ?? '' };
}

/** Conversations: one per person, newest first, with the last message and how many are unread. */
export function conversations(messages: Message[], me: string) {
  const by = new Map<string, { id: string; name: string; last: Message; unread: number }>();
  for (const m of messages) {
    const other = m.from_id === me ? m.to_id : m.from_id;
    const name = (m.from_id === me ? m.to_name : m.from_name) ?? 'Someone';
    const c = by.get(other) ?? { id: other, name, last: m, unread: 0 };
    if (m.created_at >= c.last.created_at) c.last = m;
    if (m.to_id === me && !m.read_at) c.unread++;
    by.set(other, c);
  }
  return [...by.values()].sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}
