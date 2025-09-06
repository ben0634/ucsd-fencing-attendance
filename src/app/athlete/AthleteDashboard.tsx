"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

export default function AthleteDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [practiceSchedules, setPracticeSchedules] = useState<{[key: string]: string[]}>({});
  const [customNoPracticeDays, setCustomNoPracticeDays] = useState<{[key: string]: string[]}>({});
  const [customPracticeDays, setCustomPracticeDays] = useState<{[key: string]: string[]}>({});
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

  // Helper function to format date as YYYY-MM-DD in local timezone
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  const fetchAttendanceData = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const weekDates = getWeekDates();
      const startDate = getLocalDateString(weekDates[0]);
      const endDate = getLocalDateString(weekDates[weekDates.length - 1]);

      const response = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { attendance } = await response.json();
        setAttendanceData(attendance || []);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    }
  };

  const fetchPracticeSchedules = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/practice-schedule', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { schedules } = await response.json();
        const scheduleMap: {[key: string]: string[]} = {};
        const customNoPracticeMap: {[key: string]: string[]} = {};
        const customPracticeMap: {[key: string]: string[]} = {};
        
        schedules?.forEach((schedule: any) => {
          scheduleMap[schedule.squad_id] = schedule.practice_days || [];
          customNoPracticeMap[schedule.squad_id] = schedule.custom_no_practice_days || [];
          customPracticeMap[schedule.squad_id] = schedule.custom_practice_days || [];
        });
        
        setPracticeSchedules(scheduleMap);
        setCustomNoPracticeDays(customNoPracticeMap);
        setCustomPracticeDays(customPracticeMap);
      }
    } catch (error) {
      console.error('Error fetching practice schedules:', error);
    }
  };

  const getAttendanceStatus = (date: Date) => {
    const dateString = getLocalDateString(date);
    const record = attendanceData.find((a) => a.date === dateString);
    return record?.status || null;
  };

  const hasPractice = (date: Date) => {
    if (!user) return true; // Default to showing practice if we don't know
    
    const dateString = getLocalDateString(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const squadId = `${user.user_metadata?.gender}_${user.user_metadata?.weapon}`;
    
    // Check custom no-practice days first
    const squadCustomNoPractice = customNoPracticeDays[squadId] || [];
    const allTeamCustomNoPractice = customNoPracticeDays['all'] || [];
    
    if (squadCustomNoPractice.includes(dateString) || allTeamCustomNoPractice.includes(dateString)) {
      return false;
    }
    
    // Check custom practice days
    const squadCustomPractice = customPracticeDays[squadId] || [];
    const allTeamCustomPractice = customPracticeDays['all'] || [];
    
    if (squadCustomPractice.includes(dateString) || allTeamCustomPractice.includes(dateString)) {
      return true;
    }
    
    // Fall back to regular schedule
    const squadSchedule = practiceSchedules[squadId] || [];
    return squadSchedule.includes(dayName);
  };

  // Fetch attendance data when week changes
  useEffect(() => {
    if (user) {
      fetchAttendanceData();
      fetchPracticeSchedules();
    }
  }, [currentWeekOffset, user]);

  useEffect(() => {
    async function checkUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/"); // kick back to login
        return;
      }

      setUser(data.user);
      setLoading(false);
    }

    checkUser();
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
          <div>
            <h1 className="text-2xl font-bold text-yellow-300 mb-1">
              Welcome, {user?.user_metadata?.firstName ? 
                `${user.user_metadata.firstName} ${user.user_metadata.lastName}` :
                user?.user_metadata?.username || user?.email?.split("@")[0]}!
            </h1>
            <p className="text-yellow-100 text-base font-semibold">
              Squad: {user?.user_metadata?.gender === 'male' ? "Men's" : user?.user_metadata?.gender === 'female' ? "Women's" : user?.user_metadata?.gender} {user?.user_metadata?.weapon?.charAt(0).toUpperCase() + user?.user_metadata?.weapon?.slice(1)}
            </p>
          </div>
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
            
            <h2 className="text-lg font-semibold text-gray-900">
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
                <th className="p-2 border text-gray-900 font-bold text-base">Day</th>
                <th className="p-2 border text-gray-900 font-bold text-base">Status</th>
              </tr>
            </thead>
            <tbody>
              {dayNames.map((dayName, index) => {
                const currentDate = weekDates[index];
                const status = getAttendanceStatus(currentDate);
                const hasScheduledPractice = hasPractice(currentDate);
                
                return (
                  <tr key={dayName}>
                    <td className="p-2 border text-gray-900 font-semibold">
                      {dayName} ({formatDate(currentDate)})
                    </td>
                    <td className="p-2 border text-center text-gray-900">
                      {!hasScheduledPractice ? (
                        <span className="text-gray-500 font-semibold italic">No Practice</span>
                      ) : status ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          status === 'on-time' ? 'bg-green-100 text-green-800' :
                          status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          status === 'late-justified' ? 'bg-yellow-100 text-yellow-800' :
                          status === 'excused' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {status === 'on-time' ? 'On Time' :
                           status === 'late' ? 'Late' :
                           status === 'late-justified' ? 'Late (Justified)' :
                           status === 'excused' ? 'Excused' :
                           'Missing'}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">Not Marked</span>
                      )}
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
