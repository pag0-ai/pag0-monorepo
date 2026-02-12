'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Zap, Clock, DollarSign, Rocket } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { MetricCard } from '../../components/metric-card';
import { LoadingSkeleton } from '../../components/loading';
import {
  fetchAnalyticsSummary,
  fetchAnalyticsCosts,
  fetchAnalyticsEndpoints,
  fetchAnalyticsCache,
} from '../../lib/api';

type Period = '1h' | '24h' | '7d' | '30d';

function formatUsdc(amount: string): string {
  return `$${(Number(amount) / 1_000_000).toFixed(2)}`;
}

function getBudgetColor(percentage: number): string {
  if (percentage < 70) return 'bg-green-500';
  if (percentage < 90) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const apiKey = session?.apiKey;
  const [period, setPeriod] = useState<Period>('7d');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics', 'summary', period],
    queryFn: () => fetchAnalyticsSummary(period, apiKey),
    enabled: !!apiKey,
  });

  const { data: costs, isLoading: costsLoading } = useQuery({
    queryKey: ['analytics', 'costs', period],
    queryFn: () => fetchAnalyticsCosts({ period, granularity: 'hourly', apiKey }),
    enabled: !!apiKey,
  });

  const { data: endpoints, isLoading: endpointsLoading } = useQuery({
    queryKey: ['analytics', 'endpoints', period],
    queryFn: () => fetchAnalyticsEndpoints({ period, limit: 10, apiKey }),
    enabled: !!apiKey,
  });

  const { data: cacheStats } = useQuery({
    queryKey: ['analytics', 'cache', period],
    queryFn: () => fetchAnalyticsCache(period, apiKey),
    enabled: !!apiKey,
  });

  const isLoading = summaryLoading || costsLoading || endpointsLoading;

  // Budget data from real API response
  const dailyBudget = summary?.budgetUsage?.daily || { spent: '0', limit: '0', percentage: 0 };
  const monthlyBudget = summary?.budgetUsage?.monthly || { spent: '0', limit: '0', percentage: 0 };
  const dailyPercentage = dailyBudget.percentage || 0;
  const monthlyPercentage = monthlyBudget.percentage || 0;

  // Transform costs data for chart
  const chartData =
    costs?.map((point) => ({
      timestamp: new Date(point.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      spent: Number(point.spent) / 1_000_000,
      saved: Number(point.saved) / 1_000_000,
    })) || [];

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const isEmpty = !summary || summary.totalRequests === 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Overview of your Pag0 proxy metrics</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 bg-gray-800 rounded-lg p-1">
          {(['1h', '24h', '7d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State CTA */}
      {isEmpty && (
        <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-xl p-8 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-600/20 rounded-lg">
              <Rocket className="w-8 h-8 text-blue-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">Welcome to Pag0!</h2>
              <p className="text-gray-300 mb-4">
                Your proxy is ready. Make your first API request through the proxy to start seeing analytics here.
              </p>
              <pre className="bg-gray-900/80 rounded-lg p-4 font-mono text-sm text-gray-300 whitespace-pre-wrap">{`# 1. Check API rankings
curl ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/curation/rankings \\
  -H "X-Pag0-API-Key: ${apiKey}"

# 2. Get recommended APIs by category
curl "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/curation/recommend?category=AI" \\
  -H "X-Pag0-API-Key: ${apiKey}"

# 3. Proxy a request through Pag0
curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/proxy \\
  -H "X-Pag0-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"targetUrl":"https://api.example.com/data","method":"GET"}'`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          icon={Activity}
          title="Total Requests"
          value={summary?.totalRequests.toLocaleString() || '0'}
        />
        <MetricCard
          icon={Zap}
          title="Cache Hit Rate"
          value={`${((summary?.cacheHitRate || 0) * 100).toFixed(1)}%`}
        />
        <MetricCard
          icon={Clock}
          title="Avg Latency"
          value={`${(summary?.avgLatency || 0).toFixed(0)}ms`}
        />
        <MetricCard
          icon={DollarSign}
          title="Cache Savings"
          value={formatUsdc(cacheStats?.totalSavings || '0')}
        />
      </div>

      {/* Cost Chart */}
      <div className="bg-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-6">Cost Over Time</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="timestamp"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickLine={{ stroke: '#9CA3AF' }}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                tickLine={{ stroke: '#9CA3AF' }}
                label={{ value: 'USDC', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F9FAFB',
                }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Line
                type="monotone"
                dataKey="spent"
                stroke="#A78BFA"
                strokeWidth={2}
                dot={false}
                name="Spent"
              />
              <Line
                type="monotone"
                dataKey="saved"
                stroke="#34D399"
                strokeWidth={2}
                dot={false}
                name="Saved"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            No cost data yet. Make some requests through the proxy to see charts here.
          </div>
        )}
      </div>

      {/* Budget Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Daily Budget</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {formatUsdc(dailyBudget.spent)} / {formatUsdc(dailyBudget.limit)}
              </span>
              <span className="text-white font-medium">{dailyPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getBudgetColor(dailyPercentage)}`}
                style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Monthly Budget</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {formatUsdc(monthlyBudget.spent)} / {formatUsdc(monthlyBudget.limit)}
              </span>
              <span className="text-white font-medium">{monthlyPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${getBudgetColor(monthlyPercentage)}`}
                style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Endpoints Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Top Endpoints</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Requests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Cache Hits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Avg Latency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {endpoints && endpoints.length > 0 ? (
                endpoints.map((ep, idx) => (
                  <tr key={idx} className="hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                      {ep.endpoint}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {ep.requestCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatUsdc(ep.totalCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {ep.cacheHitCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {ep.avgLatencyMs.toFixed(0)}ms
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No endpoint data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
