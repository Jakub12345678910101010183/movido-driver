// TomTom API integration for Movido Driver
// Uses TomTom Routing API + Search API + Traffic API

const API_KEY = process.env.EXPO_PUBLIC_TOMTOM_API_KEY ?? '';
const BASE_URL = 'https://api.tomtom.com';

export interface TomTomRoute {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
    departureTime: string;
    arrivalTime: string;
  };
  legs: Array<{
    points: Array<{ latitude: number; longitude: number }>;
  }>;
  guidance: {
    instructions: Array<{
      routeOffsetInMeters: number;
      travelTimeInSeconds: number;
      point: { latitude: number; longitude: number };
      instructionType: string;
      street: string;
      countryCode: string;
      junction?: string;
      roundaboutExitNumber?: number;
      possibleCombineWithNext: boolean;
      drivingSide: 'LEFT' | 'RIGHT';
      maneuver: string;
      message: string;
      combinedMessage: string;
    }>;
  };
}

export interface GeocodedAddress {
  position: { lat: number; lon: number };
  address: {
    freeformAddress: string;
    municipality: string;
    postalCode: string;
  };
}

// Calculate HGV route between two points
export async function calculateHGVRoute(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  vehicleProfile?: {
    vehicleWeight?: number;  // kg
    vehicleHeight?: number;  // metres
    vehicleWidth?: number;   // metres
    vehicleLength?: number;  // metres
    hazmat?: boolean;
  }
): Promise<TomTomRoute | null> {
  try {
    const params = new URLSearchParams({
      key: API_KEY,
      routeType: 'fastest',
      traffic: 'true',
      travelMode: 'truck',
      instructionsType: 'text',
      language: 'en-GB',
      ...(vehicleProfile?.vehicleWeight && {
        vehicleWeight: String(vehicleProfile.vehicleWeight),
      }),
      ...(vehicleProfile?.vehicleHeight && {
        vehicleHeight: String(vehicleProfile.vehicleHeight),
      }),
      ...(vehicleProfile?.vehicleWidth && {
        vehicleWidth: String(vehicleProfile.vehicleWidth),
      }),
      ...(vehicleProfile?.vehicleLength && {
        vehicleLength: String(vehicleProfile.vehicleLength),
      }),
      ...(vehicleProfile?.hazmat && {
        vehicleLoadType: 'USHazmatClass1',
      }),
    });

    const url = `${BASE_URL}/routing/1/calculateRoute/${origin.lat},${origin.lon}:${destination.lat},${destination.lon}/json?${params}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data.routes?.[0] ?? null;
  } catch {
    return null;
  }
}

// Geocode an address (UK postcode or full address)
export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  try {
    const params = new URLSearchParams({
      key: API_KEY,
      query: address,
      countrySet: 'GB',
      limit: '1',
    });

    const url = `${BASE_URL}/search/2/geocode/${encodeURIComponent(address)}.json?${params}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const result = data.results?.[0];
    if (!result) return null;

    return {
      position: result.position,
      address: result.address,
    };
  } catch {
    return null;
  }
}

// Get TomTom tile URL for react-native-maps
export function getTomTomTileUrl(style: 'main' | 'night' = 'night'): string {
  const styleMap = {
    main: 'basic_main',
    night: 'basic_night',
  };
  return `https://api.tomtom.com/map/1/tile/basic/${styleMap[style]}/{z}/{x}/{y}.png?key=${API_KEY}`;
}

// Format travel time nicely
export function formatTravelTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// Format distance
export function formatDistance(meters: number, useMiles = true): string {
  if (useMiles) {
    const miles = meters / 1609.34;
    return miles < 0.1 ? `${Math.round(meters)}m` : `${miles.toFixed(1)}mi`;
  }
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}
