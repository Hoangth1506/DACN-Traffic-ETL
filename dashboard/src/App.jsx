// App.jsx — Ultra-Optimized Dashboard with Isolated Clock & Zero-Lag Render Tree
import { useState, useEffect, memo } from 'react'
import { useTrafficData } from './hooks/useTrafficData'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import KPIPanel from './components/KPIPanel'
import VelocityPanel from './components/VelocityPanel'
import SystemMetrics from './components/SystemMetrics'
import PerformancePanel from './components/PerformancePanel'
import EvaluationPanel from './components/EvaluationPanel'
import { Clock, RefreshCw, Maximize2, Activity, ShieldCheck } from 'lucide-react'

const TABS = [
  { id: 'map',         label: 'Bản đồ Giao thông GIS', icon: '🗺️' },
  { id: 'kpi',         label: 'Biểu đồ Vận tốc Real-time', icon: '📊' },
  { id: 'velocity',    label: 'Phân tích Theo ngày', icon: '📈' },
  { id: 'system',      label: 'Độ tin cậy & Sai số', icon: '🛡️' },
  { id: 'eval',        label: 'Đánh giá Mô hình',   icon: '🎯' },
  { id: 'performance', label: 'Hiệu năng Hệ thống',icon: '⚙️' },
]

// Component Đồng Hồ Độc Lập (Ngăn re-render toàn bộ App mỗi 1s)
const LiveClock = memo(function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
      {time.toLocaleTimeString('vi-VN')}
    </div>
  )
})

// Component Đếm Lùi Độc Lập
const LiveCountdownBar = memo(function LiveCountdownBar({ onExpire }) {
  const [countdown, setCountdown] = useState(300)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onExpire()
          return 300
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onExpire])

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 9999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      <div
        className="progress-bar-fill"
        style={{
          height: '100%',
          width: `${((300 - countdown) / 300) * 100}%`,
          background: 'linear-gradient(90deg, #06b6d4, #10b981)',
          boxShadow: '0 0 10px #06b6d4'
        }}
      />
    </div>
  )
})

export default function App() {
  const [activeTab, setActiveTab] = useState('map')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefetchedAt, setLastRefetchedAt] = useState(new Date())

  const {
    filtered, aggregates, quality, loading,
    filters, setFilters, resetFilters,
    cameraRecords, nodeStates, perfMetrics,
    allNodeStates, allData, refetch
  } = useTrafficData()

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    if (refetch) await refetch()
    setLastRefetchedAt(new Date())
    setTimeout(() => setIsRefreshing(false), 600)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (loading) {
    return (
      <div style={{ display:'flex', gap:16, alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', background:'#070a12' }}>
        <div style={{ width:56, height:56, border:'3px solid rgba(6,182,212,0.2)', borderTop:'3px solid #06b6d4', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <div style={{ color:'#94a3b8', fontSize:15, fontWeight:600, fontFamily:'Plus Jakarta Sans' }}>
          Đang kết nối luồng dữ liệu 22 Node Real-time...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Lấy bản ghi mới nhất bằng cách so sánh ngày tháng
  const getLatestDate = (arr) => {
    if (!arr || !arr.length) return null;
    let max = null;
    for (const r of arr) {
      if (r.extracted_at) {
        if (!max || r.extracted_at > max) max = r.extracted_at;
      } else if (r.date_str && r.hour_vn != null) {
        // Fallback in case extracted_at is missing
        const d = `${r.date_str}T${String(r.hour_vn).padStart(2, '0')}:00:00`;
        if (!max || d > max) max = d;
      }
    }
    return max;
  }
  
  const latestRecordDate = getLatestDate(cameraRecords) || getLatestDate(allData) || new Date().toISOString()
  const formattedLatestDate = new Date(latestRecordDate).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#070a12' }}>
      
      {/* THANH BÁO TIẾN TRÌNH ĐẾM NGUỢC TÁCH BIỆT */}
      <LiveCountdownBar key={lastRefetchedAt} onExpire={handleManualRefresh} />

      {/* ── HEADER CẤU TRÚC NHẸ ──────────────────────────────────────────── */}
      <header className="glass-panel" style={{
        margin: '12px 16px 0 16px', padding: '10px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(6,182,212,0.35)'
          }}>
            <Activity color="#fff" size={20} />
          </div>
          <div>
            <div className="font-display gradient-text-cyan" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Giám Sát Giao Thông TP.HCM — Real-Time 24/7
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Node-Agent-Edge</span>
              <span>•</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>Quận 10 & Tân Bình (22 Nodes)</span>
            </div>
          </div>
        </div>

        {/* THÔNG TIN REALTIME */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          
          {/* ĐỒNG HỒ TỰ CẬP NHẬT */}
          <div className="glass-card-interactive" style={{
            padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(15,23,42,0.8)'
          }}>
            <Clock size={15} color="#38bdf8" />
            <div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Giờ Hệ Thống (ICT)
              </div>
              <LiveClock />
            </div>
          </div>

          {/* BẰNG CHỨNG DỮ LIỆU TƯƠI */}
          <div className="glass-card-interactive" style={{
            padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)'
          }}>
            <div className="live-dot-pulse" />
            <div>
              <div style={{ fontSize: 9, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={11} /> Real-Time Live Stream
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc' }}>
                Bản ghi: <span style={{ color: '#38bdf8' }}>{formattedLatestDate}</span>
              </div>
            </div>
          </div>

          {/* NÚT THAO TÁC */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={handleManualRefresh}
              className="glass-card-interactive"
              style={{
                padding: '6px 12px', cursor: 'pointer', color: '#f8fafc',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)'
              }}
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin-icon' : ''} color="#06b6d4" />
              <span>Cập Nhật Ngay</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="glass-card-interactive"
              style={{
                padding: '6px 8px', cursor: 'pointer', color: '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Toàn màn hình"
            >
              <Maximize2 size={15} />
            </button>
          </div>

        </div>
      </header>

      {/* ── THÂN DỰ ÁN ──────────────────────────────────────────────────── */}
      <div className="app-body" style={{ flex: 1, display: 'flex', gap: 14, padding: '12px 16px 16px 16px', overflow: 'hidden' }}>
        <Sidebar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          aggregates={aggregates}
          totalShown={filtered.length}
          lastUpdated={formattedLatestDate}
          filteredData={filtered}
          lastRefetchedAt={lastRefetchedAt}
        />

        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          
          {/* TABS */}
          <div className="glass-panel" style={{ display: 'flex', padding: 5, gap: 5, overflowX: 'auto' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, minWidth: 130, padding: '8px 12px', borderRadius: 8,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 12, fontWeight: 700, fontFamily: 'Plus Jakarta Sans',
                  transition: 'all 0.15s ease',
                  background: activeTab === tab.id
                    ? 'linear-gradient(135deg, rgba(6,182,212,0.25) 0%, rgba(59,130,246,0.25) 100%)'
                    : 'transparent',
                  color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                  boxShadow: activeTab === tab.id ? '0 0 12px rgba(6,182,212,0.25)' : 'none',
                  border: activeTab === tab.id ? '1px solid rgba(56,189,248,0.4)' : '1px solid transparent'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* VÙNG NỘI DUNG TABS */}
          <div className="tab-content" style={{ flex: 1, minHeight: 0 }}>
            {activeTab === 'map'         && <MapView data={filtered} nodeStates={nodeStates} cameraRecords={cameraRecords} filters={filters} />}
            {activeTab === 'kpi'         && <KPIPanel data={filtered} aggregates={aggregates} quality={quality} />}
            {activeTab === 'velocity'    && <VelocityPanel data={filtered} aggregates={aggregates} nodeStates={allNodeStates} />}
            {activeTab === 'eval'        && <EvaluationPanel perf={perfMetrics} quality={quality} nodeStates={nodeStates} />}
            {activeTab === 'system'      && <SystemMetrics data={allData} quality={quality} aggregates={aggregates} nodeStates={allNodeStates} />}
            {activeTab === 'performance' && <PerformancePanel perf={perfMetrics} nodeStates={allNodeStates} />}
          </div>
        </div>
      </div>

      <style>{`
        .spin-icon { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
