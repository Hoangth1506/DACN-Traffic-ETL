// SystemMetrics.jsx — Tab 4: Data Quality + System Performance + Anomaly Alerts
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
  PieChart, Pie
} from 'recharts'
import { NODE_COLORS, NODE_LABEL } from '../hooks/useTrafficData'

export default function SystemMetrics({ data, quality, aggregates, nodeStates }) {
  const tooltipStyle = {
    contentStyle: { background:'rgba(13,20,36,0.95)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 },
    labelStyle: { color:'#94a3b8' },
  }

  // ── 1. Quality metrics ────────────────────────────────────────
  const qMetrics = quality ? [
    { name: 'Completeness', value: quality.completeness_score, pct: (quality.completeness_score*100).toFixed(1) },
    { name: 'Validity', value: quality.validity_score, pct: (quality.validity_score*100).toFixed(1) },
    { name: 'Consistency', value: quality.consistency_score, pct: (quality.consistency_score*100).toFixed(1) },
    { name: 'Timeliness', value: quality.timeliness_score, pct: (quality.timeliness_score*100).toFixed(1) },
    { name: 'Fusion Coverage', value: quality.fusion_coverage, pct: (quality.fusion_coverage*100).toFixed(1) },
    { name: 'No Conflict', value: 1 - quality.conflict_rate, pct: ((1-quality.conflict_rate)*100).toFixed(1) },
  ] : []

  // ── 2. Session type distribution ─────────────────────────────
  const sessionTypes = { manual_dispatch: 0, auto_cron: 0 }
  const sessionSet = {}
  data.forEach(r => {
    if (!r.session_id || sessionSet[r.session_id]) return
    sessionSet[r.session_id] = true
    if (r.session_id.includes('manual')) sessionTypes.manual_dispatch++
    else sessionTypes.auto_cron++
  })
  const sessionTypeData = [
    { name: 'Auto Cron', value: sessionTypes.auto_cron, fill: 'var(--accent)' },
    { name: 'Manual', value: sessionTypes.manual_dispatch, fill: 'var(--accent-purple)' },
  ]

  // ── 3. Fusion coverage per node ──────────────────────────────
  const fusionData = Object.entries(NODE_COLORS).map(([nid, color]) => {
    const nd = data.filter(r => r.node_id === nid)
    const matched = nd.filter(r => r.osm_matched).length
    return {
      node: NODE_LABEL[nid]?.slice(4) || nid,
      coverage: nd.length ? +(matched/nd.length*100).toFixed(1) : 0,
      fill: color,
    }
  })

  // ── Records per day ────────────────────────────────────────
  const byDate = {}
  data.forEach(r => {
    if (!r.date_str) return
    byDate[r.date_str] = (byDate[r.date_str] || 0) + 1
  })
  const recordsPerDay = Object.entries(byDate)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), count }))

  // ── Node stats table ─────────────────────────────────────
  const nodeStats = Object.entries(NODE_COLORS).map(([nid, color]) => {
    const nd = data.filter(r => r.node_id === nid)
    const matched = nd.filter(r => r.osm_matched).length
    const congested = nd.filter(r => r.is_congested).length
    const avgSpd = nd.length ? (nd.reduce((s,r)=>s+(r.current_speed||0),0)/nd.length).toFixed(1) : 'N/A'
    return { nid, color, count: nd.length, matched, congested, avgSpd }
  })

  // ── 4. Anomaly Detection Logic (Mới) ──────────────────────────────────
  const trafficAnomalies = useMemo(() => {
    return (data || [])
      .filter(r => r.speed_ratio != null && r.speed_ratio < 0.35 && r.is_congested)
      .map(r => ({
        id: `T-${r.session_id}-${r.sample_id}`,
        type: 'traffic',
        title: `Kẹt xe nghiêm trọng trên đường ${r.matched_road_name || r.node_name}`,
        desc: `Vận tốc thực tế giảm còn ${r.current_speed} km/h (Tốc độ tự do: ${r.free_flow_speed} km/h, Tỷ số: ${(r.speed_ratio*100).toFixed(0)}%)`,
        time: `${r.date_str} - ${r.time_slot === 'morning_peak' ? 'Cao điểm Sáng' : r.time_slot === 'midday_peak' ? 'Cao điểm Trưa' : 'Cao điểm Chiều'}`,
        severity: 'Critical',
        color: '#ef4444'
      }))
      .slice(0, 3)
  }, [data])

  const sensorAnomalies = useMemo(() => {
    return (data || [])
      .filter(r => r.confidence != null && r.confidence < 0.55)
      .map(r => {
        const nodeShort = r.node_id?.substring(0, 3) || 'N01';
        const segmentId = `${nodeShort}_S${String(r.sample_id || 0).padStart(2, '0')}`;
        return {
          id: `S-${r.session_id}-${r.sample_id}`,
          type: 'sensor',
          title: `Độ tin cậy phân đoạn đo ${segmentId} suy giảm`,
          desc: `Độ tin cậy định vị (Confidence) chỉ đạt ${(r.confidence*100).toFixed(1)}% (Dưới ngưỡng an toàn 55%)`,
          time: `${r.date_str} - Khung giờ ${r.hour_vn}h`,
          severity: 'Warning',
          color: '#f59e0b'
        }
      })
      .slice(0, 3)
  }, [data])

  const consensusAnomalies = useMemo(() => {
    return (nodeStates || [])
      .filter(ns => ns.camera_agreement_rate != null && ns.camera_agreement_rate < 0.75)
      .map(ns => ({
        id: `A-${ns.session_id}-${ns.node_id}`,
        type: 'consensus',
        title: `Xung đột dữ liệu / Bất đồng thuận tại ${ns.node_id?.replace(/_/g, ' ')}`,
        desc: `Tỉ lệ đồng thuận giữa 9 phân đoạn đo biên chỉ đạt ${(ns.camera_agreement_rate*100).toFixed(1)}%. Agent biên đã xử lý bằng hợp nhất có trọng số.`,
        time: `${ns.date_str} - Cao điểm ${ns.time_slot === 'morning_peak' ? 'Sáng' : ns.time_slot === 'midday_peak' ? 'Trưa' : 'Chiều'}`,
        severity: 'Inconsistency',
        color: '#8b5cf6'
      }))
      .slice(0, 3)
  }, [nodeStates])

  const allAlerts = useMemo(() => {
    return [...trafficAnomalies, ...sensorAnomalies, ...consensusAnomalies]
  }, [trafficAnomalies, sensorAnomalies, consensusAnomalies])

  return (
    <div className="fade-in">
      {/* Quality Score Header */}
      {quality && (
        <div className="card mb-12" style={{ background: 'var(--gradient-card)', borderColor: 'var(--border-accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Overall Quality Score</div>
              <div style={{ fontSize: 48, fontWeight: 800, background: 'var(--gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
                {(quality.overall_score * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              {qMetrics.map(m => (
                <div key={m.name} className="quality-row">
                  <div className="quality-name">{m.name}</div>
                  <div className="quality-bar-bg">
                    <div className="quality-bar-fill" style={{ width: `${m.value*100}%` }} />
                  </div>
                  <div className="quality-pct">{m.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Session type + Fusion coverage */}
      <div className="grid-2 mb-12">
        <div className="card">
          <div className="card-title">Loai Session Thu thap</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sessionTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent*100).toFixed(0)}%)`}
                labelLine fontSize={10}>
                {sessionTypeData.map((d,i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">OSM Fusion Coverage theo Node</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={fusionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="node" tick={{ fill:'#64748b', fontSize:10 }} />
              <YAxis domain={[0,100]} tick={{ fill:'#64748b', fontSize:10 }} unit="%" />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, 'Coverage']} />
              <Bar dataKey="coverage" name="OSM Match %" radius={[4,4,0,0]}>
                {fusionData.map((d,i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Records per day + Node table */}
      <div className="grid-2 mb-12">
        <div className="card">
          <div className="card-title">Records thu thap theo Ngay</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={recordsPerDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill:'#64748b', fontSize:9 }} interval={1} />
              <YAxis tick={{ fill:'#64748b', fontSize:10 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="var(--accent)" name="Records" radius={[3,3,0,0]}
                opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Thong ke theo Node</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '4px 8px', textAlign:'left', fontWeight:600 }}>Node</th>
                <th style={{ padding: '4px 6px', textAlign:'right' }}>Records</th>
                <th style={{ padding: '4px 6px', textAlign:'right' }}>OSM</th>
                <th style={{ padding: '4px 6px', textAlign:'right' }}>Tac</th>
                <th style={{ padding: '4px 6px', textAlign:'right' }}>Avg Speed</th>
              </tr>
            </thead>
            <tbody>
              {nodeStats.map(n => (
                <tr key={n.nid} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding:'6px 8px', color: n.color, fontWeight: 600 }}>
                    {n.nid.replace(/_/g,' ').replace('N0','N')}
                  </td>
                  <td style={{ padding:'6px 6px', textAlign:'right', color:'var(--text-secondary)' }}>{n.count}</td>
                  <td style={{ padding:'6px 6px', textAlign:'right', color:'var(--accent-green)' }}>
                    {n.count ? (n.matched/n.count*100).toFixed(0)+'%' : '-'}
                  </td>
                  <td style={{ padding:'6px 6px', textAlign:'right', color:'var(--los-d)' }}>
                    {n.count ? (n.congested/n.count*100).toFixed(0)+'%' : '-'}
                  </td>
                  <td style={{ padding:'6px 6px', textAlign:'right', color: n.color, fontWeight:600 }}>
                    {n.avgSpd} km/h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Issues list */}
          {quality?.issues?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Issues detected:</div>
              {quality.issues.slice(0,3).map((issue, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--los-d)', marginBottom: 3, padding: '3px 8px', background: 'rgba(249,115,22,0.08)', borderRadius: 4 }}>
                  • {issue}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NEW FEATURE: HỆ THỐNG PHÁT HIỆN DỊ THƯỜNG & CONSENSUS ALERTS */}
      <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⚠️</span>
            <span>HỆ THỐNG GIÁM SÁT DỊ THƯỜNG & CẢNH BÁO SỰ CỐ (AGENT CONSENSUS ALERTS)</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            Đang quét {data.length} điểm đo & {nodeStates?.length || 0} trạng thái hợp nhất
          </div>
        </div>

        {allAlerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allAlerts.map(alert => (
              <div key={alert.id} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: alert.color,
                    boxShadow: `0 0 8px ${alert.color}`
                  }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{alert.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{alert.desc}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: alert.color,
                    background: `${alert.color}15`,
                    padding: '2px 8px',
                    borderRadius: 4,
                    display: 'inline-block'
                  }}>
                    {alert.severity.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>{alert.time}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center', fontSize: 11 }}>
            ✅ Không phát hiện dị thường nào trong hệ thống. Tất cả phân đoạn đo và luồng xe hoạt động tốt.
          </div>
        )}
      </div>

    </div>
  )
}
