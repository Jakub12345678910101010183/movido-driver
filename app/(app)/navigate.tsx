import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import MapView, { Polyline, Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { calculateHGVRoute, formatTravelTime, formatDistance, type TomTomRoute } from '../../lib/tomtom';
import { Colors, Spacing, Radius, FontSize } from '../../constants/theme';

type LatLng = { latitude: number; longitude: number };

export default function NavigateScreen() {
  const { t } = useTranslation();
  const { lat, lng, address, jobId } = useLocalSearchParams<{
    lat: string; lng: string; address: string; jobId: string;
  }>();

  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<TomTomRoute | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [distanceToNext, setDistanceToNext] = useState<string>('');
  const [instrIndex, setInstrIndex] = useState(0);

  const destLat = lat ? parseFloat(lat) : null;
  const destLng = lng ? parseFloat(lng) : null;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Location permission required for navigation');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    if (userLocation && destLat && destLng) calculateRoute();
  }, [userLocation]);

  const calculateRoute = async () => {
    if (!userLocation || !destLat || !destLng) return;
    setIsCalculating(true);
    try {
      const result = await calculateHGVRoute(
        { lat: userLocation.latitude, lon: userLocation.longitude },
        { lat: destLat, lon: destLng },
        { vehicleWeight: 26000, vehicleHeight: 4.2, vehicleWidth: 2.55 }
      );
      if (result) {
        setRoute(result);
        const coords = result.legs.flatMap(leg =>
          leg.points.map(p => ({ latitude: p.latitude, longitude: p.longitude }))
        );
        setRouteCoords(coords);
        if (result.guidance?.instructions?.length > 0) {
          setCurrentInstruction(result.guidance.instructions[0].message);
        }
        // Fit map to route
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 80, right: 40, bottom: 240, left: 40 },
            animated: true,
          });
        }, 300);
      }
    } catch {
      Alert.alert('Error', 'Could not calculate route');
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (!isNavigating || !route?.guidance?.instructions) return;
    const sub = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 10 },
      (loc) => {
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        // Advance instructions based on distance
        const instrs = route.guidance.instructions;
        if (instrIndex < instrs.length - 1) {
          const next = instrs[instrIndex + 1];
          // Simple: advance if close to next instruction point
          const dist = haversine(
            loc.coords.latitude, loc.coords.longitude,
            next.point.latitude, next.point.longitude
          );
          if (dist < 50) {
            setInstrIndex(i => i + 1);
            setCurrentInstruction(next.message);
          }
        }
      }
    ).then(s => { return s; });
    return () => { sub.then(s => s.remove()); };
  }, [isNavigating, instrIndex, route]);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const TOMTOM_KEY = process.env.EXPO_PUBLIC_TOMTOM_API_KEY ?? '';

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={userLocation ? {
          ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05,
        } : { latitude: 52.2405, longitude: -0.9026, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
        showsUserLocation
        followsUserLocation={isNavigating}
        customMapStyle={darkMapStyle}
      >
        {/* TomTom tiles */}
        <UrlTile
          urlTemplate={`https://api.tomtom.com/map/1/tile/basic/night/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`}
          maximumZ={19}
          flipY={false}
        />

        {/* Route polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={Colors.primary}
            strokeWidth={5}
            lineDashPattern={undefined}
          />
        )}

        {/* Destination marker */}
        {destLat && destLng && (
          <Marker
            coordinate={{ latitude: destLat, longitude: destLng }}
            title={address}
          >
            <View style={styles.destMarker}>
              <Ionicons name="location" size={24} color={Colors.error} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topBarInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>{t('navigate.hgv_route')}</Text>
            <Text style={styles.topBarAddress} numberOfLines={1}>{address}</Text>
          </View>
          <TouchableOpacity onPress={calculateRoute} style={styles.backBtn}>
            <Ionicons name="refresh" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {isCalculating && (
          <View style={styles.calcRow}>
            <Ionicons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.calcText}>{t('navigate.calculating')}</Text>
          </View>
        )}

        {/* Current instruction */}
        {isNavigating && currentInstruction ? (
          <View style={styles.instructionCard}>
            <Ionicons name="arrow-up-circle" size={32} color={Colors.primary} />
            <Text style={styles.instructionText}>{currentInstruction}</Text>
          </View>
        ) : null}

        {/* Route summary */}
        {route && !isCalculating && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
              <Text style={styles.summaryValue}>
                {formatTravelTime(route.summary.travelTimeInSeconds)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
              <Text style={styles.summaryValue}>
                {formatDistance(route.summary.lengthInMeters)}
              </Text>
            </View>
            {route.summary.trafficDelayInSeconds > 60 && (
              <>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="warning-outline" size={18} color={Colors.warning} />
                  <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                    +{formatTravelTime(route.summary.trafficDelayInSeconds)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Start/Stop button */}
        <TouchableOpacity
          style={[styles.navBtn, isNavigating && styles.navBtnStop]}
          onPress={() => setIsNavigating(v => !v)}
        >
          <Ionicons
            name={isNavigating ? 'stop' : 'navigate'}
            size={20}
            color={isNavigating ? Colors.error : Colors.background}
          />
          <Text style={[styles.navBtnText, isNavigating && { color: Colors.error }]}>
            {isNavigating ? t('navigate.stop_navigation') : t('navigate.start_navigation')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8888a0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0f' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  topBarInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface + 'ee',
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
  },
  topBarCenter: { flex: 1 },
  topBarTitle: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 2 },
  topBarAddress: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface + 'f5',
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderTopWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, gap: Spacing.md,
    paddingBottom: 34,
  },
  calcRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calcText: { color: Colors.primary, fontSize: FontSize.sm },
  instructionCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primaryFaint, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary,
  },
  instructionText: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryValue: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  summaryDivider: { width: 1, height: 20, backgroundColor: Colors.border },
  navBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16,
  },
  navBtnStop: { backgroundColor: Colors.errorFaint, borderWidth: 1, borderColor: Colors.error },
  navBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '700' },
  destMarker: { alignItems: 'center' },
});
