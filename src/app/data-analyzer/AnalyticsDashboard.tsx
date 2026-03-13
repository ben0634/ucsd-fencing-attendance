"use client";
import { useEffect, useState, Fragment, useRef } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import PasswordChangeModal from "../../components/PasswordChangeModal";

export default function AnalyticsDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [sessionType, setSessionType] = useState<'practice' | 'lift'>('practice');
  const [selectedSquad, setSelectedSquad] = useState<string>('all');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [quarters, setQuarters] = useState<any[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'stats' | 'calendar'>('stats');
  
  // Auto-select current quarter when switching to calendar
  useEffect(() => {
    if (viewMode === 'calendar' && !selectedCalendarQuarter && quarters.length > 0) {
      const today = new Date();
      const currentQuarter = quarters.find(q => {
        const start = new Date(q.start_date);
        const end = new Date(q.end_date);
        return today >= start && today <= end;
      });
      if (currentQuarter) {
        setSelectedCalendarQuarter(currentQuarter.id);
        // Set to current month within quarter
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        setSelectedMonth(currentMonth);
        setSelectedYear(currentYear);
      } else if (quarters[0]) {
        // Default to first quarter if no current quarter
        setSelectedCalendarQuarter(quarters[0].id);
        const start = new Date(quarters[0].start_date);
        setSelectedMonth(start.getMonth());
        setSelectedYear(start.getFullYear());
      }
    }
  }, [viewMode, quarters]);
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'quarter'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCalendarQuarter, setSelectedCalendarQuarter] = useState<string | null>(null);
  const [practiceSchedules, setPracticeSchedules] = useState<{[key: string]: string[]}>({});
  const [customNoPracticeDays, setCustomNoPracticeDays] = useState<{[key: string]: string[]}>({});
  const [customPracticeDays, setCustomPracticeDays] = useState<{[key: string]: string[]}>({});
  const practiceScheduleRequestRef = useRef(0);
  const router = useRouter();

  // Persist session type
  useEffect(() => {
    try { localStorage.setItem('analyzer_last_session_type', sessionType); } catch {}
  }, [sessionType]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('analyzer_last_session_type');
      if (saved === 'practice' || saved === 'lift') setSessionType(saved);
    } catch {}
  }, []);

  // Fetch all athletes
  const fetchAthletes = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/users/list', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { users } = await response.json();
        const athletesAndCaptains = users.filter((u: any) => 
          u.role === 'athlete' || u.role === 'captain'
        );
        setAthletes(athletesAndCaptains);
      }
    } catch (error) {
      console.error('Error fetching athletes:', error);
    }
  };

  // Fetch attendance for all athletes
  const fetchAllAttendance = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch(`/api/attendance?sessionType=${sessionType}`, {
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
      console.error('Error fetching attendance:', error);
    }
  };

  // Fetch practice schedules
  const fetchPracticeSchedules = async () => {
    const requestId = ++practiceScheduleRequestRef.current;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const quarterParam = selectedCalendarQuarter
        ? `&quarterId=${encodeURIComponent(selectedCalendarQuarter)}`
        : '';
      const dateParam = !selectedCalendarQuarter
        ? `&date=${encodeURIComponent(getLocalDateString(new Date(selectedYear, selectedMonth, 1)))}`
        : '';

      const response = await fetch(`/api/practice-schedule?sessionType=${sessionType}${quarterParam}${dateParam}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { schedules } = await response.json();
        if (requestId !== practiceScheduleRequestRef.current) return;
        
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

  // Fetch quarters
  const fetchQuarters = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      // First, fetch the current season
      const { data: seasons, error: seasonError } = await supabase
        .from('seasons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (seasonError || !seasons || seasons.length === 0) {
        console.error('Error fetching season:', seasonError);
        return;
      }

      const currentSeason = seasons[0];

      // Then fetch quarters for this season
      const response = await fetch(`/api/quarters?seasonId=${currentSeason.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { quarters: fetchedQuarters } = await response.json();
        setQuarters(fetchedQuarters || []);
        if (fetchedQuarters && fetchedQuarters.length > 0) {
          setSelectedQuarter(fetchedQuarters[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching quarters:', error);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (!currentUser || currentUser.user_metadata.role !== "data-analyzer") {
        router.push("/");
        return;
      }

      if (!currentUser.user_metadata?.passwordChanged) {
        setShowPasswordChange(true);
      }

      await fetchAthletes();
      await fetchAllAttendance();
      await fetchQuarters();
      await fetchPracticeSchedules();
      setLoading(false);
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchAllAttendance();
      fetchPracticeSchedules();
    }
  }, [sessionType]);

  useEffect(() => {
    if (user) {
      fetchPracticeSchedules();
    }
  }, [user, selectedCalendarQuarter, selectedMonth, selectedYear]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Get squads
  const getSquads = () => {
    const squads = new Set<string>();
    athletes.forEach(athlete => {
      if (athlete.weapon && athlete.gender) {
        const squadKey = `${athlete.gender}_${athlete.weapon}`;
        squads.add(squadKey);
      }
    });
    return Array.from(squads).sort();
  };

  // Filter athletes by selected squad
  const getFilteredAthletes = () => {
    if (selectedSquad === 'all') return athletes;
    return athletes.filter(athlete => {
      const squadKey = `${athlete.gender}_${athlete.weapon}`;
      return squadKey === selectedSquad;
    });
  };

  // Get all unique past practice dates from practice schedule for a specific squad
  const getAllPastPracticeDates = (squadGender?: string, squadWeapon?: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get quarter date range if quarter is selected
    let quarterStart: Date | null = null;
    let quarterEnd: Date | null = null;
    
    if (selectedQuarter) {
      const quarter = quarters.find(q => q.id === selectedQuarter);
      if (quarter) {
        quarterStart = new Date(quarter.start_date + 'T00:00:00');
        quarterEnd = new Date(quarter.end_date + 'T00:00:00');
      }
    }
    
    const uniqueDates = new Set<string>();
    
    if (!squadGender || !squadWeapon) return uniqueDates;
    
    const squadId = `${squadGender}_${squadWeapon}`;
    
    // Determine date range to check
    let startDate: Date;
    let endDate: Date = today;
    
    if (quarterStart && quarterEnd) {
      startDate = quarterStart;
      endDate = quarterEnd < today ? quarterEnd : today;
    } else {
      // Check from earliest attendance record or 6 months ago
      const earliestRecord = attendanceData
        .filter(r => {
          const athlete = athletes.find(a => a.id === r.athlete_id);
          return athlete && athlete.gender === squadGender && athlete.weapon === squadWeapon;
        })
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      
      if (earliestRecord) {
        startDate = new Date(earliestRecord.date + 'T00:00:00');
      } else {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
      }
    }
    
    // Iterate through each day and check if it's a practice day
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      if (hasAnalyticsPractice(squadId, currentDate)) {
        uniqueDates.add(getLocalDateString(currentDate));
      }
    }
    
    return uniqueDates;
  };

  // Get month/quarter days for calendar
  const getMonthDays = () => {
    const year = selectedYear;
    const month = selectedMonth;
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };
  
  // Navigate to previous month
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };
  
  // Navigate to next month
  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };
  
  // Check if can navigate to previous month (within quarter bounds)
  const canGoPrevious = () => {
    if (!selectedCalendarQuarter) return false;
    const quarter = quarters.find(q => q.id === selectedCalendarQuarter);
    if (!quarter) return false;
    
    const quarterStart = new Date(quarter.start_date + 'T00:00:00');
    const firstDayOfCurrentMonth = new Date(selectedYear, selectedMonth, 1);
    
    // Can go previous if current month is not the first month of the quarter
    return firstDayOfCurrentMonth > quarterStart;
  };
  
  // Check if can navigate to next month (within quarter bounds)
  const canGoNext = () => {
    if (!selectedCalendarQuarter) return false;
    const quarter = quarters.find(q => q.id === selectedCalendarQuarter);
    if (!quarter) return false;
    
    const quarterEnd = new Date(quarter.end_date + 'T00:00:00');
    const lastDayOfCurrentMonth = new Date(selectedYear, selectedMonth + 1, 0);
    
    // Can go next if current month is not the last month of the quarter
    return lastDayOfCurrentMonth < quarterEnd;
  };

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCalendarAttendanceStatus = (athleteId: string, date: Date) => {
    const dateString = getLocalDateString(date);
    const record = attendanceData.find(
      (a: any) => a.athlete_id === athleteId && a.date === dateString
    );
    return record?.status || null;
  };

  const formatStatusSymbol = (status: string | null) => {
    switch (status) {
      case 'on-time': return '✓';
      case 'late': return 'L';
      case 'late-justified': return 'J';
      case 'excused': return 'E';
      case 'missing': return 'X';
      case 'no-practice': return '';
      default: return '—'; // Not marked
    }
  };

  const getStatusColorClass = (status: string | null) => {
    switch (status) {
      case 'on-time': return 'text-green-600 bg-green-50';
      case 'late': return 'text-yellow-600 bg-yellow-50';
      case 'late-justified': return 'text-green-600 bg-green-50';
      case 'excused': return 'text-blue-600 bg-blue-50';
      case 'missing': return 'text-red-600 bg-red-50';
      case 'no-practice': return 'text-gray-400 bg-gray-200'; // Lighter grey background
      default: return 'text-purple-600 bg-purple-50'; // Not marked
    }
  };

  const isDateWithinAnyQuarter = (date: Date) => {
    if (!quarters.length) return true;

    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0);

    return quarters.some((q: any) => {
      const start = new Date(q.start_date + 'T00:00:00');
      const end = new Date(q.end_date + 'T23:59:59');
      return checkDate >= start && checkDate <= end;
    });
  };

  // Check if a date is a practice day for a squad based on practice schedule
  const hasAnalyticsPractice = (squadId: string, date: Date) => {
    const dateString = getLocalDateString(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
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

    // Outside all quarter ranges, regular schedule does not apply
    if (!isDateWithinAnyQuarter(date)) {
      return false;
    }
    
    // Fall back to regular schedule
    const squadSchedule = practiceSchedules[squadId] || [];
    return squadSchedule.includes(dayName);
  };

  // Get analytics attendance status with practice schedule consideration
  const getCalendarAttendanceStatusWithSchedule = (athleteId: string, date: Date, squadId: string) => {
    // First check if date is within the selected quarter bounds
    if (selectedCalendarQuarter) {
      const quarter = quarters.find(q => q.id === selectedCalendarQuarter);
      if (quarter) {
        const quarterStart = new Date(quarter.start_date + 'T00:00:00');
        const quarterEnd = new Date(quarter.end_date + 'T00:00:00');
        const currentDate = new Date(date);
        currentDate.setHours(0, 0, 0, 0);
        
        // If date is outside quarter bounds, mark as no practice
        if (currentDate < quarterStart || currentDate > quarterEnd) {
          return 'no-practice';
        }
      }
    }
    
    // Check if there's practice scheduled for this squad on this date
    if (!hasAnalyticsPractice(squadId, date)) {
      return 'no-practice';
    }
    
    // If there is practice, get the actual attendance status
    const dateString = getLocalDateString(date);
    const record = attendanceData.find(
      (a) => a.athlete_id === athleteId && a.date === dateString
    );
    return record?.status || null;
  };

  // Calculate overall statistics
  const calculateOverallStats = () => {
    const filteredAthletes = getFilteredAthletes();
    if (filteredAthletes.length === 0) return null;

    let totalAttended = 0;
    let onTime = 0;
    let late = 0;
    let lateJustified = 0;
    let excused = 0;
    let missing = 0;
    let notMarked = 0;
    let totalPractices = 0;

    // Group athletes by squad to calculate squad-specific totals
    const squadGroups = new Map<string, any[]>();
    filteredAthletes.forEach(athlete => {
      const squadKey = `${athlete.gender}_${athlete.weapon}`;
      if (!squadGroups.has(squadKey)) {
        squadGroups.set(squadKey, []);
      }
      squadGroups.get(squadKey)!.push(athlete);
    });

    squadGroups.forEach((squadAthletes, squadKey) => {
      const [gender, weapon] = squadKey.split('_');
      const allPastDates = getAllPastPracticeDates(gender, weapon);
      
      squadAthletes.forEach(athlete => {
        const athleteAttendance = attendanceData.filter(a => a.athlete_id === athlete.id);
        const markedDates = new Set(athleteAttendance.map(a => a.date));
        
        athleteAttendance.forEach(record => {
          if (record.status === 'on-time') {
            totalAttended++;
            onTime++;
          } else if (record.status === 'late-justified') {
            totalAttended++;
            lateJustified++;
          } else if (record.status === 'late') {
            late++;
          } else if (record.status === 'excused') {
            excused++;
          } else if (record.status === 'missing') {
            missing++;
          }
        });

        // Count unmarked days for this athlete (only on days their squad had practice)
        allPastDates.forEach(date => {
          if (!markedDates.has(date)) {
            notMarked++;
          }
        });
        
        totalPractices += allPastDates.size;
      });
    });

    const totalEligible = totalPractices - excused;
    const attendanceRate = totalEligible > 0 ? (totalAttended / totalEligible) * 100 : null;

    return {
      totalAthletes: filteredAthletes.length,
      totalPractices,
      totalAttended,
      attendanceRate,
      onTime,
      late,
      lateJustified,
      excused,
      missing
    };
  };

  // Calculate per-squad statistics
  const calculateSquadStats = () => {
    const squads = getSquads();
    return squads.map(squadKey => {
      const [gender, weapon] = squadKey.split('_');
      const squadAthletes = athletes.filter(a => 
        a.gender === gender && a.weapon === weapon
      );

      let totalAttended = 0;
      let totalPractices = 0;
      let excused = 0;

      squadAthletes.forEach(athlete => {
        const athleteAttendance = attendanceData.filter(a => a.athlete_id === athlete.id);
        athleteAttendance.forEach(record => {
          totalPractices++;
          if (record.status === 'on-time' || record.status === 'late-justified') {
            totalAttended++;
          } else if (record.status === 'excused') {
            excused++;
          }
        });
      });

      const totalEligible = totalPractices - excused;
      const attendanceRate = totalEligible > 0 ? (totalAttended / totalEligible) * 100 : null;

      return {
        squad: squadKey,
        label: `${gender === 'male' ? "Men's" : "Women's"} ${weapon.charAt(0).toUpperCase() + weapon.slice(1)}`,
        athleteCount: squadAthletes.length,
        totalPractices,
        attendanceRate: attendanceRate !== null ? attendanceRate.toFixed(1) : 'N/A'
      };
    });
  };

  // Get top performers
  const getTopPerformers = () => {
    const filteredAthletes = getFilteredAthletes();
    
    const athleteStats = filteredAthletes.map(athlete => {
      const allPastDates = getAllPastPracticeDates(athlete.gender, athlete.weapon);
      const athleteAttendance = attendanceData.filter(a => a.athlete_id === athlete.id);
      let attended = 0;
      let excused = 0;

      athleteAttendance.forEach(record => {
        if (record.status === 'on-time' || record.status === 'late-justified') {
          attended++;
        } else if (record.status === 'excused') {
          excused++;
        }
      });

      const total = allPastDates.size;
      const totalEligible = total - excused;
      const rate = totalEligible > 0 ? (attended / totalEligible) * 100 : null;

      return {
        name: athlete.full_name || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() || athlete.username,
        squad: `${athlete.gender === 'male' ? "Men's" : "Women's"} ${athlete.weapon?.charAt(0).toUpperCase() + athlete.weapon?.slice(1)}`,
        attended,
        total,
        rate
      };
    });

    return athleteStats
      .filter(a => a.total > 0)
      .sort((a, b) => {
        // Handle null rates (push to end)
        if (a.rate === null && b.rate === null) return 0;
        if (a.rate === null) return 1;
        if (b.rate === null) return -1;
        
        // First sort by rate (highest first)
        if (b.rate !== a.rate) return b.rate - a.rate;
        // If rates are equal, sort by total attended (highest first)
        return b.attended - a.attended;
      })
      .slice(0, 10);
  };

  if (loading) return <p className="p-4">Loading...</p>;

  const overallStats = calculateOverallStats();
  const squadStats = calculateSquadStats();
  const topPerformers = getTopPerformers();
  const squads = getSquads();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-800 p-4 sm:p-6">
      {showPasswordChange && user && (
        <PasswordChangeModal
          username={user.user_metadata?.username || user.email?.split('@')[0] || ''}
          onPasswordChanged={() => {
            setShowPasswordChange(false);
            supabase.auth.getSession().then(({ data }) => {
              if (data.session?.user) setUser(data.session.user);
            });
          }}
        />
      )}
      
      <div className="max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-yellow-300 mb-2">Team Analytics Dashboard</h1>
            <p className="text-yellow-100 text-sm sm:text-base">Comprehensive attendance insights and statistics</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex bg-white/10 rounded-lg overflow-hidden border border-white/20 backdrop-blur-sm">
              <button
                onClick={() => setViewMode('stats')}
                className={`px-3 py-1 text-sm font-medium transition ${viewMode === 'stats' ? 'bg-yellow-400 text-blue-900' : 'text-white hover:bg-white/20'}`}
              >Stats</button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 text-sm font-medium transition ${viewMode === 'calendar' ? 'bg-yellow-400 text-blue-900' : 'text-white hover:bg-white/20'}`}
              >Calendar</button>
            </div>
            <div className="flex bg-white/10 rounded-lg overflow-hidden border border-white/20 backdrop-blur-sm">
              <button
                onClick={() => setSessionType('practice')}
                className={`px-3 py-1 text-sm font-medium transition ${sessionType === 'practice' ? 'bg-yellow-400 text-blue-900' : 'text-white hover:bg-white/20'}`}
              >Practice</button>
              <button
                onClick={() => setSessionType('lift')}
                className={`px-3 py-1 text-sm font-medium transition ${sessionType === 'lift' ? 'bg-yellow-400 text-blue-900' : 'text-white hover:bg-white/20'}`}
              >Lift</button>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition-transform transform hover:scale-105 text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Squad Filter */}
        {viewMode === 'stats' && (
          <div className="mb-6 bg-white rounded-xl shadow-lg p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Filter by Quarter:</label>
              <select
                value={selectedQuarter || ''}
                onChange={(e) => setSelectedQuarter(e.target.value || null)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Time</option>
                {quarters.map((quarter) => (
                  <option key={quarter.id} value={quarter.id}>
                    {quarter.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Filter by Squad:</label>
              <select
                value={selectedSquad}
                onChange={(e) => setSelectedSquad(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Squads</option>
                {squads.map(squad => {
                  const [gender, weapon] = squad.split('_');
                  return (
                    <option key={squad} value={squad}>
                      {gender === 'male' ? "Men's" : "Women's"} {weapon.charAt(0).toUpperCase() + weapon.slice(1)}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
        )}

        {viewMode === 'stats' ? (
          <>
        {/* Overall Statistics Cards */}
        {overallStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500">
              <div className="text-3xl font-bold text-blue-700">{overallStats.totalAthletes}</div>
              <div className="text-sm text-gray-600 mt-1">Athletes</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-indigo-500">
              <div className="text-3xl font-bold text-indigo-700">{overallStats.totalPractices}</div>
              <div className="text-sm text-gray-600 mt-1">Total Records</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-green-500">
              <div className="text-3xl font-bold text-green-700">
                {overallStats.attendanceRate !== null ? `${overallStats.attendanceRate.toFixed(1)}%` : 'N/A'}
              </div>
              <div className="text-sm text-gray-600 mt-1">Attendance Rate</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-emerald-500">
              <div className="text-3xl font-bold text-emerald-700">{overallStats.onTime}</div>
              <div className="text-sm text-gray-600 mt-1">On Time</div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-yellow-500">
              <div className="text-3xl font-bold text-yellow-700">{overallStats.late}</div>
              <div className="text-sm text-gray-600 mt-1">Late</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Squad Comparison */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Squad Performance</h3>
            <div className="space-y-4">
              {squadStats.map(squad => (
                <div key={squad.squad} className="border-b pb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-800">{squad.label}</span>
                    <span className="text-sm text-gray-600">{squad.athleteCount} athletes</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: squad.attendanceRate !== 'N/A' ? `${squad.attendanceRate}%` : '0%' }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold text-blue-700 min-w-[50px]">{squad.attendanceRate !== 'N/A' ? `${squad.attendanceRate}%` : 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Top Performers</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {topPerformers.slice(0, 10).map((performer, index) => (
                <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-400' :
                      index === 2 ? 'bg-amber-600' :
                      'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm">{performer.name}</div>
                      <div className="text-xs text-gray-500">{performer.squad}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-700">
                      {performer.rate !== null ? `${performer.rate.toFixed(1)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">{performer.attended}/{performer.total}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        {overallStats && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Attendance Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{overallStats.onTime}</div>
                <div className="text-sm text-gray-600">On Time</div>
                <div className="text-xs text-green-600 mt-1">
                  {overallStats.totalPractices > 0 ? ((overallStats.onTime / overallStats.totalPractices) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-700">{overallStats.lateJustified}</div>
                <div className="text-sm text-gray-600">Late (Justified)</div>
                <div className="text-xs text-emerald-600 mt-1">
                  {overallStats.totalPractices > 0 ? ((overallStats.lateJustified / overallStats.totalPractices) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-700">{overallStats.late}</div>
                <div className="text-sm text-gray-600">Late</div>
                <div className="text-xs text-yellow-600 mt-1">
                  {overallStats.totalPractices > 0 ? ((overallStats.late / overallStats.totalPractices) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{overallStats.excused}</div>
                <div className="text-sm text-gray-600">Excused</div>
                <div className="text-xs text-blue-600 mt-1">
                  {overallStats.totalPractices > 0 ? ((overallStats.excused / overallStats.totalPractices) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{overallStats.missing}</div>
                <div className="text-sm text-gray-600">Missing</div>
                <div className="text-xs text-red-600 mt-1">
                  {overallStats.totalPractices > 0 ? ((overallStats.missing / overallStats.totalPractices) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Athlete Analytics Grid */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Individual Athlete Statistics</h3>
          
          {/* Group by squad */}
          {squads.map(squadKey => {
            const [gender, weapon] = squadKey.split('_');
            const squadLabel = `${gender === 'male' ? "Men's" : "Women's"} ${weapon.charAt(0).toUpperCase() + weapon.slice(1)}`;
            const squadAthletes = athletes
              .filter(a => a.gender === gender && a.weapon === weapon && (selectedSquad === 'all' || selectedSquad === squadKey))
              .sort((a, b) => {
                const nameA = a.full_name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.username || '';
                const nameB = b.full_name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username || '';
                return nameA.localeCompare(nameB);
              });

            if (squadAthletes.length === 0) return null;

            return (
              <div key={squadKey} className="mb-6 last:mb-0">
                <h4 className="text-lg font-semibold text-gray-700 mb-3 pb-2 border-b-2 border-blue-200">
                  {squadLabel}
                </h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-2 font-semibold text-gray-700 w-[200px]">Athlete</th>
                        <th className="p-2 font-semibold text-gray-700 text-center w-[70px]">Total</th>
                        <th className="p-2 font-semibold text-gray-700 text-center w-[80px]">Attended</th>
                        <th className="p-2 font-semibold text-gray-700 text-center w-[70px]">Rate</th>
                        <th className="p-2 font-semibold text-green-700 text-center w-[80px]">On Time</th>
                        <th className="p-2 font-semibold text-yellow-700 text-center w-[70px]">Late</th>
                        <th className="p-2 font-semibold text-blue-700 text-center w-[80px]">Excused</th>
                        <th className="p-2 font-semibold text-red-700 text-center w-[80px]">Missing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {squadAthletes.map(athlete => {
                        // Get all past practice dates for this squad
                        const allPastDates = getAllPastPracticeDates(gender, weapon);
                        const athleteAttendance = attendanceData.filter(a => a.athlete_id === athlete.id);
                        
                        let onTime = 0, late = 0, lateJustified = 0, excused = 0, missing = 0, notMarked = 0;
                        
                        athleteAttendance.forEach(record => {
                          if (record.status === 'on-time') onTime++;
                          else if (record.status === 'late') late++;
                          else if (record.status === 'late-justified') lateJustified++;
                          else if (record.status === 'excused') excused++;
                          else if (record.status === 'missing') missing++;
                        });

                        // Count not marked: all past dates minus dates with records
                        const markedDates = new Set(athleteAttendance.map(a => a.date));
                        allPastDates.forEach(date => {
                          if (!markedDates.has(date)) {
                            notMarked++;
                          }
                        });

                        const attended = onTime + lateJustified;
                        const total = allPastDates.size; // Total = all past practice days for this squad
                        const totalEligible = total - excused;
                        const rate = totalEligible > 0 ? ((attended / totalEligible) * 100).toFixed(1) : 'N/A';

                        return (
                          <tr key={athlete.id} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-medium text-gray-800">
                              {athlete.full_name || `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() || athlete.username}
                              {athlete.role === 'captain' && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Captain</span>
                              )}
                            </td>
                            <td className="p-2 text-center text-gray-700">{total}</td>
                            <td className="p-2 text-center text-gray-700">{attended}</td>
                            <td className="p-2 text-center">
                              <span className={`font-bold ${
                                rate === 'N/A' ? 'text-gray-500' :
                                parseFloat(rate) >= 90 ? 'text-green-600' :
                                parseFloat(rate) >= 75 ? 'text-blue-600' :
                                parseFloat(rate) >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {rate}{rate !== 'N/A' ? '%' : ''}
                              </span>
                            </td>
                            <td className="p-2 text-center text-green-700">{onTime}</td>
                            <td className="p-2 text-center text-yellow-700">{late + lateJustified}</td>
                            <td className="p-2 text-center text-blue-700">{excused}</td>
                            <td className="p-2 text-center text-red-700">{missing}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
        </>
        ) : (
          /* Calendar View - Month navigation within quarter */
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-xl p-6">
            <div className="mb-6">
              {/* Calendar Header: Title Left, Month Navigation Center, Quarter Right */}
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-6">
                {/* Left: Title */}
                <h2 className="text-2xl font-bold text-gray-800 whitespace-nowrap">Attendance Calendar</h2>
                
                {/* Center: Month Navigation */}
                {selectedCalendarQuarter && (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={goToPreviousMonth}
                      disabled={!canGoPrevious()}
                      className={`p-2 rounded-full transition shadow-md ${
                        canGoPrevious() 
                          ? 'bg-white text-blue-600 hover:bg-blue-50 hover:shadow-lg' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      title="Previous Month"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="bg-white px-6 py-2 rounded-lg shadow-md border-2 border-blue-200">
                      <span className="text-lg font-bold text-gray-800 whitespace-nowrap">
                        {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    
                    <button
                      onClick={goToNextMonth}
                      disabled={!canGoNext()}
                      className={`p-2 rounded-full transition shadow-md ${
                        canGoNext() 
                          ? 'bg-white text-blue-600 hover:bg-blue-50 hover:shadow-lg' 
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      title="Next Month"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Right: Quarter Selector */}
                <select
                  value={selectedCalendarQuarter || ''}
                  onChange={(e) => {
                    setSelectedCalendarQuarter(e.target.value);
                    // Set to first month of selected quarter
                    const quarter = quarters.find(q => q.id === e.target.value);
                    if (quarter) {
                      const start = new Date(quarter.start_date);
                      setSelectedMonth(start.getMonth());
                      setSelectedYear(start.getFullYear());
                    }
                  }}
                  className="px-4 py-2 border-2 border-blue-300 rounded-lg text-gray-900 font-semibold bg-white shadow-sm hover:border-blue-400 transition text-sm"
                >
                  <option value="">Select a quarter</option>
                  {quarters.map((quarter) => (
                    <option key={quarter.id} value={quarter.id}>
                      {quarter.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Legend */}
              <div className="bg-white rounded-xl shadow-md p-4 mb-6 border-2 border-blue-100">
                <div className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <span className="text-blue-600">📊</span>
                  <span>Legend:</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                    <span className="text-green-700 text-lg font-bold">✓</span>
                    <span className="text-gray-800 text-xs font-semibold">On Time</span>
                  </span>
                  <span className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-200">
                    <span className="text-yellow-700 text-lg font-bold">L</span>
                    <span className="text-gray-800 text-xs font-semibold">Late</span>
                  </span>
                  <span className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                    <span className="text-green-500 text-lg font-bold">J</span>
                    <span className="text-gray-800 text-xs font-semibold">Late (J)</span>
                  </span>
                  <span className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                    <span className="text-blue-700 text-lg font-bold">E</span>
                    <span className="text-gray-800 text-xs font-semibold">Excused</span>
                  </span>
                  <span className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                    <span className="text-red-700 text-lg font-bold">X</span>
                    <span className="text-gray-800 text-xs font-semibold">Missing</span>
                  </span>
                  <span className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                    <span className="bg-gray-200 px-2 py-1 rounded text-gray-600 text-xs font-bold">Empty</span>
                    <span className="text-gray-800 text-xs font-semibold">No Prac</span>
                  </span>
                  <span className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                    <span className="text-purple-700 text-lg font-bold">—</span>
                    <span className="text-gray-800 text-xs font-semibold">Not Marked</span>
                  </span>
                </div>
              </div>
            </div>
            
            {/* Attendance Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 table-fixed">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-1 sm:px-3 py-1 sm:py-2 text-left font-semibold text-gray-900 w-[80px] sm:w-[150px] text-[10px] sm:text-base">
                      Team Member
                    </th>
                    {getMonthDays().map((date, index) => (
                      <th key={index} className="border border-gray-300 px-1 sm:px-2 py-1 sm:py-2 text-center font-semibold text-gray-900 w-[25px] sm:w-[40px]">
                        <div className="text-[8px] sm:text-xs">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className="text-[10px] sm:text-sm">
                          {date.getDate()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {squads.map((squadKey, squadIndex) => {
                    const [gender, weapon] = squadKey.split('_');
                    const squadLabel = `${gender === 'male' ? "Men's" : "Women's"} ${weapon.charAt(0).toUpperCase() + weapon.slice(1)}`;
                    const squadId = `${gender}_${weapon}`;
                    const squadAthletes = athletes
                      .filter(a => a.gender === gender && a.weapon === weapon && (selectedSquad === 'all' || selectedSquad === squadKey))
                      .sort((a, b) => {
                        const nameA = a.full_name || `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.username || '';
                        const nameB = b.full_name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username || '';
                        return nameA.localeCompare(nameB);
                      });

                    if (squadAthletes.length === 0) return null;

                    return (
                      <Fragment key={squadKey}>
                        {/* Squad Header Row */}
                        <tr>
                          <td colSpan={getMonthDays().length + 1} className="border border-gray-300 px-2 sm:px-3 py-1 sm:py-2 bg-blue-50 font-bold text-blue-900 text-xs sm:text-base">
                            {squadLabel}
                          </td>
                        </tr>
                        
                        {/* Squad Members */}
                        {squadAthletes.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-1 sm:px-3 py-1 sm:py-2 font-medium text-gray-900 text-[10px] sm:text-base">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                                <div className="flex items-center gap-1 sm:gap-2">
                                  <span>{member.full_name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.username}</span>
                                </div>
                                {member.role === 'captain' && (
                                  <span className="text-[8px] sm:text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                    🔱
                                  </span>
                                )}
                              </div>
                            </td>
                            
                            {getMonthDays().map((date, dateIndex) => {
                              const status = getCalendarAttendanceStatusWithSchedule(member.id, date, squadId);
                              const symbol = formatStatusSymbol(status);
                              const colorClass = getStatusColorClass(status);
                              
                              return (
                                <td 
                                  key={dateIndex} 
                                  className={`border border-gray-300 px-1 sm:px-2 py-1 sm:py-2 text-center font-bold text-[10px] sm:text-base ${colorClass} relative group cursor-help`}
                                >
                                  <div className="relative inline-block">
                                    {symbol}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        
                        {/* Spacer row between squads (except for last squad) */}
                        {squadIndex < squads.length - 1 && (
                          <tr>
                            <td colSpan={getMonthDays().length + 1} className="border-0 py-2"></td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

