import { useState, useEffect } from 'react';
import { ProfitTier } from '@/types/tokens';

interface ProfitTierThreshold {
  tier: keyof typeof ProfitTier;
  minProfitUsd: number;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: () => void;
}

export default function SettingsModal({ isOpen, onClose, onSettingsSaved }: SettingsModalProps) {
  const [tiers, setTiers] = useState<ProfitTierThreshold[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current thresholds on mount
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSuccess(null);
      fetch('/api/profit-tiers')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch profit tiers');
          return res.json();
        })
        .then((data) => {
          setTiers(data.tiers);
          console.log('SettingsModal: Loaded tiers:', JSON.stringify(data.tiers, null, 2));
          setError(null);
        })
        .catch((err) => {
          setError('Error loading settings');
          console.error('SettingsModal: Error loading tiers:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Handle input changes
  const handleInputChange = (tier: keyof typeof ProfitTier, value: string) => {
    const numValue = parseFloat(value);
    setTiers((prev) =>
      prev.map((t) =>
        t.tier === tier ? { ...t, minProfitUsd: isNaN(numValue) ? 0 : numValue } : t
      )
    );
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate inputs
    for (const tier of tiers) {
      if (tier.minProfitUsd < 0) {
        setError(`Minimum profit for ${tier.tier} cannot be negative`);
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/profit-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || 'Failed to update profit tiers');
      }

      console.log('SettingsModal: Saved tiers:', JSON.stringify(tiers, null, 2));
      setSuccess('Profit tiers updated successfully');
      onSettingsSaved();
      setTimeout(onClose, 1000); // Close modal after 1s
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Error saving settings');
      console.error('SettingsModal: Error saving tiers:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#00000094] flex items-center justify-center z-50">
      <div className="bg-[#2c2c2c] p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold text-white mb-4">Profit Tier Settings</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        {success && <p className="text-green-500 mb-4">{success}</p>}
        <form onSubmit={handleSubmit}>
          {tiers.map((tier) => (
            <div key={tier.tier} className="mb-4">
              <label className="block text-sm font-medium text-gray-300">
                {tier.tier} Minimum Profit (USD)
              </label>
              <input
                type="number"
                value={tier.minProfitUsd}
                onChange={(e) => handleInputChange(tier.tier, e.target.value)}
                className="mt-1 block w-full rounded-md bg-[#181818] border-gray-600 text-white p-2"
                min="0"
                step="1"
                required
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2  text-white rounded hover:bg-gray-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#007bff] text-white rounded"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}