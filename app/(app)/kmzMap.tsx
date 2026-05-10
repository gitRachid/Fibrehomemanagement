import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { kmzApi, type KmzCoordinate, type KmzFeature } from '@/api';

const DEFAULT_REGION: Region = {
  latitude: 33.5731,
  longitude: -7.5898,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const cleanDescription = (value?: string) => {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

const getFeatureTypeLabel = (type: KmzFeature['type']) => {
  if (type === 'point') return 'Point';
  if (type === 'line') return 'Ligne';
  return 'Polygone';
};

const getInitialRegion = (coordinates: KmzCoordinate[]): Region => {
  if (coordinates.length === 0) return DEFAULT_REGION;

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.8, 0.01),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.8, 0.01),
  };
};

export default function KmzMapScreen() {
  const router = useRouter();
  const { zone, buildingName, buildingLatitude, buildingLongitude } = useLocalSearchParams<{
    zone?: string;
    buildingName?: string;
    buildingLatitude?: string;
    buildingLongitude?: string;
  }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mapRef = useRef<MapView | null>(null);
  const [features, setFeatures] = useState<KmzFeature[]>([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<KmzFeature | null>(null);

  const zoneName = String(zone || '').trim();
  const points = features.filter((feature) => feature.type === 'point');
  const lines = features.filter((feature) => feature.type === 'line');
  const polygons = features.filter((feature) => feature.type === 'polygon');

  const buildingCoordinate = useMemo(() => {
    const latitude = Number(buildingLatitude);
    const longitude = Number(buildingLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }, [buildingLatitude, buildingLongitude]);

  const buildingFeature = useMemo<KmzFeature | undefined>(() => {
    if (!buildingCoordinate) return undefined;
    return {
      id: 'current-building',
      type: 'point',
      name: String(buildingName || 'Immeuble'),
      description: `Immeuble courant\nLatitude: ${buildingCoordinate.latitude}\nLongitude: ${buildingCoordinate.longitude}`,
      coordinates: [buildingCoordinate],
    };
  }, [buildingCoordinate, buildingName]);

  const allCoordinates = useMemo(
    () => (buildingFeature ? [...features, buildingFeature] : features).flatMap((feature) => feature.coordinates),
    [buildingFeature, features],
  );
  const firstCoordinate = allCoordinates[0];
  const region = useMemo(() => getInitialRegion(allCoordinates), [allCoordinates]);

  const centerMap = (animated = true) => {
    if (allCoordinates.length === 0) return;
    mapRef.current?.fitToCoordinates(allCoordinates, {
      edgePadding: { top: 90, right: 70, bottom: 90, left: 70 },
      animated,
    });
  };

  useEffect(() => {
    const loadFeatures = async () => {
      if (!zoneName) {
        setError('Zone introuvable pour charger la carte KMZ.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError('');
        const response = await kmzApi.getFeaturesByZone(zoneName);
        setFeatures(response.data || []);
        setFileName(response.file?.fileName || '');
      } catch (loadError: any) {
        setError(loadError?.message || 'Impossible de charger le KMZ.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFeatures();
  }, [zoneName]);

  useEffect(() => {
    if (!isMapReady || allCoordinates.length === 0) return;
    requestAnimationFrame(() => centerMap(false));
  }, [allCoordinates, isMapReady]);

  const renderContent = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.centerContent}>
          <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Carte Google non disponible sur web</Text>
          <Text style={[styles.emptyText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
            Ouvrir cette forme sur Android pour visualiser les points, lignes et polygones.
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={[styles.emptyText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>Chargement KMZ...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContent}>
          <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Erreur</Text>
          <Text style={[styles.emptyText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>{error}</Text>
        </View>
      );
    }

    if (features.length === 0) {
      return (
        <View style={styles.centerContent}>
          <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Aucun élément KMZ</Text>
          <Text style={[styles.emptyText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
            Importer un KMZ en base pour cette zone avant d'afficher la carte.
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        mapType="hybrid"
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        toolbarEnabled
        zoomControlEnabled
        loadingEnabled
        showsCompass
        showsScale
        moveOnMarkerPress={false}
        onMapReady={() => {
          setIsMapReady(true);
        }}
      >
        {points.map((feature) => (
          <Marker
            key={feature.id}
            coordinate={feature.coordinates[0]}
            title={feature.name}
            description={cleanDescription(feature.description)}
            pinColor="#dc2626"
            onPress={() => setSelectedFeature(feature)}
          />
        ))}

        {buildingFeature ? (
          <Marker
            key={buildingFeature.id}
            coordinate={buildingFeature.coordinates[0]}
            title={buildingFeature.name}
            description={cleanDescription(buildingFeature.description)}
            pinColor="#f97316"
            onPress={() => setSelectedFeature(buildingFeature)}
          />
        ) : null}

        {lines.map((feature) => (
          <Polyline
            key={feature.id}
            coordinates={feature.coordinates}
            strokeColor="#2563eb"
            strokeWidth={5}
            tappable
            onPress={() => setSelectedFeature(feature)}
          />
        ))}

        {polygons.map((feature) => (
          <Polygon
            key={feature.id}
            coordinates={feature.coordinates}
            fillColor="rgba(22, 163, 74, 0.24)"
            strokeColor="#16a34a"
            strokeWidth={3}
            tappable
            onPress={() => setSelectedFeature(feature)}
          />
        ))}
      </MapView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#fff' }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#0f172a' : '#fff', borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Retour</Text>
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#0f172a' }]}>Carte Google KMZ</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
            Zone {zoneName || '-'}{buildingName ? ` • ${buildingName}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>Points: {points.length}</Text>
        <Text style={styles.statsText}>Lignes: {lines.length}</Text>
        <Text style={styles.statsText}>Polygones: {polygons.length}</Text>
      </View>

      {features.length > 0 ? (
        <View style={styles.mapTools}>
          <TouchableOpacity onPress={() => centerMap(true)} style={styles.centerButton}>
            <Text style={styles.centerButtonText}>Centrer Google</Text>
          </TouchableOpacity>
          <View style={[styles.centerButton, { backgroundColor: buildingFeature ? '#f97316' : '#94a3b8' }]}>
            <Text style={styles.centerButtonText}>{buildingFeature ? 'Immeuble OK' : 'Immeuble sans GPS'}</Text>
          </View>
          {firstCoordinate ? (
            <Text style={[styles.coordinateText, { color: isDark ? '#cbd5e1' : '#475569' }]} numberOfLines={1}>
              Lat {firstCoordinate.latitude.toFixed(6)} / Lon {firstCoordinate.longitude.toFixed(6)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {fileName ? (
        <Text style={[styles.fileName, { color: isDark ? '#cbd5e1' : '#475569' }]} numberOfLines={1}>
          Fichier: {fileName}
        </Text>
      ) : null}

      <View style={styles.mapContainer}>{renderContent()}</View>

      <Modal visible={Boolean(selectedFeature)} transparent animationType="fade" onRequestClose={() => setSelectedFeature(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedFeature(null)}>
          <Pressable style={[styles.infoCard, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}>
            <Text style={[styles.infoTitle, { color: isDark ? '#fff' : '#0f172a' }]}>
              {selectedFeature?.name || 'Élément KMZ'}
            </Text>
            <Text style={styles.infoType}>{selectedFeature ? getFeatureTypeLabel(selectedFeature.type) : ''}</Text>
            <ScrollView style={styles.infoScroll}>
              <Text style={[styles.infoText, { color: isDark ? '#e2e8f0' : '#334155' }]}>
                {cleanDescription(selectedFeature?.description) || 'Aucune information disponible.'}
              </Text>
            </ScrollView>
            <TouchableOpacity onPress={() => setSelectedFeature(null)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    gap: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 8,
  },
  backText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#eff6ff',
  },
  statsText: {
    flex: 1,
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  mapTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  centerButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  centerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  coordinateText: {
    flex: 1,
    fontSize: 12,
  },
  fileName: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 12,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  infoCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: '55%',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoType: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 12,
  },
  infoScroll: {
    maxHeight: 180,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
