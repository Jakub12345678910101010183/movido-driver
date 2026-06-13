import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import type { Job } from './useJobs';

const ARRIVE_RADIUS_METRES = 200;

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeofencing(
  activeJob: Job | null,
  onArrive: (jobId: string) => void
) {
  const arrivedRef = useRef<Set<string>>(new Set());
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const startWatching = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 20 },
      (loc) => {
        if (!activeJob?.lat || !activeJob?.lng) return;
        if (activeJob.status !== 'in_progress') return;
        if (arrivedRef.current.has(activeJob.id)) return;

        const dist = haversineDistance(
          loc.coords.latitude, loc.coords.longitude,
          activeJob.lat, activeJob.lng
        );

        if (dist <= ARRIVE_RADIUS_METRES) {
          arrivedRef.current.add(activeJob.id);
          onArrive(activeJob.id);
        }
      }
    );
  }, [activeJob, onArrive]);

  useEffect(() => {
    if (activeJob?.status === 'in_progress') {
      startWatching();
    }
    return () => { watchRef.current?.remove(); };
  }, [activeJob?.id, activeJob?.status, startWatching]);
}
