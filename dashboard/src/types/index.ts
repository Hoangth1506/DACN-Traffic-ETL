// Type definitions for DACN Traffic Dashboard

export interface TrafficNode {
  node_id: string;
  node_short: string;
  fused_velocity: number;
  fused_density: number;
  congestion_level: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  confidence: number;
  active_cameras: number;
  total_cameras: number;
  node_lat: number;
  node_lon: number;
  timestamp: string;
  los: string;
  is_congested: boolean;
}

export interface SessionMetrics {
  timestamp: string;
  avg_velocity: number;
  avg_confidence: number;
  total_nodes: number;
  congestion_rate: number;
}

export interface PerformanceMetrics {
  etl_duration_s: number;
  spatial_join_time_s: number;
  fusion_time_s: number;
  collection_time_s: number;
  cache_hit_rate: number;
  total_sessions_processed: number;
}

export interface QualityReport {
  fusion_mae: number;
  fusion_mape: number;
  segment_agreement: number;
  congestion_detection: number;
  node_coverage: number;
}

export interface DashboardData {
  nodes: TrafficNode[];
  sessions: SessionMetrics[];
  performance: PerformanceMetrics;
  quality: QualityReport;
  last_update: string;
}

export interface MapViewProps {
  nodes: TrafficNode[];
  selectedNode: string | null;
  onNodeSelect: (nodeId: string) => void;
}

export interface PanelProps {
  data: DashboardData;
  loading?: boolean;
  error?: Error | null;
}
