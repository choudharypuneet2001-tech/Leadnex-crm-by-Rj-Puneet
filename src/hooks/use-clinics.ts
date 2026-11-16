'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_CLINICS, type ManagedClinic } from '@/lib/clinics/clinics-service';

export function useClinics() {
  const [clinics, setClinics] = useState<ManagedClinic[]>(DEFAULT_CLINICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClinics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clinics', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch clinics');
      const data = await res.json();
      if (Array.isArray(data.clinics) && data.clinics.length > 0) {
        setClinics(data.clinics);
      }
      setError(null);
    } catch (err: any) {
      console.warn('[useClinics] fetch notice:', err);
      setError(err?.message || 'Could not load clinics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClinics();
  }, [fetchClinics]);

  const activeClinics = useMemo(() => {
    return clinics.filter((c) => c.is_active !== false);
  }, [clinics]);

  return {
    clinics,
    activeClinics,
    loading,
    error,
    refreshClinics: fetchClinics,
    setClinics,
  };
}
