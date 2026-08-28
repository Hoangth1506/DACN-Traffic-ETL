import { useQuery, UseQueryResult } from '@tanstack/react-query'
import type { DashboardData } from '@types/index'

const API_BASE = ''

async function fetchJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`)
  }
  return response.json()
}

export function useDashboardData(
  refreshInterval: number = 30000
): UseQueryResult<DashboardData, Error> {
  return useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      const [nodes, performance, quality] = await Promise.all([
        fetchJSON('/traffic_data.json'),
        fetchJSON('/performance_metrics.json'),
        fetchJSON('/quality_summary.json'),
      ])

      return {
        nodes: nodes.nodes || [],
        sessions: nodes.sessions || [],
        performance,
        quality,
        last_update: new Date().toISOString(),
      }
    },
    refetchInterval: refreshInterval,
    staleTime: 10000,
    retry: 3,
  })
}

export function useNodeHistory(nodeId: string) {
  return useQuery({
    queryKey: ['node-history', nodeId],
    queryFn: () => fetchJSON(`/node_history/${nodeId}.json`),
    enabled: !!nodeId,
    staleTime: 60000,
  })
}
