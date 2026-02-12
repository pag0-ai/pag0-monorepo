'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchRankings, fetchCategories, fetchApi, type EndpointScore, type Category } from '../../lib/api';
import { Award, Trophy, Medal } from 'lucide-react';

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

interface ComparisonData {
  endpoints: Array<{
    endpoint: string;
    overall: number;
    cost: number;
    latency: number;
    reliability: number;
  }>;
}

export default function RankingsPage() {
  const { data: session } = useSession();
  const apiKey = session?.apiKey;
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const { data: rankings, isLoading: rankingsLoading } = useQuery({
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
    queryFn: () => fetchApi<ComparisonData>(`/api/curation/compare?endpoints=${selectedEndpoints.join(',')}`, { apiKey }),
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
      ? catRankings.reduce((sum, r) => sum + r.overall, 0) / catRankings.length
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
                key={cat.id}
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
                      <ScoreBadge score={ranking.overall} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={ranking.cost} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={ranking.latency} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={ranking.reliability} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparison.endpoints.map((endpoint) => (
              <div key={endpoint.endpoint} className="bg-gray-900 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 truncate">{endpoint.endpoint}</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Overall</span>
                      <span className="text-white font-medium">{endpoint.overall.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          endpoint.overall >= 80 ? 'bg-green-400' : endpoint.overall >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${endpoint.overall}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Cost</span>
                      <span className="text-white font-medium">{endpoint.cost.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          endpoint.cost >= 80 ? 'bg-green-400' : endpoint.cost >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${endpoint.cost}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Latency</span>
                      <span className="text-white font-medium">{endpoint.latency.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          endpoint.latency >= 80 ? 'bg-green-400' : endpoint.latency >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${endpoint.latency}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Reliability</span>
                      <span className="text-white font-medium">{endpoint.reliability.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          endpoint.reliability >= 80 ? 'bg-green-400' : endpoint.reliability >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${endpoint.reliability}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
