"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
      email: username + "@example.com", // auto-generated emails
      password,
    });

    if (error) setError(error.message);
    else if (session?.user) redirectToRole(session.user.user_metadata.role);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded shadow">
      <h1 className="text-2xl mb-4">Team Login</h1>
      
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded">
          Log In
        </button>
        {error && <p className="text-red-500">{error}</p>}
      </form>
    </div>
  );
}
