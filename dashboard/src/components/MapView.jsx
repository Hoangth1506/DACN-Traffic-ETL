// MapView.jsx — Advanced Leaflet GIS Traffic Map & Arterial Corridors (ĐHBK Standard)
import { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import { LOS_COLOR, NODE_COLORS } from '../hooks/useTrafficData'
import {
  Video,
  Camera,
  Layers,
  Search,
  Eye,
  X,
  Gauge,
  Activity,
  Maximize2,
  TrendingUp,
  Radio,
  MapPin,
  Compass,
} from 'lucide-react'

const NODE_META = {
  N01_LY_THUONG_KIET:   { lat: 10.770501, lon: 106.658107, label: 'N01 Lý Thường Kiệt', short: 'N01', district: 'Quận 10', speedLimit: 40, road: 'Lý Thường Kiệt' },
  N02_BA_THANG_HAI:     { lat: 10.768200, lon: 106.669800, label: 'N02 Ba Tháng Hai', short: 'N02', district: 'Quận 10', speedLimit: 40, road: '3 Tháng 2' },
  N03_CMT8:             { lat: 10.782100, lon: 106.671200, label: 'N03 Cách Mạng Tháng 8', short: 'N03', district: 'Quận 10', speedLimit: 35, road: 'Cách Mạng Tháng 8' },
  N04_THANH_THAI:       { lat: 10.774500, lon: 106.662100, label: 'N04 Thành Thái', short: 'N04', district: 'Quận 10', speedLimit: 40, road: 'Thành Thái' },
  N05_TO_HIEN_THANH:    { lat: 10.778100, lon: 106.664500, label: 'N05 Tô Hiến Thành', short: 'N05', district: 'Quận 10', speedLimit: 35, road: 'Tô Hiến Thành' },
  N06_NGUYEN_TRI_PHUONG:{ lat: 10.763500, lon: 106.667200, label: 'N06 Nguyễn Tri Phương', short: 'N06', district: 'Quận 10', speedLimit: 40, road: 'Nguyễn Tri Phương' },
  N07_SU_VAN_HANH:      { lat: 10.776200, lon: 106.668000, label: 'N07 Sư Vạn Hạnh', short: 'N07', district: 'Quận 10', speedLimit: 35, road: 'Sư Vạn Hạnh' },
  N08_DIEN_BIEN_PHU:    { lat: 10.775800, lon: 106.678200, label: 'N08 Điện Biên Phủ', short: 'N08', district: 'Quận 10', speedLimit: 50, road: 'Điện Biên Phủ' },
  N09_CONG_HOA:         { lat: 10.800431, lon: 106.661012, label: 'N09 Cộng Hòa', short: 'N09', district: 'Tân Bình', speedLimit: 50, road: 'Cộng Hòa' },
  N10_TRUONG_CHINH:     { lat: 10.806527, lon: 106.635795, label: 'N10 Trường Chinh', short: 'N10', district: 'Tân Bình', speedLimit: 45, road: 'Trường Chinh' },
  N11_LE_HONG_PHONG:    { lat: 10.763116, lon: 106.674998, label: 'N11 Lê Hồng Phong', short: 'N11', district: 'Quận 10', speedLimit: 40, road: 'Lê Hồng Phong' },
  N12_NGO_GIA_TU:       { lat: 10.760721, lon: 106.669865, label: 'N12 Ngô Gia Tự', short: 'N12', district: 'Quận 10', speedLimit: 40, road: 'Ngô Gia Tự' },
  N13_VINH_VIEN:        { lat: 10.762145, lon: 106.668875, label: 'N13 Vĩnh Viễn', short: 'N13', district: 'Quận 10', speedLimit: 30, road: 'Vĩnh Viễn' },
  N14_HOA_HAO:          { lat: 10.761001, lon: 106.666993, label: 'N14 Hòa Hảo', short: 'N14', district: 'Quận 10', speedLimit: 30, road: 'Hòa Hảo' },
  N15_BA_HAT:           { lat: 10.764500, lon: 106.667500, label: 'N15 Bà Hạt', short: 'N15', district: 'Quận 10', speedLimit: 30, road: 'Bà Hạt' },
  N16_NHAT_TAO:         { lat: 10.763100, lon: 106.665300, label: 'N16 Nhật Tảo', short: 'N16', district: 'Quận 10', speedLimit: 30, road: 'Nhật Tảo' },
  N17_TRAN_NHAN_TON:    { lat: 10.764300, lon: 106.670200, label: 'N17 Trần Nhân Tôn', short: 'N17', district: 'Quận 10', speedLimit: 30, road: 'Trần Nhân Tôn' },
  N18_NGUYEN_LAM:       { lat: 10.765600, lon: 106.668300, label: 'N18 Nguyễn Lâm', short: 'N18', district: 'Quận 10', speedLimit: 30, road: 'Nguyễn Lâm' },
  N19_DONG_NAI:         { lat: 10.778800, lon: 106.665500, label: 'N19 Đồng Nai', short: 'N19', district: 'Quận 10', speedLimit: 30, road: 'Đồng Nai' },
  N20_CUU_LONG:         { lat: 10.779700, lon: 106.664400, label: 'N20 Cửu Long', short: 'N20', district: 'Quận 10', speedLimit: 30, road: 'Cửu Long' },
  N21_HO_BA_KIEN:       { lat: 10.781600, lon: 106.666800, label: 'N21 Hồ Bá Kiện', short: 'N21', district: 'Quận 10', speedLimit: 30, road: 'Hồ Bá Kiện' },
  N22_BAC_HAI:          { lat: 10.781200, lon: 106.663500, label: 'N22 Bắc Hải', short: 'N22', district: 'Quận 10', speedLimit: 35, road: 'Bắc Hải' },
}

// Mạng lưới các tuyến đường đô thị chính kết nối giữa các nút giao (Arterial Network)
const ARTERIAL_ROUTES = [
  { name: 'Trục Lý Thường Kiệt', road: 'Đường Lý Thường Kiệt', nodes: ['N01_LY_THUONG_KIET', 'N05_TO_HIEN_THANH', 'N22_BAC_HAI'] },
  { name: 'Trục Ba Tháng Hai', road: 'Đường 3 Tháng 2', nodes: ['N01_LY_THUONG_KIET', 'N02_BA_THANG_HAI', 'N06_NGUYEN_TRI_PHUONG', 'N11_LE_HONG_PHONG'] },
  { name: 'Trục Tô Hiến Thành', road: 'Đường Tô Hiến Thành', nodes: ['N01_LY_THUONG_KIET', 'N04_THANH_THAI', 'N05_TO_HIEN_THANH', 'N19_DONG_NAI', 'N07_SU_VAN_HANH', 'N21_HO_BA_KIEN', 'N03_CMT8'] },
  { name: 'Trục Sư Vạn Hạnh', road: 'Đường Sư Vạn Hạnh', nodes: ['N02_BA_THANG_HAI', 'N15_BA_HAT', 'N07_SU_VAN_HANH', 'N05_TO_HIEN_THANH'] },
  { name: 'Trục Nguyễn Tri Phương', road: 'Đường Nguyễn Tri Phương', nodes: ['N12_NGO_GIA_TU', 'N14_HOA_HAO', 'N06_NGUYEN_TRI_PHUONG', 'N02_BA_THANG_HAI'] },
  { name: 'Trục Cách Mạng Tháng 8', road: 'Đường Cách Mạng Tháng 8', nodes: ['N08_DIEN_BIEN_PHU', 'N03_CMT8', 'N10_TRUONG_CHINH'] },
  { name: 'Trục Bắc Hải — Thành Thái', road: 'Đường Bắc Hải', nodes: ['N22_BAC_HAI', 'N20_CUU_LONG', 'N04_THANH_THAI'] },
  { name: 'Trục Ngô Gia Tự — Trần Nhân Tôn', road: 'Đường Ngô Gia Tự', nodes: ['N12_NGO_GIA_TU', 'N17_TRAN_NHAN_TON'] },
  { name: 'Trục Vĩnh Viễn — Nguyễn Lâm — Bà Hạt', road: 'Đường Vĩnh Viễn', nodes: ['N13_VINH_VIEN', 'N18_NGUYEN_LAM', 'N15_BA_HAT'] },
  { name: 'Trục Nhật Tảo — Hòa Hảo', road: 'Đường Nhật Tảo', nodes: ['N16_NHAT_TAO', 'N14_HOA_HAO'] },
  { name: 'Trục Tân Bình: Cộng Hòa — Trường Chinh', road: 'Đường Cộng Hòa — Trường Chinh', nodes: ['N09_CONG_HOA', 'N10_TRUONG_CHINH'] },
]

const LOS_LABELS = {
  A: 'Free flow (Lý tưởng)',
  B: 'Khá thông thoáng',
  C: 'Dòng xe ổn định',
  D: 'Đông đúc, chậm',
  E: 'Ùn tắc xuất hiện',
  F: 'Ùn tắc nghiêm trọng',
}

const CONGESTION_COLORS = {
  low: '#22c55e', medium: '#facc15', high: '#f97316', critical: '#ef4444', unknown: '#64748b',
}

function majorityLOS(records) {
  if (!records.length) return 'unknown'
  const counts = {}
  records.forEach(r => { counts[r.los] = (counts[r.los] || 0) + 1 })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
}

function avgSpeed(records) {
  const valid = records.filter(r => (r.current_speed ?? r.velocity) != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + (r.current_speed ?? r.velocity), 0) / valid.length
}

function avgDensity(records) {
  const valid = records.filter(r => (r.congestion_index ?? r.density ?? r.fused_density) != null)
  if (!valid.length) return null
  return valid.reduce((s, r) => s + (r.congestion_index ?? r.density ?? r.fused_density ?? 0), 0) / valid.length
}

const BASEMAP_CONFIGS = {
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, HERE, Garmin, © OpenStreetMap',
    maxZoom: 18,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
}

export default function MapView({ data, nodeStates, cameraRecords, filters }) {
  const mapRef = useRef(null)
  const leafRef = useRef(null)
  const tileLayerRef = useRef(null)
  const tileLabelRef = useRef(null)

  // Layer groups
  const layersRef = useRef({ corridors: null, cameras: null, nodes: null, arterialRoutes: null })

  const [showCameras, setShowCameras] = useState(true)
  const [showCorridors, setShowCorridors] = useState(true)
  const [showArterialRoutes, setShowArterialRoutes] = useState(true)
  const [showNodes, setShowNodes] = useState(true)
  const [baseMapType, setBaseMapType] = useState('dark')
  const [mapReady, setMapReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNode, setSelectedNode] = useState(null)

  // Resize handler
  useEffect(() => {
    if (!leafRef.current) return
    const handleResize = () => {
      window.requestAnimationFrame(() => {
        leafRef.current?.map.invalidateSize()
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mapReady])

  // 1. Initialize map
  useEffect(() => {
    if (leafRef.current || !mapRef.current) return

    const map = L.map(mapRef.current, {
      center: [10.782, 106.662],
      zoom: 13.5,
      zoomControl: true,
      preferCanvas: true,
    })

    // Init Layer Groups
    layersRef.current.arterialRoutes = L.layerGroup().addTo(map)
    layersRef.current.corridors      = L.layerGroup().addTo(map)
    layersRef.current.cameras        = L.layerGroup().addTo(map)
    layersRef.current.nodes          = L.layerGroup().addTo(map)

    leafRef.current = { map, L }
    setMapReady(true)

    // Popup CSS
    const style = document.createElement('style')
    style.textContent = `
      .popup-title { font-size:13px; font-weight:800; color:#f1f5f9; margin-bottom:6px; border-bottom:1px solid #334155; padding-bottom:4px; }
      .popup-row { display:flex; justify-content:space-between; gap:12px; font-size:11px; color:#94a3b8; margin-bottom:3px; }
      .popup-val { color:#e2e8f0; font-weight:700; }
      .leaflet-popup-content-wrapper { background:#0d1424; border:1px solid #1e3a5f; border-radius:10px; color:#e2e8f0; box-shadow:0 8px 30px rgba(0,0,0,0.6); }
      .leaflet-popup-tip { background:#0d1424; }
      .btn-view-cam { display:block; width:100%; margin-top:8px; padding:6px 0; background:linear-gradient(135deg,#06b6d4,#2563eb); color:#fff; font-weight:700; font-size:11px; text-align:center; border-radius:6px; border:none; cursor:pointer; }
      .btn-view-cam:hover { opacity:0.9; }
    `
    document.head.appendChild(style)

    setTimeout(() => {
      if (map) map.invalidateSize()
    }, 200)

    return () => {
      if (leafRef.current) {
        leafRef.current.map.remove()
        leafRef.current = null
      }
    }
  }, [])

  // 1b. Basemap switcher
  useEffect(() => {
    if (!leafRef.current || !mapReady) return
    const { map, L } = leafRef.current

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current)
      tileLayerRef.current = null
    }
    if (tileLabelRef.current) {
      map.removeLayer(tileLabelRef.current)
      tileLabelRef.current = null
    }

    const cfg = BASEMAP_CONFIGS[baseMapType] || BASEMAP_CONFIGS.dark
    const layer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom || 19,
    }).addTo(map)
    layer.bringToBack()
    tileLayerRef.current = layer

    if (cfg.labelUrl) {
      const labelLayer = L.tileLayer(cfg.labelUrl, {
        maxZoom: cfg.maxZoom || 18,
      }).addTo(map)
      tileLabelRef.current = labelLayer
    }
  }, [baseMapType, mapReady])

  // 2. Render Arterial Road Network Routes (Các trục đường kết nối chính giữa các node)
  useEffect(() => {
    if (!leafRef.current || !mapReady) return
    const { L } = leafRef.current
    const { arterialRoutes } = layersRef.current
    if (!arterialRoutes) return

    arterialRoutes.clearLayers()
    if (!showArterialRoutes) return

    const sourceData = cameraRecords?.length ? cameraRecords : data

    ARTERIAL_ROUTES.forEach((route) => {
      const points = []
      const routeSpeeds = []
      const routeDensities = []

      route.nodes.forEach(nid => {
        const meta = NODE_META[nid]
        if (meta) {
          points.push([meta.lat, meta.lon])
          const ns = nodeStates?.find(n => n.node_id === nid)
          if (ns?.fused_velocity) routeSpeeds.push(ns.fused_velocity)
          if (ns?.fused_density) routeDensities.push(ns.fused_density)
        }
      })

      if (points.length >= 2) {
        const avgRouteSpeed = routeSpeeds.length ? routeSpeeds.reduce((s, v) => s + v, 0) / routeSpeeds.length : 24.0
        const avgRouteDen = routeDensities.length ? routeDensities.reduce((s, v) => s + v, 0) / routeDensities.length : 0.45

        // Xác định màu theo vận tốc thực tế (Chuẩn ĐHBK)
        let routeColor = '#10b981' // >= 30 km/h (LOS A/B)
        let routeLOS = 'B'
        if (avgRouteSpeed < 13) {
          routeColor = '#ef4444' // < 13 km/h (LOS E/F)
          routeLOS = 'E'
        } else if (avgRouteSpeed < 20) {
          routeColor = '#f97316' // 13 - 20 km/h (LOS D)
          routeLOS = 'D'
        } else if (avgRouteSpeed < 30) {
          routeColor = '#f59e0b' // 20 - 30 km/h (LOS C)
          routeLOS = 'C'
        }

        // 1. Glow effect polyline
        const glowLine = L.polyline(points, {
          color: routeColor,
          weight: 10,
          opacity: 0.25,
          lineCap: 'round',
          interactive: false,
        })

        // 2. Main road line
        const mainLine = L.polyline(points, {
          color: routeColor,
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: avgRouteSpeed < 15 ? '6, 6' : null,
          interactive: false,
        })

        // 3. Interactive Hitline
        const hitLine = L.polyline(points, {
          color: '#ffffff',
          weight: 22,
          opacity: 0.001,
          interactive: true,
        })

        const popupContent = `
          <div class="popup-title">🛣️ ${route.name}</div>
          <div class="popup-row"><span>Tuyến chính:</span><span class="popup-val">${route.road}</span></div>
          <div class="popup-row"><span>Mức phục vụ:</span><span class="popup-val" style="color:${routeColor}">LOS ${routeLOS} — ${LOS_LABELS[routeLOS]}</span></div>
          <div class="popup-row"><span>Vận tốc TB:</span><span class="popup-val">${avgRouteSpeed.toFixed(1)} km/h</span></div>
          <div class="popup-row"><span>Mật độ luồng xe:</span><span class="popup-val">${(avgRouteDen * 100).toFixed(0)}%</span></div>
          <div class="popup-row"><span>Số nút giao kết nối:</span><span class="popup-val">${route.nodes.length} nút</span></div>
        `
        hitLine.bindPopup(popupContent, { maxWidth: 260 })

        arterialRoutes.addLayer(glowLine)
        arterialRoutes.addLayer(mainLine)
        arterialRoutes.addLayer(hitLine)
      }
    })
  }, [nodeStates, data, cameraRecords, showArterialRoutes, mapReady])

  // 3. Render Camera Points & Local Segments
  useEffect(() => {
    if (!leafRef.current || !mapReady) return
    const { L, map } = leafRef.current
    const { corridors, cameras } = layersRef.current
    if (!corridors || !cameras) return

    corridors.clearLayers()
    cameras.clearLayers()

    const sourceData = cameraRecords?.length ? cameraRecords : data
    if (!sourceData?.length) return

    map.invalidateSize()

    // Nhóm theo node
    const byNode = {}
    sourceData.forEach(r => {
      const nid = r.node_id
      if (!byNode[nid]) byNode[nid] = []
      byNode[nid].push(r)
    })

    Object.entries(byNode).forEach(([nid, records]) => {
      const byCam = {}
      records.forEach(r => {
        const cid = r.sample_id ?? r.camera_id
        if (cid == null) return
        if (!byCam[cid]) byCam[cid] = { lat: r.lat ?? r.sample_lat, lon: r.lon ?? r.sample_lon, records: [] }
        byCam[cid].records.push(r)
      })

      // Camera Dot Markers
      if (showCameras) {
        Object.entries(byCam).forEach(([cid, cam]) => {
          if (!cam.lat || !cam.lon) return
          const los = majorityLOS(cam.records)
          const color = LOS_COLOR[los] || LOS_COLOR.unknown
          const speed = avgSpeed(cam.records)
          const density = cam.records[0]?.congestion_index ?? cam.records[0]?.density

          const dot = L.circleMarker([cam.lat, cam.lon], {
            radius: 5.5,
            color: '#0d1424',
            fillColor: color,
            fillOpacity: 0.95,
            weight: 2,
          })

          const nodeMeta = NODE_META[nid] || { label: nid, district: 'Quận 10' }
          const popupHtml = document.createElement('div')
          popupHtml.innerHTML = `
            <div class="popup-title">📷 Camera Đo #${cid}</div>
            <div class="popup-row"><span>Nút giao:</span><span class="popup-val">${nodeMeta.label}</span></div>
            <div class="popup-row"><span>Khu vực:</span><span class="popup-val">${nodeMeta.district}</span></div>
            <div class="popup-row"><span>Mức phục vụ:</span><span class="popup-val" style="color:${color}">LOS ${los}</span></div>
            <div class="popup-row"><span>Vận tốc:</span><span class="popup-val">${speed ? speed.toFixed(1) + ' km/h' : '24.0 km/h'}</span></div>
            <div class="popup-row"><span>Mật độ:</span><span class="popup-val">${density != null ? (density * 100).toFixed(0) + '%' : '35%'}</span></div>
            <button class="btn-view-cam">📺 Xem Camera Trực Tuyến & AI</button>
          `

          popupHtml.querySelector('.btn-view-cam')?.addEventListener('click', () => {
            setSelectedNode({
              nid,
              ...nodeMeta,
              speed: speed ?? 24.0,
              los: los ?? 'C',
              density: density ?? 0.35,
              records: cam.records,
            })
          })

          dot.bindPopup(popupHtml, { maxWidth: 240 })
          cameras.addLayer(dot)
        })
      }
    })
  }, [data, cameraRecords, showCameras, showCorridors, mapReady])

  // 4. Render 22 Node Markers
  useEffect(() => {
    if (!leafRef.current || !mapReady) return
    const { L } = leafRef.current
    const { nodes } = layersRef.current
    if (!nodes) return

    nodes.clearLayers()
    if (!showNodes) return

    const filteredNS = nodeStates || []
    const nodeAvg = {}
    filteredNS.forEach(ns => {
      const nid = ns.node_id
      if (!nodeAvg[nid]) nodeAvg[nid] = { velocities: [], densities: [], confidences: [], levels: [] }
      if (ns.fused_velocity != null) nodeAvg[nid].velocities.push(ns.fused_velocity)
      if (ns.fused_density != null)  nodeAvg[nid].densities.push(ns.fused_density)
      if (ns.confidence != null)     nodeAvg[nid].confidences.push(ns.confidence)
      if (ns.los)                    nodeAvg[nid].levels.push(ns.los)
    })

    Object.entries(NODE_META).forEach(([nid, meta]) => {
      const agg = nodeAvg[nid]
      const avgV = agg?.velocities.length ? agg.velocities.reduce((s, v) => s + v, 0) / agg.velocities.length : 24.0
      const avgD = agg?.densities.length ? agg.densities.reduce((s, v) => s + v, 0) / agg.densities.length : 0.42
      const avgC = agg?.confidences.length ? agg.confidences.reduce((s, v) => s + v, 0) / agg.confidences.length : 0.88

      // Determine LOS & color
      let losKey = 'C'
      let fillColor = '#f59e0b'
      if (avgV >= 35) { losKey = 'A'; fillColor = '#10b981'; }
      else if (avgV >= 30) { losKey = 'B'; fillColor = '#22c55e'; }
      else if (avgV >= 20) { losKey = 'C'; fillColor = '#f59e0b'; }
      else if (avgV >= 13) { losKey = 'D'; fillColor = '#f97316'; }
      else { losKey = 'E'; fillColor = '#ef4444'; }

      // Icon marker with Node badge
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:30px; height:30px; border-radius:50%;
            background:${fillColor}; border:2.5px solid #0d1424;
            display:flex; align-items:center; justify-content:center;
            font-size:9px; font-weight:800; color:#ffffff;
            box-shadow:0 0 14px ${fillColor}aa;
            transform:translate(-15px, -15px); cursor:pointer;
          ">${meta.short}</div>
        `,
        iconSize: [0, 0],
      })

      const marker = L.marker([meta.lat, meta.lon], { icon })

      const popupContent = document.createElement('div')
      popupContent.innerHTML = `
        <div class="popup-title">🚦 ${meta.label}</div>
        <div class="popup-row"><span>Khu vực:</span><span class="popup-val">${meta.district}</span></div>
        <div class="popup-row"><span>Tuyến chính:</span><span class="popup-val">${meta.road}</span></div>
        <div class="popup-row"><span>Mức phục vụ:</span><span class="popup-val" style="color:${fillColor}">LOS ${losKey} — ${LOS_LABELS[losKey]}</span></div>
        <div class="popup-row"><span>Vận tốc hợp nhất:</span><span class="popup-val">${avgV.toFixed(1)} km/h</span></div>
        <div class="popup-row"><span>Mật độ phương tiện:</span><span class="popup-val">${(avgD * 100).toFixed(0)}%</span></div>
        <div class="popup-row"><span>Độ tin cậy cảm biến:</span><span class="popup-val">${(avgC * 100).toFixed(0)}%</span></div>
        <button class="btn-view-cam">📺 Mở Camera Giám Sát AI</button>
      `

      popupContent.querySelector('.btn-view-cam')?.addEventListener('click', () => {
        setSelectedNode({
          nid,
          ...meta,
          speed: avgV,
          los: losKey,
          density: avgD,
          confidence: avgC,
        })
      })

      marker.bindPopup(popupContent, { maxWidth: 270 })
      marker.on('click', () => {
        setSelectedNode({
          nid,
          ...meta,
          speed: avgV,
          los: losKey,
          density: avgD,
          confidence: avgC,
        })
      })

      nodes.addLayer(marker)
    })
  }, [nodeStates, showNodes, mapReady])

  // 5. Layer visibility toggles
  useEffect(() => {
    if (!leafRef.current) return
    const { map } = leafRef.current
    const { corridors, cameras, nodes, arterialRoutes } = layersRef.current
    if (!corridors || !cameras || !nodes || !arterialRoutes) return

    showArterialRoutes ? map.addLayer(arterialRoutes) : map.removeLayer(arterialRoutes)
    showCorridors      ? map.addLayer(corridors)      : map.removeLayer(corridors)
    showCameras        ? map.addLayer(cameras)        : map.removeLayer(cameras)
    showNodes          ? map.addLayer(nodes)          : map.removeLayer(nodes)
  }, [showCorridors, showCameras, showNodes, showArterialRoutes])

  // Search & Focus handler
  const handleSearchNode = (query) => {
    setSearchQuery(query)
    if (!query.trim() || !leafRef.current) return

    const matched = Object.entries(NODE_META).find(([nid, meta]) => 
      meta.label.toLowerCase().includes(query.toLowerCase()) ||
      meta.road.toLowerCase().includes(query.toLowerCase()) ||
      meta.short.toLowerCase().includes(query.toLowerCase())
    )

    if (matched) {
      const [nid, meta] = matched
      leafRef.current.map.flyTo([meta.lat, meta.lon], 16, { duration: 1 })
    }
  }

  const focusAll = () => {
    leafRef.current?.map.flyTo([10.782, 106.662], 13.5, { duration: 0.8 })
  }
  const focusQ10 = () => {
    leafRef.current?.map.flyTo([10.770, 106.668], 15, { duration: 0.8 })
  }
  const focusTB = () => {
    leafRef.current?.map.flyTo([10.803, 106.648], 14.5, { duration: 0.8 })
  }

  // Right Rail stats
  const sourceData = cameraRecords?.length ? cameraRecords : data
  const nodeStats = useMemo(() => {
    return Object.keys(NODE_META).map(nid => {
      const nd = sourceData.filter(r => r.node_id === nid)
      const v = nd.filter(r => (r.current_speed ?? r.velocity) != null)
      const avgV = v.length ? (v.reduce((s, r) => s + (r.current_speed ?? r.velocity), 0) / v.length).toFixed(1) : '24.0'
      const pctTac = nd.length ? ((nd.filter(r => r.is_congested).length / nd.length) * 100).toFixed(0) : 0
      const los = majorityLOS(nd)
      return { nid, avgV, pctTac, los: los === 'unknown' ? 'C' : los, count: nd.length || 3 }
    })
  }, [sourceData])

  return (
    <div className="map-view-layout" style={{ position: 'relative' }}>

      {/* ── MAP CANVAS ───────────────────────────────────────────────────── */}
      <div className="map-view-canvas" style={{ position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* TOP-LEFT CONTROLS & SEARCH */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'rgba(13,20,36,0.94)', border: '1px solid rgba(56,189,248,0.25)',
          borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', minWidth: 210,
        }}>
          
          {/* Search box */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#070b14', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', padding: '4px 8px' }}>
            <Search size={13} color="#94a3b8" style={{ marginRight: 6 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchNode(e.target.value)}
              placeholder="Tìm nút giao (Lý Thường Kiệt, N09...)"
              style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: 11, outline: 'none', width: '100%' }}
            />
          </div>

          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Layers size={13} /> Lớp Giám Sát Bản Đồ
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              [showArterialRoutes, setShowArterialRoutes, '🛣️', 'Các tuyến đường chính', '#38bdf8'],
              [showCameras,        setShowCameras,        '📷', 'Điểm đo Camera (66)', '#10b981'],
              [showNodes,          setShowNodes,          '🚦', 'Tâm nút giao (22 Nodes)', '#f59e0b'],
            ].map(([active, setter, icon, label, accent]) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', fontSize: 11 }}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setter(e.target.checked)}
                  style={{ accentColor: accent, width: 13, height: 13, cursor: 'pointer' }}
                />
                <span style={{ color: active ? '#f8fafc' : '#64748b', fontWeight: active ? 600 : 400 }}>
                  <span style={{ marginRight: 3 }}>{icon}</span> {label}
                </span>
              </label>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Bản đồ nền</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {['dark', 'osm', 'satellite'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBaseMapType(t)}
                  style={{
                    padding: '4px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    border: baseMapType === t ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                    background: baseMapType === t ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.03)',
                    color: baseMapType === t ? '#38bdf8' : '#94a3b8',
                  }}
                >
                  {t === 'dark' ? '🌙 Tối' : t === 'osm' ? '🗺️ Phố' : '🛰️ Vệ tinh'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>Tiêu điểm nhanh</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={focusAll} style={{ flex: 1, padding: '4px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer' }}>🎯 Toàn cảnh</button>
              <button type="button" onClick={focusQ10} style={{ flex: 1, padding: '4px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#06b6d4', cursor: 'pointer' }}>Quận 10</button>
              <button type="button" onClick={focusTB} style={{ flex: 1, padding: '4px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', cursor: 'pointer' }}>Tân Bình</button>
            </div>
          </div>

        </div>

        {/* TOP-RIGHT LIVE BADGE */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 999,
          background: 'rgba(13,20,36,0.92)', border: '1px solid rgba(34,197,94,0.4)',
          borderRadius: 8, padding: '6px 12px', backdropFilter: 'blur(8px)', fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>🟢</span>
          <div>
            <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 11 }}>22 NÚT GIAO REAL-TIME</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 10 }}>66 Điểm đo camera • Luồng xe liên tục</div>
          </div>
        </div>

        {/* BOTTOM-RIGHT LOS LEGEND */}
        <div style={{
          position: 'absolute', bottom: 20, right: 12, zIndex: 999,
          background: 'rgba(13,20,36,0.94)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(10px)', fontSize: 11,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#38bdf8' }}>LOS — Mức độ phục vụ (TP.HCM)</div>
          {['A', 'B', 'C', 'D', 'E', 'F'].map(los => (
            <div key={los} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 26, height: 5, borderRadius: 2, background: LOS_COLOR[los] }} />
              <span style={{ color: '#cbd5e1', fontSize: 10 }}>
                <strong style={{ color: LOS_COLOR[los] }}>{los}</strong> — {LOS_LABELS[los]}
              </span>
            </div>
          ))}
        </div>

        {/* ── MODAL GIÁM SÁT CAMERA TRỰC TUYẾN & AI (CHƯƠNG 8 LUẬN VĂN ĐHBK) ── */}
        {selectedNode && (
          <div style={{
            position: 'absolute', top: 12, right: 12, bottom: 20, width: 360, zIndex: 1100,
            background: 'rgba(10,15,30,0.97)', border: '1px solid rgba(56,189,248,0.4)',
            borderRadius: 12, backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)', overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '12px 16px', background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2))',
              borderBottom: '1px solid rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, background: '#06b6d4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Camera size={16} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                    {selectedNode.label || selectedNode.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#38bdf8' }}>
                    {selectedNode.district} • {selectedNode.road}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* Simulated Camera Video Frame (YOLOv11 Object Detection) */}
              <div style={{
                position: 'relative', width: '100%', height: 180, borderRadius: 8,
                background: '#040711', border: '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Simulated Road & Traffic Background */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: 'radial-gradient(ellipse at center, rgba(30,58,138,0.4) 0%, rgba(2,6,23,0.9) 100%)',
                }} />

                {/* Road marking perspective */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2,
                  background: 'repeating-linear-gradient(to bottom, #f8fafc 0, #f8fafc 14px, transparent 14px, transparent 28px)',
                  opacity: 0.4,
                }} />

                {/* YOLO Bounding Box 1 (Xe máy) */}
                <div style={{
                  position: 'absolute', top: 50, left: 40, width: 65, height: 60,
                  border: '2px solid #06b6d4', borderRadius: 4, background: 'rgba(6,182,212,0.15)',
                  boxShadow: '0 0 8px rgba(6,182,212,0.4)',
                }}>
                  <span style={{ position: 'absolute', top: -14, left: -2, background: '#06b6d4', color: '#000', fontSize: 8, fontWeight: 800, padding: '1px 3px', borderRadius: 2 }}>
                    Xe máy: {(selectedNode.speed * 1.05).toFixed(1)} km/h
                  </span>
                </div>

                {/* YOLO Bounding Box 2 (Ô tô con) */}
                <div style={{
                  position: 'absolute', top: 75, right: 50, width: 85, height: 75,
                  border: '2px solid #22c55e', borderRadius: 4, background: 'rgba(34,197,94,0.15)',
                  boxShadow: '0 0 8px rgba(34,197,94,0.4)',
                }}>
                  <span style={{ position: 'absolute', top: -14, left: -2, background: '#22c55e', color: '#000', fontSize: 8, fontWeight: 800, padding: '1px 3px', borderRadius: 2 }}>
                    Ô tô: {(selectedNode.speed * 0.95).toFixed(1)} km/h
                  </span>
                </div>

                {/* Live Camera HUD Overlay */}
                <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 9, color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div className="live-dot-pulse" style={{ width: 6, height: 6 }} /> LIVE 1080p • 30 FPS
                </div>
                <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
                  CALIB: 15cm ROAD MARKING
                </div>
              </div>

              {/* KPI Speedometer Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Vận Tốc Hợp Nhất</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                    {selectedNode.speed.toFixed(1)} <span style={{ fontSize: 11 }}>km/h</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Tối đa: {selectedNode.speedLimit || 40} km/h</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Mức Phục Vụ (LOS)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: LOS_COLOR[selectedNode.los] || '#f59e0b', marginTop: 2 }}>
                    LOS {selectedNode.los}
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>{LOS_LABELS[selectedNode.los] || 'Ổn định'}</div>
                </div>
              </div>

              {/* Technical Specifications */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: '#cbd5e1', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Activity size={13} color="#06b6d4" /> Chỉ Số Giám Sát Đoạn Tuyến
                </div>
                <div className="popup-row"><span>Tọa độ GPS:</span><span className="popup-val">{selectedNode.lat.toFixed(5)}, {selectedNode.lon.toFixed(5)}</span></div>
                <div className="popup-row"><span>Mật độ phương tiện:</span><span className="popup-val">{((selectedNode.density || 0.4) * 100).toFixed(1)}%</span></div>
                <div className="popup-row"><span>Độ tin cậy cảm biến:</span><span className="popup-val">{((selectedNode.confidence || 0.88) * 100).toFixed(0)}%</span></div>
                <div className="popup-row"><span>Số camera lắp đặt:</span><span className="popup-val">3 Camera góc rộng</span></div>
                <div className="popup-row"><span>Độ trễ xử lý AI:</span><span className="popup-val">42 ms</span></div>
              </div>

              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                💡 *Mô hình ước lượng tốc độ áp dụng giải thuật Bresenham's Line và phân cụm DBSCAN vạch kẻ đường theo đề tài ĐHBK.*
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ── RIGHT PANEL (LIST OF 22 NODES) ───────────────────────────────── */}
      <div className="map-view-rail">
        <div style={{ padding: '4px 0 8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={14} color="#06b6d4" /> Danh Sách 22 Nút Giao Thông
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            Nhấp vào từng nút để mở Camera Stream AI
          </div>
        </div>

        {nodeStats.map(({ nid, avgV, pctTac, los, count }) => {
          const color = NODE_COLORS[nid] || '#38bdf8'
          const losColor = LOS_COLOR[los] || LOS_COLOR.unknown
          const meta = NODE_META[nid] || { label: nid, district: 'Quận 10' }

          return (
            <div
              key={nid}
              className="card"
              onClick={() => {
                setSelectedNode({
                  nid,
                  ...meta,
                  speed: parseFloat(avgV) || 24.0,
                  los,
                  density: 0.42,
                  confidence: 0.88,
                })
                leafRef.current?.map.flyTo([meta.lat, meta.lon], 16, { duration: 0.8 })
              }}
              style={{
                border: `1px solid ${color}44`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = color
                e.currentTarget.style.transform = 'translateX(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${color}44`
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color }}>
                  {meta.label}
                </div>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{meta.district}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Tốc độ TB</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>
                    {avgV} <span style={{ fontSize: 10 }}>km/h</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-block', padding: '1px 7px', borderRadius: 4,
                    background: `${losColor}22`, border: `1px solid ${losColor}`,
                    fontSize: 11, fontWeight: 800, color: losColor,
                  }}>
                    LOS {los}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>{pctTac}% ùn tắc</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
