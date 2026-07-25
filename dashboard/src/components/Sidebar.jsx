// Sidebar.jsx — Ultra-Upgraded Control Panel with Day/Week/Month, Peak Hours, and Speed Filters
import { useState, useEffect, memo } from 'react'
import { NODE_LABEL, LOS_COLOR, LOS_LABEL, SLOT_LABEL } from '../hooks/useTrafficData'
import { Filter, Layers, Calendar, RotateCcw, Search, Sparkles, Clock, AlertTriangle, Gauge, Download } from 'lucide-react'

const LiveCountdownText = memo(function LiveCountdownText() {
  const [countdown, setCountdown] = useState(120)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 120 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <span style={{ color: '#06b6d4', fontWeight: 800, fontFamily: 'Outfit' }}>
      {countdown}s
    </span>
  )
})

const Q10_NODES = [
  'N01_LY_THUONG_KIET', 'N02_BA_THANG_HAI', 'N03_CMT8', 'N04_THANH_THAI',
  'N05_TO_HIEN_THANH', 'N06_NGUYEN_TRI_PHUONG', 'N07_SU_VAN_HANH', 'N08_DIEN_BIEN_PHU',
]

const TAN_BINH_NODES = [
  'N09_CONG_HOA', 'N10_TRUONG_CHINH'
]

const ALL_NODES = [...Q10_NODES, ...TAN_BINH_NODES]
const ALL_LOS = ['A', 'B', 'C', 'D', 'E', 'F']
const ALL_SLOTS = ['morning_peak', 'midday_peak', 'evening_peak', 'off_peak']

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function Sidebar({ filters, setFilters, resetFilters, aggregates, lastUpdated, filteredData }) {
  const [searchTerm, setSearchTerm] = useState('')
  const dates = aggregates?.by_date ? Object.keys(aggregates.by_date).sort() : []
  const latestDate = dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10)
  const minDate = dates.length ? dates[0] : latestDate

  // Mode chọn thời gian: 'today' | 'week' | 'month' | 'single'
  const [timeMode, setTimeMode] = useState('today')

  const handleExportCSV = () => {
    const dataToExport = filteredData || []
    if (!dataToExport.length) return alert('Không có dữ liệu để xuất file!')
    
    const headers = ['date_str', 'time_slot', 'node_id', 'current_speed', 'congestion_index', 'los', 'osm_matched']
    const rows = dataToExport.map(r => [
      r.date_str || '',
      r.time_slot || '',
      r.node_id || '',
      r.current_speed != null ? r.current_speed : '',
      r.congestion_index != null ? r.congestion_index : '',
      r.los || '',
      r.osm_matched ? '1' : '0'
    ].join(','))

    const csvStr = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `traffic_report_${filters.dateRange[0] || 'live'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleTimeModeChange = (mode) => {
    setTimeMode(mode)
    if (mode === 'today') {
      setFilters(f => ({ ...f, dateRange: [latestDate, latestDate] }))
    } else if (mode === 'week') {
      // 7 ngày gần nhất
      const d7 = dates.length >= 7 ? dates[dates.length - 7] : minDate
      setFilters(f => ({ ...f, dateRange: [d7, latestDate] }))
    } else if (mode === 'month') {
      // Tháng 7/2026
      const monthStart = '2026-07-01'
      setFilters(f => ({ ...f, dateRange: [monthStart, latestDate] }))
    } else if (mode === 'single') {
      // Mặc định chọn ngày tươi nhất khi bấm nút Lịch sử
      setFilters(f => ({ ...f, dateRange: [latestDate, latestDate] }))
    }
  }

  const selectPreset = (type) => {
    if (type === 'today') {
      handleTimeModeChange('today')
      setFilters(f => ({ ...f, nodes: ALL_NODES, losLevels: ALL_LOS }))
    } else if (type === 'hotspots') {
      // Cảnh báo ùn tắc: chỉ lọc LOS A, B, C
      setFilters(f => ({ ...f, losLevels: ['A', 'B', 'C'] }))
    } else if (type === 'q10') {
      setFilters(f => ({ ...f, nodes: Q10_NODES }))
    } else if (type === 'tanbinh') {
      setFilters(f => ({ ...f, nodes: TAN_BINH_NODES }))
    }
  }

  const matchesSearch = (nid) => {
    if (!searchTerm.trim()) return true
    const label = NODE_LABEL[nid] || ''
    return label.toLowerCase().includes(searchTerm.toLowerCase().trim())
  }

  const filteredQ10 = Q10_NODES.filter(matchesSearch)
  const filteredTB  = TAN_BINH_NODES.filter(matchesSearch)

  return (
    <div className="glass-panel" style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 14, padding: 16, flexShrink: 0, overflowY: 'auto' }}>
      
      {/* ── 1. HỘP REAL-TIME STREAMING ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(16,185,129,0.12) 100%)',
        border: '1px solid rgba(16,185,129,0.35)',
        borderRadius: 12, padding: 12, boxShadow: '0 4px 20px rgba(16,185,129,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 12, fontWeight: 800 }}>
            <div className="live-dot-pulse" />
            <span>REAL-TIME STREAMING</span>
          </div>
          <span style={{ fontSize: 10, background: 'rgba(6,182,212,0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
            2 PHÚT/LẦN
          </span>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 6 }}>
          Bản ghi mới nhất nhận lúc:
          <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 12, marginTop: 2, fontFamily: 'Outfit' }}>
            {lastUpdated || 'Đang đồng bộ...'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span>Tự động làm mới:</span>
          <LiveCountdownText />
        </div>
      </div>

      {/* ── 2. PRESETS LỌC NHANH TÌNH HUỐNG ─────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={12} color="#06b6d4" /> Kịch Bản Tùy Chọn
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            onClick={() => selectPreset('today')}
            style={{
              padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)',
              background: 'rgba(16,185,129,0.12)', color: '#34d399', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
            }}
          >
            🔥 Hôm Nay Live
          </button>
          <button
            onClick={() => selectPreset('hotspots')}
            style={{
              padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
            }}
          >
            <AlertTriangle size={12} /> Cảnh Báo Kẹt Xe
          </button>
          <button
            onClick={() => selectPreset('q10')}
            style={{
              padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: '#f8fafc', fontSize: 11, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Quận 10 (8 Node)
          </button>
          <button
            onClick={() => selectPreset('tanbinh')}
            style={{
              padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: '#f8fafc', fontSize: 11, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Tân Bình (2 Node)
          </button>
        </div>
      </div>

      {/* ── 3. PHẠM VI THỜI GIAN (HÔM NAY / TUẦN / THÁNG / CHỌN NGÀY) ───── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={12} color="#f59e0b" /> Phạm Vi Thời Gian
        </div>
        
        {/* Nút bấm chọn Hôm nay / Tuần / Tháng */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: 'week',  label: 'Theo Tuần' },
            { id: 'month', label: 'Theo Tháng' },
            { id: 'single',label: 'Lịch sử' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => handleTimeModeChange(m.id)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', border: timeMode === m.id ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                background: timeMode === m.id ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.03)',
                color: timeMode === m.id ? '#fbbf24' : '#94a3b8'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Dropdown chọn ngày lẻ lịch sử nếu chọn mode Lịch sử */}
        {timeMode === 'single' && (
          <select
            value={filters.dateRange[0] || latestDate}
            onChange={e => {
              const d = e.target.value
              setFilters(f => ({ ...f, dateRange: d ? [d, d] : [latestDate, latestDate] }))
            }}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 8,
              background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
              color: '#f8fafc', fontSize: 11, outline: 'none', cursor: 'pointer'
            }}
          >
            {dates.map(d => (
              <option key={d} value={d}>
                {d === latestDate ? `Hôm nay (${d}) — LIVE` : `Ngày ${d}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── 4. BỘ LỌC KHUNG GIỜ CAO ĐIỂM (TIME SLOTS) ────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={12} color="#8b5cf6" /> Khung Giờ Giám Sát
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {ALL_SLOTS.map(slot => {
            const active = filters.timeSlots.includes(slot)
            return (
              <button
                key={slot}
                onClick={() => setFilters(f => ({ ...f, timeSlots: toggle(f.timeSlots, slot) }))}
                style={{
                  padding: '5px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  border: active ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.06)',
                  background: active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.02)',
                  color: active ? '#c084fc' : '#64748b', textAlign: 'left'
                }}
              >
                {SLOT_LABEL[slot]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 5. LỌC THEO DẢI VẬN TỐC ──────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Gauge size={12} color="#ec4899" /> Lọc Vận Tốc Di Chuyển
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: 'Tất cả', min: 0, max: 100 },
            { label: '< 15km/h (Chậm)', min: 0, max: 15 },
            { label: '15-30km/h', min: 15, max: 30 },
            { label: '> 30km/h (Nhanh)', min: 30, max: 100 },
          ].map((sp, idx) => {
            const active = filters.minSpeed === sp.min && filters.maxSpeed === sp.max
            return (
              <button
                key={idx}
                onClick={() => setFilters(f => ({ ...f, minSpeed: sp.min, maxSpeed: sp.max }))}
                style={{
                  flex: 1, padding: '5px 2px', borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  border: active ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.08)',
                  background: active ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#f472b6' : '#94a3b8', textAlign: 'center'
                }}
              >
                {sp.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 6. Ô TÌM KIẾM & DANH SÁCH 10 NODE ────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={12} color="#38bdf8" /> Nút Giao ({filters.nodes.length}/10)
          </span>
        </div>

        {/* Ô tìm kiếm nút giao */}
        <div style={{ position: 'relative' }}>
          <Search size={13} color="#64748b" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text"
            placeholder="Tìm tên đường..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#f8fafc', fontSize: 11, outline: 'none'
            }}
          />
        </div>

        {/* Danh sách Node phân theo Quận */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
          {filteredQ10.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#06b6d4', margin: '4px 0 2px 2px' }}>QUẬN 10 (8 NODE)</div>
              {filteredQ10.map(nid => {
                const isChecked = filters.nodes.includes(nid)
                return (
                  <label
                    key={nid}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                      background: isChecked ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.02)',
                      border: isChecked ? '1px solid rgba(56,189,248,0.25)' : '1px solid transparent',
                      cursor: 'pointer', fontSize: 11, color: isChecked ? '#f8fafc' : '#64748b', transition: 'all 0.15s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setFilters(f => ({ ...f, nodes: toggle(f.nodes, nid) }))}
                      style={{ accentColor: '#06b6d4', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontWeight: isChecked ? 600 : 400 }}>{NODE_LABEL[nid]?.replace('N0', 'N')}</span>
                  </label>
                )
              })}
            </div>
          )}

          {filteredTB.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', margin: '6px 0 2px 2px' }}>TÂN BÌNH (2 NODE)</div>
              {filteredTB.map(nid => {
                const isChecked = filters.nodes.includes(nid)
                return (
                  <label
                    key={nid}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                      background: isChecked ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                      border: isChecked ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
                      cursor: 'pointer', fontSize: 11, color: isChecked ? '#f8fafc' : '#64748b', transition: 'all 0.15s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setFilters(f => ({ ...f, nodes: toggle(f.nodes, nid) }))}
                      style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    <span style={{ flex: 1, fontWeight: isChecked ? 600 : 400 }}>{NODE_LABEL[nid]?.replace('N0', 'N')}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 7. MỨC DỊCH VỤ LOS ──────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Mức Dịch Vụ LOS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {ALL_LOS.map(los => {
            const active = filters.losLevels.includes(los)
            return (
              <button
                key={los}
                onClick={() => setFilters(f => ({ ...f, losLevels: toggle(f.losLevels, los) }))}
                title={`LOS ${los}: ${LOS_LABEL[los]}`}
                style={{
                  padding: '6px 0', borderRadius: 6, border: active ? `1.5px solid ${LOS_COLOR[los]}` : '1px solid rgba(255,255,255,0.08)',
                  background: active ? `${LOS_COLOR[los]}25` : 'rgba(255,255,255,0.02)',
                  color: active ? LOS_COLOR[los] : '#64748b', fontSize: 12, fontWeight: 800, cursor: 'pointer'
                }}
              >
                {los}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={handleExportCSV}
          style={{
            padding: '9px', borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(16,185,129,0.2) 100%)',
            border: '1px solid rgba(6,182,212,0.4)', color: '#38bdf8', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 0 12px rgba(6,182,212,0.2)'
          }}
        >
          <Download size={13} color="#38bdf8" /> 📥 Xuất Báo Cáo CSV ({filteredData?.length || 0} dòng)
        </button>

        <button
          onClick={() => {
            handleTimeModeChange('today')
            resetFilters()
          }}
          style={{
            padding: '8px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <RotateCcw size={13} /> Đặt Lại Mặc Định (Hôm Nay)
        </button>
      </div>

    </div>
  )
}
