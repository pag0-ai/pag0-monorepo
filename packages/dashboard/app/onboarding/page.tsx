'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const apiKey = session?.apiKey || '';

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-lg p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Pag0</h1>
          <p className="text-gray-400">
            Your account is ready. Here's your API key to get started.
          </p>
        </div>

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
          onClick={() => router.push('/dashboard')}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
}
