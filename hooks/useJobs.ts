import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Job {
  id: string;
  reference: string;
  customer: string;
  address: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  driver_id: string | null;
  vehicle_id: string | null;
  eta: string | null;
  notes: string | null;
  instructions: string | null;
  weight_kg: number | null;
  items: number | null;
  pod_photo_url: string | null;
  pod_signature_url: string | null;
  pod_recipient: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useJobs(driverId: string | null | undefined) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!driverId) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('driver_id', driverId)
        .neq('status', 'completed')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setJobs(data ?? []);
    } catch (e) {
      setError('Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchJobs();

    // Realtime subscription
    if (!driverId) return;
    const sub = supabase
      .channel('driver-jobs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `driver_id=eq.${driverId}`,
      }, () => fetchJobs())
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [driverId, fetchJobs]);

  const updateJobStatus = async (
    jobId: string,
    status: Job['status']
  ): Promise<boolean> => {
    try {
      const updates: Partial<Job> = { status };
      if (status === 'in_progress') updates.updated_at = new Date().toISOString();
      if (status === 'completed') updates.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from('jobs').update(updates).eq('id', jobId);

      if (error) throw error;
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
      return true;
    } catch { return false; }
  };

  return { jobs, isLoading, error, refetch: fetchJobs, updateJobStatus };
}
