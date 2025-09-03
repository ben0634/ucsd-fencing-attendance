"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

export default function CaptainDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [athletes, setAthletes] = useState<any[]>([]); // Changed to any[] for users table
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [markingAttendance, setMarkingAttendance] = useState<{[key: string]: boolean}>({});
  const [message, setMessage] = useState<string>('');
  const [viewMode, setViewMode] = useState<'mark' | 'view'>('mark'); // 'mark' for marking others, 'view' for viewing own
  const router = useRouter();

  // Get current week's dates with offset (same as athlete dashboard)
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

  // Fetch attendance data when week changes, view mode changes, or after marking attendance
  useEffect(() => {
    if (user && user.user_metadata.role === 'captain') {
      fetchAttendanceData();
    }
  }, [currentWeekOffset, user, viewMode]);

  const goToCurrentWeek = () => {
    setCurrentWeekOffset(0);
  };

  const fetchAttendanceData = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const weekDates = getWeekDates();
      const startDate = weekDates[0].toISOString().split('T')[0];
      const endDate = weekDates[weekDates.length - 1].toISOString().split('T')[0];

      let url = `/api/attendance?startDate=${startDate}&endDate=${endDate}`;
      
      // If viewing own attendance, filter by current user
      if (viewMode === 'view' && user) {
        url += `&athleteId=${user.id}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { attendance } = await response.json();
        setAttendanceData(attendance || []);
      } else {
        console.error('Error fetching attendance:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    }
  };

  const getAttendanceStatus = (athleteId: string, date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    const record = attendanceData.find(
      (a) => a.athlete_id === athleteId && a.date === dateString
    );
    return record?.status || null;
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (!currentUser || currentUser.user_metadata.role !== "captain") {
        router.push("/"); // redirect if not captain or not logged in
        return;
      }

      // Fetch athletes from the same squad using API endpoint
      try {
        console.log('=== Captain Dashboard Debug ===');
        console.log('Current user metadata:', currentUser.user_metadata);
        console.log('Looking for athletes with weapon:', currentUser.user_metadata?.weapon, 'gender:', currentUser.user_metadata?.gender);
        
        // Get the current session token
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('Session data available:', !!sessionData.session);
        const accessToken = sessionData.session?.access_token;
        
        if (!accessToken) {
          console.error('No access token available');
          setAthletes([]);
          setLoading(false);
          return;
        }
        
        console.log('Access token available, length:', accessToken.length);
        
        // Call the API endpoint
        console.log('Calling API endpoint...');
        const response = await fetch('/api/squad-athletes', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('API response status:', response.status);
        console.log('API response ok:', response.ok);
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('API error:', errorData);
          setAthletes([]);
        } else {
          const responseData = await response.json();
          console.log('API response data:', responseData);
          const { athletes } = responseData;
          console.log('Athletes from API:', athletes);
          console.log('Number of athletes:', athletes?.length || 0);
          setAthletes(athletes || []);
          console.log('Athletes state updated to:', athletes?.length || 0, 'athletes');
          
          // Fetch attendance data after getting athletes
          await fetchAttendanceData();
        }
        
      } catch (error) {
        console.error('Error fetching athletes:', error);
        setAthletes([]);
      }
      
      setLoading(false);
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const markAttendance = async (athleteId: string, date: Date, status: string) => {
    const key = `${athleteId}-${date.toISOString().split('T')[0]}`;
    setMarkingAttendance(prev => ({ ...prev, [key]: true }));
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          athleteId,
          date: date.toISOString(),
          status
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark attendance');
      }

      // Show success message
      setMessage(result.message || 'Attendance marked successfully');
      
      // Immediately update the attendance data in state to reflect the change
      // This ensures the UI updates instantly before the API refetch completes
      const dateString = date.toISOString().split('T')[0];
      setAttendanceData(prevData => {
        const existingIndex = prevData.findIndex(
          a => a.athlete_id === athleteId && a.date === dateString
        );
        
        const newRecord = {
          athlete_id: athleteId,
          date: dateString,
          status: status,
          marked_by: user?.id,
          updated_at: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
          // Update existing record
          const newData = [...prevData];
          newData[existingIndex] = { ...newData[existingIndex], ...newRecord };
          return newData;
        } else {
          // Add new record
          return [...prevData, newRecord];
        }
      });
      
      // Also refresh attendance data from server to ensure consistency
      await fetchAttendanceData();

      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      console.error('Error marking attendance:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to mark attendance'}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setMarkingAttendance(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (user === undefined) return <p className="p-4">Loading...</p>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 p-6">
      <div className="max-w-screen-lg mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-yellow-300 mb-1">Welcome, Captain {user.user_metadata.firstName ?? user.email}</h1>
            <p className="text-yellow-100 text-base font-semibold">
              Squad: {user.user_metadata?.gender === 'male' ? "Men's" : user.user_metadata?.gender === 'female' ? "Women's" : user.user_metadata?.gender} {user.user_metadata?.weapon?.charAt(0).toUpperCase() + user.user_metadata?.weapon?.slice(1)}
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setViewMode(viewMode === 'mark' ? 'view' : 'mark')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              {viewMode === 'mark' ? 'My Attendance' : 'Mark Attendance'}
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Attendance Interface */}
        <div className="border rounded p-4 bg-white shadow">
          {message && (
            <div className={`mb-4 p-3 rounded ${
              message.startsWith('Error') 
                ? 'bg-red-100 text-red-700 border border-red-300' 
                : 'bg-green-100 text-green-700 border border-green-300'
            }`}>
              {message}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ← Previous Week
            </button>
            
            <h2 className="text-lg font-semibold text-gray-900">
              {viewMode === 'mark' ? 'Mark Attendance' : 'My Attendance'} - {currentWeekOffset === 0 ? "This Week" : 
               currentWeekOffset === -1 ? "Last Week" :
               currentWeekOffset === 1 ? "Next Week" :
               currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
               `${currentWeekOffset} Weeks Ahead`} ({formatWeekRange(weekDates)})
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

          {viewMode === 'mark' && (
            // Mark Attendance Mode - Show athletes in squad
            athletes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No athletes found. Make sure you have created athlete accounts.</p>
                <p className="text-sm mt-2">Run: <code>node scripts/createUsers.js</code></p>
              </div>
            ) : (
              <div className="space-y-4">
                {dayNames.map((dayName, dayIndex) => {
                  const isWeekend = dayName === "Saturday" || dayName === "Sunday";
                  const currentDate = weekDates[dayIndex];
                  
                  if (isWeekend) {
                    return (
                      <div key={dayName} className="border rounded p-3 bg-gray-50">
                        <h3 className="font-bold text-lg text-gray-600">
                          {dayName} ({formatDate(currentDate)}) - No Practice
                        </h3>
                      </div>
                    );
                  }

                  return (
                    <div key={dayName} className="border rounded p-3">
                      <h3 className="font-bold text-lg mb-3 text-gray-900">
                        {dayName} ({formatDate(currentDate)})
                      </h3>
                      
                      <div className="grid gap-2">
                        {athletes.map((athlete) => {
                          const currentStatus = getAttendanceStatus(athlete.id, currentDate);
                          const markingKey = `${athlete.id}-${currentDate.toISOString().split('T')[0]}`;
                          const isMarking = markingAttendance[markingKey];
                          
                          return (
                            <div key={athlete.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex-1">
                                <span className="font-medium text-gray-900">
                                  {athlete.full_name || `${athlete.first_name} ${athlete.last_name}`.trim() || athlete.username}
                                  {athlete.role === 'captain' && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Captain 🔱</span>}
                                </span>
                                {currentStatus && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    Current: <span className={`font-medium ${
                                      currentStatus === 'on-time' ? 'text-green-600' :
                                      currentStatus === 'late' || currentStatus === 'late-justified' ? 'text-yellow-600' :
                                      currentStatus === 'excused' ? 'text-blue-600' :
                                      'text-red-600'
                                    }`}>
                                      {currentStatus === 'on-time' ? 'On Time' :
                                       currentStatus === 'late' ? 'Late' :
                                       currentStatus === 'late-justified' ? 'Late (Justified)' :
                                       currentStatus === 'excused' ? 'Excused' :
                                       'Missing'}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                {isMarking && (
                                  <div className="text-sm text-gray-500 mr-2">Updating...</div>
                                )}
                                {['on-time', 'late', 'late-justified', 'excused', 'missing'].map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => markAttendance(athlete.id, currentDate, status)}
                                    disabled={isMarking}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      currentStatus === status 
                                        ? 'ring-2 ring-blue-300 ' 
                                        : ''
                                    }${
                                      status === 'on-time' ? 'bg-green-500 hover:bg-green-600 text-white' :
                                      status === 'late' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                      status === 'late-justified' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                                      status === 'excused' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                      'bg-red-500 hover:bg-red-600 text-white'
                                    }${isMarking ? ' opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {status === 'on-time' ? 'On Time' :
                                     status === 'late' ? 'Late' :
                                     status === 'late-justified' ? 'Late (J)' :
                                     status === 'excused' ? 'Excused' :
                                     'Missing'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );              })}
            </div>
            )
          )}

          {viewMode === 'view' && (
            // My Attendance Mode - Show personal attendance calendar like athlete dashboard
            <table className="w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border text-gray-900 font-bold text-base">Day</th>
                  <th className="p-2 border text-gray-900 font-bold text-base">Status</th>
                </tr>
              </thead>
              <tbody>
                {dayNames.map((dayName, index) => {
                  const isWeekend = dayName === "Saturday" || dayName === "Sunday";
                  const currentDate = weekDates[index];
                  const status = getAttendanceStatus(user.id, currentDate);
                  
                  return (
                    <tr key={dayName}>
                      <td className="p-2 border text-gray-900 font-semibold">
                        {dayName} ({formatDate(currentDate)})
                      </td>
                      <td className="p-2 border text-center text-gray-900">
                        {isWeekend ? (
                          <span className="text-gray-400">No Practice</span>
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
                          <span className="text-gray-400">Not Marked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
