"use client";
import React, { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import PasswordChangeModal from "../../components/PasswordChangeModal";

export default function CoachDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [squads, setSquads] = useState<any[]>([]);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [selectedSquad, setSelectedSquad] = useState<string | null>(null);
  const [markingAttendance, setMarkingAttendance] = useState<{[key: string]: boolean}>({});
  const [message, setMessage] = useState<string>('');
  const [viewMode, setViewMode] = useState<'overview' | 'attendance' | 'captains' | 'analytics' | 'practice'>('overview');
  const [updatingCaptain, setUpdatingCaptain] = useState<{[key: string]: boolean}>({});
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [practiceSchedules, setPracticeSchedules] = useState<{[key: string]: string[]}>({});
  const [customNoPracticeDays, setCustomNoPracticeDays] = useState<{[key: string]: string[]}>({});
  const [customPracticeDays, setCustomPracticeDays] = useState<{[key: string]: string[]}>({});
  // Cache per sessionType
  const [practiceScheduleCache, setPracticeScheduleCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  const [customNoPracticeDaysCache, setCustomNoPracticeDaysCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  const [customPracticeDaysCache, setCustomPracticeDaysCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  const [updatingSchedule, setUpdatingSchedule] = useState<{[key: string]: boolean}>({});
  const [showCustomDaysModal, setShowCustomDaysModal] = useState(false);
  const [customDayType, setCustomDayType] = useState<'no-practice' | 'practice'>('no-practice');
  const [selectedCustomSquad, setSelectedCustomSquad] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [customSpecificDates, setCustomSpecificDates] = useState<string[]>(['']);
  // sessionType toggle for Practice vs Lift modes
  const [sessionType, setSessionType] = useState<'practice' | 'lift'>('practice');
  // Quarter management state
  const [quarters, setQuarters] = useState<any[]>([]);
  const [newQuarter, setNewQuarter] = useState({ name: '', startDate: '', endDate: '' });
  const [editingQuarter, setEditingQuarter] = useState<any>(null);
  const [savingQuarter, setSavingQuarter] = useState(false);
  // Analytics view mode state
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'month' | 'quarter'>('month');
  const [selectedAnalyticsQuarter, setSelectedAnalyticsQuarter] = useState<string | null>(null);
  // Athlete quarter stats modal state
  const [showAthleteStatsModal, setShowAthleteStatsModal] = useState(false);
  const [selectedAthleteStats, setSelectedAthleteStats] = useState<any>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const router = useRouter();

  // When sessionType toggles, attempt to restore cached schedules; otherwise fetch
  useEffect(() => {
    // Skip initial before user load
    if (!user) return;
    const cached = practiceScheduleCache[sessionType];
    if (Object.keys(cached).length > 0) {
      setPracticeSchedules(cached);
      setCustomNoPracticeDays(customNoPracticeDaysCache[sessionType]);
      setCustomPracticeDays(customPracticeDaysCache[sessionType]);
    } else {
      fetchPracticeSchedules();
    }
  }, [sessionType]);

  // Get current week's dates with offset
  const getWeekDates = () => {
    const today = new Date();
    // Set to noon to avoid timezone issues near midnight
    today.setHours(12, 0, 0, 0);
    today.setDate(today.getDate() + (currentWeekOffset * 7));
    
    const currentDay = today.getDay();
    const sundayOffset = -currentDay;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + sundayOffset);
    
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

  // Fetch squads and their members
  const fetchSquads = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      // Fetch all users from the users table via API
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Error fetching users:', response.status, response.statusText);
        return;
      }

      const { users } = await response.json();

      // Group users by squad
      const squadGroups: { [key: string]: any[] } = {};
      
      users?.forEach((user: any) => {
        // Only include athletes and captains in squads
        if (user.role === 'athlete' || user.role === 'captain') {
          const squadKey = `${user.gender}_${user.weapon}`;
          if (!squadGroups[squadKey]) {
            squadGroups[squadKey] = [];
          }
          squadGroups[squadKey].push(user);
        }
      });

      // Convert to array format
      const squadArray = Object.keys(squadGroups).map(key => {
        const [gender, weapon] = key.split('_');
        return {
          id: key,
          gender,
          weapon,
          displayName: `${gender === 'male' ? "Men's" : "Women's"} ${weapon.charAt(0).toUpperCase() + weapon.slice(1)}`,
          members: squadGroups[key].sort((a: any, b: any) => {
            // Sort captains first, then by name
            if (a.role === 'captain' && b.role !== 'captain') return -1;
            if (a.role !== 'captain' && b.role === 'captain') return 1;
            return a.full_name.localeCompare(b.full_name);
          })
        };
      });

      setSquads(squadArray.sort((a, b) => a.displayName.localeCompare(b.displayName)));
      
    } catch (error) {
      console.error('Error fetching squads:', error);
    }
  };

  // Fetch attendance data
  const fetchAttendanceData = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const weekDates = getWeekDates();
      const startDate = getLocalDateString(weekDates[0]);
      const endDate = getLocalDateString(weekDates[weekDates.length - 1]);

      const response = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&sessionType=${sessionType}`, {
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

  // Fetch analytics data for the selected month or quarter
  const fetchAnalyticsData = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      let startDate: string;
      let endDate: string;

      if (analyticsViewMode === 'quarter' && selectedAnalyticsQuarter) {
        // Get quarter date range
        const quarter = quarters.find(q => q.id === selectedAnalyticsQuarter);
        if (!quarter) return;
        
        startDate = quarter.start_date;
        endDate = quarter.end_date;
      } else {
        // Get first and last day of selected month
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        
        startDate = getLocalDateString(firstDay);
        endDate = getLocalDateString(lastDay);
      }

      const response = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&sessionType=${sessionType}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { attendance } = await response.json();
        setAnalyticsData(attendance || []);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    }
  };

  // Auto-refresh after login / user load (and when sessionType changes)
  useEffect(() => {
    if (user && user.user_metadata?.role === 'coach') {
      // Fire and forget parallel fetches
      Promise.all([
        fetchAttendanceData(),
        fetchPracticeSchedules(),
        fetchSquads(),
        fetchAnalyticsData(),
        fetchQuarters()
      ]).catch(e => console.error('Auto refresh error:', e));
    }
  // Include sessionType so switching practice/lift also triggers full sync
  }, [user, sessionType]);

  // Generate days for the selected month (including weekends)
  const getMonthDays = () => {
    if (analyticsViewMode === 'quarter' && selectedAnalyticsQuarter) {
      // Get quarter date range
      const quarter = quarters.find(q => q.id === selectedAnalyticsQuarter);
      if (!quarter) return [];
      
      const start = new Date(quarter.start_date + 'T00:00:00');
      const end = new Date(quarter.end_date + 'T00:00:00');
      
      const days = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      return days;
    } else {
      // Month view
      const year = selectedYear;
      const month = selectedMonth;
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const days = [];
      for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        days.push(date);
      }
      return days;
    }
  };

  // Check if there's practice for a squad on a given date (for analytics)
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
    
    // Fall back to regular schedule
    const squadSchedule = practiceSchedules[squadId] || [];
    return squadSchedule.includes(dayName);
  };

  // Check if there's practice for a squad on a given date (for attendance marking)
  const hasPractice = (squadId: string, date: Date) => {
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
    
    // Fall back to regular schedule
    const squadSchedule = practiceSchedules[squadId] || [];
    return squadSchedule.includes(dayName);
  };

  // Get analytics attendance status with practice schedule consideration
  const getAnalyticsAttendanceStatusWithSchedule = (athleteId: string, date: Date, squadId: string) => {
    // First check if there's practice scheduled for this squad on this date
    if (!hasAnalyticsPractice(squadId, date)) {
      return 'no-practice';
    }
    
    // If there is practice, get the actual attendance status
    const dateString = getLocalDateString(date);
    const record = analyticsData.find(
      (a) => a.athlete_id === athleteId && a.date === dateString
    );
    return record?.status || null;
  };

  // Get analytics attendance status for grid display
  const getAnalyticsAttendanceStatus = (athleteId: string, date: Date) => {
    // Find which squad this athlete belongs to
    let memberSquadId = '';
    for (const squad of squads) {
      const member = squad.members.find((m: any) => m.id === athleteId);
      if (member) {
        memberSquadId = squad.id;
        break;
      }
    }
    
    if (!memberSquadId) {
      return null; // Athlete not found in any squad
    }
    
    return getAnalyticsAttendanceStatusWithSchedule(athleteId, date, memberSquadId);
  };

  const getAnalyticsAttendanceNotes = (athleteId: string, date: Date) => {
    const dateString = getLocalDateString(date);
    const record = analyticsData.find(
      (a) => a.athlete_id === athleteId && a.date === dateString
    );
    return record?.notes || null;
  };

  // Format status for display in grid
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

  // Get status color class
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

  const goToPreviousMonth = () => {
    setSelectedMonth(prev => prev === 0 ? 11 : prev - 1);
    setSelectedYear(prev => prev === 0 ? 2023 : prev - 1);
  };

  const goToNextMonth = () => {
    setSelectedMonth(prev => prev === 11 ? 0 : prev + 1);
    setSelectedYear(prev => prev === 2023 ? 2024 : prev + 1);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [year, month] = e.target.value.split('-').map(Number);
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  // Calculate attendance statistics
  const calculateAttendanceStats = () => {
    const stats: { [squadId: string]: any } = {};
    
    squads.forEach(squad => {
      const squadStats = {
        totalMembers: squad.members.length,
        totalPossibleAttendance: 0,
        actualAttendance: 0,
        onTime: 0,
        lateJustified: 0,
        late: 0,
        excused: 0,
        missing: 0,
        notMarked: 0
      };

      // Get days that actually have practice scheduled for this squad (including weekends)
      const practiceWeekdays = weekDates.filter((date, index) => {
        const dayName = dayNames[index];
        // Check if practice is scheduled for this squad on this date (including weekends)
        return hasPractice(squad.id, date);
      });

      squadStats.totalPossibleAttendance = squad.members.length * practiceWeekdays.length;

      squad.members.forEach((member: any) => {
        practiceWeekdays.forEach(date => {
          const status = getAttendanceStatus(member.id, date);
          if (status) {
            squadStats.actualAttendance++;
            switch (status) {
              case 'on-time':
                squadStats.onTime++;
                break;
              case 'late-justified':
                squadStats.lateJustified++;
                break;
              case 'late':
                squadStats.late++;
                break;
              case 'excused':
                squadStats.excused++;
                break;
              case 'missing':
                squadStats.missing++;
                break;
            }
          } else {
            squadStats.notMarked++;
          }
        });
      });

      stats[squad.id] = squadStats;
    });

    return stats;
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

  const markAttendance = async (athleteId: string, date: Date, status: string) => {
    const key = `${athleteId}-${getLocalDateString(date)}`;
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
          date: getLocalDateString(date),
          status,
          sessionType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark attendance');
      }

      setMessage(result.message || 'Attendance marked successfully');
      await fetchAttendanceData();
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      console.error('Error marking attendance:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to mark attendance'}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setMarkingAttendance(prev => ({ ...prev, [key]: false }));
    }
  };

  // Update captain for a squad
  const updateCaptain = async (squadId: string, newCaptainId: string) => {
    setUpdatingCaptain(prev => ({ ...prev, [squadId]: true }));
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Find the squad and the new captain
      const squad = squads.find(s => s.id === squadId);
      if (!squad) {
        throw new Error('Squad not found');
      }

      const newCaptain = squad.members.find((m: any) => m.id === newCaptainId);
      if (!newCaptain) {
        throw new Error('New captain not found');
      }

      // Update all members in the squad: set the new captain and demote old captain(s)
      const updatePromises = squad.members.map(async (member: any) => {
        const newRole = member.id === newCaptainId ? 'captain' : 'athlete';
        
        // Only update if role is changing
        if (member.role !== newRole) {
          const response = await fetch('/api/users', {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: member.id,
              role: newRole
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to update ${member.full_name}`);
          }
        }
      });

      await Promise.all(updatePromises);

      setMessage(`Successfully updated captain for ${squad.displayName} to ${newCaptain.full_name}`);
      
      // Refresh the squads data to reflect changes
      await fetchSquads();
      
      setTimeout(() => setMessage(''), 5000);

    } catch (error) {
      console.error('Error updating captain:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to update captain'}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setUpdatingCaptain(prev => ({ ...prev, [squadId]: false }));
    }
  };

  // Fetch practice schedules
  const fetchPracticeSchedules = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error('No access token for fetching schedules');
        return;
      }
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
        // cache per session type
        setPracticeScheduleCache(prev => ({ ...prev, [sessionType]: scheduleMap }));
        setCustomNoPracticeDaysCache(prev => ({ ...prev, [sessionType]: customNoPracticeMap }));
        setCustomPracticeDaysCache(prev => ({ ...prev, [sessionType]: customPracticeMap }));
      } else {
        console.error('Failed to fetch schedules:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error fetching practice schedules:', error);
    }
  };

  // Update practice schedule for a squad
  const updatePracticeSchedule = async (squadId: string, practiceDays: string[]) => {
    try {
      setUpdatingSchedule(prev => ({ ...prev, [squadId]: true }));
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch('/api/practice-schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          squadId,
          practiceDays,
          customNoPracticeDays: customNoPracticeDays[squadId] || [],
          customPracticeDays: customPracticeDays[squadId] || [],
          sessionType
        })
      });

      const result = await response.json();

      if (response.ok) {
        setPracticeSchedules(prev => ({ ...prev, [squadId]: practiceDays }));
        setPracticeScheduleCache(prev => ({
          ...prev,
          [sessionType]: { ...prev[sessionType], [squadId]: practiceDays }
        }));
        setMessage('Practice schedule updated successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(result.error || 'Error updating practice schedule');
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error updating practice schedule:', error);
      setMessage('Error updating practice schedule');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUpdatingSchedule(prev => ({ ...prev, [squadId]: false }));
    }
  };

  // Toggle practice day for a squad
  const togglePracticeDay = (squadId: string, day: string) => {
    const currentDays = practiceSchedules[squadId] || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    updatePracticeSchedule(squadId, newDays);
  };

  // Helper function to generate date range
  const generateDateRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    // Create dates in local timezone to avoid timezone shift issues
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      // Use local date formatting instead of toISOString to avoid timezone conversion
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    
    return dates;
  };

  // Add custom days (no practice or extra practice)
  const addCustomDays = async () => {
    try {
      let datesToAdd: string[] = [];
      
      // Generate dates from range or specific dates
      if (customDateRange.start && customDateRange.end) {
        datesToAdd = generateDateRange(customDateRange.start, customDateRange.end);
      } else {
        datesToAdd = customSpecificDates.filter(date => date.trim() !== '');
      }
      
      if (datesToAdd.length === 0) {
        setMessage('Please specify dates to add');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      
      // Determine which squads to update
      const squadsToUpdate = selectedCustomSquad === 'all' 
        ? squads.map(squad => squad.id) // Use actual squad IDs
        : [selectedCustomSquad];
      
      for (const squadId of squadsToUpdate) {
        const currentCustomDays = customDayType === 'no-practice' 
          ? customNoPracticeDays[squadId] || []
          : customPracticeDays[squadId] || [];
        
        const newCustomDays = [...new Set([...currentCustomDays, ...datesToAdd])];
        
        if (customDayType === 'no-practice') {
          setCustomNoPracticeDays(prev => ({ ...prev, [squadId]: newCustomDays }));
          setCustomNoPracticeDaysCache(prev => ({
            ...prev,
            [sessionType]: { ...prev[sessionType], [squadId]: newCustomDays }
          }));
        } else {
          setCustomPracticeDays(prev => ({ ...prev, [squadId]: newCustomDays }));
          setCustomPracticeDaysCache(prev => ({
            ...prev,
            [sessionType]: { ...prev[sessionType], [squadId]: newCustomDays }
          }));
        }
        
        // Update in database - pass the NEW custom days directly
        await updatePracticeScheduleWithCustomDays(
          squadId, 
          practiceSchedules[squadId] || [], 
          customDayType === 'no-practice' ? newCustomDays : (customNoPracticeDays[squadId] || []),
          customDayType === 'practice' ? newCustomDays : (customPracticeDays[squadId] || []),
          sessionType
        );
      }
      
      setMessage(`Custom ${customDayType} days added successfully`);
      setTimeout(() => setMessage(''), 3000);
      setShowCustomDaysModal(false);
      setCustomDateRange({ start: '', end: '' });
      setCustomSpecificDates(['']);
    } catch (error) {
      console.error('Error adding custom days:', error);
      setMessage('Error adding custom days');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Update practice schedule with custom days
  const updatePracticeScheduleWithCustomDays = async (
    squadId: string, 
    practiceDays: string[], 
    customNoPracticeDaysOverride?: string[], 
    customPracticeDaysOverride?: string[],
    sessionTypeOverride?: 'practice' | 'lift'
  ) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error('No access token available');
        return;
      }

      const response = await fetch('/api/practice-schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          squadId,
          practiceDays,
          customNoPracticeDays: customNoPracticeDaysOverride ?? (customNoPracticeDays[squadId] || []),
          customPracticeDays: customPracticeDaysOverride ?? (customPracticeDays[squadId] || []),
          sessionType: sessionTypeOverride || sessionType
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        throw new Error(`Failed to update practice schedule: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error updating practice schedule with custom days:', error);
      throw error;
    }
  };

  // Remove custom day
  const removeCustomDay = async (squadId: string, dateToRemove: string, dayType: 'no-practice' | 'practice') => {
    try {
      if (dayType === 'no-practice') {
        const newDays = (customNoPracticeDays[squadId] || []).filter(date => date !== dateToRemove);
        setCustomNoPracticeDays(prev => ({ ...prev, [squadId]: newDays }));
        setCustomNoPracticeDaysCache(prev => ({
          ...prev,
            [sessionType]: { ...prev[sessionType], [squadId]: newDays }
        }));
        await updatePracticeScheduleWithCustomDays(
          squadId, 
          practiceSchedules[squadId] || [], 
          newDays, // Pass the new no-practice days
          customPracticeDays[squadId] || [], // Keep existing practice days
          sessionType
        );
      } else {
        const newDays = (customPracticeDays[squadId] || []).filter(date => date !== dateToRemove);
        setCustomPracticeDays(prev => ({ ...prev, [squadId]: newDays }));
        setCustomPracticeDaysCache(prev => ({
          ...prev,
            [sessionType]: { ...prev[sessionType], [squadId]: newDays }
        }));
        await updatePracticeScheduleWithCustomDays(
          squadId, 
          practiceSchedules[squadId] || [], 
          customNoPracticeDays[squadId] || [], // Keep existing no-practice days
          newDays, // Pass the new practice days
          sessionType
        );
      }
      
      setMessage(`Custom ${dayType} day removed successfully`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error removing custom day:', error);
      setMessage('Error removing custom day');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Calculate detailed quarter stats for a specific athlete
  const calculateAthleteQuarterStats = (memberId: string, memberName: string) => {
    if (analyticsViewMode !== 'quarter' || !selectedAnalyticsQuarter) return;
    
    const quarter = quarters.find(q => q.id === selectedAnalyticsQuarter);
    if (!quarter) return;
    
    // Only count practices up to today
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const allDays = getMonthDays();
    const days = allDays.filter(date => date <= today);
    
    let onTime = 0, late = 0, lateJustified = 0, excused = 0, missing = 0, notMarked = 0;
    let totalPractices = 0;
    
    days.forEach(date => {
      const status = getAnalyticsAttendanceStatus(memberId, date);
      // Only count days where practice was scheduled (not 'no-practice' days)
      if (status !== 'no-practice') {
        totalPractices++;
        if (status === 'on-time') onTime++;
        else if (status === 'late') late++;
        else if (status === 'late-justified') lateJustified++;
        else if (status === 'excused') excused++;
        else if (status === 'missing') missing++;
        else if (status === null) notMarked++;
      }
    });
    
    // Attended = on-time + late-justified
    // Total eligible = total practices - excused
    const attended = onTime + lateJustified;
    const totalEligible = totalPractices - excused;
    const percentage = totalEligible > 0 ? Math.round((attended / totalEligible) * 100) : 0;
    
    setSelectedAthleteStats({
      name: memberName,
      quarterName: quarter.name,
      totalPractices,
      attended,
      percentage,
      onTime,
      late,
      lateJustified,
      excused,
      missing,
      notMarked
    });
    setShowAthleteStatsModal(true);
  };

  // Quarter management functions
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
        const { quarters } = await response.json();
        setQuarters(quarters || []);
      }
    } catch (error) {
      console.error('Error fetching quarters:', error);
    }
  };

  const saveQuarter = async () => {
    console.log('saveQuarter called with:', newQuarter);
    
    if (!newQuarter.name || !newQuarter.startDate || !newQuarter.endDate) {
      console.log('Validation failed: missing fields');
      setMessage('Please fill in all quarter fields');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (new Date(newQuarter.endDate) <= new Date(newQuarter.startDate)) {
      console.log('Validation failed: end date before start date');
      setMessage('End date must be after start date');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setSavingQuarter(true);

      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('Season query result:', { seasonData, seasonError });

      const currentSeason = seasonData?.[0];

      if (!currentSeason) {
        setMessage('No active season found. Please create a season first.');
        setTimeout(() => setMessage(''), 3000);
        setSavingQuarter(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      console.log('Access token:', accessToken ? 'present' : 'missing');
      
      if (!accessToken) {
        setMessage('Authentication error');
        setTimeout(() => setMessage(''), 3000);
        setSavingQuarter(false);
        return;
      }

      console.log('Sending quarter data:', {
        seasonId: currentSeason.id,
        name: newQuarter.name,
        startDate: newQuarter.startDate,
        endDate: newQuarter.endDate
      });

      const response = await fetch('/api/quarters', {
        method: editingQuarter ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...(editingQuarter && { id: editingQuarter.id }),
          seasonId: currentSeason.id,
          name: newQuarter.name,
          startDate: newQuarter.startDate,
          endDate: newQuarter.endDate
        })
      });

      console.log('Quarter API response status:', response.status);

      if (response.ok) {
        await fetchQuarters();
        setNewQuarter({ name: '', startDate: '', endDate: '' });
        setEditingQuarter(null);
        setMessage(`Quarter ${editingQuarter ? 'updated' : 'created'} successfully`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await response.json();
        console.error('Quarter API error:', error);
        setMessage(error.error || 'Failed to save quarter');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving quarter:', error);
      setMessage('Error saving quarter');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSavingQuarter(false);
    }
  };

  const deleteQuarter = async (quarterId: string) => {
    if (!confirm('Are you sure you want to delete this quarter?')) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;

      const response = await fetch(`/api/quarters?id=${quarterId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchQuarters();
        setMessage('Quarter deleted successfully');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to delete quarter');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting quarter:', error);
      setMessage('Error deleting quarter');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const startEditQuarter = (quarter: any) => {
    setEditingQuarter(quarter);
    setNewQuarter({
      name: quarter.name,
      startDate: quarter.start_date,
      endDate: quarter.end_date
    });
  };

  const cancelEditQuarter = () => {
    setEditingQuarter(null);
    setNewQuarter({ name: '', startDate: '', endDate: '' });
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (!currentUser || currentUser.user_metadata.role !== "coach") {
        router.push("/");
        return;
      }

      // Check if user needs to change password
      if (!currentUser.user_metadata?.passwordChanged) {
        setShowPasswordChange(true);
      }

      await fetchSquads();
      setLoading(false);
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    if (user && user.user_metadata.role === 'coach') {
      fetchAttendanceData();
      fetchAnalyticsData();
      // practiceSchedules loaded by sessionType effect, avoid duplicate fetch here
    }
  }, [currentWeekOffset, user, selectedMonth, selectedYear, sessionType]);

  // Refetch analytics when quarter selection or view mode changes
  useEffect(() => {
    if (user && user.user_metadata.role === 'coach') {
      fetchAnalyticsData();
    }
  }, [analyticsViewMode, selectedAnalyticsQuarter]);

  // Persist last used sessionType
  useEffect(() => {
    if (sessionType) {
      try { localStorage.setItem('coach_last_session_type', sessionType); } catch {}
    }
  }, [sessionType]);

  // Restore last sessionType on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('coach_last_session_type');
      if (saved === 'practice' || saved === 'lift') setSessionType(saved);
    } catch {}
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Print function for analytics data
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 0);
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (user === undefined) return <p className="p-4">Loading...</p>;
  if (!user) return null;

  const attendanceStats = calculateAttendanceStats();

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
      
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4">
          {/* Left: Title & Mode Badge */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-yellow-300 leading-tight tracking-tight">
              Welcome, Coach {user.user_metadata.firstName ?? user.email}
            </h1>
            <p className="text-yellow-100 text-sm sm:text-base font-semibold mt-1">UCSD Fencing Team Management</p>
            {/* Removed mode badge per request */}
          </div>
          {/* Right: Toolbars */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white/20 backdrop-blur-sm rounded-xl overflow-hidden border-2 border-white/30 h-10 sm:h-11 shadow-lg">
              <button
                onClick={() => setSessionType('practice')}
                className={`px-4 sm:px-6 text-sm sm:text-base font-semibold transition-all duration-200 h-full flex items-center ${sessionType === 'practice' ? 'bg-white text-indigo-600 shadow-md' : 'text-white hover:bg-white/10'}`}
              >Practice</button>
              <button
                onClick={() => setSessionType('lift')}
                className={`px-4 sm:px-6 text-sm sm:text-base font-semibold transition-all duration-200 h-full flex items-center ${sessionType === 'lift' ? 'bg-white text-indigo-600 shadow-md' : 'text-white hover:bg-white/10'}`}
              >Lift</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {[
                { key: 'overview', label: 'Overview', shortLabel: 'Overview' },
                { key: 'attendance', label: 'Mark Attendance', shortLabel: 'Attendance' },
                // Captains management only relevant for practice session type
                ...(sessionType === 'practice' ? [{ key: 'captains', label: 'Manage Captains', shortLabel: 'Captains' }] : []),
                { key: 'analytics', label: 'Analytics', shortLabel: 'Analytics' },
                { key: 'practice', label: 'Practice Management', shortLabel: 'Practice' }
              ].map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setViewMode(btn.key as any)}
                  className={`h-10 sm:h-11 px-3 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center shadow-md hover:shadow-lg transform hover:scale-105 ${
                    viewMode === btn.key ? 'bg-white text-indigo-600' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-white/20'
                  }`}
                >
                  <span className="hidden sm:inline">{btn.label}</span>
                  <span className="sm:hidden">{btn.shortLabel}</span>
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="h-8 sm:h-9 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium flex items-center bg-red-500 hover:bg-red-600 text-white transition-colors"
              >Logout</button>
            </div>
          </div>
        </div>

        {viewMode === 'overview' ? (
          // Team Overview Mode
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Team Overview</h2>
                
                {/* Week Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <button
                      onClick={goToPreviousWeek}
                      className="px-2 sm:px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">← Previous Week</span>
                      <span className="sm:hidden">← Prev</span>
                    </button>
                    
                    {currentWeekOffset !== 0 && (
                      <button
                        onClick={goToCurrentWeek}
                        className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs sm:text-sm"
                      >
                        Today
                      </button>
                    )}
                    
                    <button
                      onClick={goToNextWeek}
                      className="px-2 sm:px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Next Week →</span>
                      <span className="sm:hidden">Next →</span>
                    </button>
                  </div>
                  
                  <span className="text-xs sm:text-sm font-medium text-gray-700 text-center sm:text-left">
                    {currentWeekOffset === 0 ? "This Week" : 
                     currentWeekOffset === -1 ? "Last Week" :
                     currentWeekOffset === 1 ? "Next Week" :
                     currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
                     `${currentWeekOffset} Weeks Ahead`} ({formatWeekRange(weekDates)})
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {squads.map(squad => (
                  <div key={squad.id} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                    <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 sm:mb-3">{squad.displayName}</h3>
                    
                    <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                      {squad.members.map((member: any) => {
                        // Get this week's attendance summary for this member - include all days (including weekends)
                        const practiceWeekdays = weekDates.filter((date, index) => {
                          const dayName = dayNames[index];
                          // Check if practice is scheduled for this squad on this date (including weekends)
                          return hasPractice(squad.id, date);
                        });
                        
                        const weekAttendance = practiceWeekdays.map(date => getAttendanceStatus(member.id, date));
                        const attendanceCount = {
                          onTime: weekAttendance.filter(s => s === 'on-time').length,
                          lateJustified: weekAttendance.filter(s => s === 'late-justified').length,
                          late: weekAttendance.filter(s => s === 'late').length,
                          excused: weekAttendance.filter(s => s === 'excused').length,
                          missing: weekAttendance.filter(s => s === 'missing').length,
                          notMarked: weekAttendance.filter(s => s === null).length
                        };
                        
                        // Today's specific status (if current week)
                        const today = new Date();
                        const todayStatus = currentWeekOffset === 0 ? getAttendanceStatus(member.id, today) : null;
                        const hasTodayPractice = hasPractice(squad.id, today);
                        const isTodayCurrentWeek = currentWeekOffset === 0;
                        
                        return (
                          <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm gap-1">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <span className="font-medium text-gray-900">
                                {member.full_name}
                              </span>
                              {member.role === 'captain' && (
                                <span className="text-[10px] sm:text-xs bg-blue-100 text-blue-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                                  Captain 🔱
                                </span>
                              )}
                            </div>
                            
                            {/* Today's status only */}
                            <div className="flex items-center gap-1 sm:gap-2">
                              {/* Today's status for current week */}
                              {isTodayCurrentWeek && (
                                <div className="text-[10px] sm:text-xs">
                                  {!hasTodayPractice ? (
                                    <span className="text-gray-400 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-gray-100 font-bold italic">
                                      <span className="hidden sm:inline">Today: No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
                                      <span className="sm:hidden">No {sessionType === 'practice' ? 'Prac' : 'Lift'}</span>
                                    </span>
                                  ) : todayStatus ? (
                                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-medium ${
                                      todayStatus === 'on-time' ? 'bg-green-100 text-green-700' :
                                      todayStatus === 'late' ? 'bg-yellow-100 text-yellow-700' :
                                      todayStatus === 'late-justified' ? 'bg-green-100 text-green-700' :
                                      todayStatus === 'excused' ? 'bg-blue-100 text-blue-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      Today: {todayStatus === 'on-time' ? 'On Time' :
                                               todayStatus === 'late' ? 'Late' :
                                               todayStatus === 'late-justified' ? 'Late (J)' :
                                               todayStatus === 'excused' ? 'Excused' :
                                               'Missing'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 px-2 py-1 rounded bg-gray-100">
                                      Today: Not Marked
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {attendanceStats[squad.id] && (
                      <div className="border-t pt-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">This Week's Attendance:</p>
                        <div className="grid grid-cols-3 gap-3 max-w-xl">
                          <div className="flex flex-col items-center justify-center border border-green-200 rounded-lg bg-green-50 px-3 py-2">
                            <span className="text-[11px] font-medium text-green-700 tracking-wide">On Time</span>
                            <span className="text-xl font-bold text-green-600 leading-snug">{attendanceStats[squad.id].onTime}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center border border-green-300 rounded-lg bg-green-100 px-3 py-2">
                            <span className="text-[11px] font-medium text-green-700 tracking-wide">Late (J)</span>
                            <span className="text-xl font-bold text-green-600 leading-snug">{attendanceStats[squad.id].lateJustified}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center border border-yellow-300 rounded-lg bg-yellow-50 px-3 py-2">
                            <span className="text-[11px] font-medium text-yellow-700 tracking-wide">Late</span>
                            <span className="text-xl font-bold text-yellow-600 leading-snug">{attendanceStats[squad.id].late}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center border border-blue-300 rounded-lg bg-blue-50 px-3 py-2">
                            <span className="text-[11px] font-medium text-blue-700 tracking-wide">Excused</span>
                            <span className="text-xl font-bold text-blue-600 leading-snug">{attendanceStats[squad.id].excused}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center border border-red-300 rounded-lg bg-red-50 px-3 py-2">
                            <span className="text-[11px] font-medium text-red-700 tracking-wide">Missing</span>
                            <span className="text-xl font-bold text-red-600 leading-snug">{attendanceStats[squad.id].missing}</span>
                          </div>
                          <div className="flex flex-col items-center justify-center border border-gray-300 rounded-lg bg-gray-100 px-3 py-2">
                            <span className="text-[11px] font-medium text-gray-600 tracking-wide">Not Marked</span>
                            <span className="text-xl font-bold text-gray-700 leading-snug">{attendanceStats[squad.id].notMarked}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : viewMode === 'attendance' ? (
          // Attendance Management Mode
          <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
            {message && (
              <div className={`mb-3 sm:mb-4 p-2 sm:p-3 rounded text-xs sm:text-base ${
                message.startsWith('Error') 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'bg-green-100 text-green-700 border border-green-300'
              }`}>
                {message}
              </div>
            )}

            <div className="flex flex-col gap-3 mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <button
                    onClick={goToPreviousWeek}
                    className="px-2 sm:px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">← Previous Week</span>
                    <span className="sm:hidden">← Prev</span>
                  </button>
                  
                  {currentWeekOffset !== 0 && (
                    <button
                      onClick={goToCurrentWeek}
                      className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs sm:text-sm"
                    >
                      Today
                    </button>
                  )}
                  
                  <button
                    onClick={goToNextWeek}
                    className="px-2 sm:px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs sm:text-sm"
                  >
                    <span className="hidden sm:inline">Next Week →</span>
                    <span className="sm:hidden">Next →</span>
                  </button>
                </div>
                
                <h2 className="text-sm sm:text-lg font-semibold text-gray-900">
                  <span className="hidden sm:inline">Attendance Management - </span>
                  {currentWeekOffset === 0 ? "This Week" : 
                   currentWeekOffset === -1 ? "Last Week" :
                   currentWeekOffset === 1 ? "Next Week" :
                   currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
                   `${currentWeekOffset} Weeks Ahead`} ({formatWeekRange(weekDates)})
                </h2>
              </div>

              <select
                value={selectedSquad || ''}
                onChange={(e) => setSelectedSquad(e.target.value || null)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-gray-900 text-xs sm:text-base w-full sm:w-auto"
              >
                <option value="">All Squads</option>
                {squads.map(squad => (
                  <option key={squad.id} value={squad.id}>{squad.displayName}</option>
                ))}
              </select>
            </div>

            {squads
              .filter(squad => !selectedSquad || squad.id === selectedSquad)
              .map(squad => (
                <div key={squad.id} className="mb-4 sm:mb-8">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">{squad.displayName}</h3>
                  
                  <div className="space-y-3 sm:space-y-4">
                    {dayNames.map((dayName, dayIndex) => {
                      const currentDate = weekDates[dayIndex];
                      const hasSquadPractice = hasPractice(squad.id, currentDate);
                      
                      if (!hasSquadPractice) {
                        return (
                          <div key={dayName} className="border rounded p-2 sm:p-3 bg-gray-50">
                            <h4 className="font-bold text-sm sm:text-lg text-gray-600">
                              <span className="hidden sm:inline">{dayName} ({formatDate(currentDate)}) - No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
                              <span className="sm:hidden">{dayName.substring(0, 3)} {formatDate(currentDate)} - No {sessionType === 'practice' ? 'Prac' : 'Lift'}</span>
                            </h4>
                            <div className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                              <span className="hidden sm:inline">No practice scheduled for this day</span>
                              <span className="sm:hidden">Not scheduled</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={dayName} className="border rounded p-2 sm:p-3">
                          <h4 className="font-bold text-sm sm:text-lg mb-2 sm:mb-3 text-gray-900">
                            <span className="hidden sm:inline">{dayName} ({formatDate(currentDate)})</span>
                            <span className="sm:hidden">{dayName.substring(0, 3)} {formatDate(currentDate)}</span>
                          </h4>
                          
                          <div className="grid gap-1.5 sm:gap-2">
                            {squad.members.map((member: any) => {
                              const currentStatus = getAttendanceStatus(member.id, currentDate);
                              const markingKey = `${member.id}-${getLocalDateString(currentDate)}`;
                              const isMarking = markingAttendance[markingKey];
                              
                              return (
                                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-1.5 sm:p-2 bg-gray-50 rounded gap-1.5">
                                  <div className="flex-1">
                                    <span className="font-medium text-gray-900 text-xs sm:text-base">
                                      {member.full_name}
                                      {member.role === 'captain' && (
                                        <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs bg-blue-100 text-blue-800 px-1 sm:px-2 py-0.5 sm:py-1 rounded">
                                          Captain 🔱
                                        </span>
                                      )}
                                    </span>
                                    {currentStatus && (() => {
                                      const notes = getAttendanceNotes(member.id, currentDate);
                                      return (
                                        <div className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1 flex items-center gap-1">
                                          <span>
                                            Current: <span className={`font-medium ${
                                              currentStatus === 'on-time' ? 'text-green-600' :
                                              currentStatus === 'late' ? 'text-yellow-600' :
                                              currentStatus === 'late-justified' ? 'text-green-600' :
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
                                  
                                  <div className="flex flex-wrap gap-1 sm:gap-2">
                                    {isMarking && (
                                      <div className="text-xs sm:text-sm text-gray-500 w-full sm:w-auto sm:mr-2">Updating...</div>
                                    )}
                                    {['on-time', 'late-justified', 'late', 'excused', 'missing'].map((status) => (
                                      <button
                                        key={status}
                                        onClick={() => markAttendance(member.id, currentDate, status)}
                                        disabled={isMarking}
                                        className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium transition-colors ${
                                          currentStatus === status 
                                            ? 'ring-2 ring-blue-300 ' 
                                            : ''
                                        }${
                                          status === 'on-time' ? 'bg-green-500 hover:bg-green-600 text-white' :
                                          status === 'late-justified' ? 'bg-green-600 hover:bg-green-700 text-white' :
                                          status === 'late' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                          status === 'excused' ? 'bg-blue-500 hover:bg-blue-600 text-white' :
                                          'bg-red-500 hover:bg-red-600 text-white'
                                        }${isMarking ? ' opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        {status === 'on-time' ? 'On Time' :
                                         status === 'late-justified' ? 'Late (J)' :
                                         status === 'late' ? 'Late' :
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
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        ) : viewMode === 'captains' ? (
          // Captain Management Mode
          <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
            {message && (
              <div className={`mb-3 sm:mb-4 p-2 sm:p-3 rounded text-xs sm:text-base ${
                message.startsWith('Error') 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'bg-green-100 text-green-700 border border-green-300'
              }`}>
                {message}
              </div>
            )}

            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-4">Manage Squad Captains</h2>
              <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">
                Select who should be the captain for each squad. Only one captain per squad is allowed.
              </p>
            </div>

            <div className="space-y-3 sm:space-y-6">
              {squads.map(squad => {
                const currentCaptain = squad.members.find((m: any) => m.role === 'captain');
                const isUpdating = updatingCaptain[squad.id];
                
                return (
                  <div key={squad.id} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-1">{ squad.displayName}</h3>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Current Captain: {currentCaptain ? currentCaptain.full_name : 'None'}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 sm:gap-3">
                        {isUpdating && (
                          <span className="text-xs sm:text-sm text-gray-500">Updating...</span>
                        )}
                        <select
                          value={currentCaptain?.id || ''}
                          onChange={(e) => {
                            if (e.target.value && e.target.value !== currentCaptain?.id) {
                              updateCaptain(squad.id, e.target.value);
                            }
                          }}
                          disabled={isUpdating}
                          className="px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-gray-900 text-xs sm:text-base w-full sm:min-w-[200px]"
                        >
                          <option value="">Select Captain...</option>
                          {squad.members.map((member: any) => (
                            <option key={member.id} value={member.id}>
                              {member.full_name}
                              {member.role === 'captain' ? ' (Current Captain)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-600">
                      <p><strong>Squad Members:</strong></p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1">
                        {squad.members.map((member: any) => (
                          <span 
                            key={member.id}
                            className={`px-2 py-1 rounded text-xs ${
                              member.role === 'captain' 
                                ? 'bg-blue-100 text-blue-800 font-medium' 
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {member.full_name}
                            {member.role === 'captain' && ' 🔱'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'practice' ? (
          // Practice / Lift Management Mode
          <div className="bg-white rounded-lg shadow-lg p-3 sm:p-6">
            <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{sessionType === 'practice' ? 'Practice' : 'Lift'} Management</h2>
                <p className="text-gray-600 text-xs sm:text-sm max-w-xl">Configure recurring {sessionType === 'practice' ? 'practice' : 'lift'} days and override with custom cancellations or extra sessions.</p>
              </div>
              <div className="flex bg-gray-100 rounded-md overflow-hidden border border-gray-300 w-full sm:w-auto">
                <button onClick={() => setSessionType('practice')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition ${sessionType === 'practice' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'}`}>Practice</button>
                <button onClick={() => setSessionType('lift')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition ${sessionType === 'lift' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'}`}>Lift</button>
              </div>
            </div>

            {message && (
              <div className={`mb-3 sm:mb-4 p-2 sm:p-3 border rounded text-xs sm:text-base ${
                message.includes('Error')
                  ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                  : 'bg-green-100 border-green-400 text-green-700'
              }`}>
                {message}
              </div>
            )}

            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">{sessionType === 'practice' ? 'Practice' : 'Lift'} Days</h3>
              
              {squads.map((squad) => {
                const squadSchedule = practiceSchedules[squad.id] || [];
                const isUpdating = updatingSchedule[squad.id];
                const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                
                return (
                  <div key={squad.id} className="border border-gray-200 rounded-lg p-2 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
                      <h4 className="text-sm sm:text-md font-semibold text-gray-900">{squad.displayName}</h4>
                      <span className="text-xs sm:text-sm text-gray-500">
                        {squad.members.length} members
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {daysOfWeek.map((day) => {
                        const isSelected = squadSchedule.includes(day.toLowerCase());
                        
                        return (
                          <button
                            key={day}
                            onClick={() => !isUpdating && togglePracticeDay(squad.id, day.toLowerCase())}
                            disabled={isUpdating}
                            className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border-2 transition-colors text-xs sm:text-base ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600'
                                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:text-blue-600'
                            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {isUpdating ? (
                              <span className="flex items-center gap-1">
                                <span className="animate-spin">⚪</span>
                                <span className="hidden sm:inline">{day}</span>
                                <span className="sm:hidden">{day.substring(0, 3)}</span>
                              </span>
                            ) : (
                              <>
                                <span className="hidden sm:inline">{day}</span>
                                <span className="sm:hidden">{day.substring(0, 3)}</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-600">
                      <span className="font-medium">Current Schedule:</span> {squadSchedule.length > 0 ? squadSchedule.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ') : `No ${sessionType === 'practice' ? 'practice' : 'lift'} days set`}
                    </div>
                  </div>
                );
              })}
              
              {/* Custom Days Management */}
              <div className="border-t pt-4 sm:pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Custom {sessionType === 'practice' ? 'Practice' : 'Lift'} Days</h3>
                  <button
                    onClick={() => setShowCustomDaysModal(true)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs sm:text-sm"
                  >
                    Add Custom Days
                  </button>
                </div>
                
                <p className="text-gray-600 mb-3 sm:mb-4 text-xs sm:text-sm">Override regular {sessionType === 'practice' ? 'practice' : 'lift'} schedule for specific dates or date ranges. Useful for holidays, tournaments, cancellations, or extra sessions.</p>

                {/* Display existing custom days */}
                <div className="space-y-3 sm:space-y-4">
                  {[...squads, { id: 'all', displayName: 'Whole Team' }].map((squad) => {
                    const noPracticeDays = customNoPracticeDays[squad.id] || [];
                    const practiceDays = customPracticeDays[squad.id] || [];
                    
                    if (noPracticeDays.length === 0 && practiceDays.length === 0) return null;
                    
                    return (
                      <div key={`custom-${squad.id}`} className="border border-gray-200 rounded-lg p-2 sm:p-4 bg-gray-50">
                        <h4 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">{squad.displayName}</h4>
                        
                        {noPracticeDays.length > 0 && (
                          <div className="mb-3">
                            <h5 className="text-xs sm:text-sm font-medium text-red-700 mb-2">No Practice Days:</h5>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {noPracticeDays.map((date) => (
                                <span
                                  key={date}
                                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] sm:text-sm"
                                >
                                  {new Date(date + 'T00:00:00').toLocaleDateString()}
                                  <button
                                    onClick={() => removeCustomDay(squad.id, date, 'no-practice')}
                                    className="text-red-500 hover:text-red-700 text-sm sm:text-base"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {practiceDays.length > 0 && (
                          <div>
                            <h5 className="text-xs sm:text-sm font-medium text-green-700 mb-2">Extra Practice Days:</h5>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {practiceDays.map((date) => (
                                <span
                                  key={date}
                                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] sm:text-sm"
                                >
                                  {new Date(date + 'T00:00:00').toLocaleDateString()}
                                  <button
                                    onClick={() => removeCustomDay(squad.id, date, 'practice')}
                                    className="text-green-500 hover:text-green-700"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {[...squads, { id: 'all' }].every(squad => (customNoPracticeDays[squad.id] || []).length === 0 && (customPracticeDays[squad.id] || []).length === 0) && (
                    <p className="text-gray-500 italic">No custom days set for {sessionType === 'practice' ? 'practice' : 'lift'}. Click "Add Custom Days" to get started.</p>
                  )}
                </div>
              </div>
              
              {/* Quarter Management Section */}
              <div className="border-t pt-4 sm:pt-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Manage Quarters</h3>
                <p className="text-gray-600 mb-3 sm:mb-4 text-xs sm:text-sm">Define quarter date ranges (Fall, Winter, Spring) to enable quarter-based attendance statistics for athletes.</p>
                
                {/* Add/Edit Quarter Form */}
                <div className="border border-gray-200 rounded-lg p-3 sm:p-4 mb-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">
                    {editingQuarter ? 'Edit Quarter' : 'Add New Quarter'}
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Quarter Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Fall, Winter, Spring"
                        value={newQuarter.name}
                        onChange={(e) => setNewQuarter({ ...newQuarter, name: e.target.value })}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={newQuarter.startDate}
                        onChange={(e) => setNewQuarter({ ...newQuarter, startDate: e.target.value })}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-900"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={newQuarter.endDate}
                        onChange={(e) => setNewQuarter({ ...newQuarter, endDate: e.target.value })}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-900"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        console.log('Button clicked!');
                        saveQuarter();
                      }}
                      disabled={savingQuarter}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs sm:text-sm"
                    >
                      {savingQuarter ? 'Saving...' : (editingQuarter ? 'Update Quarter' : 'Add Quarter')}
                    </button>
                    {editingQuarter && (
                      <button
                        onClick={cancelEditQuarter}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-xs sm:text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                
                {/* List of Quarters */}
                <div className="space-y-2">
                  {quarters.length === 0 ? (
                    <p className="text-gray-500 italic text-xs sm:text-sm">No quarters defined yet. Add your first quarter above.</p>
                  ) : (
                    quarters.map((quarter) => (
                      <div key={quarter.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900 text-sm sm:text-base">{quarter.name}</h5>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {new Date(quarter.start_date + 'T00:00:00').toLocaleDateString()} - {new Date(quarter.end_date + 'T00:00:00').toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditQuarter(quarter)}
                            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-xs sm:text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteQuarter(quarter.id)}
                            className="px-2 sm:px-3 py-1 sm:py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs sm:text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Click on days to toggle {sessionType === 'practice' ? 'practice' : 'lift'} schedule for each squad</li>
                  <li>• Selected days (blue) are regular {sessionType === 'practice' ? 'practice' : 'lift'} days</li>
                  <li>• Unselected days will show as "No {sessionType === 'practice' ? 'Practice' : 'Lift'}" in attendance</li>
                  <li>• Custom overrides add or remove single dates (including weekends)</li>
                  <li>• Changes are saved immediately per mode</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          // Analytics Mode
          <div className="analytics-print-area bg-white rounded-lg shadow-lg p-3 sm:p-6">
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col gap-3 mb-3 sm:mb-4">
                <h2 className="text-base sm:text-xl font-bold text-gray-900">
                  UCSD Fencing Team - {sessionType === 'practice' ? 'Practice' : 'Lift'} Attendance Report
                </h2>
                
                {/* View Mode Toggle */}
                <div className="print-controls flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-700 font-medium">View by:</span>
                  <div className="flex bg-gray-100 rounded-md overflow-hidden border border-gray-300">
                    <button
                      onClick={() => setAnalyticsViewMode('month')}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition ${
                        analyticsViewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'
                      }`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => setAnalyticsViewMode('quarter')}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition ${
                        analyticsViewMode === 'quarter' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white'
                      }`}
                    >
                      Quarter
                    </button>
                  </div>
                </div>
                
                <div className="print-controls flex flex-wrap items-center gap-2 sm:gap-4">
                  {analyticsViewMode === 'month' ? (
                    <>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-gray-900 text-xs sm:text-base flex-1 sm:flex-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i}>
                            {new Date(2025, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                      
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-gray-900 text-xs sm:text-base flex-1 sm:flex-none"
                      >
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                      </select>
                    </>
                  ) : (
                    <select
                      value={selectedAnalyticsQuarter || ''}
                      onChange={(e) => setSelectedAnalyticsQuarter(e.target.value)}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-gray-900 text-xs sm:text-base flex-1"
                    >
                      <option value="">Select a quarter</option>
                      {quarters.map((quarter) => (
                        <option key={quarter.id} value={quarter.id}>
                          {quarter.name} ({new Date(quarter.start_date + 'T00:00:00').toLocaleDateString()} - {new Date(quarter.end_date + 'T00:00:00').toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={handlePrint}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-base w-full sm:w-auto justify-center"
                  >
                    <span>🖨️</span>
                    <span className="hidden sm:inline">Print/PDF</span>
                    <span className="sm:hidden">Print</span>
                  </button>
                </div>
              </div>
              
              {/* Add month/quarter info for print */}
              <div className="mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-lg font-semibold text-gray-800">
                  {analyticsViewMode === 'month' 
                    ? `${new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Attendance`
                    : selectedAnalyticsQuarter 
                      ? `${quarters.find(q => q.id === selectedAnalyticsQuarter)?.name || 'Quarter'} Attendance`
                      : 'Select a Quarter'
                  }
                </h3>
              </div>
              
              {/* Legend */}
              <div className="print-controls flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-[10px] sm:text-sm mb-4 sm:mb-6 p-2 sm:p-4 bg-gray-100 rounded-lg border">
                <span className="font-bold text-gray-900 text-xs sm:text-sm">Legend:</span>
                <div className="flex flex-wrap gap-2 sm:gap-6">
                  <span className="flex items-center gap-1 font-semibold"><span className="text-green-700 text-sm sm:text-lg">✓</span> <span className="text-gray-800">On Time</span></span>
                  <span className="flex items-center gap-1 font-semibold"><span className="text-yellow-700 text-sm sm:text-lg">L</span> <span className="text-gray-800">Late</span></span>
                  <span className="flex items-center gap-1 font-semibold"><span className="text-green-500 text-sm sm:text-lg">J</span> <span className="text-gray-800">Late (J)</span></span>
                  <span className="flex items-center gap-1 font-semibold"><span className="text-blue-700 text-sm sm:text-lg">E</span> <span className="text-gray-800">Excused</span></span>
                  <span className="flex items-center gap-1 font-semibold"><span className="text-red-700 text-sm sm:text-lg">X</span> <span className="text-gray-800">Missing</span></span>
                  <span className="flex items-center gap-1 font-semibold"><span className="bg-gray-200 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-gray-600 text-[8px] sm:text-xs">Empty</span> <span className="text-gray-800">No Prac</span></span>
                  <span className="flex items-center gap-1 font-semibold"><span className="text-purple-700 text-sm sm:text-lg">—</span> <span className="text-gray-800">Not Marked</span></span>
                </div>
              </div>
            </div>
            
            {/* Attendance Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-1 sm:px-3 py-1 sm:py-2 text-left font-semibold text-gray-900 min-w-[80px] sm:min-w-[150px] text-[10px] sm:text-base">
                      Team Member
                    </th>
                    {getMonthDays().map((date, index) => (
                      <th key={index} className="border border-gray-300 px-1 sm:px-2 py-1 sm:py-2 text-center font-semibold text-gray-900 min-w-[25px] sm:min-w-[40px]">
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
                  {squads.map((squad, squadIndex) => (
                    <Fragment key={squad.id}>
                      {/* Squad Header Row */}
                      <tr>
                        <td colSpan={getMonthDays().length + 1} className="border border-gray-300 px-2 sm:px-3 py-1 sm:py-2 bg-blue-50 font-bold text-blue-900 text-xs sm:text-base">
                          {squad.displayName}
                        </td>
                      </tr>
                      
                      {/* Squad Members */}
                      {squad.members.map((member: any) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-1 sm:px-3 py-1 sm:py-2 font-medium text-gray-900 text-[10px] sm:text-base">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <span>{member.full_name}</span>
                                {analyticsViewMode === 'quarter' && selectedAnalyticsQuarter && (
                                  <button
                                    onClick={() => calculateAthleteQuarterStats(member.id, member.full_name)}
                                    className="text-blue-600 hover:text-blue-800 transition-colors"
                                    title="View quarter statistics"
                                  >
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              {member.role === 'captain' && (
                                <span className="text-[8px] sm:text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                  🔱
                                </span>
                              )}
                            </div>
                          </td>
                          
                          {getMonthDays().map((date, dateIndex) => {
                            const status = getAnalyticsAttendanceStatus(member.id, date);
                            const notes = getAnalyticsAttendanceNotes(member.id, date);
                            const symbol = formatStatusSymbol(status);
                            const colorClass = getStatusColorClass(status);
                            
                            return (
                              <td 
                                key={dateIndex} 
                                className={`border border-gray-300 px-1 sm:px-2 py-1 sm:py-2 text-center font-bold text-[10px] sm:text-base ${colorClass} relative group cursor-help`}
                                title={notes || undefined}
                              >
                                <div className="relative inline-block">
                                  {symbol}
                                  {notes && (
                                    <span className="absolute -top-1 -right-1 text-[8px]">📝</span>
                                  )}
                                </div>
                                {notes && (
                                  <div className="hidden group-hover:block absolute z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 -translate-y-full -mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap max-w-xs">
                                    {notes}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                )}
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
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Summary Statistics */}
            <div className="print-controls mt-4 sm:mt-6 p-2 sm:p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">
                {analyticsViewMode === 'quarter' 
                  ? selectedAnalyticsQuarter 
                    ? `${quarters.find(q => q.id === selectedAnalyticsQuarter)?.name || 'Quarter'} Summary`
                    : 'Select a Quarter'
                  : `${new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Summary`
                }
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 text-[10px] sm:text-sm">
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-green-600">
                    {(() => {
                      // Count on-time attendance for all days (including weekends)
                      let count = 0;
                      squads.forEach(squad => {
                        squad.members.forEach((member: any) => {
                          getMonthDays().forEach(date => {
                            const status = getAnalyticsAttendanceStatus(member.id, date);
                            if (status === 'on-time') count++;
                          });
                        });
                      });
                      return count;
                    })()}
                  </div>
                  <div className="text-xs font-medium text-gray-600 mt-1">On Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(() => {
                      // Count justified late attendance for all days
                      let count = 0;
                      squads.forEach(squad => {
                        squad.members.forEach((member: any) => {
                          getMonthDays().forEach(date => {
                            const status = getAnalyticsAttendanceStatus(member.id, date);
                            if (status === 'late-justified') count++;
                          });
                        });
                      });
                      return count;
                    })()}
                  </div>
                  <div className="text-xs font-medium text-gray-600 mt-1">Late (Justified)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {(() => {
                      // Count late attendance for all days (excluding justified)
                      let count = 0;
                      squads.forEach(squad => {
                        squad.members.forEach((member: any) => {
                          getMonthDays().forEach(date => {
                            const status = getAnalyticsAttendanceStatus(member.id, date);
                            if (status === 'late') count++;
                          });
                        });
                      });
                      return count;
                    })()}
                  </div>
                  <div className="text-xs font-medium text-gray-600 mt-1">Late</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(() => {
                      // Count excused attendance for all days (including weekends)
                      let count = 0;
                      squads.forEach(squad => {
                        squad.members.forEach((member: any) => {
                          getMonthDays().forEach(date => {
                            const status = getAnalyticsAttendanceStatus(member.id, date);
                            if (status === 'excused') {
                              count++;
                            }
                          });
                        });
                      });
                      return count;
                    })()}
                  </div>
                  <div className="text-gray-600">Excused</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {(() => {
                      // Count missing attendance for all days (including weekends)
                      let count = 0;
                      squads.forEach(squad => {
                        squad.members.forEach((member: any) => {
                          getMonthDays().forEach(date => {
                            const status = getAnalyticsAttendanceStatus(member.id, date);
                            if (status === 'missing') {
                              count++;
                            }
                          });
                        });
                      });
                      return count;
                    })()}
                  </div>
                  <div className="text-gray-600">Missing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {(() => {
                      // Count "Not Marked" - for all days that have practice scheduled but no attendance record
                      let notMarkedCount = 0;
                      
                      squads.forEach(squad => {
                        squad.members.forEach((member: any) => {
                          getMonthDays().forEach(date => {
                            const status = getAnalyticsAttendanceStatus(member.id, date);
                            // Only count as "not marked" if:
                            // 1. There should be practice today (not 'no-practice')
                            // 2. AND no attendance has been recorded (status is null)
                            if (status === null) {
                              notMarkedCount++;
                            }
                          });
                        });
                      });
                      
                      return notMarkedCount;
                    })()}
                  </div>
                  <div className="text-gray-600">Not Marked</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Athlete Quarter Stats Modal */}
      {showAthleteStatsModal && selectedAthleteStats && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" onClick={() => setShowAthleteStatsModal(false)}>
          <div className="bg-white rounded-lg p-4 max-w-sm w-full shadow-2xl border border-gray-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">{selectedAthleteStats.name}</h3>
              <button
                onClick={() => setShowAthleteStatsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-600 mb-2">{selectedAthleteStats.quarterName}</h4>
              
              {/* Percentage Card */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 mb-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{selectedAthleteStats.percentage}%</div>
                  <div className="text-xs text-gray-600">Attendance Rate</div>
                </div>
                <div className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${selectedAthleteStats.percentage}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-gray-900">{selectedAthleteStats.attended}</div>
                  <div className="text-[10px] text-gray-600">Attended</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-gray-900">{selectedAthleteStats.totalPractices}</div>
                  <div className="text-[10px] text-gray-600">Total {sessionType === 'practice' ? 'Practices' : 'Lifts'}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-green-600">{selectedAthleteStats.onTime}</div>
                  <div className="text-[10px] text-gray-600">On Time</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-green-600">{selectedAthleteStats.lateJustified}</div>
                  <div className="text-[10px] text-gray-600">Late (Justified)</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-yellow-600">{selectedAthleteStats.late}</div>
                  <div className="text-[10px] text-gray-600">Late</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-blue-600">{selectedAthleteStats.excused}</div>
                  <div className="text-[10px] text-gray-600">Excused</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-red-600">{selectedAthleteStats.missing}</div>
                  <div className="text-[10px] text-gray-600">Missing</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-gray-600">{selectedAthleteStats.notMarked}</div>
                  <div className="text-[10px] text-gray-600">Not Marked</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Days Modal */}
      {showCustomDaysModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl border pointer-events-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Custom Days</h3>
              <button
                onClick={() => setShowCustomDaysModal(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Day Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center text-gray-900 font-medium">
                    <input
                      type="radio"
                      checked={customDayType === 'no-practice'}
                      onChange={() => setCustomDayType('no-practice')}
                      className="mr-2"
                    />
                    No Practice
                  </label>
                  <label className="flex items-center text-gray-900 font-medium">
                    <input
                      type="radio"
                      checked={customDayType === 'practice'}
                      onChange={() => setCustomDayType('practice')}
                      className="mr-2"
                    />
                    Extra Practice
                  </label>
                </div>
              </div>
              
              {/* Squad Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Apply to</label>
                <select
                  value={selectedCustomSquad}
                  onChange={(e) => setSelectedCustomSquad(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                >
                  <option value="all" className="text-gray-900 font-medium">Whole Team</option>
                  {squads.map(squad => (
                    <option key={squad.id} value={squad.id} className="text-gray-900 font-medium">{squad.displayName}</option>
                  ))}
                </select>
              </div>
              
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Date Range</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                    placeholder="Start date"
                  />
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                    placeholder="End date"
                  />
                </div>
                <p className="text-xs text-gray-900 mt-1">Leave empty to use specific dates below</p>
              </div>
              
              {/* OR Specific Dates */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  OR Specific Dates
                </label>
                {customSpecificDates.map((date, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input

                      type="date"
                      value={date}
                                           onChange={(e) => {
                        const newDates = [...customSpecificDates];
                        newDates[index] = e.target.value;
                        setCustomSpecificDates(newDates);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                    />
                    {customSpecificDates.length > 1 && (
                      <button
                        onClick={() => {
                          const newDates = customSpecificDates.filter((_, i) => i !== index);
                          setCustomSpecificDates(newDates);
                        }}
                        className="px-2 py-2 text-red-500 hover:text-red-700 font-medium"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setCustomSpecificDates([...customSpecificDates, ''])}
                  className="text-sm text-blue-500 hover:text-blue-700 font-medium"
                >
                  + Add another date
                </button>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCustomDaysModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addCustomDays}
                className="flex-1 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600"
              >
                Add Days
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
