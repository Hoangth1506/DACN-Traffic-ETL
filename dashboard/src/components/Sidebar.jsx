import { useState, useEffect, memo } from 'react'
import { NODE_LABEL, LOS_COLOR, LOS_LABEL, SLOT_LABEL } from '../hooks/useTrafficData'
import { Layers, Calendar, RotateCcw, Search, Sparkles, Clock, AlertTriangle, Gauge, Download } from 'lucide-react'

const REFRESH_INTERVAL_SECONDS = 300

const LiveCountdownText = memo(function LiveCountdownText() {
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? REFRESH_INTERVAL_SECONDS : prev - 1))
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
  'N11_LE_HONG_PHONG', 'N12_NGO_GIA_TU', 'N13_VINH_VIEN', 'N14_HOA_HAO',
  'N15_BA_HAT', 'N16_NHAT_TAO', 'N17_TRAN_NHAN_TON', 'N18_NGUYEN_LAM',
  'N19_DONG_NAI', 'N20_CUU_LONG', 'N21_HO_BA_KIEN', 'N22_BAC_HAI',
]

const TAN_BINH_NODES = ['N09_CONG_HOA', 'N10_TRUONG_CHINH']
const ALL_NODES = [...Q10_NODES, ...TAN_BINH_NODES]
const ALL_LOS = ['A', 'B', 'C', 'D', 'E', 'F']
const ALL_SLOTS = ['morning_peak', 'midday_peak', 'evening_peak', 'off_peak']

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

function buttonStyle(active, accent, solid = false) {
  return {
    border: active ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.08)',
    background: active ? `${accent}22` : solid ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
    color: active ? accent : '#94a3b8',
  }
}

export default function Sidebar({ filters, setFilters, resetFilters, aggregates, lastUpdated, filteredData, lastRefetchedAt }) {
  const [searchTerm, setSearchTerm] = useState('')
  const dates = aggregates?.by_date ? Object.keys(aggregates.by_date).sort() : []
  const latestDate = dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10)
  const minDate = dates.length ? dates[0] : latestDate
  const [timeMode, setTimeMode] = useState('today')

  const handleExportCSV = () => {
    const dataToExport = filteredData || []
    if (!dataToExport.length) return alert('Không có dữ liệu để xuất file!')

    const headers = ['date_str', 'time_slot', 'node_id', 'current_speed', 'congestion_index', 'los', 'osm_matched']
    const rows = dataToExport.map((r) => [
      r.date_str || '',
      r.time_slot || '',
      r.node_id || '',
      r.current_speed != null ? r.current_speed : '',
      r.congestion_index != null ? r.congestion_index : '',
      r.los || '',
      r.osm_matched ? '1' : '0',
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
      setFilters((f) => ({ ...f, dateRange: [latestDate, latestDate] }))
    } else if (mode === 'week') {
      const d7 = dates.length >= 7 ? dates[dates.length - 7] : minDate
      setFilters((f) => ({ ...f, dateRange: [d7, latestDate] }))
    } else if (mode === 'month') {
      const monthStart = latestDate.slice(0, 8) + '01'
      setFilters((f) => ({ ...f, dateRange: [monthStart, latestDate] }))
    } else if (mode === 'single') {
      setFilters((f) => ({ ...f, dateRange: [latestDate, latestDate] }))
    }
  }

  const selectPreset = (type) => {
    if (type === 'today') {
      handleTimeModeChange('today')
      setFilters((f) => ({ ...f, nodes: ALL_NODES, losLevels: ALL_LOS }))
    } else if (type === 'hotspots') {
      setFilters((f) => ({ ...f, losLevels: ['A', 'B', 'C'] }))
    } else if (type === 'q10') {
      setFilters((f) => ({ ...f, nodes: Q10_NODES }))
    } else if (type === 'tanbinh') {
      setFilters((f) => ({ ...f, nodes: TAN_BINH_NODES }))
    }
  }

  const matchesSearch = (nid) => {
    if (!searchTerm.trim()) return true
    const label = NODE_LABEL[nid] || ''
    return label.toLowerCase().includes(searchTerm.toLowerCase().trim())
  }

  const filteredQ10 = Q10_NODES.filter(matchesSearch)
  const filteredTB = TAN_BINH_NODES.filter(matchesSearch)

  return (
    <aside className="glass-panel dashboard-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
      <div className="sidebar-realtime-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 12, fontWeight: 800 }}>
            <div className="live-dot-pulse" />
            <span>REAL-TIME STREAMING</span>
          </div>
          <span className="sidebar-live-badge">5 PHÚT/LẦN</span>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45, marginBottom: 8 }}>
          Bản ghi mới nhất nhận lúc:
          <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 12, marginTop: 3, fontFamily: 'Outfit' }}>
            {lastUpdated || 'Đang đồng bộ...'}
          </div>
        </div>

        <div className="sidebar-realtime-footer">
          <span>Tự động làm mới</span>
          <LiveCountdownText key={lastRefetchedAt} />
        </div>
      </div>

      <div className="sidebar-section-card">
        <div className="sidebar-section-title">
          <Sparkles size={12} color="#06b6d4" /> Kịch bản nhanh
        </div>
        <div className="sidebar-preset-grid">
          <button className="sidebar-pill-button sidebar-pill-button--green" onClick={() => selectPreset('today')}>
            🔥 Hôm nay live
          </button>
          <button className="sidebar-pill-button sidebar-pill-button--red" onClick={() => selectPreset('hotspots')}>
            <AlertTriangle size={12} /> Cảnh báo kẹt xe
          </button>
          <button className="sidebar-pill-button" onClick={() => selectPreset('q10')}>
            Quận 10 (20 node)
          </button>
          <button className="sidebar-pill-button" onClick={() => selectPreset('tanbinh')}>
            Tân Bình (2 node)
          </button>
        </div>
      </div>

      <div className="sidebar-section-card">
        <div className="sidebar-section-title">
          <Calendar size={12} color="#f59e0b" /> Phạm vi thời gian
        </div>

        <div className="sidebar-segmented-control">
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: 'week', label: 'Theo tuần' },
            { id: 'month', label: 'Theo tháng' },
            { id: 'single', label: 'Lịch sử' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => handleTimeModeChange(m.id)}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                ...buttonStyle(timeMode === m.id, '#fbbf24'),
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {timeMode === 'single' && (
          <select
            value={filters.dateRange[0] || latestDate}
            onChange={(e) => {
              const d = e.target.value
              setFilters((f) => ({ ...f, dateRange: d ? [d, d] : [latestDate, latestDate] }))
            }}
            className="sidebar-input"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d === latestDate ? `Hôm nay (${d}) — LIVE` : `Ngày ${d}`}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="sidebar-section-card">
        <div className="sidebar-section-title">
          <Clock size={12} color="#8b5cf6" /> Khung giờ giám sát
        </div>
        <div className="sidebar-two-col-grid">
          {ALL_SLOTS.map((slot) => {
            const active = filters.timeSlots.includes(slot)
            return (
              <button
                key={slot}
                onClick={() => setFilters((f) => ({ ...f, timeSlots: toggle(f.timeSlots, slot) }))}
                style={{
                  padding: '6px 8px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  ...buttonStyle(active, '#c084fc'),
                }}
              >
                {SLOT_LABEL[slot]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="sidebar-section-card">
        <div className="sidebar-section-title">
          <Gauge size={12} color="#ec4899" /> Lọc vận tốc di chuyển
        </div>
        <div className="sidebar-speed-grid">
          {[
            { label: 'Tất cả', min: 0, max: 100 },
            { label: '< 15km/h', min: 0, max: 15 },
            { label: '15-30km/h', min: 15, max: 30 },
            { label: '> 30km/h', min: 30, max: 100 },
          ].map((sp, idx) => {
            const active = filters.minSpeed === sp.min && filters.maxSpeed === sp.max
            return (
              <button
                key={idx}
                onClick={() => setFilters((f) => ({ ...f, minSpeed: sp.min, maxSpeed: sp.max }))}
                style={{
                  padding: '6px 6px',
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  ...buttonStyle(active, '#f472b6'),
                }}
              >
                {sp.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="sidebar-section-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={12} color="#38bdf8" /> Nút giao ({filters.nodes.length}/22)
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={13} color="#64748b" style={{ position: 'absolute', left: 10, top: 10 }} />
          <input
            type="text"
            placeholder="Tìm tên đường..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sidebar-input"
            style={{ paddingLeft: 32 }}
          />
        </div>

        <div className="node-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
          {filteredQ10.length > 0 && (
            <div>
              <div className="sidebar-node-group-title sidebar-node-group-title--cyan">QUẬN 10 (20 NODE)</div>
              {filteredQ10.map((nid) => {
                const isChecked = filters.nodes.includes(nid)
                return (
                  <label key={nid} className={`sidebar-node-item ${isChecked ? 'sidebar-node-item--active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setFilters((f) => ({ ...f, nodes: toggle(f.nodes, nid) }))}
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
              <div className="sidebar-node-group-title sidebar-node-group-title--amber">TÂN BÌNH (2 NODE)</div>
              {filteredTB.map((nid) => {
                const isChecked = filters.nodes.includes(nid)
                return (
                  <label key={nid} className={`sidebar-node-item ${isChecked ? 'sidebar-node-item--amber' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setFilters((f) => ({ ...f, nodes: toggle(f.nodes, nid) }))}
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

      <div className="sidebar-section-card">
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Mức dịch vụ LOS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {ALL_LOS.map((los) => {
            const active = filters.losLevels.includes(los)
            return (
              <button
                key={los}
                onClick={() => setFilters((f) => ({ ...f, losLevels: toggle(f.losLevels, los) }))}
                title={`LOS ${los}: ${LOS_LABEL[los]}`}
                style={{
                  padding: '7px 0',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 800,
                  border: active ? `1.5px solid ${LOS_COLOR[los]}` : '1px solid rgba(255,255,255,0.08)',
                  background: active ? `${LOS_COLOR[los]}25` : 'rgba(255,255,255,0.02)',
                  color: active ? LOS_COLOR[los] : '#64748b',
                }}
              >
                {los}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="sidebar-action-button sidebar-action-button--primary" onClick={handleExportCSV}>
          <Download size={13} color="#38bdf8" /> Xuất báo cáo CSV ({filteredData?.length || 0} dòng)
        </button>

        <button
          className="sidebar-action-button"
          onClick={() => {
            handleTimeModeChange('today')
            resetFilters()
          }}
        >
          <RotateCcw size={13} /> Đặt lại mặc định (Hôm nay)
        </button>
      </div>
    </aside>
  )
}
