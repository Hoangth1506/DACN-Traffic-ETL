// useTrafficData.js — Hook load và filter traffic data với bộ lọc đa chiều (Ngày, Tuần, Tháng, Giờ cao điểm, Vận tốc)
import { useState, useEffect, useMemo, useCallback } from 'react'

const DEFAULT_FILTERS = {
  nodes: [
    'N01_LY_THUONG_KIET', 'N02_BA_THANG_HAI', 'N03_CMT8', 'N04_THANH_THAI',
    'N05_TO_HIEN_THANH', 'N06_NGUYEN_TRI_PHUONG', 'N07_SU_VAN_HANH',
    'N08_DIEN_BIEN_PHU', 'N09_CONG_HOA', 'N10_TRUONG_CHINH',
  ],
  timeSlots: ['morning_peak', 'midday_peak', 'evening_peak', 'off_peak'],
  losLevels: ['A', 'B', 'C', 'D', 'E', 'F'],
  dateRange: ['', ''],
  minSpeed: 0,
  maxSpeed: 100,
}

export function useTrafficData() {
  const [allData, setAllData]               = useState([])
  const [allCameraRecords, setAllCameras]   = useState([])
  const [allNodeStates, setAllNodeStates]   = useState([])
  const [aggregates, setAggregates]         = useState(null)
  const [quality, setQuality]               = useState(null)
  const [perfMetrics, setPerfMetrics]       = useState(null)
  const [loading, setLoading]               = useState(true)
  const [filters, setFilters]               = useState(DEFAULT_FILTERS)

  const fetchData = useCallback(() => {
    const t = Date.now()
    return Promise.all([
      fetch(`/traffic_data.json?t=${t}`).then(r => r.json()),
      fetch(`/aggregates.json?t=${t}`).then(r => r.json()),
      fetch(`/quality_summary.json?t=${t}`).then(r => r.json()),
      fetch(`/camera_records.json?t=${t}`).then(r => r.json()).catch(() => []),
      fetch(`/node_states.json?t=${t}`).then(r => r.json()).catch(() => []),
      fetch(`/performance_metrics.json?t=${t}`).then(r => r.json()).catch(() => null),
    ]).then(([data, agg, qual, cams, ns, perf]) => {
      setAllData(data)
      setAllCameras(cams || [])
      setAllNodeStates(ns || [])
      setAggregates(agg)
      setQuality(qual)
      setPerfMetrics(perf)
      setLoading(false)

      // Mặc định chọn NGÀY MỚI NHẤT (Hôm nay) khi nạp ứng dụng
      const latestDate = agg?.date_range?.max || '2026-07-24'
      setFilters(prev => ({
        ...prev,
        dateRange: [latestDate, latestDate]
      }))
    }).catch(err => {
      console.error('Failed to load data:', err)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Filter helper ─────────────────────────────────────────────────────────
  function applyFilters(records, {
    nodeKey = 'node_id', slotKey = 'time_slot',
    losKey = 'los', dateKey = 'date_str', speedKey = 'velocity'
  } = {}) {
    return records.filter(r => {
      if (filters.nodes.length && !filters.nodes.includes(r[nodeKey])) return false
      if (filters.timeSlots.length && slotKey && r[slotKey] && !filters.timeSlots.includes(r[slotKey])) return false
      if (filters.losLevels.length && losKey && r[losKey] && !filters.losLevels.includes(r[losKey])) return false
      if (filters.dateRange[0] && r[dateKey] < filters.dateRange[0]) return false
      if (filters.dateRange[1] && r[dateKey] > filters.dateRange[1]) return false
      
      // Filter vận tốc
      const v = r[speedKey] ?? r.fused_velocity
      if (v != null && !isNaN(v)) {
        if (filters.minSpeed > 0 && v < filters.minSpeed) return false
        if (filters.maxSpeed < 100 && v > filters.maxSpeed) return false
      }
      return true
    })
  }

  // Filtered traffic_data
  const filtered = useMemo(() => {
    if (!allData.length) return []
    return applyFilters(allData)
  }, [allData, filters])

  // Filtered camera_records (cho MapView)
  const cameraRecords = useMemo(() => {
    if (!allCameraRecords.length) return []
    return applyFilters(allCameraRecords, {
      nodeKey: 'node_id', slotKey: 'time_slot',
      losKey: 'los', dateKey: 'date_str', speedKey: 'velocity'
    })
  }, [allCameraRecords, filters])

  // Filtered node_states (cho MapView node markers + Performance)
  const nodeStates = useMemo(() => {
    if (!allNodeStates.length) return []
    return applyFilters(allNodeStates, {
      nodeKey: 'node_id', slotKey: 'time_slot',
      losKey: 'los', dateKey: 'date_str', speedKey: 'fused_velocity'
    })
  }, [allNodeStates, filters])

  const resetFilters = () => {
    const latestDate = aggregates?.date_range?.max || '2026-07-24'
    setFilters({
      ...DEFAULT_FILTERS,
      dateRange: [latestDate, latestDate],
    })
  }

  return {
    allData, filtered,
    cameraRecords, nodeStates, perfMetrics,
    allNodeStates,
    aggregates, quality, loading,
    filters, setFilters, resetFilters,
    refetch: fetchData,
  }
}

// Helpers
export const LOS_COLOR = {
  A: '#7f1d1d', B: '#ef4444', C: '#f97316',
  D: '#facc15', E: '#86efac', F: '#22c55e', unknown: '#475569',
}

export const LOS_LABEL = {
  A: 'Nghiêm trọng', B: 'Tắc nghẽn', C: 'Gần tắc',
  D: 'Trung bình', E: 'Ổn định', F: 'Thông thoáng', unknown: 'Không xác định',
}

export const NODE_LABEL = {
  N01_LY_THUONG_KIET: 'N01 Lý Thường Kiệt',
  N02_BA_THANG_HAI: 'N02 Ba Tháng Hai',
  N03_CMT8: 'N03 Cách Mạng Tháng 8',
  N04_THANH_THAI: 'N04 Thành Thái',
  N05_TO_HIEN_THANH: 'N05 Tô Hiến Thành',
  N06_NGUYEN_TRI_PHUONG: 'N06 Nguyễn Tri Phương',
  N07_SU_VAN_HANH: 'N07 Sư Vạn Hạnh',
  N08_DIEN_BIEN_PHU: 'N08 Điện Biên Phủ',
  N09_CONG_HOA: 'N09 Cộng Hòa',
  N10_TRUONG_CHINH: 'N10 Trường Chinh',
}

export const SLOT_LABEL = {
  morning_peak: 'Sáng (6h–8h30)',
  midday_peak: 'Trưa (11h–13h)',
  evening_peak: 'Chiều (16h–19h)',
  off_peak: 'Ban đêm / Khác',
}

export const NODE_COLORS = {
  N01_LY_THUONG_KIET: '#38bdf8',
  N02_BA_THANG_HAI: '#ef4444',
  N03_CMT8: '#f97316',
  N04_THANH_THAI: '#facc15',
  N05_TO_HIEN_THANH: '#10b981',
  N06_NGUYEN_TRI_PHUONG: '#06b6d4',
  N07_SU_VAN_HANH: '#8b5cf6',
  N08_DIEN_BIEN_PHU: '#ec4899',
  N09_CONG_HOA: '#6366f1',
  N10_TRUONG_CHINH: '#f59e0b',
}

export function avg(arr, key) {
  const vals = arr.map(r => r[key]).filter(v => v != null && !isNaN(v))
  if (!vals.length) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}
