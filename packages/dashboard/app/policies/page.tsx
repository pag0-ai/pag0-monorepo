'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Shield, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  fetchPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  type Policy,
  type CreatePolicyData,
} from '../../lib/api';

const toUsdcBigint = (dollars: string): string => {
  const num = parseFloat(dollars || '0');
  return String(Math.floor(num * 1_000_000));
};

const fromUsdcBigint = (usdc: string): string => {
  return (Number(usdc) / 1_000_000).toFixed(2);
};

interface PolicyFormData {
  name: string;
  maxPerRequest: string;
  dailyBudget: string;
  monthlyBudget: string;
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
    name: '', maxPerRequest: '', dailyBudget: '', monthlyBudget: '',
    allowedEndpoints: '', blockedEndpoints: '',
  });
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const { data: policies = [], isLoading, isError: policiesError, refetch: policiesRefetch } = useQuery({
    queryKey: ['policies'],
    queryFn: () => fetchPolicies(apiKey),
    enabled: !!apiKey,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePolicyData) => createPolicy(data, apiKey),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['policies'] }); queryClient.invalidateQueries({ queryKey: ['analytics'] }); closeModal(); },
    onError: (error: Error) => { setFormError(error.message); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePolicyData> }) => updatePolicy(id, data, apiKey),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['policies'] }); queryClient.invalidateQueries({ queryKey: ['analytics'] }); closeModal(); },
    onError: (error: Error) => { setFormError(error.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePolicy(id, apiKey),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['policies'] }); queryClient.invalidateQueries({ queryKey: ['analytics'] }); setDeleteConfirm(null); setDeleteError(''); },
    onError: (error: Error) => { setDeleteError(error.message); },
  });

  const openCreateModal = () => {
    setEditingPolicy(null);
    setFormData({ name: '', maxPerRequest: '', dailyBudget: '', monthlyBudget: '', allowedEndpoints: '', blockedEndpoints: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      maxPerRequest: fromUsdcBigint(policy.maxPerRequest),
      dailyBudget: fromUsdcBigint(policy.dailyBudget),
      monthlyBudget: fromUsdcBigint(policy.monthlyBudget),
      allowedEndpoints: (policy.allowedEndpoints || []).join(', '),
      blockedEndpoints: (policy.blockedEndpoints || []).join(', '),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingPolicy(null); setFormError(''); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
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
      allowedEndpoints: formData.allowedEndpoints.split(',').map(s => s.trim()).filter(Boolean),
      blockedEndpoints: formData.blockedEndpoints.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (editingPolicy) { updateMutation.mutate({ id: editingPolicy.id, data }); }
    else { createMutation.mutate(data); }
  };

  const inputStyle = {
    background: 'var(--color-obsidian-base)',
    border: '1px solid var(--color-obsidian-border-bright)',
    borderRadius: '10px',
    color: 'var(--color-txt-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
  };

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--color-txt-primary)' }}>
            Policies
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-txt-muted)' }}>
            Manage spending policies and endpoint access rules
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
          <Plus size={16} />
          Create Policy
        </button>
      </div>

      {/* Error State */}
      {policiesError && (
        <div className="glass-card p-5 mb-6 flex items-center gap-4" style={{ borderColor: 'rgba(244,63,94,0.3)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.1)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--color-neon-rose)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-txt-primary)' }}>Failed to load policies</p>
            <p className="text-xs" style={{ color: 'var(--color-txt-muted)' }}>Check that the proxy server is running.</p>
          </div>
          <button onClick={() => policiesRefetch()} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
            <RotateCcw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--color-txt-muted)' }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mr-3" style={{ borderColor: 'var(--color-neon-indigo)', borderTopColor: 'transparent' }} />
          Loading policies...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && policies.length === 0 && (
        <div className="glass-card p-16 text-center animate-fade-up">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)' }}
          >
            <Shield size={28} style={{ color: 'var(--color-neon-indigo)' }} />
          </div>
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-txt-primary)' }}>No policies yet</h3>
          <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--color-txt-muted)' }}>
            Create your first policy to control spending and endpoint access
          </p>
          <button onClick={openCreateModal} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Plus size={16} /> Create Policy
          </button>
        </div>
      )}

      {/* Policies Table */}
      {!isLoading && policies.length > 0 && (
        <div className="glass-card overflow-hidden animate-fade-up">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--color-obsidian-base)' }}>
                {['Name', 'Daily Budget', 'Monthly Budget', 'Status', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-3.5 text-[10px] font-semibold uppercase tracking-widest ${i === 4 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--color-txt-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map(policy => (
                <tr key={policy.id} className="table-row-hover border-t" style={{ borderColor: 'var(--color-obsidian-border)' }}>
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-txt-primary)' }}>{policy.name}</td>
                  <td className="px-6 py-4 text-sm metric-value" style={{ color: 'var(--color-txt-secondary)' }}>
                    ${fromUsdcBigint(policy.dailyBudget)}
                  </td>
                  <td className="px-6 py-4 text-sm metric-value" style={{ color: 'var(--color-txt-secondary)' }}>
                    ${fromUsdcBigint(policy.monthlyBudget)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        color: policy.isActive ? 'var(--color-neon-green)' : 'var(--color-txt-muted)',
                        background: policy.isActive ? 'rgba(16,185,129,0.1)' : 'var(--color-obsidian-border)',
                      }}
                    >
                      {policy.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(policy)}
                        className="p-2 rounded-lg transition-all hover:scale-105"
                        style={{ color: 'var(--color-txt-muted)' }}
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(policy.id)}
                        className="p-2 rounded-lg transition-all hover:scale-105"
                        style={{ color: 'var(--color-txt-muted)' }}
                        title="Delete"
                      >
                        <Trash2 size={15} />
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
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(7,7,14,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto glow-indigo" style={{ borderColor: 'rgba(99,102,241,0.2)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-obsidian-border)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--color-txt-primary)' }}>
                {editingPolicy ? 'Edit Policy' : 'Create Policy'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--color-txt-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="text-xs px-4 py-3 rounded-xl" style={{ color: 'var(--color-neon-rose)', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-txt-muted)' }}>
                  Policy Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5"
                  style={inputStyle}
                  placeholder="Production Policy"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'maxPerRequest', label: 'Max Per Request', placeholder: '10.00' },
                  { id: 'dailyBudget', label: 'Daily Budget', placeholder: '100.00' },
                  { id: 'monthlyBudget', label: 'Monthly Budget', placeholder: '1000.00' },
                ].map(({ id, label, placeholder }) => (
                  <div key={id}>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-txt-muted)' }}>
                      {label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs" style={{ color: 'var(--color-txt-muted)' }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData[id as keyof PolicyFormData]}
                        onChange={e => setFormData({ ...formData, [id]: e.target.value })}
                        className="w-full pl-7 pr-3 py-2.5"
                        style={inputStyle}
                        placeholder={placeholder}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              {[
                { id: 'allowedEndpoints', label: 'Allowed Endpoints', placeholder: 'https://api.example.com/v1/*', hint: 'Leave empty to allow all' },
                { id: 'blockedEndpoints', label: 'Blocked Endpoints', placeholder: 'https://api.expensive.com/*', hint: '' },
              ].map(({ id, label, placeholder, hint }) => (
                <div key={id}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-txt-muted)' }}>
                    {label} <span className="normal-case tracking-normal font-normal">(comma-separated)</span>
                  </label>
                  <textarea
                    value={formData[id as keyof PolicyFormData]}
                    onChange={e => setFormData({ ...formData, [id]: e.target.value })}
                    className="w-full px-4 py-2.5 resize-none"
                    style={inputStyle}
                    rows={2}
                    placeholder={placeholder}
                  />
                  {hint && <p className="mt-1 text-[11px]" style={{ color: 'var(--color-txt-muted)' }}>{hint}</p>}
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-obsidian-border)' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm font-medium rounded-xl transition-colors"
                  style={{ color: 'var(--color-txt-secondary)', background: 'var(--color-obsidian-elevated)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary px-5 py-2.5 text-sm"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingPolicy ? 'Update Policy' : 'Create Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(7,7,14,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card max-w-md w-full mx-4 p-6" style={{ borderColor: 'rgba(244,63,94,0.2)' }}>
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--color-txt-primary)' }}>Delete Policy</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--color-txt-secondary)' }}>
              Are you sure? This action cannot be undone.
            </p>
            {deleteError && (
              <div className="text-xs px-4 py-3 rounded-xl mb-4" style={{ color: 'var(--color-neon-rose)', background: 'rgba(244,63,94,0.08)' }}>
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl"
                style={{ color: 'var(--color-txt-secondary)', background: 'var(--color-obsidian-elevated)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all"
                style={{ background: 'var(--color-neon-rose)', boxShadow: '0 0 12px rgba(244,63,94,0.3)' }}
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
