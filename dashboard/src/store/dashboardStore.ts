import { create } from 'zustand'
import type { TrafficNode, DashboardData } from '@types/index'

interface DashboardState {
  // Data
  data: DashboardData | null
  selectedNode: string | null

  // UI state
  isLoading: boolean
  error: Error | null
  autoRefresh: boolean
  refreshInterval: number

  // Actions
  setData: (data: DashboardData) => void
  setSelectedNode: (nodeId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: Error | null) => void
  toggleAutoRefresh: () => void
  setRefreshInterval: (interval: number) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  // Initial state
  data: null,
  selectedNode: null,
  isLoading: true,
  error: null,
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds

  // Actions
  setData: (data) => set({ data, isLoading: false, error: null }),
  setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  toggleAutoRefresh: () => set((state) => ({ autoRefresh: !state.autoRefresh })),
  setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
}))
