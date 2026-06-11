'use client';

import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function RootEntryMainframe() {
  const router = useRouter();

  useEffect(() => {
    const evaluateSessionNode = async () => {
      // Check if Supabase holds an active user authentication cookie token
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is authenticated, drop them straight into the command grid
        router.push('/dashboard');
      } else {
        // No session found, send them to the login terminal gate
        router.push('/login');
      }
    };

    evaluateSessionNode();
  }, [router]);

  return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono text-xs text-emerald-500 tracking-widest uppercase">
        <div className="flex flex-col items-center gap-3">
          <span className="animate-pulse">Establishing Secure Stream Node...</span>
          <div className="w-32 h-[1px] bg-emerald-950 overflow-hidden relative">
            <div className="w-12 h-full bg-emerald-500 absolute left-0 top-0 animate-[loading_1.5s_infinite_ease-in-out]" />
          </div>
        </div>

        {/* Injected small keyframe utility styling block for our custom loading bar tracker */}
        <style jsx global>{`
                @keyframes loading {
                    0% { left: -40%; }
                    50% { left: 100%; }
                    100% { left: -40%; }
                }
            `}</style>
      </div>
  );
}