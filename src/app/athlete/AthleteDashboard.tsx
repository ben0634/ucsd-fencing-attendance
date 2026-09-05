"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import PasswordChangeModal from "../../components/PasswordChangeModal";

export default function AthleteDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  // Active schedule state for current sessionType
  const [practiceSchedules, setPracticeSchedules] = useState<{[key: string]: string[]}>({});
  const [customNoPracticeDays, setCustomNoPracticeDays] = useState<{[key: string]: string[]}>({});
  const [customPracticeDays, setCustomPracticeDays] = useState<{[key: string]: string[]}>({});
  // Cached per-sessionType schedules to avoid losing state when toggling
  const [practiceScheduleCache, setPracticeScheduleCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  const [customNoPracticeDaysCache, setCustomNoPracticeDaysCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  const [customPracticeDaysCache, setCustomPracticeDaysCache] = useState<{[k in 'practice' | 'lift']: {[key: string]: string[]}}>({ practice: {}, lift: {} });
  // sessionType allows switching between practice and lift attendance views
  const [sessionType, setSessionType] = useState<'practice' | 'lift'>('practice');
  // Quarter management state
  const [quarters, setQuarters] = useState<any[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [quarterStats, setQuarterStats] = useState<{attended: number, total: number, percentage: number} | null>(null);
  const [finalQuarterReport, setFinalQuarterReport] = useState<any | null>(null);
  const [loadingFinalQuarterReport, setLoadingFinalQuarterReport] = useState(false);
  const finalQuarterReportRef = useRef<any | null>(null);
  const practiceScheduleRequestRef = useRef(0);
  const [scopedScheduleMaps, setScopedScheduleMaps] = useState<{
    [key: string]: {
      scheduleMap: {[key: string]: string[]},
      customNoPracticeMap: {[key: string]: string[]},
      customPracticeMap: {[key: string]: string[]},
    }
  }>({});
  const scopedScheduleLoadingRef = useRef<{[key: string]: boolean}>({});
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth()); // 0-11
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const router = useRouter();

  // Persist last used session type
  useEffect(() => {
    try { localStorage.setItem('athlete_last_session_type', sessionType); } catch {}
  }, [sessionType]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('athlete_last_session_type');
      if (saved === 'practice' || saved === 'lift') setSessionType(saved);
    } catch {}
  }, []);

  // Get current week's dates with offset
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

  const getScopeCacheKey = (scope: string) => `${sessionType}:${scope}`;

  const getQuarterIdForDate = (date: Date) => {
    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0);

    const quarter = quarters.find((q: any) => {
      const start = new Date(q.start_date + 'T00:00:00');
      const end = new Date(q.end_date + 'T23:59:59');
      return checkDate >= start && checkDate <= end;
    });

    return quarter?.id || null;
  };

  const getMapsForDate = (date: Date) => {
    const quarterId = getQuarterIdForDate(date);
    const scope = quarterId || 'global';
    const scoped = scopedScheduleMaps[getScopeCacheKey(scope)];

    if (scoped) {
      return {
        quarterId,
        scheduleMap: scoped.scheduleMap,
        customNoPracticeMap: scoped.customNoPracticeMap,
        customPracticeMap: scoped.customPracticeMap,
      };
    }

    if (!quarterId) {
      return {
        quarterId,
        scheduleMap: {},
        customNoPracticeMap: {},
        customPracticeMap: {},
      };
    }

    return {
      quarterId,
      scheduleMap: practiceSchedules,
      customNoPracticeMap: customNoPracticeDays,
      customPracticeMap: customPracticeDays,
    };
  };

  const fetchScheduleScope = async (scope: string) => {
    const cacheKey = getScopeCacheKey(scope);
    if (scopedScheduleMaps[cacheKey] || scopedScheduleLoadingRef.current[cacheKey]) return;

    scopedScheduleLoadingRef.current[cacheKey] = true;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;

      const scopeParam = scope === 'global'
        ? '&scope=global'
        : `&quarterId=${encodeURIComponent(scope)}`;

      const response = await fetch(`/api/practice-schedule?sessionType=${sessionType}${scopeParam}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;
      const { schedules } = await response.json();

      const scheduleMap: {[key: string]: string[]} = {};
      const customNoPracticeMap: {[key: string]: string[]} = {};
      const customPracticeMap: {[key: string]: string[]} = {};

      schedules?.forEach((schedule: any) => {
        scheduleMap[schedule.squad_id] = schedule.practice_days || [];
        customNoPracticeMap[schedule.squad_id] = schedule.custom_no_practice_days || [];
        customPracticeMap[schedule.squad_id] = schedule.custom_practice_days || [];
      });

      setScopedScheduleMaps(prev => ({
        ...prev,
        [cacheKey]: {
          scheduleMap,
          customNoPracticeMap,
          customPracticeMap,
        }
      }));
    } catch (error) {
      console.error('Error fetching scoped practice schedules:', error);
    } finally {
      scopedScheduleLoadingRef.current[cacheKey] = false;
    }
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
      const weekStart = weekDates[0];
      const weekEnd = weekDates[weekDates.length - 1];
      const monthStart = new Date(calendarYear, calendarMonth - 1, 1);
      const monthEnd = new Date(calendarYear, calendarMonth + 2, 0);

      const rangeStart = weekStart < monthStart ? weekStart : monthStart;
      const rangeEnd = weekEnd > monthEnd ? weekEnd : monthEnd;

      const startDate = getLocalDateString(rangeStart);
      const endDate = getLocalDateString(rangeEnd);

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

  const fetchPracticeSchedules = async () => {
    const requestId = ++practiceScheduleRequestRef.current;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) return;
      const referenceDate = currentWeekOffset !== 0
        ? getLocalDateString(getWeekDates()[0])
        : getLocalDateString(new Date(calendarYear, calendarMonth, 1));
      // For now we reuse the same endpoint; in lift mode backend will later filter by sessionType
      const response = await fetch(`/api/practice-schedule?sessionType=${sessionType}&date=${encodeURIComponent(referenceDate)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const { schedules, quarterId } = await response.json();
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
        // update caches
        setPracticeScheduleCache(prev => ({ ...prev, [sessionType]: scheduleMap }));
        setCustomNoPracticeDaysCache(prev => ({ ...prev, [sessionType]: customNoPracticeMap }));
        setCustomPracticeDaysCache(prev => ({ ...prev, [sessionType]: customPracticeMap }));

        const responseScope = quarterId || 'global';
        setScopedScheduleMaps(prev => ({
          ...prev,
          [getScopeCacheKey(responseScope)]: {
            scheduleMap,
            customNoPracticeMap,
            customPracticeMap,
          }
        }));
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

  const getAttendanceNotes = (date: Date) => {
    const dateString = getLocalDateString(date);
    const record = attendanceData.find((a) => a.date === dateString);
    return record?.notes || null;
  };

  const hasPractice = (date: Date) => {
    if (!user) return true; // Default to showing practice if we don't know

    // In lift mode (temporary logic): until separate schedules exist, we treat lift as occurring
    // on the same scheduled practice days. Later we will maintain distinct schedules.
    if (sessionType === 'lift') {
      // Placeholder: treat lift as scheduled on practice days; could be refined
      // Optionally return true always to allow marking every day: return true;
    }
    
    const dateString = getLocalDateString(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const squadId = `${user.user_metadata?.gender}_${user.user_metadata?.weapon}`;
    const { quarterId, scheduleMap, customNoPracticeMap, customPracticeMap } = getMapsForDate(date);
    
    // Check custom no-practice days first
    const squadCustomNoPractice = customNoPracticeMap[squadId] || [];
    const allTeamCustomNoPractice = customNoPracticeMap['all'] || [];
    
    if (squadCustomNoPractice.includes(dateString) || allTeamCustomNoPractice.includes(dateString)) {
      return false;
    }
    
    // Check custom practice days
    const squadCustomPractice = customPracticeMap[squadId] || [];
    const allTeamCustomPractice = customPracticeMap['all'] || [];
    
    if (squadCustomPractice.includes(dateString) || allTeamCustomPractice.includes(dateString)) {
      return true;
    }

    // Outside all quarter ranges, regular schedule does not apply
    if (!quarterId) {
      return false;
    }
    
    // Fall back to regular schedule
    const squadSchedule = scheduleMap[squadId] || [];
    return squadSchedule.includes(dayName);
  };

  const hasPracticeFromMaps = (
    date: Date,
    squadId: string,
    scheduleMap: {[key: string]: string[]},
    customNoPracticeMap: {[key: string]: string[]},
    customPracticeMap: {[key: string]: string[]}
  ) => {
    const dateString = getLocalDateString(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    const squadCustomNoPractice = customNoPracticeMap[squadId] || [];
    const allTeamCustomNoPractice = customNoPracticeMap['all'] || [];
    if (squadCustomNoPractice.includes(dateString) || allTeamCustomNoPractice.includes(dateString)) {
      return false;
    }

    const squadCustomPractice = customPracticeMap[squadId] || [];
    const allTeamCustomPractice = customPracticeMap['all'] || [];
    if (squadCustomPractice.includes(dateString) || allTeamCustomPractice.includes(dateString)) {
      return true;
    }

    const squadSchedule = scheduleMap[squadId] || [];
    return squadSchedule.includes(dayName);
  };

  const buildStatusCounts = (records: any[]) => {
    const counts = {
      onTime: 0,
      lateJustified: 0,
      late: 0,
      excused: 0,
      missing: 0,
      notMarked: 0,
    };

    records.forEach((record: any) => {
      if (record.status === 'on-time') counts.onTime += 1;
      else if (record.status === 'late-justified') counts.lateJustified += 1;
      else if (record.status === 'late') counts.late += 1;
      else if (record.status === 'excused') counts.excused += 1;
      else if (record.status === 'missing') counts.missing += 1;
    });

    return counts;
  };

  const calculateFinalQuarterReport = async () => {
    if (!selectedQuarter || !user) {
      setFinalQuarterReport(null);
      return;
    }

    const quarter = quarters.find(q => q.id === selectedQuarter);
    if (!quarter) {
      setFinalQuarterReport(null);
      return;
    }

    setLoadingFinalQuarterReport(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setFinalQuarterReport(null);
        return;
      }

      const startDate = quarter.start_date;
      const endDate = quarter.end_date;
      const squadId = `${user.user_metadata?.gender}_${user.user_metadata?.weapon}`;

      const [practiceAttendanceRes, liftAttendanceRes, practiceScheduleRes, liftScheduleRes] = await Promise.all([
        fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&sessionType=practice&athleteId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&sessionType=lift&athleteId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/api/practice-schedule?sessionType=practice&quarterId=${encodeURIComponent(selectedQuarter)}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/api/practice-schedule?sessionType=lift&quarterId=${encodeURIComponent(selectedQuarter)}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!practiceAttendanceRes.ok || !liftAttendanceRes.ok || !practiceScheduleRes.ok || !liftScheduleRes.ok) {
        setFinalQuarterReport(null);
        return;
      }

      const [{ attendance: practiceAttendance }, { attendance: liftAttendance }, { schedules: practiceSchedulesData }, { schedules: liftSchedulesData }] = await Promise.all([
        practiceAttendanceRes.json(),
        liftAttendanceRes.json(),
        practiceScheduleRes.json(),
        liftScheduleRes.json(),
      ]);

      const mapSchedules = (schedules: any[]) => {
        const scheduleMap: {[key: string]: string[]} = {};
        const customNoPracticeMap: {[key: string]: string[]} = {};
        const customPracticeMap: {[key: string]: string[]} = {};

        (schedules || []).forEach((schedule: any) => {
          scheduleMap[schedule.squad_id] = schedule.practice_days || [];
          customNoPracticeMap[schedule.squad_id] = schedule.custom_no_practice_days || [];
          customPracticeMap[schedule.squad_id] = schedule.custom_practice_days || [];
        });

        return { scheduleMap, customNoPracticeMap, customPracticeMap };
      };

      const practiceMaps = mapSchedules(practiceSchedulesData || []);
      const liftMaps = mapSchedules(liftSchedulesData || []);

      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const effectiveEnd = end < today ? end : today;

      let practiceScheduled = 0;
      let liftScheduled = 0;
      for (let d = new Date(start); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        if (hasPracticeFromMaps(currentDate, squadId, practiceMaps.scheduleMap, practiceMaps.customNoPracticeMap, practiceMaps.customPracticeMap)) {
          practiceScheduled += 1;
        }
        if (hasPracticeFromMaps(currentDate, squadId, liftMaps.scheduleMap, liftMaps.customNoPracticeMap, liftMaps.customPracticeMap)) {
          liftScheduled += 1;
        }
      }

      const practiceCounts = buildStatusCounts(practiceAttendance || []);
      const liftCounts = buildStatusCounts(liftAttendance || []);

      practiceCounts.notMarked = Math.max(
        practiceScheduled - (practiceCounts.onTime + practiceCounts.lateJustified + practiceCounts.late + practiceCounts.excused + practiceCounts.missing),
        0
      );

      liftCounts.notMarked = Math.max(
        liftScheduled - (liftCounts.onTime + liftCounts.lateJustified + liftCounts.late + liftCounts.excused + liftCounts.missing),
        0
      );

      const practiceAttended = practiceCounts.onTime + practiceCounts.lateJustified + practiceCounts.late;
      const liftAttended = liftCounts.onTime + liftCounts.lateJustified + liftCounts.late;
      const totalScheduled = practiceScheduled + liftScheduled;
      const totalAttended = practiceAttended + liftAttended;
      const totalPercentage = totalScheduled > 0 ? Math.round((totalAttended / totalScheduled) * 100) : 0;
      const practiceMarked = practiceScheduled - practiceCounts.notMarked;
      const liftMarked = liftScheduled - liftCounts.notMarked;
      const totalMarked = totalScheduled - (practiceCounts.notMarked + liftCounts.notMarked);

      setFinalQuarterReport({
        quarterName: quarter.name,
        overall: {
          scheduled: totalScheduled,
          attended: totalAttended,
          percentage: totalPercentage,
          marked: totalMarked,
          coveragePercentage: totalScheduled > 0 ? Math.round((totalMarked / totalScheduled) * 100) : 0,
          counts: {
            onTime: practiceCounts.onTime + liftCounts.onTime,
            lateJustified: practiceCounts.lateJustified + liftCounts.lateJustified,
            late: practiceCounts.late + liftCounts.late,
            excused: practiceCounts.excused + liftCounts.excused,
            missing: practiceCounts.missing + liftCounts.missing,
            notMarked: practiceCounts.notMarked + liftCounts.notMarked,
          }
        },
        byType: {
          practice: {
            scheduled: practiceScheduled,
            attended: practiceAttended,
            percentage: practiceScheduled > 0 ? Math.round((practiceAttended / practiceScheduled) * 100) : 0,
            marked: practiceMarked,
            coveragePercentage: practiceScheduled > 0 ? Math.round((practiceMarked / practiceScheduled) * 100) : 0,
            counts: practiceCounts,
          },
          lift: {
            scheduled: liftScheduled,
            attended: liftAttended,
            percentage: liftScheduled > 0 ? Math.round((liftAttended / liftScheduled) * 100) : 0,
            marked: liftMarked,
            coveragePercentage: liftScheduled > 0 ? Math.round((liftMarked / liftScheduled) * 100) : 0,
            counts: liftCounts,
          }
        }
      });
    } catch (error) {
      console.error('Error calculating final quarter report:', error);
      setFinalQuarterReport(null);
    } finally {
      setLoadingFinalQuarterReport(false);
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
        
        // Show all quarters regardless of whether athlete has data
        // If no data, stats will show 0%
        setQuarters(allQuarters || []);
        
        // Auto-select current quarter
        const today = new Date();
        const currentQuarter = (allQuarters || []).find((q: any) => {
          const start = new Date(q.start_date + 'T00:00:00');
          const end = new Date(q.end_date + 'T23:59:59');
          return today >= start && today <= end;
        });
        
        if (currentQuarter) {
          setSelectedQuarter(currentQuarter.id);
        } else if (allQuarters && allQuarters.length > 0) {
          // If between quarters, prioritize the next upcoming quarter (e.g. Fall starting soon)
          const upcomingQuarters = allQuarters
            .filter((q: any) => new Date(q.start_date + 'T00:00:00') > today)
            .sort((a: any, b: any) =>
              new Date(a.start_date + 'T00:00:00').getTime() - new Date(b.start_date + 'T00:00:00').getTime()
            );

          if (upcomingQuarters.length > 0) {
            setSelectedQuarter(upcomingQuarters[0].id);
          } else {
            const mostRecentlyStarted = allQuarters
              .filter((q: any) => new Date(q.start_date + 'T00:00:00') <= today)
              .sort((a: any, b: any) =>
                new Date(b.start_date + 'T00:00:00').getTime() - new Date(a.start_date + 'T00:00:00').getTime()
              )[0];
            const fallback = mostRecentlyStarted || allQuarters[0];
            setSelectedQuarter(fallback.id);
          }
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

    const [attendanceResponse, scheduleResponse] = await Promise.all([
      fetch(
        `/api/attendance?startDate=${startDate}&endDate=${endDate}&sessionType=${sessionType}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      ),
      fetch(
        `/api/practice-schedule?sessionType=${sessionType}&quarterId=${encodeURIComponent(selectedQuarter)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
    ]);

    if (!attendanceResponse.ok || !scheduleResponse.ok) {
      setQuarterStats(null);
      return;
    }

    const [{ attendance: quarterAttendanceData }, { schedules: quarterSchedulesData }] = await Promise.all([
      attendanceResponse.json(),
      scheduleResponse.json()
    ]);

    const scheduleMap: {[key: string]: string[]} = {};
    const customNoPracticeMap: {[key: string]: string[]} = {};
    const customPracticeMap: {[key: string]: string[]} = {};

    (quarterSchedulesData || []).forEach((schedule: any) => {
      scheduleMap[schedule.squad_id] = schedule.practice_days || [];
      customNoPracticeMap[schedule.squad_id] = schedule.custom_no_practice_days || [];
      customPracticeMap[schedule.squad_id] = schedule.custom_practice_days || [];
    });

    const athleteAttendance = quarterAttendanceData?.filter((a: any) => a.athlete_id === user.id) || [];
    const attendanceByDate = new Map<string, any>(athleteAttendance.map((a: any) => [a.date, a]));

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
      
      if (hasPracticeFromMaps(currentDate, squadId, scheduleMap, customNoPracticeMap, customPracticeMap)) {
        totalPractices++;
        
        const dateString = getLocalDateString(currentDate);
        const attendance = attendanceByDate.get(dateString);
        
        // Count as attended if status is on-time, late-justified, or late
        // Keep denominator aligned with Final Quarter Report schedule totals
        if (attendance?.status === 'on-time' || attendance?.status === 'late-justified' || attendance?.status === 'late') {
          attended++;
        }
        // Missing and excused don't count as attended but stay in denominator
      }
    }

    const percentage = totalPractices > 0 ? Math.round((attended / totalPractices) * 100) : 0;
    
    // Avoid overwriting the canonical quarter-scoped values once final report is ready
    if (finalQuarterReportRef.current?.byType?.[sessionType]) {
      return;
    }

    setQuarterStats({
      attended,
      total: totalPractices,
      percentage
    });
  };

  // Fetch attendance data when week changes
  useEffect(() => {
    if (user) {
      fetchAttendanceData();
      fetchPracticeSchedules();
    }
  }, [currentWeekOffset, calendarMonth, calendarYear, user]);

  // Refetch or restore schedules & attendance when sessionType toggles
  useEffect(() => {
    if (!user) return;
    fetchAttendanceData();
    const cached = practiceScheduleCache[sessionType];
    if (Object.keys(cached).length > 0) {
      setPracticeSchedules(cached);
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

  useEffect(() => {
    if (!user || quarters.length === 0) return;

    const requiredScopes = new Set<string>();

    weekDates.forEach((date: Date) => {
      requiredScopes.add(getQuarterIdForDate(date) || 'global');
    });

    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calendarYear, calendarMonth, day);
      requiredScopes.add(getQuarterIdForDate(date) || 'global');
    }

    requiredScopes.forEach((scope) => {
      fetchScheduleScope(scope);
    });
  }, [user, quarters, sessionType, currentWeekOffset, calendarMonth, calendarYear]);

  // Calculate quarter stats when selection changes or attendance data updates
  useEffect(() => {
    // Prefer quarter-scoped stats from final report when available
    if (finalQuarterReport?.byType?.[sessionType]) {
      return;
    }

    if (selectedQuarter && practiceSchedules) {
      calculateQuarterStats();
    }
  }, [selectedQuarter, currentWeekOffset, practiceSchedules, customNoPracticeDays, customPracticeDays, sessionType, finalQuarterReport]);

  useEffect(() => {
    calculateFinalQuarterReport();
  }, [selectedQuarter, user, quarters]);

  useEffect(() => {
    finalQuarterReportRef.current = finalQuarterReport;
  }, [finalQuarterReport]);

  useEffect(() => {
    if (!finalQuarterReport) return;
    const scoped = finalQuarterReport.byType?.[sessionType];
    if (!scoped) return;
    setQuarterStats({
      attended: scoped.attended,
      total: scoped.scheduled,
      percentage: scoped.percentage,
    });
  }, [finalQuarterReport, sessionType]);

  useEffect(() => {
    async function checkUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/"); // kick back to login
        return;
      }

      setUser(data.user);
      
      // Check if user needs to change password
      if (!data.user.user_metadata?.passwordChanged) {
        setShowPasswordChange(true);
      }
      
      setLoading(false);
    }

    checkUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Calendar helper functions
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay(); // 0 = Sunday
  };

  const goToPreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#182B49] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const athleteName = user?.user_metadata?.firstName 
    ? `${user.user_metadata.firstName} ${user.user_metadata.lastName}`
    : user?.user_metadata?.username || user?.email?.split("@")[0];

  const squadDisplay = `${user?.user_metadata?.gender === 'male' ? "Men's" : user?.user_metadata?.gender === 'female' ? "Women's" : user?.user_metadata?.gender || ''} ${user?.user_metadata?.weapon ? user.user_metadata.weapon.charAt(0).toUpperCase() + user.user_metadata.weapon.slice(1) : ''}`.trim();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {showPasswordChange && user && (
        <PasswordChangeModal
          username={user.user_metadata?.username || user.email?.split('@')[0] || ''}
          onPasswordChanged={() => {
            setShowPasswordChange(false);
            supabase.auth.getUser().then(({ data }) => {
              if (data.user) setUser(data.user);
            });
          }}
        />
      )}

      {/* Collegiate Top Navigation Bar */}
      <header className="bg-[#182B49] text-white border-b border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3">
            <img src="/fencing-logo.png" alt="UCSD Fencing" className="w-10 h-10 object-contain shrink-0" />
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#FFCD00] uppercase block leading-none">
                UC San Diego
              </span>
              <span className="text-base font-extrabold tracking-tight text-white leading-tight">
                TRITONS FENCING
              </span>
            </div>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-slate-200 border border-white/10 ml-2">
              Athlete Portal
            </span>
          </div>

          {/* Session Switcher (Practice vs Lift) */}
          <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setSessionType('practice')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                sessionType === 'practice'
                  ? 'bg-white text-[#182B49] shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Practice
            </button>
            <button
              onClick={() => setSessionType('lift')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                sessionType === 'lift'
                  ? 'bg-white text-[#182B49] shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Lift
            </button>
          </div>

          {/* User Meta & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-white/20 text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        
        {/* Welcome & Profile Header Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                Welcome, {athleteName}
              </h1>
              {squadDisplay && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-[#182B49] border border-slate-200">
                  {squadDisplay}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Viewing your {sessionType === 'practice' ? 'Practice' : 'Lift'} schedule and attendance records.
            </p>
          </div>
        </div>

        {/* Weekly Attendance Strip Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Calendar Strip Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={goToPreviousWeek}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Previous</span>
              </button>

              {currentWeekOffset !== 0 && (
                <button
                  onClick={goToCurrentWeek}
                  className="px-2.5 py-1.5 bg-[#182B49] text-white rounded-lg text-xs font-bold hover:bg-[#1f375d] transition-colors cursor-pointer"
                >
                  This Week
                </button>
              )}
            </div>

            <div className="text-center">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                {currentWeekOffset === 0 ? "Current Week" : 
                 currentWeekOffset === -1 ? "Last Week" :
                 currentWeekOffset === 1 ? "Next Week" :
                 currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} Weeks Ago` :
                 `${currentWeekOffset} Weeks Ahead`}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {formatWeekRange(weekDates)}
              </p>
            </div>

            <button
              onClick={goToNextWeek}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="hidden sm:inline">Next</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 7-Day Attendance Grid */}
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {dayNames.map((dayName, index) => {
                const currentDate = weekDates[index];
                const status = getAttendanceStatus(currentDate);
                const hasScheduledPractice = hasPractice(currentDate);
                const isToday = currentDate.toDateString() === new Date().toDateString();
                const notes = getAttendanceNotes(currentDate);

                return (
                  <div
                    key={dayName}
                    className={`rounded-xl p-3 border transition-all ${
                      isToday 
                        ? 'border-[#FFCD00] ring-2 ring-[#FFCD00]/30 bg-amber-50/30' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Day & Date Header */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-center sm:text-center pb-2 sm:pb-3 border-b border-slate-100 mb-2.5">
                      <div className="flex items-center gap-2 sm:flex-col sm:gap-0">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-[#C69214]' : 'text-slate-500'}`}>
                          {dayName.substring(0, 3)}
                        </span>
                        <span className={`text-lg sm:text-xl font-extrabold ${isToday ? 'text-slate-950' : 'text-slate-800'}`}>
                          {currentDate.getDate()}
                        </span>
                      </div>
                      {isToday && (
                        <span className="text-[10px] font-bold text-[#C69214] bg-[#FFCD00]/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="flex flex-col items-center justify-center pt-1 min-h-[36px]">
                      {!hasScheduledPractice ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <span>—</span>
                          <span>No {sessionType === 'practice' ? 'Practice' : 'Lift'}</span>
                        </span>
                      ) : status === 'on-time' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>✓</span>
                          <span>On Time</span>
                        </span>
                      ) : status === 'late-justified' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-lime-50 text-lime-700 border border-lime-200">
                          <span>J</span>
                          <span>Late (J)</span>
                        </span>
                      ) : status === 'late' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span>L</span>
                          <span>Late</span>
                        </span>
                      ) : status === 'excused' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <span>E</span>
                          <span>Excused</span>
                        </span>
                      ) : status === 'missing' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          <span>✕</span>
                          <span>Missing</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-slate-400 border border-dashed border-slate-300">
                          <span>?</span>
                          <span>Not Marked</span>
                        </span>
                      )}

                      {/* Notes snippet if present */}
                      {notes && (
                        <div className="mt-2 w-full text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded p-1.5 truncate" title={notes}>
                          <span className="font-semibold">Note:</span> {notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Color Key Legend */}
          <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> On Time
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-lime-500" /> Late (Justified)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Excused
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Missing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> No Session
              </span>
            </div>
          </div>

          {/* Weekly Stats Summary Row */}
          <div className="bg-slate-50/70 px-4 sm:px-6 py-3.5 border-t border-slate-200">
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
                <div className="flex flex-wrap justify-center gap-4 sm:gap-8 bg-white rounded-xl shadow-xs border border-slate-200 p-3 sm:p-4">
                  <div className="flex flex-col items-center">
                    <span className="text-emerald-700 font-bold text-base sm:text-lg">{stats.onTime}</span>
                    <span className="text-xs text-slate-600">On Time</span>
                    <span className="text-xs text-emerald-700 font-medium">{percent(stats.onTime)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-lime-700 font-bold text-base sm:text-lg">{stats.lateJustified}</span>
                    <span className="text-xs text-slate-600">Late (Justified)</span>
                    <span className="text-xs text-lime-700 font-medium">{percent(stats.lateJustified)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-amber-700 font-bold text-base sm:text-lg">{stats.late}</span>
                    <span className="text-xs text-slate-600">Late</span>
                    <span className="text-xs text-amber-700 font-medium">{percent(stats.late)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-blue-700 font-bold text-base sm:text-lg">{stats.excused}</span>
                    <span className="text-xs text-slate-600">Excused</span>
                    <span className="text-xs text-blue-700 font-medium">{percent(stats.excused)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-red-700 font-bold text-base sm:text-lg">{stats.missing}</span>
                    <span className="text-xs text-slate-600">Missing</span>
                    <span className="text-xs text-red-700 font-medium">{percent(stats.missing)}%</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-slate-700 font-bold text-base sm:text-lg">{stats.notMarked}</span>
                    <span className="text-xs text-slate-600">Not Marked</span>
                    <span className="text-xs text-slate-600 font-medium">{percent(stats.notMarked)}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Monthly Attendance Calendar Heatmap */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Monthly Overview
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Full month calendar for {sessionType === 'practice' ? 'Practice' : 'Lift'} attendance.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={goToPreviousMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Previous month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs sm:text-sm font-bold text-slate-800 min-w-[130px] text-center">
                {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Next month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={goToCurrentMonth}
                className="px-2 py-1 text-xs font-semibold text-[#182B49] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors ml-1 cursor-pointer"
              >
                Today
              </button>
            </div>
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[11px] font-bold text-slate-500 py-1 uppercase tracking-wider">
                {day}
              </div>
            ))}

            {(() => {
              const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
              const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
              const today = new Date();
              const days = [];

              for (let i = 0; i < firstDay; i++) {
                days.push(<div key={`empty-${i}`} className="aspect-square" />);
              }

              for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(calendarYear, calendarMonth, day);
                const isToday = date.toDateString() === today.toDateString();
                const hasScheduledPractice = hasPractice(date);
                const status = getAttendanceStatus(date);
                const notes = getAttendanceNotes(date);

                let cellClass = "bg-white border-slate-200 text-slate-800";
                if (!hasScheduledPractice) {
                  cellClass = "bg-slate-100 border-slate-200 text-slate-400";
                } else if (status === 'on-time' || status === 'late-justified') {
                  cellClass = "bg-emerald-50 border-emerald-200 text-emerald-800";
                } else if (status === 'late') {
                  cellClass = "bg-amber-50 border-amber-200 text-amber-800";
                } else if (status === 'excused') {
                  cellClass = "bg-blue-50 border-blue-200 text-blue-800";
                } else if (status === 'missing') {
                  cellClass = "bg-red-50 border-red-200 text-red-800";
                } else {
                  cellClass = "bg-white border-dashed border-slate-300 text-slate-400";
                }

                days.push(
                  <div
                    key={day}
                    className={`aspect-square border rounded-lg flex flex-col items-center justify-center p-1 text-center relative transition-all ${cellClass} ${
                      isToday ? 'ring-2 ring-[#FFCD00] font-bold' : ''
                    }`}
                    title={`${date.toLocaleDateString()}${status ? `: ${status}` : ''}${notes ? `\n${notes}` : ''}`}
                  >
                    <span className="text-[11px] sm:text-xs font-semibold">{day}</span>
                    {status && hasScheduledPractice && (
                      <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        status === 'on-time' || status === 'late-justified' ? 'bg-emerald-600' :
                        status === 'late' ? 'bg-amber-600' :
                        status === 'excused' ? 'bg-blue-600' : 'bg-red-600'
                      }`} />
                    )}
                  </div>
                );
              }
              return days;
            })()}
          </div>
        </div>

        {/* Quarter Statistics Section */}
        {quarters.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Quarter Statistics
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Term performance summary for {sessionType === 'practice' ? 'Practice' : 'Lift'}
                </p>
              </div>
              <select
                value={selectedQuarter || ''}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#182B49] focus:ring-1 focus:ring-[#182B49]"
              >
                {quarters.map((quarter) => (
                  <option key={quarter.id} value={quarter.id}>
                    {quarter.name} ({new Date(quarter.start_date + 'T00:00:00').toLocaleDateString()} - {new Date(quarter.end_date + 'T00:00:00').toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {selectedQuarter && quarterStats && (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center border border-blue-200">
                    <div className="text-3xl sm:text-4xl font-bold text-blue-700">
                      {quarterStats.percentage}%
                    </div>
                    <div className="text-xs sm:text-sm text-blue-600 mt-1 font-medium">Attendance Rate</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center border border-green-200">
                    <div className="text-3xl sm:text-4xl font-bold text-green-700">
                      {quarterStats.attended}
                    </div>
                    <div className="text-xs sm:text-sm text-green-600 mt-1 font-medium">{sessionType === 'practice' ? 'Practices' : 'Lifts'} Attended</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center border border-purple-200">
                    <div className="text-3xl sm:text-4xl font-bold text-purple-700">
                      {quarterStats.total}
                    </div>
                    <div className="text-xs sm:text-sm text-purple-600 mt-1 font-medium">Total {sessionType === 'practice' ? 'Practices' : 'Lifts'}</div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-600">Progress</span>
                    <span className="text-xs font-bold text-slate-900">
                      {quarterStats.attended} / {quarterStats.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${quarterStats.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {selectedQuarter && !quarterStats && (
              <div className="text-center py-8 text-slate-500 text-sm">
                Calculating quarter statistics...
              </div>
            )}

            {!selectedQuarter && (
              <div className="text-center py-8 text-slate-500 text-sm">
                Select a quarter to view statistics
              </div>
            )}

            {selectedQuarter && (
              <div className="mt-6 border-t border-slate-200 pt-5 sm:pt-6">
                <h4 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Final Quarter Report</h4>
                <p className="text-xs sm:text-sm text-slate-500 mb-4">Combined quarter summary across Practice and Lift.</p>

                {loadingFinalQuarterReport && (
                  <div className="text-center py-6 text-slate-500 text-sm">Building final report...</div>
                )}

                {!loadingFinalQuarterReport && finalQuarterReport && (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">{finalQuarterReport.overall.percentage}%</div>
                        <div className="text-xs text-blue-700 mt-1 font-medium">Overall Attendance Rate</div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4 text-center">
                        <div className="text-2xl font-bold text-green-700">{finalQuarterReport.overall.attended}</div>
                        <div className="text-xs text-green-700 mt-1 font-medium">Total Attended</div>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 sm:p-4 text-center">
                        <div className="text-2xl font-bold text-purple-700">{finalQuarterReport.overall.scheduled}</div>
                        <div className="text-xs text-purple-700 mt-1 font-medium">Total Scheduled</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                        <h5 className="font-semibold text-slate-900 mb-2 text-sm">Practice</h5>
                        <div className="text-sm text-slate-700">{finalQuarterReport.byType.practice.attended} / {finalQuarterReport.byType.practice.scheduled} attended ({finalQuarterReport.byType.practice.percentage}%)</div>
                        <div className="text-xs text-slate-500 mt-1">Marked: {finalQuarterReport.byType.practice.marked}/{finalQuarterReport.byType.practice.scheduled} ({finalQuarterReport.byType.practice.coveragePercentage}% coverage)</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
                        <h5 className="font-semibold text-slate-900 mb-2 text-sm">Lift</h5>
                        <div className="text-sm text-slate-700">{finalQuarterReport.byType.lift.attended} / {finalQuarterReport.byType.lift.scheduled} attended ({finalQuarterReport.byType.lift.percentage}%)</div>
                        <div className="text-xs text-slate-500 mt-1">Marked: {finalQuarterReport.byType.lift.marked}/{finalQuarterReport.byType.lift.scheduled} ({finalQuarterReport.byType.lift.coveragePercentage}% coverage)</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                      <div className="bg-green-50 rounded-xl p-2.5 sm:p-3 text-center border border-green-200">
                        <div className="text-lg font-bold text-green-700">{finalQuarterReport.overall.counts.onTime}</div>
                        <div className="text-xs text-slate-700 font-medium">On Time</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-2.5 sm:p-3 text-center border border-green-200">
                        <div className="text-lg font-bold text-green-700">{finalQuarterReport.overall.counts.lateJustified}</div>
                        <div className="text-xs text-slate-700 font-medium">Late (Justified)</div>
                      </div>
                      <div className="bg-yellow-50 rounded-xl p-2.5 sm:p-3 text-center border border-yellow-200">
                        <div className="text-lg font-bold text-yellow-700">{finalQuarterReport.overall.counts.late}</div>
                        <div className="text-xs text-slate-700 font-medium">Late</div>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-2.5 sm:p-3 text-center border border-blue-200">
                        <div className="text-lg font-bold text-blue-700">{finalQuarterReport.overall.counts.excused}</div>
                        <div className="text-xs text-slate-700 font-medium">Excused</div>
                      </div>
                      <div className="bg-red-50 rounded-xl p-2.5 sm:p-3 text-center border border-red-200">
                        <div className="text-lg font-bold text-red-700">{finalQuarterReport.overall.counts.missing}</div>
                        <div className="text-xs text-slate-700 font-medium">Missing</div>
                      </div>
                      <div className="bg-slate-100 rounded-xl p-2.5 sm:p-3 text-center border border-slate-200">
                        <div className="text-lg font-bold text-slate-700">{finalQuarterReport.overall.counts.notMarked}</div>
                        <div className="text-xs text-slate-700 font-medium">Not Marked</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
