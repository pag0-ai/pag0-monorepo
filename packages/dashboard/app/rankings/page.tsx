'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchRankings, fetchCategories, fetchApi, type EndpointScore, type Category } from '../../lib/api';
import { Award, Trophy, Medal, Crown, AlertCircle, RefreshCw } from 'lucide-react';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-400 bg-green-400/10'
    : score >= 60 ? 'text-yellow-400 bg-yellow-400/10'
    : 'text-red-400 bg-red-400/10';
  return (
    <span className={`px-2 py-1 rounded-full text-sm font-medium ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <div className="flex items-center gap-1 text-yellow-400"><Trophy size={16} /> 1st</div>;
  }
  if (rank === 2) {
    return <div className="flex items-center gap-1 text-gray-400"><Award size={16} /> 2nd</div>;
  }
  if (rank === 3) {
    return <div className="flex items-center gap-1 text-orange-400"><Medal size={16} /> 3rd</div>;
  }
  return <span className="text-gray-500">{rank}</span>;
}

interface ComparisonEndpoint {
  endpoint: string;
  overallScore: number;
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
}

interface ComparisonWinner {
  overall: string;
  cost: string;
  latency: string;
  reliability: string;
}

interface ComparisonData {
  endpoints: ComparisonEndpoint[];
  winner?: ComparisonWinner;
}

export default function RankingsPage() {
  const { data: session } = useSession();
  const apiKey = session?.apiKey;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const { data: rankings, isLoading: rankingsLoading, isError: rankingsError, refetch: rankingsRefetch } = useQuery({
    queryKey: ['rankings', selectedCategory],
    queryFn: () => fetchRankings({
      category: selectedCategory === 'all' ? undefined : selectedCategory,
      apiKey,
    }),
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

  const handleCheckboxChange = (endpoint: string, checked: boolean) => {
    if (checked && selectedEndpoints.length < 5) {
      setSelectedEndpoints([...selectedEndpoints, endpoint]);
    } else if (!checked) {
      setSelectedEndpoints(selectedEndpoints.filter(e => e !== endpoint));
    }
  };

  const handleCompare = async () => {
    if (selectedEndpoints.length >= 2) {
      await compareRefetch();
      setShowComparison(true);
    }
  };

  const categoryStats = categories?.map(cat => {
    const catRankings = rankings?.filter(r => r.category === cat.name) || [];
    const avgScore = catRankings.length > 0
      ? catRankings.reduce((sum, r) => sum + r.overallScore, 0) / catRankings.length
      : 0;
    return {
      name: cat.name,
      count: catRankings.length,
      avgScore,
    };
  }) || [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">API Rankings</h1>
      <p className="text-gray-400 mb-8">Discover and compare the best-performing API endpoints</p>

      {/* Error State */}
      {rankingsError && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6 mb-6 flex items-center gap-4">
          <AlertCircle className="w-8 h-8 text-red-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-white font-medium">Failed to load rankings</h3>
            <p className="text-gray-400 text-sm">Check that the proxy server is running.</p>
          </div>
          <button onClick={() => rankingsRefetch()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {categoriesLoading ? (
            <div className="text-gray-500">Loading categories...</div>
          ) : (
            categories?.map(cat => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat.name
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat.name}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Rankings Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Leaderboard</h2>
          {selectedEndpoints.length >= 2 && (
            <button
              onClick={handleCompare}
              disabled={comparisonLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {comparisonLoading ? 'Comparing...' : `Compare (${selectedEndpoints.length})`}
            </button>
          )}
        </div>

        {rankingsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading rankings...</div>
        ) : !rankings || rankings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No rankings available for this category</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-16">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-24">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Overall
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Latency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Reliability
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {rankings.map((ranking, index) => (
                  <tr key={ranking.endpoint} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEndpoints.includes(ranking.endpoint)}
                        onChange={(e) => handleCheckboxChange(ranking.endpoint, e.target.checked)}
                        disabled={!selectedEndpoints.includes(ranking.endpoint) && selectedEndpoints.length >= 5}
                        className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <RankBadge rank={index + 1} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{ranking.endpoint}</div>
                      <div className="text-sm text-gray-400">{ranking.category}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={ranking.overallScore} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={ranking.costScore} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={ranking.latencyScore} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={ranking.reliabilityScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comparison Panel */}
      {showComparison && comparison && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Comparison Results</h2>
          {comparison.winner && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
              <Crown size={20} className="text-yellow-400" />
              <span className="text-yellow-200 font-medium">Overall Winner:</span>
              <span className="text-white font-mono text-sm">{comparison.winner.overall}</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparison.endpoints.map((ep) => {
              const isOverallWinner = comparison.winner?.overall === ep.endpoint;
              return (
                <div key={ep.endpoint} className={`bg-gray-900 rounded-lg p-4 ${isOverallWinner ? 'ring-2 ring-yellow-500/60' : ''}`}>
                  <div className="flex items-center gap-2 mb-4">
                    {isOverallWinner && <Crown size={16} className="text-yellow-400 shrink-0" />}
                    <h3 className="text-white font-medium truncate">{ep.endpoint}</h3>
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
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400 flex items-center gap-1">
                              {label}
                              {isDimWinner && winnerKey !== 'overall' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full font-medium">BEST</span>
                              )}
                            </span>
                            <span className="text-white font-medium">{score.toFixed(1)}</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${score}%` }}
                            />
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
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Category Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryStats.map((cat) => (
            <div key={cat.name} className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">{cat.name}</h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-white">{cat.count}</span>
                <span className="text-sm text-gray-400">endpoints</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Avg Score:</span>
                <ScoreBadge score={cat.avgScore} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
