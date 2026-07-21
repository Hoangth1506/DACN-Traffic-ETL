// App.jsx — Root component voi 6 tabs + sidebar
import { useState } from 'react'
import { useTrafficData } from './hooks/useTrafficData'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import KPIPanel from './components/KPIPanel'
import VelocityPanel from './components/VelocityPanel'
import SystemMetrics from './components/SystemMetrics'
import PerformancePanel from './components/PerformancePanel'
import EvaluationPanel from './components/EvaluationPanel'

const TABS = [
  { id: 'map',         label: 'Bản đồ Giao thông', icon: '🗺' },
  { id: 'kpi',         label: 'Biểu đồ Vận tốc',   icon: '📊' },
  { id: 'velocity',    label: 'Biểu đồ Theo ngày', icon: '📈' },
  { id: 'system',      label: 'Độ tin cậy Dữ liệu', icon: '🛡' },
  { id: 'eval',        label: 'Đánh giá Sai số',   icon: '🎯' },
  { id: 'performance', label: 'Hiệu năng Hệ thống',icon: '⚙️' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('map')
  const {
    filtered, aggregates, quality, loading,
    filters, setFilters, resetFilters,
    cameraRecords, nodeStates, perfMetrics,
    allNodeStates, allData,
  } = useTrafficData()

  if (loading) {
    return (
      <div style={{ display:'flex', gap:16, alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column' }}>
        <div style={{ width:48, height:48, border:'3px solid rgba(56,189,248,0.2)', borderTop:'3px solid #38bdf8', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <div style={{ color:'var(--text-muted)', fontSize:14 }}>Đang tải dữ liệu giao thông...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const totalAll = aggregates
    ? Object.values(aggregates.by_node || {}).reduce((s, n) => s + n.records, 0)
    : 0

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo-badge">
          <div className="logo-dot" />
          <div>
            <div className="header-title">Giám sát Giao thông TP.HCM</div>
            <div className="header-sub">Kiến trúc Node-Agent-Edge · ĐACN 2026</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:12, marginLeft:'auto', alignItems:'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 20,
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
            fontSize: 12, fontWeight: 700, color: '#22c55e',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span>REALTIME STREAM (2 PHÚT/LẦN)</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Quận 10 & Tân Bình · 10 Node Agents
          </div>
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          aggregates={aggregates}
          totalShown={filtered.length}
        />

        <div className="main-content">
          <div className="tab-bar">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="tab-content">
            {activeTab === 'map'         && <MapView data={filtered} nodeStates={nodeStates} cameraRecords={cameraRecords} filters={filters} />}
            {activeTab === 'kpi'         && <KPIPanel data={filtered} aggregates={aggregates} quality={quality} />}
            {activeTab === 'velocity'    && <VelocityPanel data={filtered} aggregates={aggregates} nodeStates={allNodeStates} />}
            {activeTab === 'eval'        && <EvaluationPanel perf={perfMetrics} quality={quality} nodeStates={nodeStates} />}
            {activeTab === 'system'      && <SystemMetrics data={allData} quality={quality} aggregates={aggregates} nodeStates={allNodeStates} />}
            {activeTab === 'performance' && <PerformancePanel perf={perfMetrics} nodeStates={allNodeStates} />}
          </div>
        </div>
      </div>
    </div>
  )
}
