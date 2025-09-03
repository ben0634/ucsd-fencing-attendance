"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CoachDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (!currentUser || currentUser.user_metadata.role !== "coach") {
        router.push("/"); // redirect if not coach or not logged in
      }
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (user === undefined) return <p>Loading...</p>;
  if (!user) return null;

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Welcome, Coach {user.user_metadata.firstName ?? user.email}</h1>
      <p>This is the Coach Dashboard.</p>
      <button
        onClick={handleLogout}
        className="mt-4 bg-red-500 text-white p-2 rounded"
      >
        Log Out
      </button>
    </div>
  );
}
