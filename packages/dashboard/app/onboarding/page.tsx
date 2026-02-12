'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to generate API key');
      }
      const data = await res.json();
      setApiKey(data.apiKey);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = async () => {
    // Update the NextAuth session with the new API key
    await update({ apiKey, needsOnboarding: false });
    // Hard navigation so middleware picks up the refreshed JWT
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-lg p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Pag0</h1>
          <p className="text-gray-400">
            {apiKey
              ? 'Your API key has been generated. Save it now — it won\'t be shown again.'
              : 'Generate your API key to get started with the Pag0 proxy.'}
          </p>
        </div>

        {!apiKey ? (
          // Step 1: Generate API Key
          <div>
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-6">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {generating ? 'Generating...' : 'Generate API Key'}
            </button>
          </div>
        ) : (
          // Step 2: Show API Key + Continue
          <div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your API Key
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="w-full px-4 py-3 pr-20 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mb-8">
              <p className="text-yellow-200 text-sm">
                <span className="font-semibold">Important:</span> Save this API key now.
                It won't be shown again. You'll need it to authenticate with the Pag0 proxy.
              </p>
            </div>

            <button
              onClick={handleContinue}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
