// VelocityPanel.jsx — Tab 3: Velocity & Density Analyst (Advanced Chart & Prediction)
import { useState, useMemo } from 'react'
import {
  ComposedChart, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { NODE_LABEL, SLOT_LABEL } from '../hooks/useTrafficData'

export default function VelocityPanel({ nodeStates }) {
  const [selectedNode, setSelectedNode] = useState('N01_LY_THUONG_KIET')
  const [selectedSlot, setSelectedSlot] = useState('morning_peak') // Mặc định là khung giờ Sáng
  const [viewMode, setViewMode] = useState('day') // 'day', 'month', 'dayofweek', 'session'

  // Trạng thái cho bộ dự báo (Predictor State)
  const [predNode, setPredNode] = useState('N01_LY_THUONG_KIET')
  const [predDay, setPredDay] = useState(1) // 1 = Thứ Hai
  const [predSlot, setPredSlot] = useState('morning_peak') // morning_peak

  const dayOfWeekLabels = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

  // ── 1. Tính toán dữ liệu cho Biểu đồ ─────────────────────────────────────────
  const chartData = useMemo(() => {
    let list = nodeStates || []
    if (selectedNode && selectedNode !== 'ALL') {
      list = list.filter(ns => ns.node_id === selectedNode)
    }
    if (selectedSlot && selectedSlot !== 'ALL') {
      list = list.filter(ns => ns.time_slot === selectedSlot)
    }

    // A. Chế độ xem theo Phiên liên tục (Session Timeline)
    if (viewMode === 'session') {
      const sessionGroups = {}
      list.forEach(ns => {
        if (!ns.session_id) return
        if (!sessionGroups[ns.session_id]) {
          sessionGroups[ns.session_id] = { velocities: [], densities: [], date_str: ns.date_str, time_slot: ns.time_slot }
        }
        if (ns.fused_velocity != null) sessionGroups[ns.session_id].velocities.push(ns.fused_velocity)
        if (ns.fused_density != null) sessionGroups[ns.session_id].densities.push(ns.fused_density)
      })

      const slotLabels = { morning_peak: 'Sáng', midday_peak: 'Trưa', evening_peak: 'Chiều', off_peak: 'Ngoại' }

      return Object.entries(sessionGroups)
        .map(([session_id, agg]) => {
          const avgSpeed = agg.velocities.length ? agg.velocities.reduce((s, v) => s + v, 0) / agg.velocities.length : null
          const avgDensity = agg.densities.length ? agg.densities.reduce((s, v) => s + v, 0) / agg.densities.length : null
          const dateLabel = agg.date_str ? agg.date_str.slice(5) : '' // MM-DD
          const slotLabel = slotLabels[agg.time_slot] || agg.time_slot
          return {
            key: session_id,
            label: `${dateLabel} ${slotLabel}`,
            speed: avgSpeed != null ? +avgSpeed.toFixed(1) : null,
            density: avgDensity != null ? +(avgDensity * 100).toFixed(1) : null,
          }
        })
        .sort((a, b) => a.key.localeCompare(b.key))
    }

    // B. Chế độ gom nhóm (Ngày, Tháng, Thứ)
    const groups = {}
    list.forEach(ns => {
      if (!ns.date_str) return
      let groupKey = ns.date_str
      if (viewMode === 'month') {
        groupKey = ns.date_str.slice(0, 7) // YYYY-MM
      } else if (viewMode === 'dayofweek') {
        const d = new Date(ns.date_str)
        groupKey = d.getDay().toString() // "0"-"6"
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { velocities: [], densities: [] }
      }
      if (ns.fused_velocity != null) groups[groupKey].velocities.push(ns.fused_velocity)
      if (ns.fused_density != null) groups[groupKey].densities.push(ns.fused_density)
    })

    return Object.entries(groups)
      .map(([key, agg]) => {
        const avgSpeed = agg.velocities.length 
          ? agg.velocities.reduce((s, v) => s + v, 0) / agg.velocities.length 
          : null
        const avgDensity = agg.densities.length 
          ? agg.densities.reduce((s, v) => s + v, 0) / agg.densities.length 
          : null
        
        let label = key
        if (viewMode === 'month') {
          const parts = key.split('-')
          label = `Tháng ${parts[1]}/${parts[0]}`
        } else if (viewMode === 'dayofweek') {
          label = dayOfWeekLabels[parseInt(key)]
        } else {
          label = key.slice(5) // MM-DD
        }
        
        return {
          key,
          label,
          speed: avgSpeed != null ? +avgSpeed.toFixed(1) : null,
          density: avgDensity != null ? +(avgDensity * 100).toFixed(1) : null,
        }
      })
      .sort((a, b) => {
        if (viewMode === 'dayofweek') {
          const order = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '0': 7 }
          return order[a.key] - order[b.key]
        }
        return a.key.localeCompare(b.key)
      })
  }, [nodeStates, selectedNode, selectedSlot, viewMode])

  // ── 2. Xử lý logic dự đoán (Predictor Logic) ───────────────────────────────
  const predictionResult = useMemo(() => {
    let list = nodeStates || []
    
    // Lọc theo Nút
    if (predNode && predNode !== 'ALL') {
      list = list.filter(ns => ns.node_id === predNode)
    }
    // Lọc theo Khung giờ
    if (predSlot) {
      list = list.filter(ns => ns.time_slot === predSlot)
    }
    // Lọc theo Thứ
    list = list.filter(ns => {
      if (!ns.date_str) return false
      const d = new Date(ns.date_str)
      return d.getDay() === predDay
    })

    if (!list.length) {
      return { status: 'no_data' }
    }

    const speeds = list.map(ns => ns.fused_velocity).filter(v => v != null)
    const densities = list.map(ns => ns.fused_density).filter(v => v != null)

    const avgSpeed = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 25.0
    const avgDensity = densities.length ? densities.reduce((s, v) => s + v, 0) / densities.length : 0.35

    // Xác định mức độ ùn tắc dự kiến (đã hoán vị ngược lại theo yêu cầu của user)
    let level = 'F'
    let color = '#22c55e'
    let levelText = 'Thông thoáng (F)'
    let risk = 'THẤP'
    let advice = 'Giao thông thuận tiện, thời gian di chuyển tối ưu. Lộ trình lý tưởng.'

    if (avgSpeed < 7) {
      level = 'A'
      color = '#7f1d1d'
      levelText = 'Nghiêm trọng (A)'
      risk = 'CỰC KỲ CAO'
      advice = 'Ùn tắc nghiêm trọng kéo dài! Khuyến nghị tránh tuyến đường này hoàn toàn.'
    } else if (avgSpeed < 13) {
      level = 'B'
      color = '#ef4444'
      levelText = 'Tắc nghẽn (B)'
      risk = 'RẤT CAO'
      advice = 'Mật độ xe cực kỳ đông, di chuyển rất chậm. Hãy chọn hướng đi thay thế.'
    } else if (avgSpeed < 20) {
      level = 'C'
      color = '#f97316'
      levelText = 'Gần tắc (C)'
      risk = 'TRUNG BÌNH CAO'
      advice = 'Giao thông bắt đầu ùn ứ, vận tốc chậm. Khuyên bạn nên chuẩn bị lộ trình dự phòng.'
    } else if (avgSpeed < 30) {
      level = 'D'
      color = '#facc15'
      levelText = 'Trung bình (D)'
      risk = 'TRUNG BÌNH'
      advice = 'Lưu lượng xe ở mức trung bình, di chuyển ổn định nhưng cần giữ khoảng cách an toàn.'
    } else if (avgSpeed < 35) {
      level = 'E'
      color = '#86efac'
      levelText = 'Ổn định (E)'
      risk = 'THẤP'
      advice = 'Dòng xe di chuyển trôi chảy, vận tốc khá tốt.'
    }

    return {
      status: 'ok',
      speed: avgSpeed,
      density: avgDensity * 100,
      level,
      color,
      levelText,
      risk,
      advice,
      sampleSize: list.length
    }
  }, [nodeStates, predNode, predDay, predSlot])

  const tooltipStyle = {
    contentStyle: { background: 'rgba(13,20,36,0.95)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 },
    labelStyle: { color: '#94a3b8' },
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* KHU VỰC BỘ LỌC BIỂU ĐỒ */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>CHỌN NODE CHÍNH:</div>
            <select 
              className="select-field" 
              style={{ minWidth: 200, padding: '6px 12px', fontSize: 12 }} 
              value={selectedNode} 
              onChange={e => setSelectedNode(e.target.value)}
            >
              <option value="ALL">Tất cả các nút giao</option>
              {Object.entries(NODE_LABEL).map(([nid, label]) => (
                <option key={nid} value={nid}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>CHỌN KHUNG GIỜ:</div>
            <select 
              className="select-field" 
              style={{ minWidth: 180, padding: '6px 12px', fontSize: 12 }} 
              value={selectedSlot} 
              onChange={e => setSelectedSlot(e.target.value)}
            >
              <option value="ALL">Tất cả khung giờ (Peak Hours)</option>
              {Object.entries(SLOT_LABEL).map(([slot, label]) => (
                <option key={slot} value={slot}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>CHẾ ĐỘ XEM BIỂU ĐỒ:</div>
            <select 
              className="select-field" 
              style={{ minWidth: 160, padding: '6px 12px', fontSize: 12 }} 
              value={viewMode} 
              onChange={e => setViewMode(e.target.value)}
            >
              <option value="day">Xem theo Ngày (Daily)</option>
              <option value="month">Xem theo Tháng (Monthly)</option>
              <option value="dayofweek">Xem theo Thứ (Weekly Pattern)</option>
              <option value="session">Xem theo Phiên liên tục (Session Timeline)</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>
            <div>Mức phân giải biểu diễn: <strong style={{ color: 'var(--accent)' }}>
              {viewMode === 'month' ? 'Tháng' : viewMode === 'day' ? 'Ngày' : viewMode === 'dayofweek' ? 'Thứ' : 'Phiên'}
            </strong></div>
            <div style={{ fontSize: 10, marginTop: 2 }}>Tổng số điểm vẽ: <strong style={{ color: 'var(--accent-green)' }}>{chartData.length}</strong></div>
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ TRỤC KÉP */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ margin: 0 }}>
            BIỂU ĐỒ TRUNG BÌNH TỐC ĐỘ & MẬT ĐỘ (XEM THEO {viewMode === 'month' ? 'THÁNG' : viewMode === 'day' ? 'NGÀY' : viewMode === 'dayofweek' ? 'THỨ' : 'PHIÊN ĐO'})
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
              <span style={{ width: 12, height: 3, background: '#38bdf8', borderRadius: 2 }} /> Tốc độ TB (km/h)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b' }}>
              <span style={{ width: 12, height: 8, background: '#f59e0b', borderRadius: 2 }} /> Mật độ TB (%)
            </span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDensity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} interval={viewMode === 'session' ? 9 : 0} />
              <YAxis 
                yAxisId="left" 
                domain={[0, 45]} 
                tick={{ fill: '#38bdf8', fontSize: 9 }} 
                label={{ value: 'Tốc độ (km/h)', angle: -90, position: 'insideLeft', fill: '#38bdf8', fontSize: 10, offset: 5 }} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                domain={[0, 100]} 
                tick={{ fill: '#f59e0b', fontSize: 9 }} 
                label={{ value: 'Mật độ (%)', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 10, offset: 5 }} 
              />
              <Tooltip 
                {...tooltipStyle} 
                formatter={(v, name) => {
                  if (name === 'speed') return [`${v} km/h`, 'Tốc độ Trung bình']
                  if (name === 'density') return [`${v}%`, 'Mật độ Trung bình']
                  return [v, name]
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ display: 'none' }} />
              
              <Area 
                yAxisId="right"
                type="monotone" 
                dataKey="density" 
                fill="url(#colorDensity)" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="density" 
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="speed" 
                fill="url(#colorSpeed)" 
                stroke="#38bdf8" 
                strokeWidth={2.5}
                name="speed" 
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: 'var(--text-muted)', padding: '60px 0', textAlign: 'center', fontSize: 13 }}>
            Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </div>

      {/* NEW FEATURE: BỘ DỰ BÁO VẬN TỐC & MẬT ĐỘ THÔNG MINH */}
      <div className="card" style={{ padding: 20, borderLeft: '4px solid var(--accent-purple)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔮</span>
          <span>BỘ ƯỚC TÍNH & DỰ BÁO VẬN TỐC GIAO THÔNG (HISTORICAL PREDICTOR)</span>
          <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 8px', background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)', borderRadius: 20, marginLeft: 8 }}>
            AI Agent Local Inference
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          
          {/* Cấu hình bộ dự báo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Công cụ thực hiện suy luận lịch sử (Inference) dựa trên kho dữ liệu 2 tháng. Bằng cách chọn tham số đầu vào, Agent tại biên sẽ tính toán trạng thái tắc nghẽn và tốc độ kỳ vọng tại thời điểm đó để hỗ trợ điều tiết giao thông và lên kế hoạch di chuyển.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600 }}>CHỌN NÚT GIAO:</div>
                <select 
                  className="select-field" 
                  style={{ width: '100%', padding: '6px 10px', fontSize: 11, minWidth: 0 }} 
                  value={predNode} 
                  onChange={e => setPredNode(e.target.value)}
                >
                  <option value="ALL">Toàn mạng lưới</option>
                  {Object.entries(NODE_LABEL).map(([nid, label]) => (
                    <option key={nid} value={nid}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600 }}>CHỌN THỨ TRONG TUẦN:</div>
                <select 
                  className="select-field" 
                  style={{ width: '100%', padding: '6px 10px', fontSize: 11, minWidth: 0 }} 
                  value={predDay} 
                  onChange={e => setPredDay(parseInt(e.target.value))}
                >
                  <option value={1}>Thứ Hai</option>
                  <option value={2}>Thứ Ba</option>
                  <option value={3}>Thứ Tư</option>
                  <option value={4}>Thứ Năm</option>
                  <option value={5}>Thứ Sáu</option>
                  <option value={6}>Thứ Bảy</option>
                  <option value={0}>Chủ Nhật</option>
                </select>
              </div>

              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 600 }}>KHUNG GIỜ CAO ĐIỂM:</div>
                <select 
                  className="select-field" 
                  style={{ width: '100%', padding: '6px 10px', fontSize: 11, minWidth: 0 }} 
                  value={predSlot} 
                  onChange={e => setPredSlot(e.target.value)}
                >
                  {Object.entries(SLOT_LABEL).map(([slot, label]) => (
                    <option key={slot} value={slot}>{label.split(' ')[0]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 10, color: 'var(--text-muted)' }}>
              🎯 <b>Công thức suy diễn cục bộ:</b> Trạng thái kỳ vọng <i>E(V, D)</i> là trung bình có trọng số chất lượng của toàn bộ các phiên đo quá khứ khớp chính xác với bộ tham số.
            </div>
          </div>

          {/* Kết quả dự báo */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {predictionResult.status === 'ok' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>KẾT QUẢ DỰ ĐOÁN:</span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 8px',
                    background: `${predictionResult.color}25`,
                    color: predictionResult.color,
                    border: `1px solid ${predictionResult.color}45`,
                    borderRadius: 4
                  }}>
                    RỦI RO: {predictionResult.risk}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '4px 0' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Tốc độ kỳ vọng</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                      {predictionResult.speed.toFixed(1)} <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}>km/h</span>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Mật độ kỳ vọng</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', marginTop: 2 }}>
                      {predictionResult.density.toFixed(1)}<span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Mức phục vụ (Expected LOS):</span>
                  <span style={{ color: predictionResult.color, fontWeight: 700 }}>{predictionResult.levelText}</span>
                </div>

                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4, fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', padding: 6, borderRadius: 4 }}>
                  💡 <b>Khuyến nghị:</b> {predictionResult.advice}
                </div>

                <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'right', marginTop: 'auto' }}>
                  Cơ sở dữ liệu mẫu: {predictionResult.sampleSize} phiên
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                <span style={{ fontSize: 24, marginBottom: 8 }}>⚠️</span>
                <span style={{ fontSize: 11 }}>Không tìm thấy mẫu dữ liệu lịch sử phù hợp cho lựa chọn này. Vui lòng chọn tham số khác.</span>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
