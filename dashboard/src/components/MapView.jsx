// MapView.jsx — Leaflet map v2
// Hiển thị:
//   • Polyline tuyến đường (từ camera lat/lon) → màu theo LOS trung bình
//   • Camera dots (từng điểm đo) → màu theo LOS cá nhân
//   • Node markers → màu theo fused congestion_level
//   • Tự động cập nhật khi filter thay đổi (date/timeslot/node)

import { useEffect, useRef, useState } from 'react'
import { LOS_COLOR, NODE_COLORS } from '../hooks/useTrafficData'

const NODE_META = {
  N01_LY_THUONG_KIET:   { lat: 10.770501, lon: 106.658107, label: 'N01 Lý Thường Kiệt', short: 'N01' },
  N02_BA_THANG_HAI:     { lat: 10.768200, lon: 106.669800, label: 'N02 Ba Tháng Hai', short: 'N02' },
  N03_CMT8:             { lat: 10.782100, lon: 106.671200, label: 'N03 Cách Mạng Tháng 8', short: 'N03' },
  N04_THANH_THAI:       { lat: 10.774500, lon: 106.662100, label: 'N04 Thành Thái', short: 'N04' },
  N05_TO_HIEN_THANH:    { lat: 10.778100, lon: 106.664500, label: 'N05 Tô Hiến Thành', short: 'N05' },
  N06_NGUYEN_TRI_PHUONG:{ lat: 10.763500, lon: 106.667200, label: 'N06 Nguyễn Tri Phương', short: 'N06' },
  N07_SU_VAN_HANH:      { lat: 10.776200, lon: 106.668000, label: 'N07 Sư Vạn Hạnh', short: 'N07' },
  N08_DIEN_BIEN_PHU:    { lat: 10.775800, lon: 106.678200, label: 'N08 Điện Biên Phủ', short: 'N08' },
  N09_CONG_HOA:         { lat: 10.800431, lon: 106.661012, label: 'N09 Cộng Hòa', short: 'N09' },
  N10_TRUONG_CHINH:     { lat: 10.806527, lon: 106.635795, label: 'N10 Trường Chinh', short: 'N10' },
}

const LOS_LABELS = {
  A: 'Nghiêm trọng', B: 'Tắc nghẽn', C: 'Gần tắc',
  D: 'Trung bình', E: 'Ổn định', F: 'Thông thoáng',
}

const CONGESTION_COLORS = {
  low: '#22c55e', medium: '#facc15', high: '#f97316', critical: '#ef4444', unknown: '#64748b',
}

// Tính LOS đa số từ mảng records
function majorityLOS(records) {
  if (!records.length) return 'unknown'
  const counts = {}
  records.forEach(r => { counts[r.los] = (counts[r.los] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
}

// Tính avg speed
function avgSpeed(records) {
  const valid = records.filter(r => r.velocity != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + r.velocity, 0) / valid.length
}

// Tính avg density
function avgDensity(records) {
  const valid = records.filter(r => r.density != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + r.density, 0) / valid.length
}

// Sắp xếp camera theo lat (từ nam → bắc) để polyline liên tục
function sortCameras(cams) {
  return [...cams].sort((a, b) => a.lat - b.lat)
}

export default function MapView({ data, nodeStates, cameraRecords, filters }) {
  const mapRef  = useRef(null)
  const leafRef = useRef(null)   // { map, L }

  // Layer groups — tái tạo khi data thay đổi
  const layersRef = useRef({ corridors: null, cameras: null, nodes: null })

  // Layer visibility toggle
  const [showCameras,   setShowCameras]   = useState(true)
  const [showCorridors, setShowCorridors] = useState(true)
  const [showNodes,     setShowNodes]     = useState(true)

  // ── 1. Khởi tạo map (chỉ 1 lần) ──────────────────────────────────────────
  useEffect(() => {
    if (leafRef.current) return
    import('leaflet').then(L => {
      const map = L.map(mapRef.current, {
        center: [10.782, 106.655],
        zoom: 13,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19,
      }).addTo(map)

      // Khởi tạo 3 layer groups
      layersRef.current.corridors = L.layerGroup().addTo(map)
      layersRef.current.cameras   = L.layerGroup().addTo(map)
      layersRef.current.nodes     = L.layerGroup().addTo(map)

      leafRef.current = { map, L }

      // CSS popup
      const style = document.createElement('style')
      style.textContent = `
        .popup-title { font-size:13px; font-weight:700; color:#f1f5f9; margin-bottom:6px; border-bottom:1px solid #334155; padding-bottom:4px; }
        .popup-row { display:flex; justify-content:space-between; gap:12px; font-size:11px; color:#94a3b8; margin-bottom:3px; }
        .popup-val { color:#e2e8f0; font-weight:600; }
        .leaflet-popup-content-wrapper { background:#0d1424; border:1px solid #1e3a5f; border-radius:8px; color:#e2e8f0; }
        .leaflet-popup-tip { background:#0d1424; }
      `
      document.head.appendChild(style)
    })
    return () => { if (leafRef.current) { leafRef.current.map.remove(); leafRef.current = null } }
  }, [])

  // ── 2. Cập nhật corridors + cameras khi data (filtered) thay đổi ─────────
  useEffect(() => {
    if (!leafRef.current) return
    const { L } = leafRef.current
    const { corridors, cameras } = layersRef.current
    if (!corridors || !cameras) return

    corridors.clearLayers()
    cameras.clearLayers()

    // Dùng cameraRecords đã filter, hoặc fallback sang data (traffic_data)
    // cameraRecords có lat/lon chính xác theo camera_id
    const sourceData = cameraRecords?.length ? cameraRecords : data

    if (!sourceData?.length) return

    // Auto-fit vao khu vuc co data (chi lan dau, khi map da trong)
    const { map } = leafRef.current
    if (corridors.getLayers().length === 0) {
      // Center vao giua 3 node
      map.setView([10.792, 106.649], 14)
    }

    // Nhom theo node_id
    const byNode = {}
    sourceData.forEach(r => {
      const nid = r.node_id
      if (!byNode[nid]) byNode[nid] = []
      byNode[nid].push(r)
    })

    Object.entries(byNode).forEach(([nid, records]) => {
      const nodeColor = NODE_COLORS[nid] || '#64748b'

      // ── A. CORRIDOR POLYLINES ────────────────────────────────────────────
      // Nhóm theo camera_id → lấy vị trí và avg LOS
      const byCam = {}
      records.forEach(r => {
        const cid = r.camera_id || r.sample_id
        if (!byCam[cid]) byCam[cid] = { lat: r.lat ?? r.sample_lat, lon: r.lon ?? r.sample_lon, records: [] }
        byCam[cid].records.push(r)
      })

      // Sắp xếp camera theo lat/lon tùy theo chiều đường để vẽ polyline đúng hướng và tránh zig-zag
      const camPoints = Object.values(byCam)
        .filter(c => c.lat != null && c.lon != null)
        .sort((a, b) => {
          if (nid === 'N02_CONG_HOA') {
            return a.lon - b.lon; // Đường Cộng Hòa chạy hướng Tây-Đông: xếp theo Kinh độ
          } else {
            return a.lat - b.lat; // Các đường khác chạy hướng Bắc-Nam/chéo: xếp theo Vĩ độ
          }
        })

      if (camPoints.length >= 2) {
        // Vẽ từng đoạn polyline giữa 2 camera liên tiếp, màu theo LOS đoạn đó
        for (let i = 0; i < camPoints.length - 1; i++) {
          const seg = camPoints[i]
          const segLOS = majorityLOS(seg.records)
          const segColor = LOS_COLOR[segLOS] || LOS_COLOR.unknown
          const segSpeed = avgSpeed(seg.records)
          const segDen = avgDensity(seg.records)

          const nextSeg = camPoints[i + 1]

          // Popup cho segment với đầy đủ thông tin: Vận tốc, Mật độ và LOS
          const roadName = seg.records[0]?.road_segment || seg.records[0]?.matched_road_name || nid
          const popupHtml = `
            <div class="popup-title">${roadName}</div>
            <div class="popup-row"><span>LOS:</span><span class="popup-val" style="color:${segColor}">${segLOS} — ${LOS_LABELS[segLOS] || ''}</span></div>
            <div class="popup-row"><span>Tốc độ TB:</span><span class="popup-val">${segSpeed ? segSpeed.toFixed(1) + ' km/h' : 'N/A'}</span></div>
            <div class="popup-row"><span>Mật độ TB:</span><span class="popup-val">${segDen != null ? (segDen * 100).toFixed(1) + '%' : 'N/A'}</span></div>
          `

          // Visible line (not interactive, click will pass through to transparent hitLine)
          const line = L.polyline(
            [[seg.lat, seg.lon], [nextSeg.lat, nextSeg.lon]],
            { color: segColor, weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }
          )

          // Transparent hit area (dễ click chuột hơn)
          const hitLine = L.polyline(
            [[seg.lat, seg.lon], [nextSeg.lat, nextSeg.lon]],
            { color: '#ffffff', weight: 20, opacity: 0.001, interactive: true }
          )
          hitLine.bindPopup(popupHtml, { maxWidth: 240 })

          if (showCorridors) {
            corridors.addLayer(line)
            corridors.addLayer(hitLine)
          }
        }

        // Outline mờ làm nền (trắng mỏng) để corridor nổi hơn nền tối
        const outlinePts = camPoints.map(c => [c.lat, c.lon])
        const outline = L.polyline(outlinePts, {
          color: '#ffffff', weight: 10, opacity: 0.07, lineCap: 'round', interactive: false
        })
        if (showCorridors) corridors.addLayer(outline)
      }

      // ── B. CAMERA DOT MARKERS ─────────────────────────────────────────────
      if (showCameras) {
        Object.entries(byCam).forEach(([cid, cam]) => {
          if (!cam.lat || !cam.lon) return
          const los = majorityLOS(cam.records)
          const color = LOS_COLOR[los] || LOS_COLOR.unknown
          const speed = avgSpeed(cam.records)
          const density = cam.records[0]?.density

          const dot = L.circleMarker([cam.lat, cam.lon], {
            radius: 5, color: '#0d1424', fillColor: color,
            fillOpacity: 0.95, weight: 1.5,
          })

          dot.bindPopup(`
            <div class="popup-title">Điểm đo ${cid}</div>
            <div class="popup-row"><span>Node:</span><span class="popup-val">${nid.replace(/_/g,' ')}</span></div>
            <div class="popup-row"><span>LOS:</span><span class="popup-val" style="color:${color}">${los} — ${LOS_LABELS[los] || ''}</span></div>
            <div class="popup-row"><span>Tốc độ:</span><span class="popup-val">${speed ? speed.toFixed(1) + ' km/h' : 'N/A'}</span></div>
            <div class="popup-row"><span>Mật độ:</span><span class="popup-val">${density != null ? (density*100).toFixed(1)+'%' : 'N/A'}</span></div>
            <div class="popup-row"><span>Bản ghi:</span><span class="popup-val">${cam.records.length}</span></div>
          `, { maxWidth: 220 })

          cameras.addLayer(dot)
        })
      }
    })

    // -- C. INTER-NODE CONNECTOR LINES --
    // Bo 3 cai duong noi giua 3 node lon theo yeu cau cua user
    // (Da bo theo thiet ke)
  }, [data, cameraRecords, nodeStates, showCameras, showCorridors])

  // ── 3. Cập nhật node markers khi nodeStates thay đổi ─────────────────────
  useEffect(() => {
    if (!leafRef.current) return
    const { L } = leafRef.current
    const { nodes } = layersRef.current
    if (!nodes) return

    nodes.clearLayers()
    if (!showNodes) return

    // Lấy nodeStates phù hợp với filter hiện tại (đã lọc ở parent)
    const filteredNS = nodeStates || []

    // Tính avg per node từ filtered node states
    const nodeAvg = {}
    filteredNS.forEach(ns => {
      const nid = ns.node_id
      if (!nodeAvg[nid]) nodeAvg[nid] = { velocities: [], densities: [], confidences: [], levels: [], latencies: [] }
      if (ns.fused_velocity != null) nodeAvg[nid].velocities.push(ns.fused_velocity)
      if (ns.fused_density != null)  nodeAvg[nid].densities.push(ns.fused_density)
      if (ns.confidence != null)     nodeAvg[nid].confidences.push(ns.confidence)
      if (ns.congestion_level)       nodeAvg[nid].levels.push(ns.congestion_level)
      if (ns.latency_ms != null)     nodeAvg[nid].latencies.push(ns.latency_ms)
    })

    Object.entries(NODE_META).forEach(([nid, meta]) => {
      const agg = nodeAvg[nid]
      const avgV   = agg?.velocities.length ? agg.velocities.reduce((s,v)=>s+v,0)/agg.velocities.length : null
      const avgD   = agg?.densities.length  ? agg.densities.reduce((s,v)=>s+v,0)/agg.densities.length   : null
      const avgC   = agg?.confidences.length? agg.confidences.reduce((s,v)=>s+v,0)/agg.confidences.length: null
      const avgLat = agg?.latencies.length  ? agg.latencies.reduce((s,v)=>s+v,0)/agg.latencies.length   : null

      // Dominant congestion level
      const levelCount = {}
      agg?.levels.forEach(l => { levelCount[l] = (levelCount[l]||0)+1 })
      const dominantLevel = agg?.levels.length
        ? Object.entries(levelCount).sort((a,b)=>b[1]-a[1])[0][0]
        : 'unknown'

      const fillColor = CONGESTION_COLORS[dominantLevel] || CONGESTION_COLORS.unknown
      const nodeColor = NODE_COLORS[nid] || '#64748b'

      // Outer glow circle (removed by user request)
      /*
      L.circle([meta.lat, meta.lon], {
        radius: 200, color: fillColor, fillColor: fillColor,
        fillOpacity: 0.12, weight: 2, opacity: 0.6,
      }).addTo(nodes)
      */

      // Node marker
      const marker = L.circleMarker([meta.lat, meta.lon], {
        radius: 14, color: '#0d1424', fillColor: fillColor,
        fillOpacity: 0.92, weight: 3,
      })

      // Icon text
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${fillColor};border:2.5px solid #0d1424;
          display:flex;align-items:center;justify-content:center;
          font-size:9px;font-weight:800;color:#fff;
          box-shadow:0 0 8px ${fillColor}88;
          transform:translate(-14px,-14px);
        ">${meta.short}</div>`,
        iconSize: [0, 0],
      })
      const iconMarker = L.marker([meta.lat, meta.lon], { icon })

      const CONGESTION_LABELS = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng', unknown: 'Không xác định' }
      const popupHtml = `
        <div class="popup-title">${meta.label}</div>
        <div class="popup-row"><span>Trạng thái:</span>
          <span class="popup-val" style="color:${fillColor}">${CONGESTION_LABELS[dominantLevel]?.toUpperCase() || dominantLevel.toUpperCase()}</span></div>
        <div class="popup-row"><span>Tốc độ TB:</span>
          <span class="popup-val">${avgV ? avgV.toFixed(1)+' km/h' : 'N/A'}</span></div>
        <div class="popup-row"><span>Mật độ TB:</span>
          <span class="popup-val">${avgD ? (avgD*100).toFixed(1)+'%' : 'N/A'}</span></div>
        <div class="popup-row"><span>Độ tin cậy:</span>
          <span class="popup-val">${avgC ? (avgC*100).toFixed(1)+'%' : 'N/A'}</span></div>
        <div class="popup-row"><span>Độ trễ:</span>
          <span class="popup-val">${avgLat ? avgLat.toFixed(0)+' ms' : 'N/A'}</span></div>
        <div class="popup-row"><span>Số phiên:</span>
          <span class="popup-val">${agg?.velocities.length || 0}</span></div>
      `
      marker.bindPopup(popupHtml, { maxWidth: 260 })
      iconMarker.bindPopup(popupHtml, { maxWidth: 260 })

      nodes.addLayer(marker)
      nodes.addLayer(iconMarker)
    })
  }, [nodeStates, showNodes])

  // ── 4. Show/hide layers khi toggle ───────────────────────────────────────
  useEffect(() => {
    if (!leafRef.current) return
    const { map } = leafRef.current
    const { corridors, cameras, nodes } = layersRef.current
    if (!corridors || !cameras || !nodes) return
    showCorridors ? map.addLayer(corridors) : map.removeLayer(corridors)
    showCameras   ? map.addLayer(cameras)   : map.removeLayer(cameras)
    showNodes     ? map.addLayer(nodes)     : map.removeLayer(nodes)
  }, [showCorridors, showCameras, showNodes])

  // ── Tính stats cho right panel ────────────────────────────────────────────
  const sourceData = cameraRecords?.length ? cameraRecords : data

  const nodeStats = Object.keys(NODE_META).map(nid => {
    const nd = sourceData.filter(r => r.node_id === nid)
    const v = nd.filter(r => r.velocity != null)
    const avgV = v.length ? (v.reduce((s,r)=>s+(r.velocity||0),0)/v.length).toFixed(1) : 'N/A'
    const pctTac = nd.length ? ((nd.filter(r=>r.is_congested).length/nd.length)*100).toFixed(0) : 0
    const los = majorityLOS(nd)
    return { nid, avgV, pctTac, los, count: nd.length }
  })

  const losDist = ['A','B','C','D','E','F'].map(los => ({
    los, count: sourceData.filter(r=>r.los===los).length,
    pct: sourceData.length ? sourceData.filter(r=>r.los===los).length/sourceData.length : 0,
  }))

  // Filter label — hien thi Ngay va Khung gio
  const selectedDate  = filters?.dateRange?.[0] || ''
  const selectedSlots = filters?.timeSlots || []
  const SLOT_HOURS = {
    morning_peak: '6h–8h', midday_peak: '11h–13h',
    evening_peak: '16h–19h', off_peak: 'Ngoài giờ',
  }
  const slotLabel = selectedSlots.map(s => SLOT_HOURS[s] || s).join(', ') || 'Tất cả'
  const filterLabel = selectedDate ? `${selectedDate}` : 'Tất cả'
  const hourLabel   = slotLabel

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:12, height:'calc(100vh - 140px)' }}>

      {/* ── MAP ─────────────────────────────────────────────────────────── */}
      <div style={{ position:'relative', borderRadius:12, overflow:'hidden', border:'1px solid var(--border)' }}>
        <div ref={mapRef} style={{ width:'100%', height:'100%' }} />

        {/* Layer controls */}
        <div style={{
          position:'absolute', top:12, left:12, zIndex:1000,
          background:'rgba(13,20,36,0.92)', border:'1px solid var(--border)',
          borderRadius:8, padding:'8px 12px', backdropFilter:'blur(8px)',
          display:'flex', flexDirection:'column', gap:5, fontSize:11,
        }}>
          <div style={{ fontWeight:600, color:'var(--text-secondary)', marginBottom:2 }}>Lớp hiển thị</div>
          {[
            [showCorridors, setShowCorridors, '━', 'Tuyến đường'],
            [showCameras,   setShowCameras,   '●', 'Điểm đo (thiết bị ảo)'],
            [showNodes,     setShowNodes,     '◉', 'Tâm nút giao'],
          ].map(([active, setter, icon, label]) => (
            <label key={label} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={active} onChange={e=>setter(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:12, height:12 }} />
              <span style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{icon} {label}</span>
            </label>
          ))}
        </div>

        {/* LOS Legend */}
        <div style={{
          position:'absolute', bottom:24, right:12, zIndex:999,
          background:'rgba(13,20,36,0.92)', border:'1px solid var(--border)',
          borderRadius:8, padding:'10px 14px', backdropFilter:'blur(8px)', fontSize:11,
        }}>
          <div style={{ fontWeight:600, marginBottom:6, color:'var(--text-secondary)' }}>LOS — Mức độ ùn tắc</div>
          {['A','B','C','D','E','F'].map(los => (
            <div key={los} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <div style={{ width:28, height:5, borderRadius:3, background:LOS_COLOR[los] }} />
              <span style={{ color:'var(--text-secondary)', fontWeight: los==='C'||los==='D'?600:400 }}>
                {los} — {LOS_LABELS[los]}
              </span>
            </div>
          ))}
          <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:6 }}>
            {Object.entries(CONGESTION_COLORS).filter(([k])=>k!=='unknown').map(([k,c]) => {
              const labelMap = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng' }
              return (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:c }} />
                  <span style={{ color:'var(--text-muted)', fontSize:10 }}>Ùn tắc: {labelMap[k] || k}</span>
                </div>
              )
            })}
          </div>
        </div>

          <div style={{
            position:'absolute', top:12, right:12, zIndex:999,
            background:'rgba(13,20,36,0.92)', border:'1px solid rgba(34,197,94,0.4)',
            borderRadius:8, padding:'6px 12px', backdropFilter:'blur(8px)', fontSize:11,
            display:'flex', alignItems:'center', gap:8,
          }}>
            <span style={{ color:'#22c55e', fontWeight:700, fontSize:13 }}>🟢</span>
            <div>
              <div style={{ color:'#22c55e', fontWeight:700, fontSize:11 }}>TRỰC TIẾP REAL-TIME</div>
              <div style={{ color:'var(--text-secondary)', fontSize:10 }}>Bao gồm tất cả 24 Giờ (00h–23h)</div>
            </div>
          </div>
        </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>


        {/* Per-node status — bo "Dang hien thi N records" card */}
        {nodeStats.map(({ nid, avgV, pctTac, los, count }) => {
          const color = NODE_COLORS[nid]
          const losColor = LOS_COLOR[los] || LOS_COLOR.unknown
          return (
            <div key={nid} className="card" style={{ border:`1px solid ${color}33`, flexShrink:0 }}>
              <div style={{ fontSize:10, fontWeight:700, color, marginBottom:6 }}>
                {nid.replace(/_/g,' ')}
              </div>
              {/* LOS badge */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Tốc độ TB</div>
                  <div style={{ fontSize:22, fontWeight:700, color }}>
                    {avgV} <span style={{fontSize:11}}>km/h</span>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{
                    display:'inline-block', padding:'2px 8px', borderRadius:4,
                    background:`${losColor}22`, border:`1px solid ${losColor}`,
                    fontSize:13, fontWeight:800, color:losColor,
                  }}>{los}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>{count} bản ghi</div>
                  <div style={{ fontSize:10, color:'var(--los-d)' }}>{pctTac}% ùn tắc</div>
                </div>
              </div>
              {/* LOS mini bar */}
              <div style={{ marginTop:8, height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ width:`${pctTac}%`, height:'100%', background:losColor, transition:'width 0.4s ease' }} />
              </div>
            </div>
          )
        })}

        {/* LOS distribution */}
        <div className="card">
          <div className="card-title">Phân bố LOS</div>
          {losDist.map(({ los, count, pct }) => (
            <div key={los} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
              <div style={{
                width:20, height:20, borderRadius:3, flexShrink:0,
                background:`${LOS_COLOR[los]}22`, border:`1.5px solid ${LOS_COLOR[los]}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, fontWeight:800, color:LOS_COLOR[los],
              }}>{los}</div>
              <div style={{ flex:1 }}>
                <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{
                    width:`${pct*100}%`, height:'100%', background:LOS_COLOR[los],
                    borderRadius:3, transition:'width 0.4s ease',
                  }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:4, fontSize:10 }}>
                <span style={{ color:LOS_COLOR[los], fontWeight:600 }}>{(pct*100).toFixed(1)}%</span>
                <span style={{ color:'var(--text-muted)' }}>({count} mẫu)</span>
              </div>
            </div>
          ))}
        </div>

        {/* LOS labels */}
        <div className="card">
          <div className="card-title">Chú thích LOS</div>
          {Object.entries(LOS_LABELS).map(([los, label]) => (
            <div key={los} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, fontSize:11 }}>
              <div style={{ width:32, height:5, borderRadius:3, background:LOS_COLOR[los], flexShrink:0 }} />
              <span style={{ color:'var(--text-muted)' }}><strong style={{color:LOS_COLOR[los]}}>{los}</strong> — {label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
