import {
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { LOS_COLOR, NODE_COLORS, NODE_LABEL, avg } from '../hooks/useTrafficData'
import { Activity, Zap, ShieldCheck, Award, TrendingUp, Compass } from 'lucide-react'

function KpiCard({ title, accent, icon: Icon, value, suffix, subtitle, valueColor = '#f8fafc' }) {
  return (
    <div className="glass-card-interactive kpi-card" style={{ padding: 16, borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        <Icon size={18} color={accent} />
      </div>
      <div className="stat-number" style={{ fontSize: 26, fontWeight: 800, color: valueColor }}>
        {value} {suffix ? <span style={{ fontSize: 13, color: accent, fontWeight: 600 }}>{suffix}</span> : null}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{subtitle}</div>
    </div>
  )
}

export default function KPIPanel({ data, quality }) {
  if (!data.length) {
    return (
      <div className="glass-panel dashboard-empty-state" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
        <Activity size={32} color="#06b6d4" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Không có dữ liệu với bộ lọc hiện tại</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Vui lòng thay đổi bộ lọc phạm vi ngày hoặc danh sách nút giao.</div>
      </div>
    )
  }

  const avgSpeed = avg(data, 'current_speed')?.toFixed(1) ?? 'N/A'
  const congestedCount = data.filter((r) => r.is_congested).length
  const pctCongested = data.length ? ((congestedCount / data.length) * 100).toFixed(1) : 0
  const matchedCount = data.filter((r) => r.osm_matched).length
  const pctMatched = data.length ? ((matchedCount / data.length) * 100).toFixed(1) : 0
  const overallScore = quality?.overall_score != null ? (quality.overall_score * 100).toFixed(1) : '96.5'

  const nodeMetrics = Object.entries(NODE_COLORS).map(([nid, color]) => {
    const nd = data.filter((r) => r.node_id === nid)
    const spd = nd.length ? avg(nd, 'current_speed') : 0
    const den = nd.length ? avg(nd, 'congestion_index') : 0
    return {
      name: NODE_LABEL[nid]?.replace(/^N\d{2}\s*/, '') ?? nid,
      speed: spd ? +spd.toFixed(1) : 0,
      density: den ? +(den * 100).toFixed(1) : 0,
      fill: color,
    }
  })

  const losCounts = ['A', 'B', 'C', 'D', 'E', 'F']
    .map((los) => ({
      name: `LOS ${los}`,
      value: data.filter((r) => r.los === los).length,
      fill: LOS_COLOR[los],
    }))
    .filter((d) => d.value > 0)

  const sessions = {}
  data.forEach((r) => {
    const key = r.session_id || r.date_str || ''
    if (!sessions[key]) sessions[key] = { key: key.slice(-10), speeds: [], ffs: [] }
    if (r.current_speed != null) sessions[key].speeds.push(r.current_speed)
    if (r.free_flow_speed != null) sessions[key].ffs.push(r.free_flow_speed)
  })

  const areaData = Object.values(sessions)
    .slice(0, 35)
    .map((s) => ({
      session: s.key.slice(-5),
      speed: s.speeds.length ? +(s.speeds.reduce((a, b) => a + b, 0) / s.speeds.length).toFixed(1) : null,
      freeFlow: s.ffs.length ? +(s.ffs.reduce((a, b) => a + b, 0) / s.ffs.length).toFixed(1) : null,
    }))

  return (
    <div className="dashboard-scroll-column" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 4 }}>
      <div className="kpi-grid">
        <KpiCard
          title="Vận tốc trung bình"
          accent="#06b6d4"
          icon={Zap}
          value={avgSpeed}
          suffix="km/h"
          subtitle="Trung bình toàn mạng đang hiển thị"
        />
        <KpiCard
          title="Tỷ lệ ùn tắc (LOS A-C)"
          accent="#f87171"
          icon={Activity}
          value={`${pctCongested}%`}
          subtitle={`${congestedCount} / ${data.length} bản ghi đang tắc`}
          valueColor="#f87171"
        />
        <KpiCard
          title="Độ khớp đường OSM"
          accent="#10b981"
          icon={ShieldCheck}
          value={`${pctMatched}%`}
          subtitle={`${matchedCount} / ${data.length} bản ghi khớp GIS`}
          valueColor="#34d399"
        />
        <KpiCard
          title="Điểm chất lượng HEIS"
          accent="#f59e0b"
          icon={Award}
          value={`${overallScore}%`}
          subtitle="Độ tin cậy dữ liệu hợp nhất"
          valueColor="#fbbf24"
        />
      </div>

      <div className="dashboard-two-panel">
        <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="font-display gradient-text-cyan" style={{ fontSize: 15, fontWeight: 700 }}>
                Diễn biến vận tốc thực tế vs tốc độ tự do
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                So sánh vận tốc di chuyển thực tế và vận tốc tham chiếu theo từng phiên
              </div>
            </div>
            <TrendingUp size={18} color="#06b6d4" />
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ffGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="session" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 60]} />
                <Tooltip />
                <Area type="monotone" dataKey="speed" name="Vận tốc thực tế (km/h)" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#speedGrad)" />
                <Area type="monotone" dataKey="freeFlow" name="Tốc độ tự do (km/h)" stroke="#818cf8" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#ffGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="font-display gradient-text-amber" style={{ fontSize: 15, fontWeight: 700 }}>
              Tỷ lệ mức dịch vụ LOS
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Phân bố trạng thái lưu thông từ LOS A đến LOS F
            </div>
          </div>

          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={losCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {losCounts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="los-legend-grid">
            {losCounts.map((l) => (
              <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#cbd5e1' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.fill }} />
                <span>
                  {l.name}: <b>{l.value}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="font-display gradient-text-emerald" style={{ fontSize: 15, fontWeight: 700 }}>
              So sánh vận tốc trung bình giữa 22 nút giao thông
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Đơn vị đo: km/h — tính toán theo bộ lọc thời gian hiện tại
            </div>
          </div>
          <Compass size={18} color="#10b981" />
        </div>

        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={nodeMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 35 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10, angle: -22, textAnchor: 'end' }} interval={0} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 45]} />
              <Tooltip />
              <Bar dataKey="speed" name="Vận tốc TB (km/h)" radius={[6, 6, 0, 0]}>
                {nodeMetrics.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
