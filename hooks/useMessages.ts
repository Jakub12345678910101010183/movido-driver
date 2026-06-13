import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  read: boolean;
  created_at: string;
  sender?: { name: string | null; role: string };
}

export function useMessages(userId: string | null | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMessages = useCallback(async () => {
    if (!userId) { setIsLoading(false); return; }
    try {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:users!sender_id(name, role)')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: true })
        .limit(100);

      setMessages(data ?? []);
      setUnreadCount((data ?? []).filter(m => !m.read && m.sender_id !== userId).length);
    } catch { /* ignore */ } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMessages();
    if (!userId) return;

    const sub = supabase
      .channel('driver-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `recipient_id=eq.${userId}`,
      }, () => fetchMessages())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [userId, fetchMessages]);

  const sendMessage = async (content: string, recipientId?: string): Promise<boolean> => {
    if (!userId || !content.trim()) return false;
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: userId,
        recipient_id: recipientId ?? null,
        content: content.trim(),
        read: false,
      });
      if (error) throw error;
      await fetchMessages();
      return true;
    } catch { return false; }
  };

  const markRead = async (messageId: string) => {
    await supabase.from('messages').update({ read: true }).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return { messages, isLoading, unreadCount, sendMessage, markRead, refetch: fetchMessages };
}
