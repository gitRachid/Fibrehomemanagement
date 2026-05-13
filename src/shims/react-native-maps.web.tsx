import { View } from 'react-native';

export const PROVIDER_GOOGLE = 'google';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export function Marker() {
  return null;
}

export function Polygon() {
  return null;
}

export function Polyline() {
  return null;
}

export default function MapView(props: any) {
  return <View {...props} />;
}
