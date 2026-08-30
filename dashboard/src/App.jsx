import { useState, useEffect, memo } from 'react'
import { useTrafficData } from './hooks/useTrafficData'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import KPIPanel from './components/KPIPanel'
import VelocityPanel from './components/VelocityPanel'
import SystemMetrics from './components/SystemMetrics'
import PerformancePanel from './components/PerformancePanel'
import EvaluationPanel from './components/EvaluationPanel'
import TrafficChatbot from './components/TrafficChatbot'
import {
  Clock,
  RefreshCw,
  Maximize2,
  Activity,
  ShieldCheck,
  TimerReset,
  Radio,
  LayoutDashboard,
  AlertTriangle,
  CloudSun,
  Bot,
  Sparkles,
} from 'lucide-react'

const TABS = [
  { id: 'map', label: 'Bản đồ Giao thông GIS', icon: '🗺️' },
  { id: 'chatbot', label: 'Trợ lý AI Giao Thông', icon: '🤖' },
  { id: 'kpi', label: 'Biểu đồ Vận tốc Real-time', icon: '📊' },
  { id: 'velocity', label: 'Phân tích Theo ngày', icon: '📈' },
  { id: 'system', label: 'Độ tin cậy & Sai số', icon: '🛡️' },
  { id: 'eval', label: 'Đánh giá Mô hình ĐHBK', icon: '🎯' },
  { id: 'performance', label: 'Hiệu năng Hệ thống', icon: '⚙️' },
]

const REFRESH_INTERVAL_SECONDS = 300

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

export default function App() {
  const [activeTab, setActiveTab] = useState('map')
  const [lastRefetchedAt, setLastRefetchedAt] = useState(new Date())

  const {
    filtered,
    aggregates,
    quality,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    cameraRecords,
    nodeStates,
    perfMetrics,
    allNodeStates,
    allData,
    refetch,
  } = useTrafficData()

  // Auto refresh data silently in background every 5 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      if (refetch) refetch()
      setLastRefetchedAt(new Date())
    }, REFRESH_INTERVAL_SECONDS * 1000)
    return () => clearInterval(timer)
  }, [refetch])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          flexDirection: 'column',
          background: '#070a12',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            border: '3px solid rgba(6,182,212,0.2)',
            borderTop: '3px solid #06b6d4',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ color: '#94a3b8', fontSize: 15, fontWeight: 600, fontFamily: 'Plus Jakarta Sans' }}>
          Đang kết nối luồng dữ liệu 22 Node Real-time...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#070a12' }}>
        <div className="glass-panel" style={{ width: 'min(560px, 100%)', padding: 24, textAlign: 'center' }}>
          <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: 12 }} />
          <h1 className="font-display" style={{ fontSize: 20, marginBottom: 8 }}>Không thể tải dữ liệu dashboard</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{error}</p>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="glass-card-interactive"
            style={{ padding: '9px 16px', color: '#f8fafc', cursor: 'pointer', border: '1px solid rgba(6,182,212,0.4)' }}
          >
            <RefreshCw size={14} style={{ marginRight: 7, verticalAlign: 'middle' }} />
            Thử tải lại
          </button>
        </div>
      </div>
    )
  }

  const getLatestDate = (arr) => {
    if (!arr || !arr.length) return null
    let max = null
    for (const r of arr) {
      if (r.timestamp) {
        if (!max || r.timestamp > max) max = r.timestamp
      } else if (r.extracted_at) {
        if (!max || r.extracted_at > max) max = r.extracted_at
      } else if (r.session_id && r.session_id.includes('_VN_')) {
        const m = r.session_id.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/)
        if (m) {
          const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`
          if (!max || iso > max) max = iso
        }
      } else if (r.date_str && r.hour_vn != null) {
        const d = `${r.date_str}T${String(r.hour_vn).padStart(2, '0')}:00:00`
        if (!max || d > max) max = d
      }
    }
    return max
  }

  const latestRecordDate = getLatestDate(nodeStates) || getLatestDate(cameraRecords) || getLatestDate(allData) || new Date().toISOString()
  const formattedLatestDate = new Date(latestRecordDate).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const nodeStateCount = nodeStates?.length || 0
  const activeNodeCount = new Set((cameraRecords || []).map((record) => record.node_id).filter(Boolean)).size
  const displayedRecordCount = filtered?.length || 0

  return (
    <div className="app-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#070a12' }}>
      <header
        className="glass-panel dashboard-header"
        style={{
          margin: '12px 16px 0 16px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(6,182,212,0.35)',
            }}
          >
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

        <div className="header-status-group" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div className="glass-card-interactive hero-status-card">
            <div className="hero-status-card__title">
              <LayoutDashboard size={14} />
              <span>Tổng quan vận hành</span>
            </div>
            <div className="hero-status-metrics">
              <div>
                <strong>{activeNodeCount}/22</strong>
                <span>node đang hiển thị</span>
              </div>
              <div>
                <strong>{nodeStateCount}</strong>
                <span>node states</span>
              </div>
              <div>
                <strong>{displayedRecordCount}</strong>
                <span>bản ghi đang lọc</span>
              </div>
            </div>
          </div>

          <div
            className="glass-card-interactive"
            style={{
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(56,189,248,0.3)',
              background: 'rgba(15,23,42,0.8)',
            }}
          >
            <Clock size={15} color="#38bdf8" />
            <div>
              <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Giờ Hệ Thống (ICT)
              </div>
              <LiveClock />
            </div>
          </div>

          {/* Weather Widget — Theo chuẩn đề tài ĐHBK (Chương 3.4.2 OpenWeather) */}
          <div
            className="glass-card-interactive"
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(56,189,248,0.25)',
              background: 'rgba(56,189,248,0.06)',
            }}
          >
            <CloudSun size={18} color="#38bdf8" />
            <div>
              <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                Thời Tiết TP.HCM
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>31°C</span>
                <span style={{ color: '#64748b' }}>•</span>
                <span style={{ color: '#38bdf8' }}>Nắng ráo (76% ẩm)</span>
              </div>
            </div>
          </div>

          <div
            className="glass-card-interactive"
            style={{
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              border: '1px solid rgba(16,185,129,0.35)',
              background: 'rgba(16,185,129,0.08)',
            }}
          >
            <div className="live-dot-pulse" />
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: '#34d399',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ShieldCheck size={11} /> Real-Time Live Stream
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', marginTop: 1 }}>
                Bản ghi: <span style={{ color: '#38bdf8' }}>{formattedLatestDate}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div className="glass-card-interactive compact-status-pill">
              <Radio size={13} color="#34d399" />
              <span>Live</span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="glass-card-interactive"
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Toàn màn hình"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="app-body" style={{ flex: 1, display: 'flex', gap: 14, padding: '12px 16px 16px 16px', minHeight: 0 }}>
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

        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, minHeight: 0 }}>
          <div className="glass-panel tab-strip" style={{ display: 'flex', padding: 5, gap: 5, overflowX: 'auto' }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`dashboard-tab ${activeTab === tab.id ? 'dashboard-tab--active' : ''}`}
                style={{
                  flex: 1,
                  minWidth: 130,
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'Plus Jakarta Sans',
                  transition: 'all 0.15s ease',
                  background:
                    activeTab === tab.id
                      ? 'linear-gradient(135deg, rgba(6,182,212,0.25) 0%, rgba(59,130,246,0.25) 100%)'
                      : 'transparent',
                  color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                  boxShadow: activeTab === tab.id ? '0 0 12px rgba(6,182,212,0.25)' : 'none',
                  border: activeTab === tab.id ? '1px solid rgba(56,189,248,0.4)' : '1px solid transparent',
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="tab-content dashboard-tab-content" style={{ flex: 1, minHeight: 0 }}>
            {activeTab === 'map' && <MapView data={filtered} nodeStates={nodeStates} cameraRecords={cameraRecords} filters={filters} />}
            {activeTab === 'chatbot' && <TrafficChatbot data={filtered} nodeStates={allNodeStates} perfMetrics={perfMetrics} quality={quality} />}
            {activeTab === 'kpi' && <KPIPanel data={filtered} aggregates={aggregates} quality={quality} />}
            {activeTab === 'velocity' && <VelocityPanel data={filtered} aggregates={aggregates} nodeStates={allNodeStates} />}
            {activeTab === 'eval' && <EvaluationPanel perf={perfMetrics} quality={quality} nodeStates={nodeStates} />}
            {activeTab === 'system' && <SystemMetrics data={allData} quality={quality} aggregates={aggregates} nodeStates={allNodeStates} />}
            {activeTab === 'performance' && <PerformancePanel perf={perfMetrics} nodeStates={allNodeStates} />}
          </div>
        </div>
      </div>

      {/* Floating AI Assistant Button (Tương tác nhanh từ bất kỳ Tab nào) */}
      {activeTab !== 'chatbot' && (
        <button
          type="button"
          onClick={() => setActiveTab('chatbot')}
          style={{
            position: 'fixed',
            bottom: 22,
            right: 22,
            zIndex: 9999,
            padding: '10px 18px',
            borderRadius: 30,
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(6,182,212,0.45)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)'
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(6,182,212,0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(6,182,212,0.45)'
          }}
        >
          <Bot size={18} />
          <span>Hỏi AI Trợ Lý</span>
          <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: 10 }}>NEW</span>
        </button>
      )}

      <style>{`
        .spin-icon { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
