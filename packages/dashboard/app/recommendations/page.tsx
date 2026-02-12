'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import { fetchRecommendations, fetchCategories, type RecommendedEndpoint } from '../../lib/api';

type SortBy = 'overall' | 'cost' | 'latency' | 'reliability';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? 'var(--color-neon-green)'
    : score >= 60
    ? 'var(--color-neon-amber)'
    : 'var(--color-neon-rose)';
  return (
    <span
      className="score-badge"
      style={{ color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      {score.toFixed(1)}
    </span>
  );
}

export default function RecommendationsPage() {
  const { data: session } = useSession();
  const apiKey = session?.apiKey;
  const [category, setCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('overall');

  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchCategories(apiKey),
    enabled: !!apiKey,
  });

  const { data: recommendations, isLoading, isError, refetch } = useQuery({
    queryKey: ['recommendations', category, sortBy],
    queryFn: () => fetchRecommendations({
      category: category === 'all' ? undefined : category,
      sortBy,
      limit: 10,
      apiKey,
    }),
    enabled: !!apiKey,
  });

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-3 mb-1">
          <Sparkles size={28} style={{ color: 'var(--color-neon-amber)' }} />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-txt-primary)' }}>
            Recommendations
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-txt-muted)' }}>
          Discover the best API endpoints curated by performance data
        </p>
      </div>

      {/* Error */}
      {isError && (
        <div className="glass-card p-5 mb-6 flex items-center gap-4" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.1)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--color-neon-rose)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-txt-primary)' }}>Failed to load recommendations</p>
            <p className="text-xs" style={{ color: 'var(--color-txt-muted)' }}>Check that the proxy server is running.</p>
          </div>
          <button onClick={() => refetch()} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-4 mb-8 animate-fade-up" style={{ animationDelay: '80ms' }}>
        {/* Category */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-txt-muted)' }}>Category</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('all')}
              className="px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200"
              style={{
                background: category === 'all' ? 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)' : 'var(--color-obsidian-surface)',
                color: category === 'all' ? 'white' : 'var(--color-txt-muted)',
                border: category === 'all' ? 'none' : '1px solid var(--color-obsidian-border)',
                boxShadow: category === 'all' ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
              }}
            >
              All
            </button>
            {catsLoading ? (
              <span className="text-xs py-2" style={{ color: 'var(--color-txt-muted)' }}>Loading...</span>
            ) : (
              categories?.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200"
                  style={{
                    background: category === cat.name ? 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)' : 'var(--color-obsidian-surface)',
                    color: category === cat.name ? 'white' : 'var(--color-txt-muted)',
                    border: category === cat.name ? 'none' : '1px solid var(--color-obsidian-border)',
                    boxShadow: category === cat.name ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
                  }}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Sort By */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-txt-muted)' }}>Sort By</p>
          <div
            className="inline-flex gap-1 p-1 rounded-xl"
            style={{ background: 'var(--color-obsidian-surface)', border: '1px solid var(--color-obsidian-border)' }}
          >
            {(['overall', 'cost', 'latency', 'reliability'] as SortBy[]).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 capitalize"
                style={{
                  background: sortBy === s ? 'linear-gradient(135deg, var(--color-neon-indigo), #7c3aed)' : 'transparent',
                  color: sortBy === s ? 'white' : 'var(--color-txt-muted)',
                  boxShadow: sortBy === s ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-txt-muted)' }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mr-3" style={{ borderColor: 'var(--color-neon-indigo)', borderTopColor: 'transparent' }} />
          Loading recommendations...
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!recommendations || recommendations.length === 0) && !isError && (
        <div className="glass-card p-16 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <Sparkles size={28} style={{ color: 'var(--color-neon-amber)' }} />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-txt-primary)' }}>No recommendations yet</h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-txt-muted)' }}>
            Make requests through the proxy to build up endpoint performance data for recommendations.
          </p>
        </div>
      )}

      {/* Recommendation Cards */}
      {recommendations && recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-up" style={{ animationDelay: '160ms' }}>
          {recommendations.map((ep, idx) => (
            <div
              key={ep.endpoint}
              className="glass-card p-5 animate-fade-up"
              style={{ animationDelay: `${200 + idx * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{
                        color: idx < 3 ? '#fbbf24' : 'var(--color-txt-muted)',
                        background: idx < 3 ? 'rgba(251,191,36,0.1)' : 'var(--color-obsidian-border)',
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--color-txt-muted)' }}>{ep.category}</span>
                  </div>
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-neon-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {ep.endpoint}
                  </p>
                </div>
                <ScoreBadge score={ep.overallScore} />
              </div>

              <div className="space-y-2.5">
                {([
                  { label: 'Cost', score: ep.costScore },
                  { label: 'Latency', score: ep.latencyScore },
                  { label: 'Reliability', score: ep.reliabilityScore },
                ] as const).map(({ label, score }) => {
                  const barColor = score >= 80 ? 'var(--color-neon-green)' : score >= 60 ? 'var(--color-neon-amber)' : 'var(--color-neon-rose)';
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: 'var(--color-txt-muted)' }}>{label}</span>
                        <span className="font-semibold metric-value" style={{ color: 'var(--color-txt-primary)' }}>{score.toFixed(1)}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--color-obsidian-border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${score}%`, background: barColor, boxShadow: `0 0 6px ${barColor}40` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {ep.evidence && (
                <div className="mt-4 pt-3 flex gap-4 text-[11px] border-t" style={{ borderColor: 'var(--color-obsidian-border)', color: 'var(--color-txt-muted)' }}>
                  <span>{ep.evidence.sampleSize} samples</span>
                  <span>{ep.evidence.avgLatencyMs.toFixed(0)}ms avg</span>
                  <span>{(ep.evidence.successRate * 100).toFixed(1)}% success</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
