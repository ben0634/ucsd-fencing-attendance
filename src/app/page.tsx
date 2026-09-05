"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import { supabase } from "../lib/supabaseClient";
export default function LoginPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Check session on mount but don't auto-redirect
  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
    };

    fetchSession();

    // Only redirect on SIGN_IN events, not initial load
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Only redirect when user actually signs in
      if (event === 'SIGNED_IN' && currentUser) {
        redirectToRole(currentUser.user_metadata.role);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  const redirectToRole = (role: string) => {
    if (role === "athlete") router.push("/athlete");
    else if (role === "coach") router.push("/coach");
    else if (role === "captain") router.push("/captain");
    else if (role === "admin") router.push("/admin");
    else if (role === "data-analyzer") router.push("/data-analyzer");
    else router.push("/"); // fallback
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#182B49] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Loading Portal...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: username + "@localhost", // match the email format from createUsers
      password,
    });

    if (error) setError(error.message);
    else if (session?.user) redirectToRole(session.user.user_metadata.role);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Centered Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navy Header Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#182B49] via-[#00629B] to-[#FFCD00]" />

        <div className="p-8 sm:p-10">
          {/* Header Branding */}
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex items-center justify-center mb-4">
              <Image
                src="/fencing-logo.png"
                alt="UCSD Fencing Logo"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </div>
            <p className="text-[11px] font-bold tracking-widest text-[#C69214] uppercase">
              UC San Diego Athletics
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
              TRITONS FENCING
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Team Attendance &amp; Practice Portal
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  placeholder="e.g. jsmith"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:border-[#182B49] focus:ring-1 focus:ring-[#182B49] transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:border-[#182B49] focus:ring-1 focus:ring-[#182B49] transition-colors"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-lg text-xs font-medium">
                <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full mt-2 bg-[#182B49] hover:bg-[#1e365d] active:bg-[#132239] text-white font-bold py-2.5 px-4 rounded-lg text-sm tracking-wide transition-colors cursor-pointer"
            >
              Sign In to Portal
            </button>
          </form>
        </div>

        {/* Card Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-8 py-3 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            UC San Diego NCAA Fencing &bull; Team Roster &amp; Attendance
          </p>
        </div>
      </div>
    </div>
  );
}
