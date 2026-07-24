// App.jsx — Modern Cyberpunk Dashboard with Live Clock & Real-time Data Proof
import { useState, useEffect } from 'react'
import { useTrafficData } from './hooks/useTrafficData'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import KPIPanel from './components/KPIPanel'
import VelocityPanel from './components/VelocityPanel'
import SystemMetrics from './components/SystemMetrics'
import PerformancePanel from './components/PerformancePanel'
import EvaluationPanel from './components/EvaluationPanel'
import { Clock, RefreshCw, Maximize2, Activity, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

const TABS = [
  { id: 'map',         label: 'Bản đồ Giao thông GIS', icon: '🗺️' },
  { id: 'kpi',         label: 'Biểu đồ Vận tốc Real-time', icon: '📊' },
  { id: 'velocity',    label: 'Phân tích Theo ngày', icon: '📈' },
  { id: 'system',      label: 'Độ tin cậy & Sai số', icon: '🛡️' },
  { id: 'eval',        label: 'Đánh giá Mô hình',   icon: '🎯' },
  { id: 'performance', label: 'Hiệu năng Hệ thống',icon: '⚙️' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('map')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [countdown, setCountdown] = useState(120)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefetchedAt, setLastRefetchedAt] = useState(new Date())

  const {
    filtered, aggregates, quality, loading,
    filters, setFilters, resetFilters,
    cameraRecords, nodeStates, perfMetrics,
    allNodeStates, allData, refetch
  } = useTrafficData()

  // 1. Đồng hồ thời gian thực ICT (chạy theo từng giây)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. Thanh đếm lùi 2 phút tự động làm mới dữ liệu
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleManualRefresh()
          return 120
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    if (refetch) await refetch()
    setLastRefetchedAt(new Date())
    setCountdown(120)
    setTimeout(() => setIsRefreshing(false), 800)
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
          Đang kết nối luồng dữ liệu 10 Node Real-time...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Mốc thời gian của bản ghi mới nhất nhận được
  const latestRecordDate = cameraRecords?.[0]?.timestamp || allData?.[0]?.timestamp || new Date().toISOString()
  const formattedLatestDate = new Date(latestRecordDate).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#070a12' }}>
      
      {/* ── HEADER THANH CÔNG CỤ CAO CẤP ────────────────────────────────── */}
      <header className="glass-panel" style={{
        margin: '12px 16px 0 16px', padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* LOGO & HỆ THỐNG */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(6,182,212,0.4)'
          }}>
            <Activity color="#fff" size={24} />
          </div>
          <div>
            <div className="font-display gradient-text-cyan" style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Giám Sát Giao Thông TP.HCM — Real-Time 24/7
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Kiến trúc Node-Agent-Edge</span>
              <span>•</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>Quận 10 & Tân Bình (10 Nodes)</span>
            </div>
          </div>
        </div>

        {/* CẮT GỌN BẰNG CHỨNG REAL-TIME & ĐỒNG HỒ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          
          {/* ĐỒNG HỒ ĐIỆN TỬ HIỆN TẠI (ICT) */}
          <div className="glass-card-interactive" style={{
            padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
            border: '1px solid rgba(56,189,248,0.3)', background: 'rgba(15,23,42,0.8)'
          }}>
            <Clock size={16} color="#38bdf8" />
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Giờ Hệ Thống (ICT)
              </div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                {currentTime.toLocaleTimeString('vi-VN')}
              </div>
            </div>
          </div>

          {/* HỘP BẰNG CHỨNG DỮ LIỆU TƯƠI (LIVE PROOF) */}
          <div className="glass-card-interactive" style={{
            padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10,
            border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)'
          }}>
            <div className="live-dot-pulse" />
            <div>
              <div style={{ fontSize: 10, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={12} /> Dữ liệu Tươi 100% Real-Time
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc' }}>
                Khung nhận: <span style={{ color: '#38bdf8' }}>{formattedLatestDate}</span>
              </div>
            </div>
          </div>

          {/* NÚT TẢI LAI VÀ FULLSCREEN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleManualRefresh}
              className="glass-card-interactive"
              style={{
                padding: '8px 14px', cursor: 'pointer', color: '#f8fafc',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)'
              }}
              title="Tải lại dữ liệu tươi mới ngay tức thì"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} color="#06b6d4" />
              <span>Cập Nhật Ngay ({countdown}s)</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="glass-card-interactive"
              style={{
                padding: '8px', cursor: 'pointer', color: '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              title="Toàn màn hình"
            >
              <Maximize2 size={16} />
            </button>
          </div>

        </div>
      </header>

      {/* THANH BÁO TIẾN TRÌNH ĐẾM NGUỢC 2 PHÚT (PROGRESS BAR) */}
      <div style={{ margin: '8px 16px 0 16px', background: 'rgba(255,255,255,0.05)', height: 3, borderRadius: 2, overflow: 'hidden' }}>
        <div
          className="progress-bar-fill"
          style={{
            height: '100%',
            width: `${((120 - countdown) / 120) * 100}%`,
            background: 'linear-gradient(90deg, #06b6d4, #10b981)',
            boxShadow: '0 0 10px #06b6d4'
          }}
        />
      </div>

      {/* ── THÂN ỨNG DỤNG (SIDEBAR + MAIN CONTENT) ────────────────────────── */}
      <div className="app-body" style={{ flex: 1, display: 'flex', gap: 16, padding: '12px 16px 16px 16px', overflow: 'hidden' }}>
        <Sidebar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          aggregates={aggregates}
          totalShown={filtered.length}
          lastUpdated={formattedLatestDate}
          countdown={countdown}
        />

        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          
          {/* THANH CHUYỂN TAB GLASSMORPHIC */}
          <div className="glass-panel" style={{ display: 'flex', padding: 6, gap: 6, overflowX: 'auto' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 10,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 13, fontWeight: 700, fontFamily: 'Plus Jakarta Sans',
                  transition: 'all 0.2s ease',
                  background: activeTab === tab.id
                    ? 'linear-gradient(135deg, rgba(6,182,212,0.25) 0%, rgba(59,130,246,0.25) 100%)'
                    : 'transparent',
                  color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                  boxShadow: activeTab === tab.id ? '0 0 15px rgba(6,182,212,0.25)' : 'none',
                  border: activeTab === tab.id ? '1px solid rgba(56,189,248,0.4)' : '1px solid transparent'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* VÙNG NỘI DUNG CÁC TAB */}
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
