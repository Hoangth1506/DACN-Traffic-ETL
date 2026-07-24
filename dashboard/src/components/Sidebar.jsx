// Sidebar.jsx — Sleek Glassmorphism Control Panel with Real-time Proof Box
import { NODE_LABEL, LOS_COLOR } from '../hooks/useTrafficData'
import { Filter, Layers, Calendar, CheckSquare, RotateCcw, ShieldCheck, Zap } from 'lucide-react'

const ALL_NODES = [
  'N01_LY_THUONG_KIET', 'N02_BA_THANG_HAI', 'N03_CMT8', 'N04_THANH_THAI',
  'N05_TO_HIEN_THANH', 'N06_NGUYEN_TRI_PHUONG', 'N07_SU_VAN_HANH',
  'N08_DIEN_BIEN_PHU', 'N09_CONG_HOA', 'N10_TRUONG_CHINH',
]

const ALL_LOS = ['A', 'B', 'C', 'D', 'E', 'F']

function toggle(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function Sidebar({ filters, setFilters, resetFilters, aggregates, lastUpdated, countdown }) {
  const dates = aggregates?.date_range?.all || []
  const selectedDate = filters.dateRange[0] || ''

  const selectPreset = (type) => {
    if (type === 'all') {
      setFilters(f => ({ ...f, nodes: ALL_NODES }))
    } else if (type === 'q10') {
      setFilters(f => ({ ...f, nodes: ALL_NODES.slice(0, 8) }))
    } else if (type === 'tanbinh') {
      setFilters(f => ({ ...f, nodes: ['N09_CONG_HOA', 'N10_TRUONG_CHINH'] }))
    }
  }

  return (
    <div className="glass-panel" style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 16, padding: 16, flexShrink: 0, overflowY: 'auto' }}>
      
      {/* ── 1. HỘP BẰNG CHỨNG DỮ LIỆU REAL-TIME (PROOF BOX) ──────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(16,185,129,0.12) 100%)',
        border: '1px solid rgba(16,185,129,0.35)',
        borderRadius: 12, padding: 14, boxShadow: '0 4px 20px rgba(16,185,129,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34d399', fontSize: 12, fontWeight: 800 }}>
            <div className="live-dot-pulse" />
            <span>REAL-TIME STREAMING</span>
          </div>
          <span style={{ fontSize: 11, background: 'rgba(6,182,212,0.2)', color: '#38bdf8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
            2 PHÚT/LẦN
          </span>
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, marginBottom: 8 }}>
          Bản ghi mới nhất nhận lúc:
          <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 12, marginTop: 2, fontFamily: 'Outfit' }}>
            {lastUpdated || 'Đang đồng bộ...'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span>Tự động làm mới:</span>
          <span style={{ color: '#06b6d4', fontWeight: 800 }}>{countdown}s</span>
        </div>
      </div>

      {/* ── 2. BỘ LỌC QUICK PRESET ────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={12} color="#06b6d4" /> Lọc Nhanh Tuyến Đường
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            onClick={() => selectPreset('all')}
            style={{
              padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: '#f8fafc', fontSize: 11, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Tất cả 10 Node
          </button>
          <button
            onClick={() => selectPreset('q10')}
            style={{
              padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)', color: '#f8fafc', fontSize: 11, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Quận 10 (8 Node)
          </button>
        </div>
      </div>

      {/* ── 3. DANH SÁCH CHECKBOX 10 NODE ────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={12} color="#38bdf8" /> Nút Giao ({filters.nodes.length}/10)
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
          {ALL_NODES.map(nid => {
            const isChecked = filters.nodes.includes(nid)
            return (
              <label
                key={nid}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                  background: isChecked ? 'rgba(56,189,248,0.08)' : 'rgba(255,255,255,0.02)',
                  border: isChecked ? '1px solid rgba(56,189,248,0.25)' : '1px solid transparent',
                  cursor: 'pointer', fontSize: 12, color: isChecked ? '#f8fafc' : '#64748b', transition: 'all 0.15s'
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
      </div>

      {/* ── 4. LỌC THEO MỨC LOS ────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Mức Dịch Vụ LOS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {ALL_LOS.map(los => {
            const active = filters.losLevels.includes(los)
            return (
              <button
                key={los}
                onClick={() => setFilters(f => ({ ...f, losLevels: toggle(f.losLevels, los) }))}
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

      {/* ── 5. NẠP CHỌN NGÀY THỜI GIAN ─────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={12} color="#f59e0b" /> Lọc Ngày Lịch Sử
        </div>
        <select
          value={selectedDate}
          onChange={e => {
            const d = e.target.value
            setFilters(f => ({ ...f, dateRange: d ? [d, d] : ['', ''] }))
          }}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
            color: '#f8fafc', fontSize: 12, outline: 'none'
          }}
        >
          <option value="">Tất cả ngày (Continuous 24/7)</option>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <button
        onClick={resetFilters}
        style={{
          marginTop: 'auto', padding: '10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}
      >
        <RotateCcw size={14} /> Đặt Lại Bộ Lọc
      </button>

    </div>
  )
}
