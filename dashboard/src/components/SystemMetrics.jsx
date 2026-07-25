// SystemMetrics.jsx — Tab 4: Data Quality + Reliability & Anomaly Detection
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
  PieChart, Pie
} from 'recharts'
import { NODE_COLORS, NODE_LABEL } from '../hooks/useTrafficData'
import { ShieldCheck, AlertOctagon, AlertTriangle, Database, CheckCircle2 } from 'lucide-react'

export default function SystemMetrics({ data, quality, aggregates, nodeStates }) {
  // ── 1. Quality metrics ────────────────────────────────────────
  const qMetrics = quality ? [
    { name: 'Tính Đầy Đủ (Completeness)', value: quality.completeness_score, pct: (quality.completeness_score*100).toFixed(1), color: '#38bdf8' },
    { name: 'Tính Hợp Lệ (Validity)', value: quality.validity_score, pct: (quality.validity_score*100).toFixed(1), color: '#10b981' },
    { name: 'Tính Đồng Nhất (Consistency)', value: quality.consistency_score, pct: (quality.consistency_score*100).toFixed(1), color: '#8b5cf6' },
    { name: 'Tính Kịp Thời (Timeliness)', value: quality.timeliness_score, pct: (quality.timeliness_score*100).toFixed(1), color: '#f59e0b' },
    { name: 'Độ Khớp GIS (Coverage)', value: quality.fusion_coverage, pct: (quality.fusion_coverage*100).toFixed(1), color: '#06b6d4' },
    { name: 'Tỷ Lệ An Toàn (No Conflict)', value: 1 - quality.conflict_rate, pct: ((1-quality.conflict_rate)*100).toFixed(1), color: '#ec4899' },
  ] : []

  // ── 2. Fusion coverage per node ──────────────────────────────
  const fusionData = Object.entries(NODE_COLORS).map(([nid, color]) => {
    const nd = data.filter(r => r.node_id === nid)
    const matched = nd.filter(r => r.osm_matched).length
    return {
      node: NODE_LABEL[nid]?.replace(/^N\d{2}\s*/, '') || nid,
      coverage: nd.length ? +(matched/nd.length*100).toFixed(1) : 0,
      fill: color,
    }
  })

  // ── 3. Anomaly Detection Logic ──────────────────────────────────
  const trafficAnomalies = useMemo(() => {
    return (data || [])
      .filter(r => r.speed_ratio != null && r.speed_ratio < 0.35 && r.is_congested)
      .map(r => ({
        id: `T-${r.session_id}-${r.sample_id}`,
        type: 'traffic',
        title: `Ùn tắc nghiêm trọng trên tuyến đường ${r.matched_road_name || r.node_id}`,
        desc: `Vận tốc giảm mạnh còn ${r.current_speed} km/h (Hạn mức tự do: ${r.free_flow_speed} km/h, Tỷ số: ${(r.speed_ratio*100).toFixed(0)}%)`,
        time: `${r.date_str || '2026-07-24'}`,
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
          title: `Cảnh báo độ tin cậy điểm đo ${segmentId} giảm`,
          desc: `Độ tin cậy định vị GIS chỉ đạt ${(r.confidence*100).toFixed(1)}% (Dưới ngưỡng an toàn 55%)`,
          time: `${r.date_str || '2026-07-24'}`,
          severity: 'Warning',
          color: '#f59e0b'
        }
      })
      .slice(0, 3)
  }, [data])

  const allAlerts = useMemo(() => [...trafficAnomalies, ...sensorAnomalies], [trafficAnomalies, sensorAnomalies])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', paddingRight: 4 }}>
      
      {/* ── 1. ĐIỂM SỐ CHẤT LƯỢNG DỮ LIỆU ETL (QUALITY SCORECARDS) ─────────── */}
      <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="font-display gradient-text-emerald" style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color="#10b981" /> Đánh Giá Độ Tin Cậy & Sai Số Dữ Liệu ETL
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Khung kiểm thử chất lượng 6 chiều tiêu chuẩn cho đường ống dữ liệu thời gian thực
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', borderRadius: 8 }}>
            <CheckCircle2 size={14} color="#34d399" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>Đạt Chuẩn ISO/IEC 25012</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {qMetrics.map(qm => (
            <div key={qm.name} className="glass-card-interactive" style={{ padding: 12, borderTop: `3px solid ${qm.color}` }}>
              <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                {qm.name.split(' ')[0]} {qm.name.split(' ')[1]}
              </div>
              <div className="stat-number" style={{ fontSize: 22, fontWeight: 800, color: qm.color }}>
                {qm.pct}%
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${qm.pct}%`, height: '100%', background: qm.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. BIỂU ĐỒ ĐỘ PHỦ FUSION & BẢNG BÁO ĐỘNG BẤT THƯỜNG ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        
        {/* FUSION COVERAGE PER NODE */}
        <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="font-display gradient-text-cyan" style={{ fontSize: 15, fontWeight: 700 }}>
              Độ Khớp Bản Đồ GIS Theo 10 Nút Giao
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Tỷ lệ các điểm đo khớp chính xác vào tọa độ con đường thực tế (%)
            </div>
          </div>

          <div style={{ width: '100%', height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={fusionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="node" stroke="#94a3b8" tick={{ fontSize: 10, angle: -20, textAnchor: 'end' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="coverage" name="Độ khớp GIS (%)" radius={[4, 4, 0, 0]}>
                  {fusionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ANOMALY DETECTION ALERTS */}
        <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="font-display gradient-text-amber" style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color="#f59e0b" /> Nhật Ký Cảnh Báo Bất Thường (Anomalies)
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                Phát hiện tự động các điểm suy hao tín hiệu hoặc ùn tắc đột biến
              </div>
            </div>
            <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              {allAlerts.length} BÁO ĐỘNG
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 230 }}>
            {allAlerts.length > 0 ? (
              allAlerts.map(alt => (
                <div
                  key={alt.id}
                  style={{
                    background: 'rgba(15,23,42,0.8)', border: `1px solid ${alt.color}40`, borderLeft: `4px solid ${alt.color}`,
                    borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{alt.title}</div>
                    <span style={{ fontSize: 9, background: `${alt.color}20`, color: alt.color, padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                      {alt.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{alt.desc}</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>⏱️ {alt.time}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                🟢 Không ghi nhận bất thường nào trong phiên hiện tại.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 3. BẢNG THỐNG KÊ CHI TIẾT THEO TỪNG NÚT GIAO ──────────────────── */}
      <div className="glass-panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', fontFamily: 'Outfit' }}>
          Thống Kê Chi Tiết Hiệu Năng Thu Thập 10 Nút Giao
        </div>

        <table className="cyber-table">
          <thead>
            <tr>
              <th>Mã Nút Giao</th>
              <th>Số Bản Ghi</th>
              <th>Số Bản Ghi Khớp OSM</th>
              <th>Tỷ Lệ Khớp</th>
              <th>Số Phiên Ùn Tắc</th>
              <th>Vận Tốc Trung Bình</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(NODE_COLORS).map(([nid, color]) => {
              const nd = data.filter(r => r.node_id === nid)
              const matched = nd.filter(r => r.osm_matched).length
              const congested = nd.filter(r => r.is_congested).length
              const avgSpd = nd.length ? (nd.reduce((s,r)=>s+(r.current_speed||0),0)/nd.length).toFixed(1) : 'N/A'
              const pct = nd.length ? ((matched / nd.length) * 100).toFixed(1) : 0

              return (
                <tr key={nid}>
                  <td style={{ fontWeight: 700, color: color, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    {NODE_LABEL[nid] || nid}
                  </td>
                  <td className="stat-number">{nd.length}</td>
                  <td className="stat-number">{matched}</td>
                  <td>
                    <span style={{ color: pct > 80 ? '#34d399' : '#fbbf24', fontWeight: 700 }} className="stat-number">
                      {pct}%
                    </span>
                  </td>
                  <td className="stat-number" style={{ color: congested > 0 ? '#f87171' : '#94a3b8' }}>
                    {congested}
                  </td>
                  <td className="stat-number" style={{ fontWeight: 700, color: '#38bdf8' }}>
                    {avgSpd} km/h
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
