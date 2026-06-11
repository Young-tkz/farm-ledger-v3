'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function OverviewDashboard() {
    const [userProfile, setUserProfile] = useState(null);
    const [stats, setStats] = useState({ totalIncome: 0, totalExpense: 0, netPosition: 0 });
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const establishSession = async () => {
            // 1. Check for an active session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            try {
                const user = session.user;

                // 2. Fetch or self-heal the profile record
                let { data: profile, error: profileErr } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileErr && profileErr.code === 'PGRST116') {
                    // Profile record missing, auto-provision it
                    const fallbackName = user.email === 'tkchidamba@gmail.com' ? 'Tory (Admin)' : 'Farm Operator';
                    const fallbackRole = user.email === 'tkchidamba@gmail.com' ? 'admin' : 'member';

                    const { data: newProfile } = await supabase
                        .from('users')
                        .insert({ id: user.id, email: user.email, display_name: fallbackName, role: fallbackRole })
                        .select()
                        .single();
                    profile = newProfile;
                }

                setUserProfile(profile);

                // 3. Fetch running financial statements from PostgreSQL
                const { data: entries, error: ledgerErr } = await supabase
                    .from('ledger_entries')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (ledgerErr) throw ledgerErr;

                let accumulatedIncome = 0;
                let accumulatedExpense = 0;

                entries.forEach(entry => {
                    if (entry.ai_status === 'done' || entry.amount) {
                        const amt = Number(entry.amount) || 0;
                        if (entry.type === 'income' || entry.category?.toLowerCase() === 'income') {
                            accumulatedIncome += amt;
                        } else {
                            accumulatedExpense += amt;
                        }
                    }
                });

                setStats({
                    totalIncome: accumulatedIncome,
                    totalExpense: accumulatedExpense,
                    netPosition: accumulatedIncome - accumulatedExpense
                });
                setRecentTransactions(entries.slice(0, 5));

            } catch (err) {
                console.error("Dashboard calculation pipeline failure:", err.message);
            } finally {
                setLoading(false);
            }
        };

        establishSession();
    }, [router]);

    if (loading) return <div className="p-8 text-emerald-500 bg-black h-screen font-mono uppercase tracking-widest animate-pulse">Syncing Supabase Core...</div>;

    return (
        <div className="p-6 md:p-10 bg-black min-h-screen text-gray-400 font-sans space-y-8">
            <div className="border-b border-gray-900 pb-6">
                <h1 className="text-xl font-black text-white tracking-tight uppercase">Sovereign Control Command</h1>
                <p className="text-[10px] text-gray-600 font-mono tracking-wider uppercase mt-1">
                    Identity: {userProfile?.display_name} ({userProfile?.email}) — <span className="text-emerald-500 font-bold">{userProfile?.role}</span>
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-950 border border-gray-900 p-6 rounded-2xl">
                    <p className="text-[10px] font-black tracking-wider uppercase text-gray-500 mb-1">Aggregated Inflows</p>
                    <p className="text-2xl font-bold font-mono text-white">${stats.totalIncome.toFixed(2)}</p>
                </div>
                <div className="bg-gray-950 border border-gray-900 p-6 rounded-2xl">
                    <p className="text-[10px] font-black tracking-wider uppercase text-gray-500 mb-1">Aggregated Outflows</p>
                    <p className="text-2xl font-bold font-mono text-red-500">${stats.totalExpense.toFixed(2)}</p>
                </div>
                <div className="bg-gray-950 border border-gray-900 p-6 rounded-2xl">
                    <p className="text-[10px] font-black tracking-wider uppercase text-gray-500 mb-1">Net Position</p>
                    <p className={`text-2xl font-bold font-mono ${stats.netPosition >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        ${stats.netPosition.toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="bg-gray-950 border border-gray-900 rounded-2xl p-4 shadow-xl">
                <h2 className="text-xs font-black uppercase text-white tracking-wider mb-4">Trailing Ledger Trace</h2>
                {recentTransactions.length === 0 ? (
                    <p className="p-4 text-xs font-mono text-gray-600 uppercase text-center">No logs found in table epoch.</p>
                ) : (
                    <div className="space-y-3">
                        {recentTransactions.map((tx) => (
                            <div key={tx.id} className="flex justify-between items-center text-xs font-mono border-b border-gray-900 pb-2 last:border-0">
                                <div>
                                    <p className="text-gray-300 font-sans font-medium">{tx.raw_text}</p>
                                    <p className="text-[9px] text-gray-600">Logged by: {tx.logged_by_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${tx.type === 'income' ? 'text-emerald-500' : 'text-gray-400'}`}>
                                        {tx.amount ? `$${Number(tx.amount).toFixed(2)}` : 'Processing...'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}