'use client'

import React, { useState, useEffect } from 'react'

interface AttendanceStats {
  present: number
  absent: number
  notMarked: number
  totalPractices: number
  presentPercentage: number
  absentPercentage: number
  notMarkedPercentage: number
}

interface IndividualStatsProps {
  userId: string
  selectedSeasonId?: string
  accessToken?: string
  className?: string
}

const IndividualStats: React.FC<IndividualStatsProps> = ({ 
  userId, 
  selectedSeasonId, 
  accessToken,
  className = '' 
}) => {
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError('')
        
        const params = new URLSearchParams({ userId })
        if (selectedSeasonId) {
          params.append('seasonId', selectedSeasonId)
        }
        
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        }
        
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
        }
        
        const response = await fetch(`/api/attendance/stats?${params}`, {
          headers
        })
        
        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`)
        }
        
        const data = await response.json()
        setStats(data)
      } catch (err) {
        console.error('Error fetching attendance stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch stats')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchStats()
    }
  }, [userId, selectedSeasonId, accessToken])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Attendance Statistics</h3>
        <div className="animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Attendance Statistics</h3>
        <div className="text-red-600 text-center py-4">
          {error}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Attendance Statistics</h3>
        <div className="text-gray-500 text-center py-4">
          No data available
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Attendance Statistics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-600">{stats.present}</div>
          <div className="text-sm text-green-700">Present</div>
          <div className="text-xs text-green-600 mt-1">
            {stats.presentPercentage.toFixed(1)}%
          </div>
        </div>
        
        <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          <div className="text-sm text-red-700">Absent</div>
          <div className="text-xs text-red-600 mt-1">
            {stats.absentPercentage.toFixed(1)}%
          </div>
        </div>
        
        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{stats.notMarked}</div>
          <div className="text-sm text-purple-700">Not Marked</div>
          <div className="text-xs text-purple-600 mt-1">
            {stats.notMarkedPercentage.toFixed(1)}%
          </div>
        </div>
        
        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{stats.totalPractices}</div>
          <div className="text-sm text-blue-700">Total Practices</div>
          <div className="text-xs text-blue-600 mt-1">
            This Season
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndividualStats
