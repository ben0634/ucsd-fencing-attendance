"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("changeme");
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
    else router.push("/"); // fallback
  };

  if (user === undefined) return <p>Loading...</p>;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email: username + "@ucsd-fencing.edu", // match the email format from createUsers
      password,
    });

    if (error) setError(error.message);
    else if (session?.user) redirectToRole(session.user.user_metadata.role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        {/* Header with Logo/Icon */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mb-4 overflow-hidden">
            <Image
              src="/fencing-logo.png"
              alt="UCSD Fencing Logo"
              width={64}
              height={64}
              className="rounded-full"
              onError={() => {
                // Fallback to SVG if image doesn't exist
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">UCSD Fencing</h1>
          <p className="text-gray-600">Attendance Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent transition duration-200 ease-in-out"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent transition duration-200 ease-in-out"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-opacity-50"
          >
            Sign In
          </button>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="text-sm">{error}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
