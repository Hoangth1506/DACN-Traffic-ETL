import { useState, useEffect, memo, lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDashboardData } from './api/queries'
import { useDashboardStore } from './store/dashboardStore'
import type { DashboardData, TrafficNode } from '@types/index'
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
} from 'lucide-react'

// Lazy load heavy components
const Sidebar = lazy(() => import('./components/Sidebar'))
const MapView = lazy(() => import('./components/MapView'))
const KPIPanel = lazy(() => import('./components/KPIPanel'))
const VelocityPanel = lazy(() => import('./components/VelocityPanel'))
const SystemMetrics = lazy(() => import('./components/SystemMetrics'))
const PerformancePanel = lazy(() => import('./components/PerformancePanel'))
const EvaluationPanel = lazy(() => import('./components/EvaluationPanel'))

interface Tab {
  id: string
  label: string
  icon: string
}

const TABS: Tab[] = [
  { id: 'map', label: 'Bản đồ Giao thông GIS', icon: '🗺️' },
  { id: 'kpi', label: 'Biểu đồ Vận tốc Real-time', icon: '📊' },
  { id: 'velocity', label: 'Phân tích Theo ngày', icon: '📈' },
  { id: 'system', label: 'Độ tin cậy & Sai số', icon: '🛡️' },
  { id: 'eval', label: 'Đánh giá Mô hình', icon: '🎯' },
  { id: 'performance', label: 'Hiệu năng Hệ thống', icon: '⚙️' },
]

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 3,
      staleTime: 10000,
    },
  },
})

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

interface LiveCountdownBarProps {
  intervalSeconds: number
  onExpire: () => void
}

const LiveCountdownBar = memo(function LiveCountdownBar({ intervalSeconds, onExpire }: LiveCountdownBarProps) {
  const [countdown, setCountdown] = useState(intervalSeconds)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onExpire()
          return intervalSeconds
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [intervalSeconds, onExpire])

  const progress = ((intervalSeconds - countdown) / intervalSeconds) * 100

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}
    >
      <div
        className="progress-bar-fill"
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #06b6d4, #10b981)',
          boxShadow: '0 0 10px #06b6d4',
          transition: 'width 1s linear',
        }}
      />
    </div>
  )
})

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('map')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const store = useDashboardStore()
  const { data, isLoading, error, refetch } = useDashboardData(store.refreshInterval)

  useEffect(() => {
    if (data) {
      store.setData(data)
    }
  }, [data, store])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setTimeout(() => setIsRefreshing(false), 600)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (isLoading) {
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
          <h1 className="font-display" style={{ fontSize: 20, marginBottom: 8 }}>
            Không thể tải dữ liệu dashboard
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            {error.message}
          </p>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="glass-card-interactive"
            style={{
              padding: '9px 16px',
              color: '#f8fafc',
              cursor: 'pointer',
              border: '1px solid rgba(6,182,212,0.4)',
            }}
          >
            <RefreshCw size={14} style={{ marginRight: 7, verticalAlign: 'middle' }} />
            Thử tải lại
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const activeNodeCount = new Set(data.nodes.map((n) => n.node_id)).size
  const formattedLatestDate = new Date(data.last_update).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <div
      className="app-layout"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#070a12' }}
    >
      <LiveCountdownBar intervalSeconds={store.refreshInterval / 1000} onExpire={handleManualRefresh} />

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
            <div
              className="font-display gradient-text-cyan"
              style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              Giám Sát Giao Thông TP.HCM — Real-Time 24/7
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Node-Agent-Edge</span>
              <span>•</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>Quận 10 & Tân Bình (22 Nodes)</span>
            </div>
          </div>
        </div>

        <div
          className="header-status-group"
          style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
        >
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
                <strong>{data.nodes.length}</strong>
                <span>node states</span>
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
              <div
                style={{
                  fontSize: 9,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                }}
              >
                Giờ Hệ Thống (ICT)
              </div>
              <LiveClock />
            </div>
          </div>

          <div
            className="glass-card-interactive"
            style={{
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(16,185,129,0.3)',
              background: 'rgba(16,185,129,0.06)',
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
              <div style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc' }}>
                Bản ghi: <span style={{ color: '#38bdf8' }}>{formattedLatestDate}</span>
              </div>
              <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>
                Tự động đồng bộ mỗi {store.refreshInterval / 1000} giây
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={handleManualRefresh}
              className="glass-card-interactive"
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                background: 'rgba(6,182,212,0.15)',
                border: '1px solid rgba(6,182,212,0.4)',
              }}
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin-icon' : ''} color="#06b6d4" />
              <span>Cập Nhật Ngay</span>
            </button>

            <div className="glass-card-interactive compact-status-pill">
              <TimerReset size={13} color="#fbbf24" />
              <span>{store.refreshInterval / 1000}s</span>
            </div>

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
        <Suspense fallback={<div>Loading sidebar...</div>}>
          <Sidebar data={data} />
        </Suspense>

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
            <Suspense fallback={<div style={{ padding: 20, color: '#94a3b8' }}>Loading...</div>}>
              {activeTab === 'map' && <MapView nodes={data.nodes} selectedNode={store.selectedNode} onNodeSelect={store.setSelectedNode} />}
              {activeTab === 'kpi' && <KPIPanel data={data} />}
              {activeTab === 'velocity' && <VelocityPanel data={data} />}
              {activeTab === 'eval' && <EvaluationPanel data={data} />}
              {activeTab === 'system' && <SystemMetrics data={data} />}
              {activeTab === 'performance' && <PerformancePanel data={data} />}
            </Suspense>
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  )
}
