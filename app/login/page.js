'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AuthenticationGateway() {
    const [isSignUpMode, setIsSignUpMode] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [feedback, setFeedback] = useState('');
    const [processing, setProcessing] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // If an operator already has an active session cookie, route them directly past the gate
        const checkActiveSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) router.push('/dashboard');
        };
        checkActiveSession();
    }, [router]);

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setProcessing(true);
        setFeedback('');

        try {
            if (isSignUpMode) {
                const { data, error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password
                });

                if (error) throw error;

                if (data.user) {
                    const fallbackName = email.trim().toLowerCase() === 'tkchidamba@gmail.com' ? 'Tory (Admin)' : fullName.trim() || 'Operator';
                    const fallbackRole = email.trim().toLowerCase() === 'tkchidamba@gmail.com' ? 'admin' : 'member';

                    await supabase.from('users').insert({
                        id: data.user.id,
                        email: email.trim().toLowerCase(),
                        display_name: fallbackName,
                        role: fallbackRole
                    });
                }
                setFeedback('Registration check completed! Confirm credentials or sign in.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password: password
                });
                if (error) throw error;
                router.push('/dashboard');
            }
        } catch (err) {
            setFeedback(err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 text-gray-400 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-gray-950 border border-gray-900 p-6 md:p-8 rounded-3xl space-y-6 shadow-2xl">
                <div className="text-center">
                    <h1 className="text-white font-black text-xl uppercase tracking-tight">{isSignUpMode ? 'Register Operator' : 'System Access'}</h1>
                    <p className="text-[10px] font-mono tracking-widest text-emerald-600 uppercase mt-1">Supabase Sovereign Engine Console</p>
                </div>

                {feedback && <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl text-xs text-center font-mono text-gray-300">{feedback}</div>}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                    {isSignUpMode && (
                        <input type="text" required placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs outline-none text-white focus:border-emerald-500/40 font-sans" />
                    )}
                    <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs outline-none text-white font-mono focus:border-emerald-500/40" />
                    <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs outline-none text-white font-mono focus:border-emerald-500/40" />
                    <button type="submit" disabled={processing} className="w-full bg-white text-black py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">
                        {processing ? '...' : isSignUpMode ? 'Register' : 'Connect'}
                    </button>
                </form>

                <div className="text-center border-t border-gray-900/60 pt-4">
                    <button type="button" onClick={() => setIsSignUpMode(!isSignUpMode)} className="text-[11px] font-mono text-gray-500 underline hover:text-white transition-colors">
                        {isSignUpMode ? 'Have an operator token? Access here' : 'Register fresh terminal operator credentials'}
                    </button>
                </div>
            </div>
        </div>
    );
}