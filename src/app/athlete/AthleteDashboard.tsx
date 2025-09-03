"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AthleteDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      // Fetch the current session
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;

      // If not logged in OR role is wrong, redirect safely
      if (!currentUser) {
        router.push("/");
        return;
      }

      if (currentUser.user_metadata.role !== "athlete") {
        router.push("/"); 
        return;
      }

      setUser(currentUser);
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Show loading while checking session
  if (user === undefined) return <p>Loading...</p>;
  if (!user) return null; // redirecting

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Welcome, {user.user_metadata?.firstName ?? user.email}</h1>
      <p>This is your Athlete Dashboard.</p>
      <button
        onClick={handleLogout}
        className="mt-4 bg-red-500 text-white p-2 rounded"
      >
        Log Out
      </button>
    </div>
  );
}
