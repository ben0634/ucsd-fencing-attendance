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

  const goToCurrentWeek = () => {
    setCurrentWeekOffset(0);
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
    try {
      const { error } = await supabase
        .from('attendance')
        .upsert({
          athlete_id: athleteId,
          date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
          status: status,
          marked_by: user?.id
        }, {
          onConflict: 'athlete_id,date'
        });

      if (error) {
        console.error('Error marking attendance:', error);
        alert('Error marking attendance. Please try again.');
      } else {
        console.log('Attendance marked successfully');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('Unexpected error. Please try again.');
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
            <h1 className="text-xl font-bold text-white">Welcome, Captain {user.user_metadata.firstName ?? user.email}</h1>
            <p className="text-blue-200 text-sm">
              Squad: {user.user_metadata?.gender === 'male' ? "Men's" : user.user_metadata?.gender === 'female' ? "Women's" : user.user_metadata?.gender} {user.user_metadata?.weapon?.charAt(0).toUpperCase() + user.user_metadata?.weapon?.slice(1)}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            Logout
          </button>
        </div>

        {/* Attendance Marking Interface */}
        <div className="border rounded p-4 bg-white shadow">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              ← Previous Week
            </button>
            
            <h2 className="text-lg font-semibold">
              Mark Attendance - {currentWeekOffset === 0 ? "This Week" : 
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

          {athletes.length === 0 ? (
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
                      <h3 className="font-medium text-gray-600">
                        {dayName} ({formatDate(currentDate)}) - No Practice
                      </h3>
                    </div>
                  );
                }

                return (
                  <div key={dayName} className="border rounded p-3">
                    <h3 className="font-medium mb-3">
                      {dayName} ({formatDate(currentDate)})
                    </h3>
                    
                    <div className="grid gap-2">
                      {athletes.map((athlete) => (
                        <div key={athlete.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium text-gray-900">
                            {athlete.full_name || `${athlete.first_name} ${athlete.last_name}`.trim() || athlete.username}
                          </span>
                          
                          <div className="flex gap-2">
                            {['on-time', 'late', 'late-justified', 'excused', 'missing'].map((status) => (
                              <button
                                key={status}
                                onClick={() => markAttendance(athlete.id, currentDate, status)}
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  status === 'on-time' ? 'bg-green-500 hover:bg-green-600 text-white' :
                                  status === 'late' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                  status === 'late-justified' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                                  status === 'excused' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                  'bg-red-500 hover:bg-red-600 text-white'
                                }`}
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
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
