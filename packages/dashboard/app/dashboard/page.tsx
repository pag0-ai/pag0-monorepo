'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Zap, Clock, DollarSign, Rocket, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  AreaChart,
  Area,
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

function getGranularity(period: Period): string {
  switch (period) {
    case '1h': return 'minute';
    case '24h': return 'hourly';
    case '7d': return 'daily';
    case '30d': return 'daily';
  }
}

function formatUsdc(amount: string): string {
  return `$${(Number(amount) / 1_000_000).toFixed(2)}`;
}

function getBudgetColor(percentage: number): string {
  if (percentage < 70) return 'var(--color-neon-green)';
  if (percentage < 90) return 'var(--color-neon-amber)';
  return 'var(--color-neon-rose)';
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const apiKey = session?.apiKey;
  const [period, setPeriod] = useState<Period>('7d');
  const [sortField, setSortField] = useState<string>('requestCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: summaryRefetch } = useQuery({
    queryKey: ['analytics', 'summary', period],
    queryFn: () => fetchAnalyticsSummary(period, apiKey),
    enabled: !!apiKey,
  });

  const { data: costs, isLoading: costsLoading, isError: costsError } = useQuery({
    queryKey: ['analytics', 'costs', period],
    queryFn: () => fetchAnalyticsCosts({ period, granularity: getGranularity(period), apiKey }),
    enabled: !!apiKey,
  });

  const { data: endpoints, isLoading: endpointsLoading, isError: endpointsError } = useQuery({
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

  const dailyBudget = summary?.budgetUsage?.daily || { spent: '0', limit: '0', percentage: 0 };
  const monthlyBudget = summary?.budgetUsage?.monthly || { spent: '0', limit: '0', percentage: 0 };
  const dailyPercentage = dailyBudget.percentage || 0;
  const monthlyPercentage = monthlyBudget.percentage || 0;

  const chartData =
    costs?.map((point) => ({
      timestamp: period === '7d' || period === '30d'
        ? new Date(point.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      spent: Number(point.spent) / 1_000_000,
      saved: Number(point.saved) / 1_000_000,
    })) || [];

  const hasError = summaryError || costsError || endpointsError;

  const sortedEndpoints = [...(endpoints || [])].sort((a, b) => {
    const fieldMap: Record<string, keyof typeof a> = {
      'Requests': 'requestCount',
      'Cost': 'totalCost',
      'Cache Hits': 'cacheHitCount',
      'Avg Latency': 'avgLatencyMs',
      'Success Rate': 'successRate',
    };
    const key = fieldMap[sortField] || 'requestCount';
    let aVal = key === 'totalCost' ? Number(a[key]) : (a[key] as number);
    let bVal = key === 'totalCost' ? Number(b[key]) : (b[key] as number);
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const isEmpty = !summary || summary.totalRequests === 0;

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight mb-1"
            style={{ color: 'var(--color-txt-primary)', fontFamily: 'var(--font-display)' }}
          >
            Dashboard
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-txt-muted)' }}>
            Real-time overview of your proxy metrics
          </p>
        </div>

        {/* Period Selector */}
        <div
          className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'var(--color-obsidian-surface)', border: '1px solid var(--color-obsidian-border)' }}
        >
          {(['1h', '24h', '7d', '30d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200"
              style={{
                background: period === p
                  ? 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)'
                  : 'transparent',
                color: period === p ? 'white' : 'var(--color-txt-muted)',
                boxShadow: period === p ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {hasError && (
        <div
          className="glass-card p-5 mb-6 flex items-center gap-4 animate-fade-up"
          style={{ borderColor: 'rgba(244, 63, 94, 0.3)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(244, 63, 94, 0.1)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--color-neon-rose)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-txt-primary)' }}>Failed to load dashboard data</p>
            <p className="text-xs" style={{ color: 'var(--color-txt-muted)' }}>Check that the proxy server is running.</p>
          </div>
          <button
            onClick={() => summaryRefetch()}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-2"
          >
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Empty State CTA */}
      {isEmpty && (
        <div
          className="glass-card p-8 mb-8 animate-fade-up glow-indigo"
          style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}
        >
          <div className="flex items-start gap-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)' }}
            >
              <Rocket size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-txt-primary)' }}>Welcome to Pag0</h2>
              <p className="text-sm mb-5" style={{ color: 'var(--color-txt-secondary)' }}>
                Your proxy is ready. Make your first API request to start seeing analytics.
              </p>
              <pre
                className="rounded-xl p-5 text-xs leading-relaxed overflow-x-auto"
                style={{
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-obsidian-base)',
                  border: '1px solid var(--color-obsidian-border)',
                  color: 'var(--color-txt-secondary)',
                }}
              >{`# Check API rankings
curl ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/curation/rankings \\
  -H "X-Pag0-API-Key: ${apiKey || 'YOUR_API_KEY'}"

# Proxy a request through Pag0
curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/proxy \\
  -H "X-Pag0-API-Key: ${apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"targetUrl":"https://api.example.com/data","method":"GET"}'

# Transparent relay (raw 402 pass-through for x402 SDK)
curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/relay \\
  -H "X-Pag0-API-Key: ${apiKey || 'YOUR_API_KEY'}" \\
  -H "X-Pag0-Target-URL: https://x402-ai-starter-alpha.vercel.app/api/add" \\
  -H "Content-Type: application/json" \\
  -d '{"a":1,"b":2}'`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          icon={Activity}
          title="Total Requests"
          value={summary?.totalRequests.toLocaleString() || '0'}
          accentColor="var(--color-neon-cyan)"
          delay={0}
        />
        <MetricCard
          icon={Zap}
          title="Cache Hit Rate"
          value={`${((summary?.cacheHitRate || 0) * 100).toFixed(1)}%`}
          accentColor="var(--color-neon-green)"
          delay={80}
        />
        <MetricCard
          icon={Clock}
          title="Avg Latency"
          value={`${(summary?.avgLatency || 0).toFixed(0)}ms`}
          accentColor="var(--color-neon-amber)"
          delay={160}
        />
        <MetricCard
          icon={DollarSign}
          title="Cache Savings"
          value={formatUsdc(cacheStats?.totalSavings || '0')}
          accentColor="var(--color-neon-indigo)"
          delay={240}
        />
      </div>

      {/* Cost Chart */}
      <div className="glass-card p-6 mb-8 animate-fade-up" style={{ animationDelay: '300ms' }}>
        <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--color-txt-primary)' }}>
          Cost Over Time
        </h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradientSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientSaved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-obsidian-border)"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                stroke="var(--color-obsidian-border-bright)"
                tick={{ fill: 'var(--color-txt-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-obsidian-border-bright)"
                tick={{ fill: 'var(--color-txt-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: 'USDC',
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'var(--color-txt-muted)',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-obsidian-elevated)',
                  border: '1px solid var(--color-obsidian-border-bright)',
                  borderRadius: '12px',
                  color: 'var(--color-txt-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                labelStyle={{ color: 'var(--color-txt-muted)' }}
              />
              <Area
                type="monotone"
                dataKey="spent"
                stroke="#818cf8"
                strokeWidth={2}
                fill="url(#gradientSpent)"
                name="Spent"
              />
              <Area
                type="monotone"
                dataKey="saved"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradientSaved)"
                name="Saved"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px]" style={{ color: 'var(--color-txt-muted)' }}>
            <p className="text-sm">No cost data yet. Make requests through the proxy to see charts.</p>
          </div>
        )}
      </div>

      {/* Budget Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {[
          { label: 'Daily Budget', budget: dailyBudget, pct: dailyPercentage },
          { label: 'Monthly Budget', budget: monthlyBudget, pct: monthlyPercentage },
        ].map(({ label, budget, pct }, i) => (
          <div
            key={label}
            className="glass-card p-5 animate-fade-up"
            style={{ animationDelay: `${380 + i * 80}ms` }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-txt-primary)' }}>
              {label}
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="metric-value" style={{ color: 'var(--color-txt-secondary)' }}>
                  {formatUsdc(budget.spent)} / {formatUsdc(budget.limit)}
                </span>
                <span className="metric-value font-semibold" style={{ color: getBudgetColor(pct) }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-obsidian-border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out progress-glow"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: `linear-gradient(90deg, ${getBudgetColor(pct)}, color-mix(in srgb, ${getBudgetColor(pct)} 70%, white))`,
                    boxShadow: `0 0 8px ${getBudgetColor(pct)}40`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Endpoints Table */}
      <div className="glass-card overflow-hidden animate-fade-up" style={{ animationDelay: '540ms' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-obsidian-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-txt-primary)' }}>
            Top Endpoints
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--color-obsidian-base)' }}>
                {['Endpoint', 'Requests', 'Cost', 'Cache Hits', 'Avg Latency', 'Success Rate'].map((h) => {
                  const sortable = h !== 'Endpoint';
                  return (
                    <th
                      key={h}
                      className={`px-6 py-3 text-left text-[10px] font-semibold uppercase tracking-widest ${sortable ? 'cursor-pointer select-none hover:text-white transition-colors' : ''}`}
                      style={{ color: sortField === h ? 'var(--color-neon-indigo-light)' : 'var(--color-txt-muted)' }}
                      onClick={() => {
                        if (!sortable) return;
                        if (sortField === h) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                        else { setSortField(h); setSortDir('desc'); }
                      }}
                    >
                      {h}
                      {sortField === h && <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedEndpoints && sortedEndpoints.length > 0 ? (
                sortedEndpoints.map((ep, idx) => (
                  <tr
                    key={idx}
                    className="table-row-hover border-t"
                    style={{ borderColor: 'var(--color-obsidian-border)' }}
                  >
                    <td className="px-6 py-3.5 text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-neon-cyan)' }}>
                      {ep.endpoint}
                    </td>
                    <td className="px-6 py-3.5 text-sm metric-value" style={{ color: 'var(--color-txt-secondary)' }}>
                      {ep.requestCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 text-sm metric-value" style={{ color: 'var(--color-txt-secondary)' }}>
                      {formatUsdc(ep.totalCost)}
                    </td>
                    <td className="px-6 py-3.5 text-sm metric-value" style={{ color: 'var(--color-txt-secondary)' }}>
                      {ep.cacheHitCount}
                    </td>
                    <td className="px-6 py-3.5 text-sm metric-value" style={{ color: 'var(--color-txt-secondary)' }}>
                      {ep.avgLatencyMs.toFixed(0)}ms
                    </td>
                    <td className="px-6 py-3.5 text-sm metric-value">
                      <span
                        className="score-badge"
                        style={{
                          color: (ep.successRate ?? 0) >= 0.95 ? 'var(--color-neon-green)' : (ep.successRate ?? 0) >= 0.8 ? 'var(--color-neon-amber)' : 'var(--color-neon-rose)',
                          background: (ep.successRate ?? 0) >= 0.95 ? 'rgba(16,185,129,0.1)' : (ep.successRate ?? 0) >= 0.8 ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)',
                        }}
                      >
                        {((ep.successRate ?? 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: 'var(--color-txt-muted)' }}>
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
