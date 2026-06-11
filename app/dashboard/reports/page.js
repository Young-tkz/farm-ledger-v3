'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient'; // 🧠 Pointing safely to your new client instance
import { useRouter } from 'next/navigation';

export default function SaaSReportsPage() {
    const [period, setPeriod] = useState('month');
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const router = useRouter();

    // Verify session credentials using your clean Supabase cookie token handler
    useEffect(() => {
        const verifySessionNode = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            // Grab the active operator profile record
            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (!error && profile) {
                setUserProfile(profile);
            }
        };
        verifySessionNode();
    }, [router]);

    const triggerReportCompilation = async () => {
        if (!userProfile) return;
        setLoading(true);
        setReport(null);

        try {
            // 1. Compute timeframe filters based on user selection range
            const now = new Date();
            let startDate = new Date();
            if (period === 'week') startDate.setDate(now.getDate() - 7);
            else if (period === 'quarter') startDate.setMonth(now.getMonth() - 3);
            else startDate.setMonth(now.getMonth() - 1);

            // 2. Fetch data from PostgreSQL using modern relational field mappings
            const { data: entries, error: dbError } = await supabase
                .from('ledger_entries')
                .select('*')
                .eq('ai_status', 'done')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            if (dbError) throw dbError;

            // 3. Process calculations using our normalized USD parameters
            const totalIncome = entries
                .filter(e => e.type === 'income' || e.category?.toLowerCase() === 'harvest')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

            const totalExpense = entries
                .filter(e => e.type === 'expense' || e.category?.toLowerCase() !== 'harvest')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

            // 4. Hit your backend report compiler endpoint
            const res = await fetch('/api/generate-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period,
                    entriesSummary: entries.map(e => `- ${e.item}: $${Number(e.amount).toFixed(2)} USD (${e.category || 'General'}) [Logged by: ${e.logged_by_name}]`).join('\n'),
                    totalIncome,
                    totalExpense
                })
            });

            if (!res.ok) throw new Error('Failed to generate professional narrative payload.');

            const data = await res.json();

            setReport({
                summary: { totalIncome, totalExpense, netProfit: totalIncome - totalExpense },
                analysis: data.analysis || data.summary_narrative || "System Analysis compilation completed.",
                entries: entries
            });

        } catch (err) {
            console.error("V-CFO Interface Error:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSystemPrintSequence = () => {
        window.print();
    };

    if (!userProfile) return <div className="p-8 text-white bg-black h-screen font-mono">Securing Analytical Workspace...</div>;

    return (
        <div className="p-4 md:p-8 bg-black min-h-screen text-white font-sans">
            <style jsx global>{`
                @media print {
                    .no-print, button, nav, .header-controls { display: none !important; }
                    body { background: white !important; color: black !important; padding: 20px !important; }
                    .report-container { border: none !important; background: white !important; color: black !important; }
                    .summary-box { background: #f9fafb !important; border: 1px solid #e5e7eb !important; color: black !important; }
                    .metric-card { background: #ffffff !important; border: 1px solid #eeeeee !important; color: black !important; }
                    .text-white, .text-gray-200, .text-gray-400 { color: black !important; }
                    .text-green-500 { color: #059669 !important; font-weight: bold !important; }
                    .text-red-500 { color: #dc2626 !important; font-weight: bold !important; }
                    p { line-height: 1.6 !important; margin-bottom: 1rem !important; }
                }
            `}</style>

            {/* Dashboard Controls */}
            <div className="mb-8 border-b border-gray-900 pb-6 no-print">
                <h1 className="text-xl font-black text-white tracking-tight uppercase">Financial Intelligence Hub</h1>
                <p className="text-gray-600 text-[10px] font-mono mt-1 uppercase tracking-wider">Compile institutional executive reports for capital deployment reviews.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-8 items-start md:items-center no-print">
                <div className="bg-gray-950 p-1 rounded-xl border border-gray-900 w-full md:w-auto flex">
                    {['week', 'month', 'quarter'].map((p) => (
                        <button
                            key={p} type="button" onClick={() => setPeriod(p)}
                            className={`flex-1 md:flex-none px-6 py-2 rounded-lg capitalize transition-all text-xs font-bold ${
                                period === p ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        type="button" onClick={triggerReportCompilation} disabled={loading}
                        className="flex-1 bg-white text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50"
                    >
                        {loading ? 'Synthesizing...' : 'Generate Executive Report'}
                    </button>
                    {report && (
                        <button type="button" onClick={handleSystemPrintSequence} className="px-6 py-3 rounded-xl border border-gray-800 text-gray-400 hover:text-white transition-all font-bold text-xs">
                            Export PDF
                        </button>
                    )}
                </div>
            </div>

            {/* Report Layout Renders */}
            {report ? (
                <div className="report-container space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="hidden print:block mb-8">
                        <h1 className="text-3xl font-black uppercase tracking-tight">Enterprise Capital Audit Report</h1>
                        <p className="text-gray-500 text-xs font-mono">Cycle Range: {period.toUpperCase()} | Compiled: {new Date().toLocaleDateString()}</p>
                    </div>

                    {/* Metric Visual Summaries */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="metric-card bg-gray-950 p-6 rounded-2xl border border-gray-900">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Normalized Inflows</p>
                            <h2 className="text-xl font-mono font-bold text-emerald-500">${report.summary.totalIncome.toFixed(2)} USD</h2>
                        </div>
                        <div className="metric-card bg-gray-950 p-6 rounded-2xl border border-gray-900">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Normalized Outflows</p>
                            <h2 className="text-xl font-mono font-bold text-red-500">${report.summary.totalExpense.toFixed(2)} USD</h2>
                        </div>
                        <div className="metric-card bg-gray-950 p-6 rounded-2xl border border-gray-900">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Net Corporate Balance</p>
                            <h2 className={`text-xl font-mono font-bold ${report.summary.netProfit >= 0 ? 'text-blue-400' : 'text-orange-500'}`}>
                                ${report.summary.netProfit.toFixed(2)} USD
                            </h2>
                        </div>
                    </div>

                    {/* AI Executive Analysis Render Block */}
                    <div className="summary-box bg-emerald-950/5 border border-emerald-900/30 p-6 md:p-10 rounded-3xl">
                        <h3 className="text-emerald-500 font-mono text-[10px] uppercase font-black tracking-widest mb-6">Virtual CFO Strategic Overview</h3>
                        <div className="space-y-6 text-gray-200 leading-relaxed text-sm md:text-base font-medium">
                            {typeof report.analysis === 'string' ? (
                                report.analysis.split('\n').map((para, i) => para.trim() && <p key={i}>{para}</p>)
                            ) : (
                                <p>Report metrics synthesized successfully.</p>
                            )}
                        </div>
                    </div>

                    {/* Transaction Audit Subtable */}
                    <div className="bg-[#0a0a0a] border border-gray-900 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-950 text-gray-500 uppercase font-black tracking-widest border-b border-gray-900">
                            <tr>
                                <th className="p-4">Item Infrastructure Metric & Category</th>
                                <th className="p-4">Audit Signature (Who)</th>
                                <th className="p-4 text-right">Accounting Value (USD)</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-900">
                            {report.entries.map((entry, idx) => (
                                <tr key={idx} className="print:bg-white">
                                    <td className="p-4">
                                        <p className="font-bold text-gray-200 print:text-black">{entry.item}</p>
                                        <p className="text-[10px] uppercase text-gray-600 mt-0.5">{entry.category}</p>
                                    </td>
                                    <td className="p-4 text-gray-400 font-mono">{entry.logged_by_name}</td>
                                    <td className={`p-4 text-right font-mono font-bold ${entry.type === 'income' ? 'text-emerald-500' : 'text-gray-400 print:text-black'}`}>
                                        {entry.type === 'income' ? '+' : '-'}${Number(entry.amount || 0).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-gray-900 rounded-[2.5rem] bg-gray-950/10 no-print">
                    <div className="w-12 h-12 rounded-full border border-gray-900 flex items-center justify-center mb-4 text-gray-600">📄</div>
                    <p className="text-gray-600 font-black uppercase tracking-widest text-[10px] font-mono">Awaiting Analytical Synthesis Trigger</p>
                </div>
            )}
        </div>
    );
}