'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ChatLedgerChannel() {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const scrollRef = useRef(null);
    const router = useRouter();

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [chatHistory]);

    useEffect(() => {
        const initChat = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
            setUserProfile(profile);

            // 1. Load initial history
            const { data: initialData } = await supabase
                .from('ledger_entries')
                .select('*')
                .order('created_at', { ascending: true });
            if (initialData) setChatHistory(initialData);

            // 2. Turn on Realtime listeners for live updates!
            const realtimeChannel = supabase
                .channel('ledger-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setChatHistory(prev => [...prev, payload.new]);
                    } else if (payload.eventType === 'UPDATE') {
                        setChatHistory(prev => prev.map(item => item.id === payload.new.id ? payload.new : item));
                    }
                })
                .subscribe();

            return () => supabase.removeChannel(realtimeChannel);
        };

        initChat();
    }, [router]);

    const handleSendPayload = async (e) => {
        e.preventDefault();
        if (!message.trim() || isSending || !userProfile) return;

        setIsSending(true);
        const inputMessage = message;
        setMessage('');

        try {
            // Write straight to the PostgreSQL table layout
            const { data: entry, error } = await supabase
                .from('ledger_entries')
                .insert({
                    raw_text: inputMessage,
                    ai_status: 'processing',
                    logged_by_uid: userProfile.id,
                    logged_by_name: userProfile.display_name
                })
                .select()
                .single();

            if (error) throw error;

            // Trigger background execution pipeline
            await fetch('/api/process-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry_id: entry.id })
            });

        } catch (err) {
            console.error("Transmission Error:", err.message);
        } finally {
            setIsSending(false);
        }
    };

    if (!userProfile) return <div className="p-8 text-white bg-black h-screen font-mono">Connecting Terminal Node...</div>;

    return (
        <div className="flex flex-col h-screen bg-black text-white p-4 font-sans">
            <h1 className="text-lg font-black text-emerald-500 border-b border-gray-800 pb-4 mb-4">Master Ledger Channel</h1>
            <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 space-y-4 p-4 border border-gray-900 rounded-2xl bg-gray-950/40">
                {chatHistory.map((entry) => (
                    <div key={entry.id} className="space-y-1">
                        <div className="flex justify-end">
                            <div className="bg-emerald-950/20 border border-emerald-900/30 max-w-[85%] p-3 px-4 rounded-2xl rounded-tr-none">
                                <p className="text-sm text-gray-200">{entry.raw_text}</p>
                                <p className="text-[9px] text-gray-600 text-right mt-1 font-mono">By: {entry.logged_by_name} • [{entry.ai_status}]</p>
                            </div>
                        </div>
                        {entry.ai_status === 'done' && (
                            <div className="flex justify-start text-xs font-mono">
                                <div className="bg-gray-900/80 border border-gray-800 p-3 px-4 rounded-2xl rounded-tl-none">
                                    <p className="text-gray-400">Parsed: <span className="text-white font-bold">{entry.item}</span> ({entry.category})</p>
                                    <p className="text-emerald-400 font-bold mt-0.5">${Number(entry.amount).toFixed(2)} USD</p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <form onSubmit={handleSendPayload} className="flex gap-2 p-2 bg-gray-950 border border-gray-900 rounded-xl">
                <input
                    type="text" value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="Log a financial operational entry..." disabled={isSending}
                    className="flex-1 bg-transparent px-2 text-sm outline-none text-white placeholder-gray-600"
                />
                <button disabled={isSending} className="bg-white text-black px-5 py-2 font-black text-xs uppercase rounded-lg">Log</button>
            </form>
        </div>
    );
}