// Sidebar.jsx — Filter controls
// Thay doi: bo Du lieu, 1 ngay duy nhat (default 2026-04-28), mac dinh chi Sang
import { NODE_LABEL, SLOT_LABEL, LOS_COLOR } from '../hooks/useTrafficData'

const ALL_NODES = [
  'N01_LY_THUONG_KIET', 'N02_BA_THANG_HAI', 'N03_CMT8', 'N04_THANH_THAI',
  'N05_TO_HIEN_THANH', 'N06_NGUYEN_TRI_PHUONG', 'N07_SU_VAN_HANH',
  'N08_DIEN_BIEN_PHU', 'N09_CONG_HOA', 'N10_TRUONG_CHINH',
]
// Tat ca slots
const ALL_SLOTS = ['morning_peak', 'midday_peak', 'evening_peak', 'off_peak']
const ALL_LOS   = ['A', 'B', 'C', 'D', 'E', 'F']

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function Sidebar({ filters, setFilters, resetFilters, aggregates }) {
  const dates = aggregates?.date_range?.all || []

  // Default to all dates when empty
  const selectedDate = filters.dateRange[0] || ''

  return (
    <div className="sidebar">
      {/* Node filter */}
      <div className="sidebar-section">
        <div className="sidebar-label">Khu vực / Nút giao ({filters.nodes.length}/{ALL_NODES.length})</div>
        {ALL_NODES.map(nid => (
          <label key={nid} className="checkbox-item">
            <input
              type="checkbox"
              checked={filters.nodes.includes(nid)}
              onChange={() => setFilters(f => ({ ...f, nodes: toggle(f.nodes, nid) }))}
            />
            <span style={{ flex: 1 }}>{NODE_LABEL[nid]?.replace('N0', 'N').slice(0, 20)}</span>
          </label>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Realtime Mode Indicator */}
      <div className="sidebar-section">
        <div className="sidebar-label">Chế độ Luồng Dữ liệu</div>
        <div style={{
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e',
          }} />
          <div>
            <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 12 }}>REAL-TIME LIVE (2 PHÚT/LẦN)</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Cập nhật siêu tốc 24/7 (00:00 – 23:59)</div>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* LOS filter */}
      <div className="sidebar-section">
        <div className="sidebar-label">Mức dịch vụ LOS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_LOS.map(los => (
            <button
              key={los}
              onClick={() => setFilters(f => ({ ...f, losLevels: toggle(f.losLevels, los) }))}
              style={{
                width: 32, height: 32,
                borderRadius: 6,
                border: `2px solid ${filters.losLevels.includes(los) ? LOS_COLOR[los] : 'transparent'}`,
                background: filters.losLevels.includes(los)
                  ? `${LOS_COLOR[los]}22`
                  : 'var(--bg-card)',
                color: LOS_COLOR[los],
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {los}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          A = Ùn tắc nghiêm trọng → F = Thông thoáng
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Date picker */}
      <div className="sidebar-section">
        <div className="sidebar-label">Thời gian (Ngày)</div>
        <select
          className="select-field"
          value={selectedDate}
          onChange={e => {
            const d = e.target.value
            setFilters(f => ({ ...f, dateRange: d ? [d, d] : ['', ''] }))
          }}
        >
          <option value="">Tất cả các ngày (24/7)</option>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button className="reset-btn" onClick={resetFilters}>Đặt lại bộ lọc</button>
      </div>
    </div>
  )
}
