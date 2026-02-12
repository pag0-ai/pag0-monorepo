'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Shield } from 'lucide-react';
import {
  fetchPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  type Policy,
  type CreatePolicyData,
} from '../../lib/api';

// USDC conversion utilities
const toUsdcBigint = (dollars: string): string => {
  const num = parseFloat(dollars || '0');
  return String(Math.floor(num * 1_000_000));
};

const fromUsdcBigint = (usdc: string): string => {
  return (Number(usdc) / 1_000_000).toFixed(2);
};

interface PolicyFormData {
  name: string;
  maxPerRequest: string; // dollars
  dailyBudget: string; // dollars
  monthlyBudget: string; // dollars
  allowedEndpoints: string;
  blockedEndpoints: string;
}

export default function PoliciesPage() {
  const { data: session } = useSession();
  const apiKey = session?.apiKey;
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<PolicyFormData>({
    name: '',
    maxPerRequest: '',
    dailyBudget: '',
    monthlyBudget: '',
    allowedEndpoints: '',
    blockedEndpoints: '',
  });
  const [formError, setFormError] = useState('');

  // Fetch policies
  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => fetchPolicies(apiKey),
    enabled: !!apiKey,
  });

  // Create policy mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePolicyData) => createPolicy(data, apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      closeModal();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // Update policy mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePolicyData> }) =>
      updatePolicy(id, data, apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      closeModal();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // Delete policy mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePolicy(id, apiKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      setDeleteConfirm(null);
    },
  });

  const openCreateModal = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      maxPerRequest: '',
      dailyBudget: '',
      monthlyBudget: '',
      allowedEndpoints: '',
      blockedEndpoints: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      maxPerRequest: fromUsdcBigint(policy.maxPerRequest),
      dailyBudget: fromUsdcBigint(policy.dailyLimit),
      monthlyBudget: fromUsdcBigint(policy.monthlyLimit),
      allowedEndpoints: (policy.allowedEndpoints || []).join(', '),
      blockedEndpoints: (policy.blockedEndpoints || []).join(', '),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPolicy(null);
    setFormError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    const maxPerRequest = parseFloat(formData.maxPerRequest || '0');
    const dailyBudget = parseFloat(formData.dailyBudget || '0');
    const monthlyBudget = parseFloat(formData.monthlyBudget || '0');

    if (maxPerRequest > dailyBudget || dailyBudget > monthlyBudget) {
      setFormError('Budget constraints: Max Per Request <= Daily Budget <= Monthly Budget');
      return;
    }

    const data: CreatePolicyData = {
      name: formData.name,
      maxPerRequest: toUsdcBigint(formData.maxPerRequest),
      dailyBudget: toUsdcBigint(formData.dailyBudget),
      monthlyBudget: toUsdcBigint(formData.monthlyBudget),
      allowedEndpoints: formData.allowedEndpoints
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      blockedEndpoints: formData.blockedEndpoints
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    };

    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Policies</h1>
          <p className="text-gray-400">Manage spending policies and budgets</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Policy
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12 text-gray-400">Loading policies...</div>
      )}

      {/* Empty State */}
      {!isLoading && policies.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No policies yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first policy to control spending and endpoint access
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Policy
          </button>
        </div>
      )}

      {/* Policies Table */}
      {!isLoading && policies.length > 0 && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                  Daily Budget
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                  Monthly Budget
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {policies.map(policy => (
                <tr key={policy.id} className="hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 text-white font-medium">{policy.name}</td>
                  <td className="px-6 py-4 text-gray-300">
                    ${fromUsdcBigint(policy.dailyLimit)}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    ${fromUsdcBigint(policy.monthlyLimit)}
                  </td>
                  <td className="px-6 py-4">
                    {policy.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(policy)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(policy.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">
                {editingPolicy ? 'Edit Policy' : 'Create Policy'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {formError && (
                <div className="bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Policy Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Production Policy"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="maxPerRequest"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Max Per Request
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      id="maxPerRequest"
                      step="0.01"
                      min="0"
                      value={formData.maxPerRequest}
                      onChange={e => setFormData({ ...formData, maxPerRequest: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="10.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="dailyBudget"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Daily Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      id="dailyBudget"
                      step="0.01"
                      min="0"
                      value={formData.dailyBudget}
                      onChange={e => setFormData({ ...formData, dailyBudget: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="100.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="monthlyBudget"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Monthly Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400">$</span>
                    <input
                      type="number"
                      id="monthlyBudget"
                      step="0.01"
                      min="0"
                      value={formData.monthlyBudget}
                      onChange={e => setFormData({ ...formData, monthlyBudget: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="1000.00"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="allowedEndpoints"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Allowed Endpoints (comma-separated)
                </label>
                <textarea
                  id="allowedEndpoints"
                  value={formData.allowedEndpoints}
                  onChange={e => setFormData({ ...formData, allowedEndpoints: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  placeholder="https://api.example.com/v1/*, https://api.another.com/*"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Leave empty to allow all endpoints
                </p>
              </div>

              <div>
                <label
                  htmlFor="blockedEndpoints"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Blocked Endpoints (comma-separated)
                </label>
                <textarea
                  id="blockedEndpoints"
                  value={formData.blockedEndpoints}
                  onChange={e => setFormData({ ...formData, blockedEndpoints: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                  placeholder="https://api.expensive.com/*, https://api.unreliable.com/*"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingPolicy
                    ? 'Update Policy'
                    : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-white mb-4">Delete Policy</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this policy? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
