'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchRankings, fetchCategories, fetchApi, fetchEndpointScore, type EndpointScore, type Category } from '../../lib/api';
import { Award, Trophy, Medal, Crown, AlertTriangle, RotateCcw, X, Info } from 'lucide-react';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? 'var(--color-neon-green)'
    : score >= 60
    ? 'var(--color-neon-amber)'
    : 'var(--color-neon-rose)';
  return (
    <span
      className="score-badge"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {score.toFixed(1)}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="flex items-center gap-1.5 font-bold" style={{ color: '#fbbf24' }}><Trophy size={15} /> 1st</div>;
  if (rank === 2) return <div className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--color-txt-secondary)' }}><Award size={15} /> 2nd</div>;
  if (rank === 3) return <div className="flex items-center gap-1.5 font-semibold" style={{ color: '#f97316' }}><Medal size={15} /> 3rd</div>;
  return <span className="metric-value text-sm" style={{ color: 'var(--color-txt-muted)' }}>{rank}</span>;
}

interface ComparisonEndpoint {
  endpoint: string;
  overallScore: number;
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
  reputationScore?: number;
  weights?: { cost: number; latency: number; reliability: number; reputation: number };
  evidence?: { sampleSize: number; period: string; avgCostPerRequest: string; avgLatencyMs: number; successRate: number };
}

interface ComparisonWinner { overall: string; cost: string; latency: string; reliability: string }
interface ComparisonDifferences { costRange: { min: number; max: number; delta: number }; latencyRange: { min: number; max: number; delta: number }; reliabilityRange: { min: number; max: number; delta: number } }
interface ComparisonData { endpoints: ComparisonEndpoint[]; winner?: ComparisonWinner; differences?: ComparisonDifferences }

export default function RankingsPage() {
  const { data: session } = useSession();
  const apiKey = session?.apiKey;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  const { data: rankings, isLoading: rankingsLoading, isError: rankingsError, refetch: rankingsRefetch } = useQuery({
    queryKey: ['rankings', selectedCategory],
    queryFn: () => fetchRankings({ category: selectedCategory === 'all' ? undefined : selectedCategory, apiKey }),
    enabled: !!apiKey,
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchCategories(apiKey),
    enabled: !!apiKey,
  });

  const { data: comparison, isLoading: comparisonLoading, refetch: compareRefetch } = useQuery({
    queryKey: ['compare', selectedEndpoints],
    queryFn: async () => {
      const res = await fetchApi<{ data: ComparisonData }>(`/api/curation/compare?endpoints=${selectedEndpoints.join(',')}`, { apiKey });
      return res.data;
    },
    enabled: false,
  });

  const { data: endpointDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['endpoint-score', selectedEndpoint],
    queryFn: () => fetchEndpointScore(selectedEndpoint!, apiKey),
    enabled: !!selectedEndpoint && !!apiKey,
  });

  const handleCheckboxChange = (endpoint: string, checked: boolean) => {
    if (checked && selectedEndpoints.length < 5) setSelectedEndpoints([...selectedEndpoints, endpoint]);
    else if (!checked) setSelectedEndpoints(selectedEndpoints.filter(e => e !== endpoint));
  };

  const handleCompare = async () => {
    if (selectedEndpoints.length >= 2) { await compareRefetch(); setShowComparison(true); }
  };

  const categoryStats = categories?.map(cat => {
    const catRankings = rankings?.filter(r => r.category === cat.name) || [];
    const avgScore = catRankings.length > 0 ? catRankings.reduce((sum, r) => sum + r.overallScore, 0) / catRankings.length : 0;
    return { name: cat.name, count: catRankings.length, avgScore };
  }) || [];

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-txt-primary)' }}>
          API Rankings
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-txt-muted)' }}>
          Discover and compare the best-performing API endpoints
        </p>
      </div>

      {/* Error */}
      {rankingsError && (
        <div className="glass-card p-5 mb-6 flex items-center gap-4" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.1)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--color-neon-rose)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-txt-primary)' }}>Failed to load rankings</p>
            <p className="text-xs" style={{ color: 'var(--color-txt-muted)' }}>Check that the proxy server is running.</p>
          </div>
          <button onClick={() => rankingsRefetch()} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className="px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200"
            style={{
              background: selectedCategory === 'all' ? 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)' : 'var(--color-obsidian-surface)',
              color: selectedCategory === 'all' ? 'white' : 'var(--color-txt-muted)',
              border: selectedCategory === 'all' ? 'none' : '1px solid var(--color-obsidian-border)',
              boxShadow: selectedCategory === 'all' ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            All
          </button>
          {categoriesLoading ? (
            <span className="text-xs py-2" style={{ color: 'var(--color-txt-muted)' }}>Loading...</span>
          ) : (
            categories?.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className="px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200"
                style={{
                  background: selectedCategory === cat.name ? 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)' : 'var(--color-obsidian-surface)',
                  color: selectedCategory === cat.name ? 'white' : 'var(--color-txt-muted)',
                  border: selectedCategory === cat.name ? 'none' : '1px solid var(--color-obsidian-border)',
                  boxShadow: selectedCategory === cat.name ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
                }}
              >
                {cat.name}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Rankings Table */}
      <div className="glass-card overflow-hidden mb-6 animate-fade-up" style={{ animationDelay: '160ms' }}>
        <div className="px-6 py-4 flex justify-between items-center border-b" style={{ borderColor: 'var(--color-obsidian-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-txt-primary)' }}>Leaderboard</h2>
          <div className="flex items-center gap-3">
            {selectedEndpoints.length < 2 && (
              <span className="text-xs" style={{ color: 'var(--color-txt-muted)' }}>Select 2+ endpoints to compare</span>
            )}
            {selectedEndpoints.length >= 2 && (
              <button onClick={handleCompare} disabled={comparisonLoading} className="btn-primary px-4 py-2 text-xs">
                {comparisonLoading ? 'Comparing...' : `Compare (${selectedEndpoints.length})`}
              </button>
            )}
          </div>
        </div>

        {rankingsLoading ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--color-txt-muted)' }}>Loading rankings...</div>
        ) : !rankings || rankings.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--color-txt-muted)' }}>No rankings available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--color-obsidian-base)' }}>
                  {['Select', 'Rank', 'Endpoint', 'Overall', 'Cost', 'Latency', 'Reliability'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-txt-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.map((ranking, index) => (
                  <tr key={ranking.endpoint} className="table-row-hover border-t" style={{ borderColor: 'var(--color-obsidian-border)' }}>
                    <td className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={selectedEndpoints.includes(ranking.endpoint)}
                        onChange={(e) => handleCheckboxChange(ranking.endpoint, e.target.checked)}
                        disabled={!selectedEndpoints.includes(ranking.endpoint) && selectedEndpoints.length >= 5}
                        className="w-4 h-4 rounded accent-[var(--color-neon-indigo)]"
                      />
                    </td>
                    <td className="px-5 py-3.5"><RankBadge rank={index + 1} /></td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm font-medium cursor-pointer hover:underline" style={{ color: 'var(--color-neon-cyan)', fontFamily: 'var(--font-mono)' }} onClick={() => setSelectedEndpoint(ranking.endpoint)}>{ranking.endpoint}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-txt-muted)' }}>{ranking.category}</div>
                    </td>
                    <td className="px-5 py-3.5"><ScoreBadge score={ranking.overallScore} /></td>
                    <td className="px-5 py-3.5"><ScoreBadge score={ranking.costScore} /></td>
                    <td className="px-5 py-3.5"><ScoreBadge score={ranking.latencyScore} /></td>
                    <td className="px-5 py-3.5"><ScoreBadge score={ranking.reliabilityScore} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comparison Panel */}
      {showComparison && comparison && (
        <div className="glass-card p-6 mb-6 animate-fade-up glow-indigo" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-txt-primary)' }}>Comparison Results</h2>
          {comparison.winner && (
            <div
              className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}
            >
              <Crown size={18} style={{ color: '#fbbf24' }} />
              <span className="text-sm font-semibold" style={{ color: '#fbbf24' }}>Overall Winner:</span>
              <span className="text-sm" style={{ color: 'var(--color-txt-primary)', fontFamily: 'var(--font-mono)' }}>{comparison.winner.overall}</span>
            </div>
          )}
          {comparison.differences && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {(['costRange', 'latencyRange', 'reliabilityRange'] as const).map((key) => {
                const range = comparison.differences![key];
                const label = key.replace('Range', '');
                return (
                  <div key={key} className="rounded-xl p-4 text-center" style={{ background: 'var(--color-obsidian-base)', border: '1px solid var(--color-obsidian-border)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-txt-muted)' }}>{label} Spread</div>
                    <div className="text-xl font-bold metric-value" style={{ color: 'var(--color-txt-primary)' }}>{range.delta.toFixed(1)}</div>
                    <div className="text-[11px] metric-value" style={{ color: 'var(--color-txt-muted)' }}>{range.min.toFixed(1)} — {range.max.toFixed(1)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparison.endpoints.map((ep) => {
              const isOverallWinner = comparison.winner?.overall === ep.endpoint;
              return (
                <div
                  key={ep.endpoint}
                  className="rounded-xl p-5"
                  style={{
                    background: 'var(--color-obsidian-base)',
                    border: isOverallWinner ? '1px solid rgba(251,191,36,0.25)' : '1px solid var(--color-obsidian-border)',
                    boxShadow: isOverallWinner ? '0 0 20px rgba(251,191,36,0.08)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    {isOverallWinner && <Crown size={14} style={{ color: '#fbbf24' }} />}
                    <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-txt-primary)', fontFamily: 'var(--font-mono)' }}>{ep.endpoint}</h3>
                  </div>
                  <div className="space-y-3">
                    {([
                      ['Overall', 'overallScore', 'overall'] as const,
                      ['Cost', 'costScore', 'cost'] as const,
                      ['Latency', 'latencyScore', 'latency'] as const,
                      ['Reliability', 'reliabilityScore', 'reliability'] as const,
                    ]).map(([label, key, winnerKey]) => {
                      const score = ep[key];
                      const isDimWinner = comparison.winner?.[winnerKey] === ep.endpoint;
                      const barColor = score >= 80 ? 'var(--color-neon-green)' : score >= 60 ? 'var(--color-neon-amber)' : 'var(--color-neon-rose)';
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="flex items-center gap-1.5" style={{ color: 'var(--color-txt-muted)' }}>
                              {label}
                              {isDimWinner && winnerKey !== 'overall' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)' }}>BEST</span>
                              )}
                            </span>
                            <span className="font-semibold metric-value" style={{ color: 'var(--color-txt-primary)' }}>{score.toFixed(1)}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--color-obsidian-border)' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: barColor, boxShadow: `0 0 6px ${barColor}40` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Overview Cards */}
      <div className="mb-6 animate-fade-up" style={{ animationDelay: '240ms' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--color-txt-primary)' }}>Category Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryStats.map((cat, i) => (
            <div
              key={cat.name}
              className="glass-card p-5 animate-fade-up"
              style={{ animationDelay: `${320 + i * 60}ms` }}
            >
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-txt-primary)' }}>{cat.name}</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold metric-value" style={{ color: 'var(--color-txt-primary)' }}>{cat.count}</span>
                <span className="text-[11px]" style={{ color: 'var(--color-txt-muted)' }}>endpoints</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: 'var(--color-txt-muted)' }}>Avg Score:</span>
                <ScoreBadge score={cat.avgScore} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoint Detail Modal */}
      {selectedEndpoint && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(7,7,14,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card max-w-lg w-full mx-4 glow-indigo" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-obsidian-border)' }}>
              <div className="flex items-center gap-2">
                <Info size={18} style={{ color: 'var(--color-neon-indigo)' }} />
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-txt-primary)' }}>Endpoint Details</h2>
              </div>
              <button onClick={() => setSelectedEndpoint(null)} className="p-1 rounded-lg" style={{ color: 'var(--color-txt-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm font-medium mb-4 break-all" style={{ color: 'var(--color-neon-cyan)', fontFamily: 'var(--font-mono)' }}>
                {selectedEndpoint}
              </p>
              {detailLoading ? (
                <div className="text-sm py-8 text-center" style={{ color: 'var(--color-txt-muted)' }}>Loading...</div>
              ) : endpointDetail ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Overall', value: endpointDetail.overallScore.toFixed(1), color: endpointDetail.overallScore >= 80 ? 'var(--color-neon-green)' : endpointDetail.overallScore >= 60 ? 'var(--color-neon-amber)' : 'var(--color-neon-rose)' },
                      { label: 'Cost', value: endpointDetail.costScore.toFixed(1), color: endpointDetail.costScore >= 80 ? 'var(--color-neon-green)' : endpointDetail.costScore >= 60 ? 'var(--color-neon-amber)' : 'var(--color-neon-rose)' },
                      { label: 'Latency', value: endpointDetail.latencyScore.toFixed(1), color: endpointDetail.latencyScore >= 80 ? 'var(--color-neon-green)' : endpointDetail.latencyScore >= 60 ? 'var(--color-neon-amber)' : 'var(--color-neon-rose)' },
                      { label: 'Reliability', value: endpointDetail.reliabilityScore.toFixed(1), color: endpointDetail.reliabilityScore >= 80 ? 'var(--color-neon-green)' : endpointDetail.reliabilityScore >= 60 ? 'var(--color-neon-amber)' : 'var(--color-neon-rose)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--color-obsidian-base)', border: '1px solid var(--color-obsidian-border)' }}>
                        <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-txt-muted)' }}>{label}</div>
                        <div className="text-xl font-bold metric-value" style={{ color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {endpointDetail.evidence && (
                    <div className="rounded-xl p-4" style={{ background: 'var(--color-obsidian-base)', border: '1px solid var(--color-obsidian-border)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-txt-muted)' }}>Evidence</div>
                      <div className="space-y-2">
                        {[
                          { label: 'Sample Size', value: endpointDetail.evidence.sampleSize.toLocaleString() },
                          { label: 'Avg Cost', value: `$${(Number(endpointDetail.evidence.avgCostPerRequest) / 1_000_000).toFixed(4)}` },
                          { label: 'Avg Latency', value: `${endpointDetail.evidence.avgLatencyMs.toFixed(0)}ms` },
                          { label: 'Success Rate', value: `${(endpointDetail.evidence.successRate * 100).toFixed(1)}%` },
                          { label: 'Period', value: endpointDetail.evidence.period },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between text-xs">
                            <span style={{ color: 'var(--color-txt-muted)' }}>{label}</span>
                            <span className="metric-value font-medium" style={{ color: 'var(--color-txt-primary)' }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-[11px] text-center" style={{ color: 'var(--color-txt-muted)' }}>
                    Category: {endpointDetail.category} · Samples: {endpointDetail.sampleSize}
                  </div>
                </div>
              ) : (
                <div className="text-sm py-8 text-center" style={{ color: 'var(--color-txt-muted)' }}>No details available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
