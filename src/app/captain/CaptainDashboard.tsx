"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import PasswordChangeModal from "../../components/PasswordChangeModal";

export default function CaptainDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [athletes, setAthletes] = useState<any[]>([]); // Changed to any[] for users table
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [markingAttendance, setMarkingAttendance] = useState<{[key: string]: boolean}>({});
  const [message, setMessage] = useState<string>('');
  const [viewMode, setViewMode] = useState<'mark' | 'view'>('mark'); // 'mark' for marking others, 'view' for viewing own
  // Active (currently displayed) schedule state for selected sessionType
  const [practiceSchedules, setPracticeSchedules] = useState<{[key: string]: string[]}>({});
  const [customNoPracticeDays, setCustomNoPracticeDays] = useState<{[key: string]: string[]}>({});
  const [customPracticeDays, setCustomPracticeDays] = useState<{[key: string]: string[]}>({});
  // Cached copies per sessionType so toggling does not refetch every time and keeps separate state
  const [practiceScheduleCache, setPracticeScheduleCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  const [customNoPracticeDaysCache, setCustomNoPracticeDaysCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  const [customPracticeDaysCache, setCustomPracticeDaysCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  // sessionType controls whether we are viewing/marking practice or lift attendance
  const [sessionType, setSessionType] = useState<'practice' | 'lift'>('practice');
  // Quarter management state
  const [quarters, setQuarters] = useState<any[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [quarterStats, setQuarterStats] = useState<{attended: number, total: number, percentage: number} | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  // Bulk attendance and notes state (keyed by date)
  const [selectedAthletes, setSelectedAthletes] = useState<{[date: string]: Set<string>}>({});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesModalData, setNotesModalData] = useState<{athleteId: string, athleteName: string, date: Date, status: string} | null>(null);
  const [attendanceNotes, setAttendanceNotes] = useState<string>('');
  const router = useRouter();

  // Persist last used sessionType
  useEffect(() => {
    try { localStorage.setItem('captain_last_session_type', sessionType); } catch {}
  }, [sessionType]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('captain_last_session_type');
      if (saved === 'practice' || saved === 'lift') setSessionType(saved);
    } catch {}
  }, []);

  // Get current week's dates with offset (same as athlete dashboard)
  const getWeekDates = () => {
    const today = new Date();
    // Set to noon to avoid timezone issues near midnight
    today.setHours(12, 0, 0, 0);
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

  // Fetch attendance data when week, view mode, or session type changes
  useEffect(() => {
    if (user && user.user_metadata.role === 'captain') {
      fetchAttendanceData();
    }
  }, [currentWeekOffset, user, viewMode, sessionType]);


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

  let url = `/api/attendance?startDate=${startDate}&endDate=${endDate}&sessionType=${sessionType}`;
      
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error fetching attendance:', response.status, response.statusText, errorData);
        setMessage(`Error: ${errorData.error || 'Failed to fetch attendance'}`);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    }
  };

  const getAttendanceStatus = (athleteId: string, date: Date) => {
    const dateString = getLocalDateString(date);
    const record = attendanceData.find(
      (a) => a.athlete_id === athleteId && a.date === dateString
    );
    return record?.status || null;
  };

  const getAttendanceNotes = (athleteId: string, date: Date) => {
    const dateString = getLocalDateString(date);
    const record = attendanceData.find(
      (a) => a.athlete_id === athleteId && a.date === dateString
    );
    return record?.notes || null;
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

      // Check if user needs to change password
      if (!currentUser.user_metadata?.passwordChanged) {
        setShowPasswordChange(true);
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
          // Fetch schedules for initial sessionType only (practice default)
          await fetchPracticeSchedules();
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

  const markAttendance = async (athleteId: string, date: Date, status: string, notes?: string) => {
    const key = `${athleteId}-${getLocalDateString(date)}`;
    setMarkingAttendance(prev => ({ ...prev, [key]: true }));
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No access token available. Please log in again.');
      }

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          athleteId,
          date: getLocalDateString(date),
          status,
          sessionType,
          notes: notes || null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Attendance POST failed:', response.status, result);
        throw new Error(result.error || `Failed to mark attendance (${response.status})`);
      }

      // Show success message
      setMessage(result.message || 'Attendance marked successfully');
      
      // Immediately update the attendance data in state to reflect the change
      // This ensures the UI updates instantly before the API refetch completes
      const dateString = getLocalDateString(date);
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

  // Bulk attendance marking
  const markBulkAttendance = async (date: Date, status: string, notes?: string) => {
    const dateKey = getLocalDateString(date);
    const selectedForDate = selectedAthletes[dateKey] || new Set();
    
    if (selectedForDate.size === 0) {
      setMessage('No athletes selected');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setMessage(`Marking ${selectedForDate.size} athlete(s)...`);

    try {
      const promises = Array.from(selectedForDate).map(athleteId =>
        markAttendance(athleteId, date, status, notes)
      );
      await Promise.all(promises);
      setMessage(`Successfully marked ${selectedForDate.size} athlete(s) as ${status}`);
      // Clear selection for this date
      setSelectedAthletes(prev => {
        const newState = { ...prev };
        delete newState[dateKey];
        return newState;
      });
    } catch (error) {
      setMessage('Some attendance markings failed');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  // Toggle athlete selection for a specific date
  const toggleAthleteSelection = (athleteId: string, date: Date) => {
    const dateKey = getLocalDateString(date);
    setSelectedAthletes(prev => {
      const newState = { ...prev };
      const dateSet = new Set(newState[dateKey] || []);
      if (dateSet.has(athleteId)) {
        dateSet.delete(athleteId);
      } else {
        dateSet.add(athleteId);
      }
      if (dateSet.size === 0) {
        delete newState[dateKey];
      } else {
        newState[dateKey] = dateSet;
      }
      return newState;
    });
  };

  // Select all athletes for a specific date
  const selectAllAthletes = (date: Date) => {
    const dateKey = getLocalDateString(date);
    setSelectedAthletes(prev => ({
      ...prev,
      [dateKey]: new Set(athletes.map(a => a.id))
    }));
  };

  // Clear selection for a specific date
  const clearSelection = (date: Date) => {
    const dateKey = getLocalDateString(date);
    setSelectedAthletes(prev => {
      const newState = { ...prev };
      delete newState[dateKey];
      return newState;
    });
  };

  // Open notes modal
  const openNotesModal = (athleteId: string, athleteName: string, date: Date, status: string) => {
    const existingNotes = getAttendanceNotes(athleteId, date) || '';
    setNotesModalData({ athleteId, athleteName, date, status });
    setAttendanceNotes(existingNotes);
    setShowNotesModal(true);
  };

  // Submit attendance with notes
  const submitAttendanceWithNotes = async () => {
    if (!notesModalData) return;
    
    await markAttendance(
      notesModalData.athleteId,
      notesModalData.date,
      notesModalData.status,
      attendanceNotes
    );
    
    setShowNotesModal(false);
    setNotesModalData(null);
    setAttendanceNotes('');
  };

  // Fetch practice schedules
  const fetchPracticeSchedules = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch(`/api/practice-schedule?sessionType=${sessionType}`, {
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
        // Update caches for this sessionType
        setPracticeScheduleCache(prev => ({ ...prev, [sessionType]: scheduleMap }));
        setCustomNoPracticeDaysCache(prev => ({ ...prev, [sessionType]: customNoPracticeMap }));
        setCustomPracticeDaysCache(prev => ({ ...prev, [sessionType]: customPracticeMap }));
      }
    } catch (error) {
      console.error('Error fetching practice schedules:', error);
    }
  };

  // Fetch quarters for dropdown
  const fetchQuarters = async () => {
    try {
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      const currentSeason = seasonData?.[0];
      if (!currentSeason) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch(`/api/quarters?seasonId=${currentSeason.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { quarters: allQuarters } = await response.json();
        
        setQuarters(allQuarters || []);
        
        // Auto-select current quarter
        const today = new Date();
        const currentQuarter = (allQuarters || []).find((q: any) => {
          const start = new Date(q.start_date + 'T00:00:00');
          const end = new Date(q.end_date + 'T00:00:00');
          return today >= start && today <= end;
        });
        
        if (currentQuarter) {
          setSelectedQuarter(currentQuarter.id);
        } else if (allQuarters && allQuarters.length > 0) {
          setSelectedQuarter(allQuarters[allQuarters.length - 1].id);
        }
      }
    } catch (error) {
      console.error('Error fetching quarters:', error);
    }
  };

  // Calculate quarter statistics
  const calculateQuarterStats = async () => {
    if (!selectedQuarter || !user) {
      setQuarterStats(null);
      return;
    }

    const quarter = quarters.find(q => q.id === selectedQuarter);
    if (!quarter) {
      setQuarterStats(null);
      return;
    }

    const startDate = quarter.start_date;
    const endDate = quarter.end_date;
    const squadId = `${user.user_metadata?.gender}_${user.user_metadata?.weapon}`;

    // Fetch attendance data for the entire quarter
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    
    if (!accessToken) {
      setQuarterStats(null);
      return;
    }

    const response = await fetch(
      `/api/attendance?startDate=${startDate}&endDate=${endDate}&sessionType=${sessionType}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      setQuarterStats(null);
      return;
    }

    const { attendance: quarterAttendanceData } = await response.json();
    const athleteAttendance = quarterAttendanceData?.filter((a: any) => a.athlete_id === user.id) || [];

    // Get all dates in quarter range, but only up to today
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    // Only count practices up to today (not future practices)
    const effectiveEnd = end < today ? end : today;
    
    let totalPractices = 0;
    let attended = 0;

    // Iterate through each day in the quarter up to today
    for (let d = new Date(start); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      if (hasPractice(currentDate)) {
        totalPractices++;
        
        const dateString = getLocalDateString(currentDate);
        const attendance = athleteAttendance.find(
          (a: any) => a.date === dateString
        );
        
        // Count as attended if status is on-time, late, late-justified, or excused
        if (attendance?.status === 'on-time' || 
            attendance?.status === 'late' || 
            attendance?.status === 'late-justified' ||
            attendance?.status === 'excused') {
          attended++;
        }
      }
    }

    const percentage = totalPractices > 0 ? Math.round((attended / totalPractices) * 100) : 0;
    
    setQuarterStats({
      attended,
      total: totalPractices,
      percentage
    });
  };

  // When sessionType changes: load from cache if available; otherwise fetch
  useEffect(() => {
    if (!user) return;
    // Attendance always distinct per sessionType
    fetchAttendanceData();
    const cachedSchedules = practiceScheduleCache[sessionType];
    if (Object.keys(cachedSchedules).length > 0) {
      setPracticeSchedules(cachedSchedules);
      setCustomNoPracticeDays(customNoPracticeDaysCache[sessionType]);
      setCustomPracticeDays(customPracticeDaysCache[sessionType]);
    } else {
      fetchPracticeSchedules();
    }
    // Refetch quarters when session type changes
    fetchQuarters();
  }, [sessionType]);

  // Fetch quarters on initial load
  useEffect(() => {
    if (user) {
      fetchQuarters();
    }
  }, [user]);

  // Calculate quarter stats when selection changes or week changes
  useEffect(() => {
    if (selectedQuarter && practiceSchedules) {
      calculateQuarterStats();
    }
  }, [selectedQuarter, currentWeekOffset, practiceSchedules, customNoPracticeDays, customPracticeDays, sessionType]);

  // Check if there's practice for a squad on a given date
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

  if (loading) return <p className="p-4">Loading...</p>;
  if (user === undefined) return <p className="p-4">Loading...</p>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 p-4 sm:p-6">
      {showPasswordChange && user && (
        <PasswordChangeModal
          username={user.user_metadata?.username || user.email?.split('@')[0] || ''}
          onPasswordChanged={() => {
            setShowPasswordChange(false);
            // Refresh user data
            supabase.auth.getSession().then(({ data }) => {
              if (data.session?.user) setUser(data.session.user);
            });
          }}
        />
      )}
      
      <div className="max-w-screen-lg mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-yellow-300 mb-1 sm:mb-2">Welcome, Captain {user.user_metadata.firstName ?? user.email}</h1>
            <p className="text-yellow-100 text-sm sm:text-lg font-medium">
              Squad: {user.user_metadata?.gender === 'male' ? "Men's" : user.user_metadata?.gender === 'female' ? "Women's" : user.user_metadata?.gender} {user.user_metadata?.weapon?.charAt(0).toUpperCase() + user.user_metadata?.weapon?.slice(1)}
            </p>
          </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center w-full sm:w-auto">
            <div className="flex bg-white/10 rounded-lg overflow-hidden border border-white/20 backdrop-blur-sm">
              <button
                onClick={() => setSessionType('practice')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium transition ${sessionType === 'practice' ? 'bg-yellow-400 text-blue-900' : 'text-white hover:bg-white/20'}`}
              >Practice</button>
              <button
                onClick={() => setSessionType('lift')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium transition ${sessionType === 'lift' ? 'bg-yellow-400 text-blue-900' : 'text-white hover:bg-white/20'}`}
              >Lift</button>
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'mark' ? 'view' : 'mark')}
              className="px-3 sm:px-5 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-transform transform hover:scale-105 text-xs sm:text-base"
            >
              {viewMode === 'mark' ? 'My Attendance' : 'Mark Attendance'}
            </button>
            <button
              onClick={handleLogout}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition-transform transform hover:scale-105 text-xs sm:text-base"
            >
              Logout
            </button>
          </div>
        </div>

        {viewMode === 'mark' && (
          <div className="border rounded-lg p-3 sm:p-6 bg-white shadow-lg">
            {message && (
              <div className={`mb-3 sm:mb-4 p-3 sm:p-4 rounded-lg text-center font-semibold text-xs sm:text-base ${
                message.startsWith('Error') 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'bg-green-100 text-green-700 border border-green-300'
              }`}>
                {message}
              </div>
            )}
            {/* Week navigation for marking mode only (calendar view has its own header) */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 px-3 sm:px-6 py-3 sm:py-4 rounded-t-lg -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 mb-3 sm:mb-4 shadow-md">
              <div className="flex items-center justify-between">
                <button
                  onClick={goToPreviousWeek}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm text-xs sm:text-sm"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Previous</span>
                </button>
                
                <div className="text-center flex-1">
                  <h2 className="text-sm sm:text-xl font-bold text-white">
                    {currentWeekOffset === 0 ? "This Week's" : 
                      currentWeekOffset === -1 ? "Last Week's" :
                      currentWeekOffset === 1 ? "Next Week's" :
                      currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
                      `${currentWeekOffset} Weeks Ahead`} {sessionType === 'practice' ? 'Practice' : 'Lift'} Attendance
                  </h2>
                  <p className="text-blue-100 text-xs sm:text-sm font-medium">
                    {formatWeekRange(weekDates)}
                  </p>
                </div>
                
                <div className="flex gap-1 sm:gap-2">
                  {currentWeekOffset !== 0 && (
                    <button
                      onClick={goToCurrentWeek}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 text-xs sm:text-sm backdrop-blur-sm"
                    >
                      Today
                    </button>
                  )}
                  <button
                    onClick={goToNextWeek}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {athletes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No athletes found. Make sure you have created athlete accounts.</p>
                <p className="text-sm mt-2">Run: <code>node scripts/createUsers.js</code></p>
              </div>
            ) : (
              <div className="space-y-6">
                {dayNames.map((dayName, dayIndex) => {
                  const currentDate = weekDates[dayIndex];
                  const hasScheduledPractice = hasPractice(currentDate);

                  if (!hasScheduledPractice) {
                    return (
                      <div key={dayName} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                        <h3 className="font-bold text-sm sm:text-lg text-gray-600">
                          <span className="hidden sm:inline">{dayName} ({formatDate(currentDate)}) - No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
                          <span className="sm:hidden">{dayName.substring(0, 3)} {formatDate(currentDate)} - No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">
                          <span className="hidden sm:inline">Practice not scheduled for this day</span>
                          <span className="sm:hidden">Not scheduled</span>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div key={dayName} className="border rounded-lg p-2 sm:p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-xs sm:text-base text-gray-900">
                          <span className="hidden sm:inline">{dayName} ({formatDate(currentDate)})</span>
                          <span className="sm:hidden">{dayName.substring(0, 3)} {formatDate(currentDate)}</span>
                        </h3>
                        
                        {/* Per-day bulk actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const dateKey = getLocalDateString(currentDate);
                              const selectedForDate = selectedAthletes[dateKey] || new Set();
                              if (selectedForDate.size === athletes.length) {
                                clearSelection(currentDate);
                              } else {
                                selectAllAthletes(currentDate);
                              }
                            }}
                            className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold bg-gray-700 hover:bg-gray-800 text-white rounded shadow-md transition-all duration-200"
                          >
                            {(() => {
                              const dateKey = getLocalDateString(currentDate);
                              const selectedForDate = selectedAthletes[dateKey] || new Set();
                              return selectedForDate.size === athletes.length ? 'Clear All' : 'Select All';
                            })()}
                          </button>
                          
                          {(() => {
                            const dateKey = getLocalDateString(currentDate);
                            const selectedForDate = selectedAthletes[dateKey] || new Set();
                            if (selectedForDate.size > 0) {
                              return (
                                <>
                                  <span className="text-[10px] sm:text-xs text-gray-800 font-semibold bg-blue-100 px-1.5 py-0.5 rounded">
                                    {selectedForDate.size} selected
                                  </span>
                                  <div className="flex gap-1">
                                    {['on-time', 'late', 'excused', 'missing'].map((status) => (
                                      <button
                                        key={status}
                                        onClick={() => markBulkAttendance(currentDate, status)}
                                        className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium ${
                                          status === 'on-time' ? 'bg-green-500 hover:bg-green-600 text-white' :
                                          status === 'late' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                          status === 'excused' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                          'bg-red-500 hover:bg-red-600 text-white'
                                        }`}
                                        title={`Mark all as ${status}`}
                                      >
                                        {status === 'on-time' ? '✓' :
                                         status === 'late' ? '⏱' :
                                         status === 'excused' ? 'E' :
                                         '✗'}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:gap-4">
                        {athletes.map((athlete) => {
                          const currentStatus = getAttendanceStatus(athlete.id, currentDate);
                          const markingKey = `${athlete.id}-${getLocalDateString(currentDate)}`;
                          const isMarking = markingAttendance[markingKey];

                          return (
                            <div key={athlete.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg shadow-sm gap-1.5 sm:gap-2 border border-gray-100">
                              <div className="flex items-start gap-1.5 sm:gap-2 flex-1 w-full sm:w-auto">
                                <input
                                  type="checkbox"
                                  checked={(() => {
                                    const dateKey = getLocalDateString(currentDate);
                                    const selectedForDate = selectedAthletes[dateKey] || new Set();
                                    return selectedForDate.has(athlete.id);
                                  })()}
                                  onChange={() => toggleAthleteSelection(athlete.id, currentDate)}
                                  className="mt-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                  <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                    {athlete.full_name || `${athlete.first_name} ${athlete.last_name}`.trim() || athlete.username}
                                    {athlete.role === 'captain' && <span className="ml-1 text-[10px] sm:text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">Capt 🔱</span>}
                                  </span>
                                  {currentStatus && (() => {
                                    const notes = getAttendanceNotes(athlete.id, currentDate);
                                    return (
                                      <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                                        <span>
                                          Current: <span className={`font-medium ${
                                            currentStatus === 'on-time' || currentStatus === 'late-justified' ? 'text-green-600' :
                                            currentStatus === 'late' ? 'text-yellow-600' :
                                            currentStatus === 'excused' ? 'text-blue-600' :
                                            'text-red-600'
                                          }`}>
                                            {currentStatus === 'on-time' ? 'On Time' :
                                             currentStatus === 'late' ? 'Late' :
                                             currentStatus === 'late-justified' ? 'Late (Justified)' :
                                             currentStatus === 'excused' ? 'Excused' :
                                             'Missing'}
                                          </span>
                                        </span>
                                        {notes && (
                                          <div className="relative group">
                                            <span className="inline-flex items-center text-blue-600">
                                              📝
                                            </span>
                                            <div className="hidden group-hover:block absolute z-50 bg-gray-900 text-white text-xs rounded px-2 py-1 -translate-y-full -mt-1 left-0 whitespace-normal max-w-xs shadow-lg">
                                              {notes}
                                              <div className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto items-center">
                                {isMarking && (
                                  <div className="text-[10px] sm:text-xs text-gray-500 w-full sm:w-auto sm:mr-1">Updating...</div>
                                )}
                                {['on-time', 'late-justified', 'late', 'excused', 'missing'].map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => markAttendance(athlete.id, currentDate, status)}
                                    disabled={isMarking}
                                    className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-semibold transition-all duration-200 ${
                                      currentStatus === status 
                                        ? 'ring-2 ring-blue-400 shadow-lg' 
                                        : ''
                                    } ${
                                      status === 'on-time' ? 'bg-green-500 hover:bg-green-600 text-white' :
                                      status === 'late' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                      status === 'late-justified' ? 'bg-green-600 hover:bg-green-700 text-white' :
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
                                <button
                                  onClick={() => openNotesModal(
                                    athlete.id,
                                    athlete.full_name || `${athlete.first_name} ${athlete.last_name}`.trim(),
                                    currentDate,
                                    currentStatus || 'on-time'
                                  )}
                                  disabled={isMarking}
                                  className="px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 transition-all duration-200 flex items-center gap-0.5 sm:gap-1 shadow-sm"
                                  title="Add note"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  <span className="hidden sm:inline">Note</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {viewMode === 'view' && (
          // Modern personal attendance calendar (matches AthleteDashboard)
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              {/* Calendar Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={goToPreviousWeek}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm text-xs sm:text-sm"
                  >
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  
                  <div className="text-center flex-1">
                    <h2 className="text-sm sm:text-xl font-bold text-white">
                      {currentWeekOffset === 0 ? "This Week's" : 
                       currentWeekOffset === -1 ? "Last Week's" :
                       currentWeekOffset === 1 ? "Next Week's" :
                       currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
                       `${currentWeekOffset} Weeks Ahead`} {sessionType === 'practice' ? 'Practice' : 'Lift'}
                    </h2>
                    <p className="text-blue-100 text-xs sm:text-sm font-medium">
                      {formatWeekRange(weekDates)}
                    </p>
                  </div>
                  
                  <div className="flex gap-1 sm:gap-2">
                    {currentWeekOffset !== 0 && (
                      <button
                        onClick={goToCurrentWeek}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 text-xs sm:text-sm backdrop-blur-sm"
                      >
                        Today
                      </button>
                    )}
                    <button
                      onClick={goToNextWeek}
                      className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-all duration-200 backdrop-blur-sm text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="p-3 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 sm:gap-4">
                  {dayNames.map((dayName, index) => {
                    const currentDate = weekDates[index];
                    const status = getAttendanceStatus(user.id, currentDate);
                    const hasScheduledPractice = hasPractice(currentDate);
                    const isToday = currentDate.toDateString() === new Date().toDateString();

                    return (
                      <div
                        key={dayName}
                        className={`${!hasScheduledPractice ? 'hidden sm:block' : ''} relative p-2 sm:p-3 rounded-lg sm:rounded-xl border sm:border-2 transition-all duration-200 ${
                          isToday 
                            ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100 shadow-lg' 
                            : 'border-gray-200 bg-gradient-to-br from-gray-50 to-white hover:border-blue-300 hover:shadow-md'
                        }`}
                      >
                        {/* Mobile compact view */}
                        <div className="sm:hidden text-center">
                          <div className={`text-xs font-semibold ${isToday ? 'text-yellow-700' : 'text-gray-600'}`}>
                            {dayName.substring(0, 3)}
                          </div>
                          <div className={`text-lg font-bold ${isToday ? 'text-yellow-800' : 'text-gray-800'}`}>
                            {currentDate.getDate()}
                          </div>
                          {/* Status with text label */}
                          <div className="mt-1.5 flex flex-col items-center gap-0.5">
                            {!hasScheduledPractice ? (
                              <>
                                <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-xs text-gray-500">-</span>
                                </div>
                                <span className="text-[10px] text-gray-500">No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
                              </>
                            ) : status ? (
                              <>
                                <div className={`w-4 h-4 rounded-full ${
                                  status === 'on-time' || status === 'late-justified' ? 'bg-green-500' :
                                  status === 'late' ? 'bg-yellow-500' :
                                  status === 'excused' ? 'bg-blue-500' :
                                  'bg-red-500'
                                }`}></div>
                                <span className={`text-[10px] font-medium ${
                                  status === 'on-time' || status === 'late-justified' ? 'text-green-700' :
                                  status === 'late' ? 'text-yellow-700' :
                                  status === 'excused' ? 'text-blue-700' :
                                  'text-red-700'
                                }`}>
                                  {status === 'on-time' ? 'On Time' :
                                   status === 'late' ? 'Late' :
                                   status === 'late-justified' ? 'Late (J)' :
                                   status === 'excused' ? 'Excused' :
                                   'Missing'}
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                                <span className="text-[10px] text-gray-500">Not Marked</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Desktop full view */}
                        <div className="hidden sm:block">
                        {/* Day Header */}
                        <div className="text-center mb-2 sm:mb-3">
                          <div className={`text-xs sm:text-sm font-semibold uppercase tracking-wide ${
                            isToday ? 'text-yellow-700' : 'text-gray-600'
                          }`}>
                            {dayName}
                          </div>
                          <div className={`text-xl sm:text-2xl font-bold ${
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
                              <span className="text-xs font-medium text-gray-500">No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
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
                              {(() => {
                                const notes = getAttendanceNotes(user.id, currentDate);
                                if (notes) {
                                  return (
                                    <div className="mt-1 text-[10px] text-gray-600 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 max-w-full break-words" title={notes}>
                                      <span className="font-medium">📝 Note:</span> {notes.length > 50 ? notes.substring(0, 50) + '...' : notes}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
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
                        </div>

                        {/* Today indicator */}
                        {isToday && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-yellow-400 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Legend - hide on mobile */}
              <div className="hidden sm:block bg-gray-50 px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-700">On Time</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-gray-700">Late (Justified)</span>
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
                    <span className="text-gray-700">No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
                  </div>
                </div>
              </div>
              
              {/* Stats Display */}
              <div className="mt-8 mb-4 px-3 sm:px-6">
                {(() => {
                  const stats = { onTime: 0, late: 0, lateJustified: 0, excused: 0, missing: 0, notMarked: 0, total: 0 };
                  weekDates.forEach(date => {
                    const status = getAttendanceStatus(user.id, date);
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

              {/* Quarter Statistics Section */}
              {quarters.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-2xl shadow-xl border-2 border-blue-100 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                        Quarter Statistics
                      </h3>
                      <select
                        value={selectedQuarter || ''}
                        onChange={(e) => setSelectedQuarter(e.target.value)}
                        className="px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm sm:text-base text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:shadow-md transition-shadow"
                      >
                        {quarters.map((quarter) => (
                          <option key={quarter.id} value={quarter.id}>
                            {quarter.name} ({new Date(quarter.start_date + 'T00:00:00').toLocaleDateString()} - {new Date(quarter.end_date + 'T00:00:00').toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedQuarter && quarterStats && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 text-center shadow-lg border-2 border-blue-200 hover:shadow-xl transition-shadow">
                            <div className="text-3xl sm:text-4xl font-bold text-blue-700">
                              {quarterStats.percentage}%
                            </div>
                            <div className="text-sm font-semibold text-blue-600 mt-1">Attendance Rate</div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-5 text-center shadow-lg border-2 border-green-200 hover:shadow-xl transition-shadow">
                            <div className="text-3xl sm:text-4xl font-bold text-green-700">
                              {quarterStats.attended}
                            </div>
                            <div className="text-sm font-semibold text-green-600 mt-1">{sessionType === 'practice' ? 'Practices' : 'Lifts'} Attended</div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 text-center shadow-lg border-2 border-purple-200 hover:shadow-xl transition-shadow">
                            <div className="text-3xl sm:text-4xl font-bold text-purple-700">
                              {quarterStats.total}
                            </div>
                            <div className="text-sm font-semibold text-purple-600 mt-1">Total {sessionType === 'practice' ? 'Practices' : 'Lifts'}</div>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">Progress</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {quarterStats.attended} / {quarterStats.total}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${quarterStats.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedQuarter && !quarterStats && (
                      <div className="text-center py-8 text-gray-500">
                        Calculating quarter statistics...
                      </div>
                    )}

                    {!selectedQuarter && (
                      <div className="text-center py-8 text-gray-500">
                        Select a quarter to view statistics
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
        )}
      </div>

      {/* Notes Modal */}
      {showNotesModal && notesModalData && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" onClick={() => setShowNotesModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl border border-gray-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Note</h3>
              <button
                onClick={() => setShowNotesModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-800 mb-2">
                <span className="font-medium">{notesModalData.athleteName}</span> - {formatDate(notesModalData.date)}
              </p>
              <p className="text-xs text-gray-700 mb-4">
                Status: <span className={`font-medium ${
                  notesModalData.status === 'on-time' || notesModalData.status === 'late-justified' ? 'text-green-600' :
                  notesModalData.status === 'late' ? 'text-yellow-600' :
                  notesModalData.status === 'excused' ? 'text-blue-600' :
                  'text-red-600'
                }`}>
                  {notesModalData.status === 'on-time' ? 'On Time' :
                   notesModalData.status === 'late' ? 'Late' :
                   notesModalData.status === 'late-justified' ? 'Late (Justified)' :
                   notesModalData.status === 'excused' ? 'Excused' :
                   'Missing'}
                </span>
              </p>
              
              <textarea
                value={attendanceNotes}
                onChange={(e) => setAttendanceNotes(e.target.value)}
                placeholder="Add a note (e.g., injury, class conflict, etc.)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
                rows={4}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowNotesModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAttendanceWithNotes}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
