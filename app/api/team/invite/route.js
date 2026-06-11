'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '../../../src/lib/firebaseClient';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function SaaSCompanyTeamPage() {
    const [emailInput, setEmailInput] = useState('');
    const [displayNameInput, setDisplayNameInput] = useState('');
    const [memberRole, setMemberRole] = useState('member');
    const [isProcessing, setIsProcessing] = useState(false);

    const [tenantProfile, setTenantProfile] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [teamRegistry, setTeamRegistry] = useState([]);
    const [feedbackMessage, setFeedbackMessage] = useState({ text: '', type: '' });
    const router = useRouter();

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }

            // 1. Resolve Auth User Profile
            const userDocRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userDocRef);
            if (!userSnap.exists()) return;

            const profileData = userSnap.data();
            setUserProfile({ uid: user.uid, ...profileData });

            // Enforce basic role protection: Only owners or admins manage registration invites
            if (profileData.role === 'member') {
                router.push('/dashboard');
                return;
            }

            // 2. Fetch Active Business Tenant Workspace Constraints
            const tenantSnap = await getDoc(doc(db, 'tenants', profileData.tenant_id));
            if (tenantSnap.exists()) {
                setTenantProfile({ id: tenantSnap.id, ...tenantSnap.data() });
            }

            // 3. Keep a Live Sync of All Registered Active Workspace Teammates
            const teamQuery = query(
                collection(db, 'users'),
                where('tenant_id', '==', profileData.tenant_id)
            );

            const unsubscribeTeam = onSnapshot(teamQuery, (snapshot) => {
                const members = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
                setTeamRegistry(members);
            });

            return () => unsubscribeTeam();
        });

        return () => unsubscribeAuth();
    }, [router]);

    const handleProvisionMember = async (e) => {
        e.preventDefault();
        if (!emailInput.trim() || isProcessing || !tenantProfile) return;

        setIsProcessing(true);
        setFeedbackMessage({ text: '', type: '' });

        // Enforce Seating Capacity Slot Thresholds inside UI validation layer
        if (teamRegistry.length >= tenantProfile.max_user_slots) {
            setFeedbackMessage({
                text: `❌ Capacity Limit Reached: Your current tier limits you to ${tenantProfile.max_user_slots} seats. Please upgrade to provision more users.`,
                type: 'error'
            });
            setIsProcessing(false);
            return;
        }

        try {
            const response = await fetch('/api/team/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailInput.toLowerCase().trim(),
                    display_name: displayNameInput.trim() || 'Team Operator',
                    role: memberRole,
                    tenant_id: tenantProfile.id
                })
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || 'Provisioning API execution anomaly.');

            setFeedbackMessage({ text: '✅ Teammate provisioned successfully! They can now log in using a default temporary password.', type: 'success' });
            setEmailInput('');
            setDisplayNameInput('');
        } catch (err) {
            setFeedbackMessage({ text: `❌ Invite Failed: ${err.message}`, type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!userProfile || !tenantProfile) return <div className="p-8 text-white bg-black h-screen font-mono">Loading Security Configurations...</div>;

    return (
        <div className="min-h-screen bg-black text-gray-300 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Team Operations</h1>
                    <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-wider">
                        Workspace: <span className="text-green-500 font-bold">{tenantProfile.farm_name}</span> | Capacity: {teamRegistry.length} / {tenantProfile.max_user_slots} Slots Filled
                    </p>
                </div>

                {/* Provision Form */}
                <form onSubmit={handleProvisionMember} className="bg-gray-950 border border-gray-900 p-6 rounded-2xl space-y-4">
                    <h2 className="text-sm font-black text-green-500 uppercase tracking-widest">Provision New Teammate</h2>

                    {feedbackMessage.text && (
                        <div className={`p-3 rounded-lg text-xs font-mono font-bold border ${feedbackMessage.type === 'error' ? 'bg-red-950/20 border-red-900/40 text-red-400' : 'bg-green-950/20 border-green-900/40 text-green-400'}`}>
                            {feedbackMessage.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Email Address</label>
                            <input
                                type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                                className="w-full bg-black border border-gray-800 p-2.5 rounded-xl text-sm outline-none text-white focus:border-green-500/50"
                                placeholder="operator@mvurwi.com"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Display/Full Name</label>
                            <input
                                type="text" value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)}
                                className="w-full bg-black border border-gray-800 p-2.5 rounded-xl text-sm outline-none text-white focus:border-green-500/50"
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Platform Permission Role</label>
                            <select
                                value={memberRole} onChange={(e) => setMemberRole(e.target.value)}
                                className="w-full bg-black border border-gray-800 p-2.5 rounded-xl text-sm outline-none text-white focus:border-green-500/50"
                            >
                                <option value="member">Member (Read/Write Chat & Ledger)</option>
                                <option value="admin">Admin (Manage Team & Financials)</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" disabled={isProcessing} className="w-full md:w-auto bg-green-600 text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:bg-green-500 disabled:opacity-50">
                        {isProcessing ? 'Processing...' : 'Authorize and Create User'}
                    </button>
                </form>

                {/* Active Team Roster List */}
                <div className="bg-[#0a0a0a] rounded-2xl border border-gray-900 overflow-hidden">
                    <div className="p-4 bg-gray-950 border-b border-gray-900">
                        <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Active Member Registry</h3>
                    </div>
                    <ul className="divide-y divide-gray-900 font-mono text-xs">
                        {teamRegistry.map((member) => (
                            <li key={member.uid} className="p-4 flex justify-between items-center hover:bg-gray-950/40">
                                <div>
                                    <p className="font-bold text-gray-200">{member.display_name}</p>
                                    <p className="text-gray-600 text-[11px]">{member.email}</p>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${member.role === 'owner' ? 'bg-blue-950/30 border-blue-900/50 text-blue-400' : member.role === 'admin' ? 'bg-purple-950/30 border-purple-900/50 text-purple-400' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
                                    {member.role}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}