// KPIPanel.jsx — Tab 2: KPI Cards + Charts
import {
  RadialBarChart, RadialBar, Legend, Tooltip,
  PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer
} from 'recharts'
import { LOS_COLOR, NODE_COLORS, NODE_LABEL, SLOT_LABEL, avg } from '../hooks/useTrafficData'

const SLOT_ORDER = ['morning_peak', 'midday_peak', 'evening_peak', 'off_peak']

export default function KPIPanel({ data, aggregates, quality }) {
  if (!data.length) return <div style={{ color: 'var(--text-muted)', padding: 24 }}>Không có dữ liệu với bộ lọc hiện tại.</div>

  // ── KPI metrics ──────────────────────────────────────────
  const avgSpeed = avg(data, 'current_speed')?.toFixed(1) ?? 'N/A'
  const pctCongested = data.length ? ((data.filter(r => r.is_congested).length / data.length) * 100).toFixed(1) : 0
  const pctMatched = data.length ? ((data.filter(r => r.osm_matched).length / data.length) * 100).toFixed(1) : 0
  const overallScore = quality?.overall_score != null ? (quality.overall_score * 100).toFixed(1) : 'N/A'

  // ── Radial bar per node ──────────────────────────────────
  const nodeAvgs = Object.entries(NODE_COLORS).map(([nid, color]) => {
    const nd = data.filter(r => r.node_id === nid)
    const spd = nd.length ? avg(nd, 'current_speed') : 0
    return { name: NODE_LABEL[nid]?.slice(4) ?? nid, value: spd?.toFixed(1) ?? 0, fill: color }
  })

  // ── Trung bình Tốc độ & Mật độ theo từng Node chính ──────────────────
  const nodeMetrics = Object.entries(NODE_COLORS).map(([nid, color]) => {
    const nd = data.filter(r => r.node_id === nid)
    const spd = nd.length ? avg(nd, 'current_speed') : 0
    const den = nd.length ? avg(nd, 'congestion_index') : 0
    return {
      name: NODE_LABEL[nid]?.replace('N01 ', '').replace('N02 ', '').replace('N03 ', '') ?? nid,
      speed: spd ? +spd.toFixed(1) : 0,
      density: den ? +(den * 100).toFixed(1) : 0,
      fill: color
    }
  })

  // ── LOS Pie ──────────────────────────────────────────────
  const losCounts = ['A','B','C','D','E','F'].map(los => ({
    name: los,
    value: data.filter(r => r.los === los).length,
    fill: LOS_COLOR[los],
  })).filter(d => d.value > 0)

  // ── Speed by date (line) ─────────────────────────────────
  const byDate = {}
  data.forEach(r => {
    if (!r.date_str) return
    if (!byDate[r.date_str]) byDate[r.date_str] = { date: r.date_str.slice(5) }
    Object.entries(NODE_COLORS).forEach(([nid]) => {
      if (!byDate[r.date_str][nid]) byDate[r.date_str][nid] = []
      if (r.node_id === nid && r.current_speed != null) byDate[r.date_str][nid].push(r.current_speed)
    })
  })
  const dateData = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => {
      const out = { date: row.date }
      Object.keys(NODE_COLORS).forEach(nid => {
        const arr = row[nid] || []
        out[nid] = arr.length ? +(arr.reduce((s,v)=>s+v,0)/arr.length).toFixed(1) : null
      })
      return out
    })

  // ── Speed vs FreeFlow area ───────────────────────────────
  const sessions = {}
  data.forEach(r => {
    const key = (r.session_id || r.date_str || '')
    if (!sessions[key]) sessions[key] = { key: key.slice(-10), speeds: [], ffs: [] }
    if (r.current_speed != null) sessions[key].speeds.push(r.current_speed)
    if (r.free_flow_speed != null) sessions[key].ffs.push(r.free_flow_speed)
  })
  const areaData = Object.values(sessions)
    .slice(0, 40)
    .map(s => ({
      session: s.key.slice(-6),
      speed: s.speeds.length ? +(s.speeds.reduce((a,b)=>a+b,0)/s.speeds.length).toFixed(1) : null,
      freeFlow: s.ffs.length ? +(s.ffs.reduce((a,b)=>a+b,0)/s.ffs.length).toFixed(1) : null,
    }))

  // ── Speed by slot×node bar ───────────────────────────────
  const slotNodeData = SLOT_ORDER.map(slot => {
    const row = { slot: SLOT_LABEL[slot]?.split(' ')[0] || slot }
    Object.keys(NODE_COLORS).forEach(nid => {
      const nd = data.filter(r => r.node_id === nid && r.time_slot === slot)
      row[nid] = nd.length ? +(avg(nd,'current_speed')).toFixed(1) : 0
    })
    return row
  })

  const tooltipStyle = {
    contentStyle: { background: 'rgba(13,20,36,0.95)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 },
    labelStyle: { color: '#94a3b8' }, itemStyle: { color: '#38bdf8' },
  }

  return (
    <div className="fade-in">
      {/* KPI row replaced by Node-level Speed & Density Bar Charts by user request */}
      <div className="grid-2 mb-12">
        <div className="card">
          <div className="card-title">Tốc độ TB theo Node giao thông (km/h)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={nodeMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis domain={[0, 45]} tick={{ fill: '#64748b', fontSize: 10 }} unit=" km/h" />
              <Tooltip formatter={(v) => [`${v} km/h`, 'Tốc độ TB']} {...tooltipStyle} />
              <Bar dataKey="speed" radius={[4, 4, 0, 0]} maxBarSize={45}>
                {nodeMetrics.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Mật độ TB theo Node giao thông (%)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={nodeMetrics} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, 'Mật độ TB']} {...tooltipStyle} />
              <Bar dataKey="density" radius={[4, 4, 0, 0]} maxBarSize={45}>
                {nodeMetrics.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 1: LOS Distribution Chart */}
      <div className="card mb-12">
        <div className="card-title" style={{ textAlign: 'center' }}>Phân bố LOS (Toàn hệ thống)</div>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={losCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
              {losCounts.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [v + ' records', 'LOS ' + name]} {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Row 2: Line chart theo ngay (Commented out by user request) */}
      {/*
      <div className="card mb-12">
        <div className="card-title">Toc do TB theo ngay — 3 nodes</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dateData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis domain={[0, 60]} tick={{ fill: '#64748b', fontSize: 10 }} unit=" km/h" />
            <Tooltip {...tooltipStyle} />
            {Object.entries(NODE_COLORS).map(([nid, color]) => (
              <Line key={nid} type="monotone" dataKey={nid} stroke={color} strokeWidth={2} dot={false}
                name={NODE_LABEL[nid]?.slice(4)} connectNulls />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(val) => NODE_LABEL[val]?.slice(4) || val} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      */}

      {/* Row 3: Area + Bar (Commented out by user request) */}
      {/*
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Speed vs FreeFlow theo Session</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={areaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="session" tick={{ fill: '#64748b', fontSize: 9 }} />
              <YAxis domain={[0, 70]} tick={{ fill: '#64748b', fontSize: 10 }} unit=" km/h" />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="freeFlow" stroke="#38bdf8" fill="rgba(56,189,248,0.12)" name="Free Flow" strokeWidth={1.5} />
              <Area type="monotone" dataKey="speed" stroke="#f97316" fill="rgba(249,115,22,0.18)" name="Current Speed" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Speed theo Khung gio × Node</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={slotNodeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="slot" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis domain={[0, 60]} tick={{ fill: '#64748b', fontSize: 10 }} unit=" km/h" />
              <Tooltip {...tooltipStyle} />
              {Object.entries(NODE_COLORS).map(([nid, color]) => (
                <Bar key={nid} dataKey={nid} fill={color} name={NODE_LABEL[nid]?.slice(4)} radius={[3,3,0,0]} maxBarSize={28} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(val) => NODE_LABEL[val]?.slice(4) || val} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      */}
    </div>
  )
}

function KPICard({ label, value, unit, sub, color = 'var(--accent)' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize: 26, background: 'none', WebkitTextFillColor: color }}>
        {value} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>{unit}</span>
      </div>
      <div className="kpi-sub">{sub}</div>
    </div>
  )
}
