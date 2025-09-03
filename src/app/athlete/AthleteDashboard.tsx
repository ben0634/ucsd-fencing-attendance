"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function AthleteDashboard() {
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0); // 0 = current week, -1 = last week, 1 = next week
  const router = useRouter();

  // Get current week's dates with offset
  const getWeekDates = () => {
    const today = new Date();
    // Add week offset (7 days per week)
    today.setDate(today.getDate() + (currentWeekOffset * 7));
    
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Sunday of this week
    const sundayOffset = -currentDay;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + sundayOffset);
    
    // Generate all 7 days (Sun-Sat)
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      weekDays.push(day);
    }
    
    return weekDays;
  };

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatWeekRange = (dates: Date[]) => {
    const start = dates[0];
    const end = dates[dates.length - 1];
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const weekDates = getWeekDates();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const goToPreviousWeek = () => {
    setCurrentWeekOffset(currentWeekOffset - 1);
  };

  const goToNextWeek = () => {
    setCurrentWeekOffset(currentWeekOffset + 1);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekOffset(0);
  };

  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/"); // kick back to login
        return;
      }

      // try firstName + lastName from metadata, else fallback
      const meta = data.user.user_metadata || {};
      const displayName =
        meta.firstName && meta.lastName
          ? `${meta.firstName} ${meta.lastName}`
          : meta.username || data.user.email?.split("@")[0];

      setUserName(displayName);
      setLoading(false);
    }

    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 p-6">
      <div className="max-w-screen-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-white">Welcome, {userName}!</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            Logout
          </button>
        </div>

        {/* Placeholder weekly attendance layout */}
        <div className="border rounded p-4 bg-white shadow">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ← Previous Week
            </button>
            
            <h2 className="text-lg font-semibold">
              {currentWeekOffset === 0 ? "This Week's" : 
               currentWeekOffset === -1 ? "Last Week's" :
               currentWeekOffset === 1 ? "Next Week's" :
               currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
               `${currentWeekOffset} Weeks Ahead`} Attendance ({formatWeekRange(weekDates)})
            </h2>
            
            <div className="flex gap-2">
              {currentWeekOffset !== 0 && (
                <button
                  onClick={goToCurrentWeek}
                  className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
                >
                  Current
                </button>
              )}
              <button
                onClick={goToNextWeek}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Next Week →
              </button>
            </div>
          </div>
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border">Day</th>
                <th className="p-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {dayNames.map((dayName, index) => {
                const isWeekend = dayName === "Saturday" || dayName === "Sunday";
                return (
                  <tr key={dayName}>
                    <td className="p-2 border">
                      {dayName} ({formatDate(weekDates[index])})
                    </td>
                    <td className="p-2 border text-center">
                      {isWeekend ? "X" : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
