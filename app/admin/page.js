'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebaseClient';
import { collection, query, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function PlatformMasterAdminCenter() {
    const [tenants, setTenants] = useState([]);
    const [globalStats, setGlobalStats] = useState({ totalFarms: 0, totalAllocatedSeats: 0 });
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const verifyAdminCredentials = auth.onAuthStateChanged(async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            try {
                // 1. Pull the user's profile and evaluate master admin flags
                const userSnap = await getDoc(doc(db, 'users', user.uid));
                if (!userSnap.exists() || !userSnap.data().is_platform_admin) {
                    // Fail Securely: Bounce unauthorized clients out instantly
                    router.push('/dashboard');
                    return;
                }

                setIsAuthorized(true);

                // 2. Fetch all registered Tenants across the entire platform
                const tenantsQuery = query(collection(db, 'tenants'), orderBy('created_at', 'desc'));
                const tenantsSnapshot = await getDocs(tenantsQuery);

                // 3. Fetch all Users to calculate seat metrics globally
                const usersSnapshot = await getDocs(collection(db, 'users'));
                const allUsers = usersSnapshot.docs.map(d => d.data());

                const compiledTenants = tenantsSnapshot.docs.map(docSnap => {
                    const tenantData = docSnap.data();
                    // Count how many active users belong to this specific farm container
                    const activeSeatsFilled = allUsers.filter(u => u.tenant_id === docSnap.id).length;

                    return {
                        id: docSnap.id,
                        ...tenantData,
                        seatsFilled: activeSeatsFilled
                    };
                });

                setTenants(compiledTenants);

                // Calculate master platform metrics
                setGlobalStats({
                    totalFarms: compiledTenants.length,
                    totalAllocatedSeats: allUsers.length
                });

            } catch (err) {
                console.error("Master Admin Fetch Exception:", err.message);
            } finally {
                setLoading(false);
            }
        });

        return () => verifyAdminCredentials();
    }, [router]);

    if (loading) return <div className="p-8 text-purple-500 bg-black h-screen font-mono tracking-widest uppercase animate-pulse">Decrypting Master Registry Core...</div>;
    if (!isAuthorized) return null;

    return (
        <div className="min-h-screen bg-black text-gray-300 p-6 md:p-10 font-sans">
            {/* Admin Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-purple-900/40 pb-6 mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                        🛡️ Platform Admin HQ
                    </h1>
                    <p className="text-[10px] text-purple-400 font-mono tracking-widest uppercase mt-1">Global SaaS Architecture Overseer Panel</p>
                </div>
                <button onClick={() => router.push('/dashboard')} className="bg-purple-950/40 hover:bg-purple-900/50 text-purple-400 border border-purple-800/40 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all">
                    Return to Operational App
                </button>
            </div>

            {/* Macro Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-[#1e1b4b]/20 border border-purple-900/40 p-6 rounded-2xl backdrop-blur-sm">
                    <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Active Tenant Nodes</p>
                    <p className="text-3xl font-mono font-bold text-white">{globalStats.totalFarms} Farms</p>
                </div>
                <div className="bg-[#1e1b4b]/20 border border-purple-900/40 p-6 rounded-2xl backdrop-blur-sm">
                    <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Provisioned Global Seats</p>
                    <p className="text-3xl font-mono font-bold text-white">{globalStats.totalAllocatedSeats} Users</p>
                </div>
            </div>

            {/* Global Tenants Directory */}
            <div className="bg-[#050505] rounded-2xl border border-purple-900/30 overflow-hidden shadow-2xl">
                <div className="p-4 bg-gray-950/80 border-b border-purple-900/30">
                    <h2 className="text-xs font-black uppercase text-purple-400 tracking-widest">Global Farm Workspace Registry</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-950 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-900">
                        <tr>
                            <th className="px-6 py-4">Initialization Date</th>
                            <th className="px-6 py-4">Tenant Workspace ID</th>
                            <th className="px-6 py-4">Farm Operations Name</th>
                            <th className="px-6 py-4 text-center">Seat Capacity Allocations</th>
                            <th className="px-6 py-4 text-right">Status Flag</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-900 text-xs font-mono">
                        {tenants.map((tenant) => (
                            <tr key={tenant.id} className="hover:bg-purple-950/10 transition-all group">
                                <td className="px-6 py-4 text-gray-600">{new Date(tenant.created_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-gray-500 text-[11px] group-hover:text-purple-400 transition-all">{tenant.id}</td>
                                <td className="px-6 py-4 font-bold text-gray-200 font-sans text-sm">{tenant.farm_name}</td>
                                <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-md border text-[11px] font-bold ${
                                            tenant.seatsFilled >= tenant.max_user_slots ? 'bg-red-950/20 border-red-900/40 text-red-400' : 'bg-gray-950 border-gray-800 text-gray-400'
                                        }`}>
                                            {tenant.seatsFilled} / {tenant.max_user_slots} Seats Used
                                        </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-emerald-950/20 border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                                            Active
                                        </span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}