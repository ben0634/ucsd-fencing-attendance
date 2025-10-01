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

        {/* Modern Weekly Attendance Calendar */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Calendar Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={goToPreviousWeek}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">
                  {currentWeekOffset === 0 ? "This Week's" : 
                   currentWeekOffset === -1 ? "Last Week's" :
                   currentWeekOffset === 1 ? "Next Week's" :
                   currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
                   `${currentWeekOffset} Weeks Ahead`} Attendance
                </h2>
                <p className="text-blue-100 text-sm font-medium">
                  {formatWeekRange(weekDates)}
                </p>
              </div>
              
              <div className="flex gap-2">
                {currentWeekOffset !== 0 && (
                  <button
                    onClick={goToCurrentWeek}
                    className="px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 text-sm backdrop-blur-sm"
                  >
                    Today
                  </button>
                )}
                <button
                  onClick={goToNextWeek}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
              {dayNames.map((dayName, index) => {
                const currentDate = weekDates[index];
                const status = getAttendanceStatus(currentDate);
                const hasScheduledPractice = hasPractice(currentDate);
                const isToday = currentDate.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={dayName}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                      isToday 
                        ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-lg' 
                        : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    {/* Day Header */}
                    <div className="text-center mb-3">
                      <div className={`text-sm font-semibold uppercase tracking-wide ${
                        isToday ? 'text-yellow-700' : 'text-gray-600'
                      }`}>
                        {dayName}
                      </div>
                      <div className={`text-2xl font-bold ${
                        isToday ? 'text-yellow-800' : 'text-gray-800'
                      }`}>
                        {currentDate.getDate()}
                      </div>
                      <div className={`text-xs ${
                        isToday ? 'text-yellow-600' : 'text-gray-500'
                      }`}>
                        {currentDate.toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                    </div>

                    {/* Practice Status */}
                    <div className="text-center">
                      {!hasScheduledPractice ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-gray-500">No Practice</span>
                        </div>
                      ) : status ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            status === 'on-time' ? 'bg-green-100 text-green-600' :
                            status === 'late' ? 'bg-yellow-100 text-yellow-600' :
                            status === 'late-justified' ? 'bg-green-100 text-green-600' :
                            status === 'excused' ? 'bg-blue-100 text-blue-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {status === 'on-time' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : status === 'late' || status === 'late-justified' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : status === 'excused' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            status === 'on-time' ? 'bg-green-100 text-green-700' :
                            status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                            status === 'late-justified' ? 'bg-green-100 text-green-700' :
                            status === 'excused' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {status === 'on-time' ? 'On Time' :
                             status === 'late' ? 'Late' :
                             status === 'late-justified' ? 'Late (Justified)' :
                             status === 'excused' ? 'Excused' :
                             'Missing'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-xs font-medium text-gray-400">Not Marked</span>
                        </div>
                      )}
                    </div>

                    {/* Today indicator */}
                    {isToday && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">On Time</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-gray-700">Late</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-gray-700">Late (Justified)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-gray-700">Excused</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-gray-700">Missing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-gray-700">No Practice</span>
              </div>
            </div>
          </div>

          {/* Stats Display */}
          <div className="mt-8 mb-4">
            {(() => {
              const stats = { onTime: 0, late: 0, lateJustified: 0, excused: 0, missing: 0, notMarked: 0, total: 0 };
              weekDates.forEach(date => {
                const status = getAttendanceStatus(date);
                if (!hasPractice(date)) return;
                stats.total++;
                if (!status) stats.notMarked++;
                else if (status === 'on-time') stats.onTime++;
                else if (status === 'late') stats.late++;
                else if (status === 'late-justified') stats.lateJustified++;
                else if (status === 'excused') stats.excused++;
                else stats.missing++;
              });
              const percent = (count: number) => stats.total ? ((count / stats.total) * 100).toFixed(0) : '0';
              return (
                <div className="flex flex-wrap justify-center gap-6 bg-white rounded-xl shadow border border-gray-200 p-4">
                  <div className="flex flex-col items-center">
                    <span className="text-green-700 font-bold text-lg">{stats.onTime}</span>
                    <span className="text-xs text-gray-600">On Time</span>
                    <span className="text-xs text-green-700">{percent(stats.onTime)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-green-700 font-bold text-lg">{stats.lateJustified}</span>
                    <span className="text-xs text-gray-600">Late (Justified)</span>
                    <span className="text-xs text-green-700">{percent(stats.lateJustified)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-yellow-700 font-bold text-lg">{stats.late}</span>
                    <span className="text-xs text-gray-600">Late</span>
                    <span className="text-xs text-yellow-700">{percent(stats.late)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-blue-700 font-bold text-lg">{stats.excused}</span>
                    <span className="text-xs text-gray-600">Excused</span>
                    <span className="text-xs text-blue-700">{percent(stats.excused)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-red-700 font-bold text-lg">{stats.missing}</span>
                    <span className="text-xs text-gray-600">Missing</span>
                    <span className="text-xs text-red-700">{percent(stats.missing)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-gray-700 font-bold text-lg">{stats.notMarked}</span>
                    <span className="text-xs text-gray-600">Not Marked</span>
                    <span className="text-xs text-gray-700">{percent(stats.notMarked)}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
