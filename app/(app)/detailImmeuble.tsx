import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert, Modal, Image, Dimensions, PanResponder } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';
import { useBuilding, useBuildingStatuses, useCreateBuildingStatus, useDeleteBuildingStatus, useUpdateBuilding } from '@/hooks';
import { dataService } from '@/services/dataService';
import { buildingsApi, photosApi, technicalDossiersApi, type Building } from '@/api';
import type { BuildingStatus } from '@/api';
import { saveFileWithPicker } from '@/utils/saveFileWithPicker';

// Local Photo interface
interface Photo {
  _id?: string;
  id: string;
  uri: string;
  name: string;
  type: string;
  timestamp: Date;
  idImmeuble?: string;
  gpsLatitude?: string;
  gpsLongitude?: string;
  mimeType?: string;
}


const photoTypes = [
  'Photo Façade',
  'Photo Immeuble',
  'Photo Entrée',
  'Photo Adduction',
  'Plan des infrastructures',
  'PLAN DE SITUATION',
  'PLAN DE CHEMINEMENT',
  'EMPLACEMENT BPO1',
  'EMPLACEMENT BPO2',
  'SITUATION-CHAMBRE BPE',
  'BPE OUVERTE',
  'Fixation BPE',
  'Ettiqutage CHA',
  'Ettiqtage PBO1 CHA',
  'Ettiqtage PBO2 CHA',
  'POSE PBO1',
  'POSE PBO2',
  'POSE PBO3',
  'POSE PBO4',
  'Photo Autre'
];

const photoTypeColors = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#ca8a04',
  '#dc2626',
  '#059669',
  '#4f46e5',
  '#9333ea',
  '#0d9488',
  '#ea580c',
  '#0284c7',
  '#65a30d',
  '#be123c',
  '#475569',
  '#0f766e',
  '#334155',
];

const buildingFields: (keyof Building)[] = [
  'idImmeuble',
  'idImmeubleSysteme', 
  'ville',
  'codePostal',
  'longitude',
  'latitude',
  'rueNomNom',
  'numeroNomImmeuble',
  'utilisationImmeuble',
  'nbreEtages',
  'sousSol',
  'sousSolCommun',
  'solutionRaccordement',
  'nbrB2B',
  'nbrB2C',
  'totalClients',
  'cheminFibrePBO1',
  'floorPBO1',
  'typePBO1',
  'PBO2',
  'floorPBO2',
  'typePBO2',
  'syndic',
  'numSyndic',
  'remarques',
  'typologieHabitat',
  'verticalite',
  'csp'
];

const fieldLabels: Record<keyof Omit<Building, 'photos'>, string> = {
  _id: 'ID',
  idImmeuble: 'ID Immeuble',
  idImmeubleSysteme: 'ID Immeuble Système',
  ville: 'Ville',
  zone: 'Zone',
  codePostal: 'Code Postal',
  longitude: 'Longitude',
  latitude: 'Latitude',
  rueNomNom: 'Rue Nom & Nom',
  numeroNomImmeuble: 'N°/Nom Immeuble',
  utilisationImmeuble: 'Utilisation Immeuble',
  nbreEtages: 'Nbre Etages',
  sousSol: 'Sous Sol',
  sousSolCommun: 'Sous Sol Commun',
  solutionRaccordement: 'Solution de Raccordement',
  nbrB2B: 'Nbr B2B',
  nbrB2C: 'Nbr B2C',
  totalClients: 'Total Clients',
  cheminFibrePBO1: 'Chemin de Fibre PBO1',
  floorPBO1: 'Floor PBO1',
  typePBO1: 'Type PBO1',
  PBO2: 'PBO2',
  floorPBO2: 'Floor PBO2',
  typePBO2: 'Type PBO2',
  syndic: 'SYNDIC',
  numSyndic: 'Num Syndic',
  remarques: 'Remarques',
  typologieHabitat: 'Typologie Habitat',
  verticalite: 'Verticalité',
  csp: 'CSP',
  serviceId: 'Service ID',
  status: 'Status',
  lastModified: 'Last Modified',
  createdAt: 'Created At',
  updatedAt: 'Updated At'
};

const DEFAULT_STATUS_OPTIONS: BuildingStatus[] = [
  { value: 'active', label: 'Actif', color: '#16a34a' },
  { value: 'pending', label: 'En attente', color: '#f59e0b' },
  { value: 'archived', label: 'Archivé', color: '#dc2626' },
  { value: 'inactive', label: 'Inactif', color: '#64748b' },
];
const LOCAL_BUILDING_STATUSES_KEY = 'local_building_statuses_v1';
const getBuildingPhotosKey = (id: string) => `building_photos_${id}`;

export default function DetailImmeubleScreen() {
  const { buildingId, buildingName, itemId, zone, itemName } = useLocalSearchParams<{
    buildingId: string;
    buildingName: string;
    itemId?: string;
    zone?: string;
    itemName?: string;
  }>();
  const router = useRouter();
  console.log("je suis dans detail")
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Use API building data
  const { data: apiBuilding, isLoading: isLoadingBuilding } = useBuilding(buildingId || '');
  const updateBuildingMutation = useUpdateBuilding();
  
  const [buildingsData, setBuildingsData] = useState<Partial<Building>[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedBuildingIndex, setSelectedBuildingIndex] = useState<number | null>(null);
  const [selectedPhotoType, setSelectedPhotoType] = useState(photoTypes[0]);
  const [showPhotoSourceModal, setShowPhotoSourceModal] = useState(false);
  const [showPhotoTypeDropdown, setShowPhotoTypeDropdown] = useState(false);
  const [photoSource, setPhotoSource] = useState<'camera' | 'gallery'>('camera');
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing' | 'error'>('synced');
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);
  const [showBuildingMenu, setShowBuildingMenu] = useState(false);
  const [isExportingTechnicalDossier, setIsExportingTechnicalDossier] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusManagerOnly, setNewStatusManagerOnly] = useState(false);
  const [localStatusOptions, setLocalStatusOptions] = useState<BuildingStatus[]>([]);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const currentUserRole = 'manager';
  const photoScaleRef = useRef(photoScale);
  const photoOffsetRef = useRef(photoOffset);
  const photoPanStartRef = useRef({ x: 0, y: 0 });

  const { data: statusOptions = [] } = useBuildingStatuses();
  const mergedStatusOptions = Array.from(
    [...DEFAULT_STATUS_OPTIONS, ...statusOptions, ...localStatusOptions]
      .reduce((map, status) => map.set(status.value, status), new Map<string, BuildingStatus>())
      .values(),
  );
  const visibleStatusOptions = mergedStatusOptions.filter((status) => !status.managerOnly || currentUserRole === 'manager');
  const createStatusMutation = useCreateBuildingStatus();
  const deleteStatusMutation = useDeleteBuildingStatus();

  useEffect(() => {
    photoScaleRef.current = photoScale;
  }, [photoScale]);

  useEffect(() => {
    photoOffsetRef.current = photoOffset;
  }, [photoOffset]);

  const clampPhotoOffset = (offset: { x: number; y: number }, scale = photoScaleRef.current) => {
    const maxX = Math.max(0, screenWidth * (scale - 1) * 0.65);
    const maxY = Math.max(0, screenHeight * (scale - 1) * 0.45);
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  };

  const updatePhotoScale = (nextScale: number) => {
    const boundedScale = Math.max(1, Math.min(3, nextScale));
    setPhotoScale(boundedScale);
    photoScaleRef.current = boundedScale;

    if (boundedScale === 1) {
      const centeredOffset = { x: 0, y: 0 };
      photoOffsetRef.current = centeredOffset;
      setPhotoOffset(centeredOffset);
      return;
    }

    const nextOffset = clampPhotoOffset(photoOffsetRef.current, boundedScale);
    photoOffsetRef.current = nextOffset;
    setPhotoOffset(nextOffset);
  };

  const photoPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => photoScaleRef.current > 1,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        photoScaleRef.current > 1 &&
        (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2),
      onPanResponderGrant: () => {
        photoPanStartRef.current = photoOffsetRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        if (photoScaleRef.current <= 1) return;
        const nextOffset = clampPhotoOffset({
          x: photoPanStartRef.current.x + gestureState.dx,
          y: photoPanStartRef.current.y + gestureState.dy,
        });
        photoOffsetRef.current = nextOffset;
        setPhotoOffset(nextOffset);
      },
    }),
  ).current;

  // Use dataService for offline storage
  const saveToLocalStorage = async (key: string, data: any) => {
    await dataService.saveToStorage(key, data);
  };

  const loadFromLocalStorage = async (key: string) => {
    return await dataService.loadFromStorage(key);
  };

  const addPendingChange = (change: any) => {
    const newChange = {
      ...change,
      timestamp: Date.now(),
      id: Date.now().toString()
    };
    setPendingChanges(prev => [...prev, newChange]);
    setSyncStatus('pending');
  };

  const syncWithBackend = async () => {
    if (!isOnline || pendingChanges.length === 0) return;
    
    setSyncStatus('syncing');
    try {
      // Simulate backend sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear pending changes after successful sync
      setPendingChanges([]);
      setSyncStatus('synced');
      
      // Save current data to backend
      await saveToLocalStorage('buildingsData', buildingsData);
      
      Alert.alert('Synchronisation', 'Données synchronisées avec succès');
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      Alert.alert('Erreur', 'Échec de la synchronisation');
    }
  };

  // Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
      
      // Auto-sync when coming back online
      if (state.isConnected && pendingChanges.length > 0) {
        syncWithBackend();
      }
    });

    return unsubscribe;
  }, [pendingChanges.length]);

  // Load saved data on mount
  useEffect(() => {
    const loadSavedData = async () => {
      const savedBuildings = await loadFromLocalStorage('buildingsData');
      const savedPending = await loadFromLocalStorage('pendingChanges');
      
      if (savedBuildings) {
        setBuildingsData(savedBuildings as Partial<Building>[]);
      }
      if (savedPending) {
        setPendingChanges(savedPending as any[]);
        setSyncStatus('pending');
      }
      const savedLocalStatuses = await loadFromLocalStorage(LOCAL_BUILDING_STATUSES_KEY);
      if (Array.isArray(savedLocalStatuses)) {
        setLocalStatusOptions(savedLocalStatuses as BuildingStatus[]);
      }
    };
    
    loadSavedData();
  }, []);

  // Auto-save when data changes
  useEffect(() => {
    if (buildingsData.length > 0) {
      saveToLocalStorage('buildingsData', buildingsData);
      
      if (isOnline) {
        syncWithBackend();
      } else {
        addPendingChange({ type: 'buildings_update', data: buildingsData });
      }
    }
  }, [buildingsData]);


  // Sync API building data to local state
  useEffect(() => {
    const mergeApiBuildingWithLocalPhotos = async () => {
      if (!apiBuilding) return;

      const key = apiBuilding._id || apiBuilding.idImmeuble || buildingId;
      const savedPhotos = key ? await loadFromLocalStorage(getBuildingPhotosKey(String(key))) : [];
      const localPhotos = Array.isArray(savedPhotos) ? savedPhotos as Photo[] : [];
      const apiPhotos = Array.isArray((apiBuilding as any).photos) ? (apiBuilding as any).photos as Photo[] : [];
      const mergedPhotos = Array.from(
        [...apiPhotos, ...localPhotos]
          .reduce((map, photo) => map.set(photo._id || photo.id || photo.uri, photo), new Map<string, Photo>())
          .values(),
      );

      setBuildingsData([{ ...apiBuilding, photos: mergedPhotos }]);
    };

    void mergeApiBuildingWithLocalPhotos();
  }, [apiBuilding, buildingId]);

  const persistBuildingPhotos = async (building: Partial<Building>) => {
    const key = building._id || building.idImmeuble || buildingId;
    if (!key) return;
    await saveToLocalStorage(getBuildingPhotosKey(String(key)), building.photos || []);
  };

  const addPhotoToBuilding = async (buildingIndex: number, photo: Photo) => {
    let nextBuilding: Partial<Building> | null = null;
    setBuildingsData(prev => {
      const next = [...prev];
      if (next[buildingIndex]) {
        next[buildingIndex] = {
          ...next[buildingIndex],
          photos: [...(next[buildingIndex].photos || []), photo]
        };
        nextBuilding = next[buildingIndex];
      }
      return next;
    });

    const current = buildingsData[buildingIndex];
    await persistBuildingPhotos({
      ...(current || {}),
      photos: [...((current?.photos || []) as any), photo],
    });
  };

  const replacePhotoForBuilding = async (buildingIndex: number, photoId: string, uploaded: any) => {
    const uploadedWithFreshUri = uploaded?.uri
      ? { ...uploaded, uri: `${uploaded.uri}${uploaded.uri.includes('?') ? '&' : '?'}v=${Date.now()}` }
      : uploaded;
    let updatedBuilding: Partial<Building> | null = null;
    setBuildingsData(prev => {
      const next = [...prev];
      if (next[buildingIndex]?.photos) {
        next[buildingIndex] = {
          ...next[buildingIndex],
          photos: next[buildingIndex].photos?.map((photo: any) =>
            photo.id === photoId ? { ...photo, ...uploadedWithFreshUri, timestamp: new Date(uploaded.timestamp) } : photo,
          ),
        };
        updatedBuilding = next[buildingIndex];
      }
      return next;
    });

    if (updatedBuilding) {
      await persistBuildingPhotos(updatedBuilding);
    }
  };

  const handleBack = () => {
    router.replace({
      pathname: '/(app)/infoImmeuble',
      params: {
        itemId: itemId || '',
        zone: zone || '',
        itemName: itemName || zone || '',
      },
    });
  };

  const handleSwipeBack = (event: any) => {
    const { state, translationX, translationY } = event.nativeEvent;
    if (state === State.END && translationX > 90 && Math.abs(translationY) < 80) {
      handleBack();
    }
  };

  const handleSave = async () => {
    console.log('Saving buildings data:', buildingsData);
    
    if (buildingsData.length > 0 && buildingsData[0]._id) {
      try {
        await uploadPendingPhotos(buildingsData[0]);
        await updateBuildingMutation.mutateAsync({
          id: buildingsData[0]._id,
          data: buildingsData[0]
        });
        Alert.alert('Sauvegardé', 'Les informations ont été enregistrées et synchronisées');
      } catch (error) {
        // Fallback to offline storage
        await dataService.saveBuilding(buildingsData[0] as any);
        Alert.alert('Sauvegardé localement', 'Les informations seront synchronisées dès le retour en ligne.');
      }
    } else {
      Alert.alert('Erreur', 'Aucun immeuble à sauvegarder');
    }
  };

  const uploadPendingPhotos = async (building: Partial<Building>) => {
    const buildingDbId = building._id;
    const photos = (building.photos || []) as Photo[];
    if (!buildingDbId || photos.length === 0) return;

    const uploadedPhotos: Photo[] = [];
    for (const photo of photos) {
      if (photo._id || !photo.uri?.startsWith('file:')) {
        uploadedPhotos.push(photo);
        continue;
      }

      console.log('[PHOTO_UPLOAD] uploading pending photo', {
        buildingId: buildingDbId,
        photoId: photo.id,
        type: photo.type,
        uri: photo.uri,
      });
      const response = await photosApi.uploadMobile(buildingDbId, {
        ...photo,
        timestamp: photo.timestamp instanceof Date ? photo.timestamp : new Date(photo.timestamp),
      });
      const uploaded = Array.isArray(response.data) ? response.data[0] : response.data;
      uploadedPhotos.push({
        ...photo,
        ...(uploaded || {}),
        timestamp: uploaded?.timestamp ? new Date(uploaded.timestamp) : photo.timestamp,
      } as Photo);
    }

    setBuildingsData((previous) => {
      const next = [...previous];
      if (next[0]?._id === buildingDbId) {
        next[0] = { ...next[0], photos: uploadedPhotos as any };
      }
      return next;
    });
    await persistBuildingPhotos({ ...building, photos: uploadedPhotos as any });
  };

  const handleStatusChange = async (status: string) => {
    const current = buildingsData[0];
    if (!current) return;

    const updated = { ...current, status };
    setBuildingsData([updated]);
    setShowStatusDropdown(false);

    if (updated._id) {
      try {
        setSyncStatus('syncing');
        await updateBuildingMutation.mutateAsync({
          id: updated._id,
          data: { status },
        });
        setSyncStatus('synced');
      } catch (error) {
        setSyncStatus('pending');
        await dataService.saveBuilding(updated as any);
      }
    }
  };

  const addStatus = async () => {
    const label = newStatusLabel.trim();
    if (!label) {
      Alert.alert('État', 'Veuillez saisir le nom de l’état.');
      return;
    }

    const localValue = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const localStatus: BuildingStatus = {
      value: localValue,
      label,
      color: '#64748b',
      managerOnly: newStatusManagerOnly,
    };
    const nextLocalStatuses = [
      ...localStatusOptions.filter((status) => status.value !== localStatus.value),
      localStatus,
    ];
    setLocalStatusOptions(nextLocalStatuses);
    await saveToLocalStorage(LOCAL_BUILDING_STATUSES_KEY, nextLocalStatuses);
    setNewStatusLabel('');
    setNewStatusManagerOnly(false);
    setShowAddStatusModal(false);
    await handleStatusChange(localStatus.value);

    try {
      const response = await createStatusMutation.mutateAsync({ label, managerOnly: newStatusManagerOnly });
      const created = response.data;
      if (created?.value && created.value !== localStatus.value) {
        const syncedLocalStatuses = nextLocalStatuses.filter((status) => status.value !== localStatus.value);
        setLocalStatusOptions(syncedLocalStatuses);
        await saveToLocalStorage(LOCAL_BUILDING_STATUSES_KEY, syncedLocalStatuses);
        await handleStatusChange(created.value);
      }
    } catch (error: any) {
      Alert.alert('État ajouté localement', 'Le backend doit être redémarré pour enregistrer cet état dans la base.');
    }
  };

  const deleteStatus = (value: string, label: string) => {
    Alert.alert('Supprimer l’état', `Supprimer "${label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            const nextLocalStatuses = localStatusOptions.filter((status) => status.value !== value);
            setLocalStatusOptions(nextLocalStatuses);
            await saveToLocalStorage(LOCAL_BUILDING_STATUSES_KEY, nextLocalStatuses);
            await deleteStatusMutation.mutateAsync(value);
            if (buildingsData[0]?.status === value) await handleStatusChange('active');
          } catch (error: any) {
            Alert.alert('Erreur', error?.message || 'Impossible de supprimer cet état.');
          }
        },
      },
    ]);
  };

  const archiveCurrentBuilding = () => {
    const building = buildingsData[0];
    const id = building?._id || building?.idImmeuble;
    if (!id) {
      Alert.alert('Erreur', 'Aucun immeuble à archiver');
      return;
    }

    Alert.alert('Archiver', `Archiver l’immeuble ${building.idImmeuble || buildingName} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Archiver',
        style: 'destructive',
        onPress: async () => {
          try {
            await buildingsApi.archive(id);
            setShowBuildingMenu(false);
            Alert.alert('Archivé', 'L’immeuble a été archivé.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (error: any) {
            Alert.alert('Erreur', error?.message || 'Impossible d’archiver cet immeuble.');
          }
        },
      },
    ]);
  };

  const exportTechnicalDossier = async () => {
    const building = buildingsData[0];
    const id = building?._id || building?.idImmeuble || buildingId;

    setShowBuildingMenu(false);
    if (!id) {
      Alert.alert('Erreur', 'Aucun immeuble sélectionné pour exporter le dossier technique.');
      return;
    }

    setIsExportingTechnicalDossier(true);
    try {
      if (building?._id) {
        await uploadPendingPhotos(building);
      }
      const request = await technicalDossiersApi.getDownloadRequest(String(id), building?.idImmeuble || buildingName);
      const targetUri = `${FileSystem.documentDirectory}${request.fileName}`;
      const result = await FileSystem.downloadAsync(request.url, targetUri, {
        headers: request.headers,
      });
      const savedUri = await saveFileWithPicker(result.uri, request.fileName);

      Alert.alert(
        'Dossier technique exporté',
        `Fichier généré : ${request.fileName}\n\nEmplacement : ${savedUri}`,
      );
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible d’exporter le dossier technique.');
    } finally {
      setIsExportingTechnicalDossier(false);
    }
  };

  // GPS Functions
  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    return status === 'granted';
  };

  const updateGPSLocation = async (buildingIndex: number) => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission refusée', 'Veuillez autoriser l\'accès à la localisation');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      
      updateBuildingField(buildingIndex, 'latitude', latitude.toString());
      updateBuildingField(buildingIndex, 'longitude', longitude.toString());
      
      Alert.alert('Position mise à jour', `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'obtenir la position GPS');
      console.error('GPS Error:', error);
    }
  };

  // Photo Functions
  const openPhotoModal = (buildingIndex: number) => {
    console.log('Opening photo modal for building index:', buildingIndex);
    setSelectedBuildingIndex(buildingIndex);
    setShowPhotoSourceModal(true);
  };

  const closePhotoSourceModal = () => {
    setShowPhotoSourceModal(false);
    setSelectedBuildingIndex(null);
    setSelectedPhotoType(photoTypes[0]);
    setShowPhotoTypeDropdown(false);
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedBuildingIndex(null);
    setSelectedPhotoType(photoTypes[0]);
    setShowPhotoTypeDropdown(false);
  };

  const formatPhotoTimestamp = (timestamp?: Date | string) => {
    if (!timestamp) return 'Date: -';
    const value = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(value.getTime())) return 'Date: -';
    return `Date: ${value.toLocaleString('fr-FR')}`;
  };

  const getPhotoBuildingId = (photo: Partial<Photo>, building?: Partial<Building>) => {
    return photo.idImmeuble || building?.idImmeuble || building?.idImmeubleSysteme || building?._id || '-';
  };

  const getPhotoGpsLabel = (photo: Partial<Photo>) => {
    const latitude = photo.gpsLatitude;
    const longitude = photo.gpsLongitude;
    if (!latitude || !longitude) return 'GPS: -';
    return `GPS: ${latitude}, ${longitude}`;
  };

  const getPhotoMetadata = (
    buildingIndex: number,
    gps?: { latitude: number; longitude: number } | null,
    options: { useBuildingGpsFallback?: boolean } = {},
  ) => {
    const building = buildingsData[buildingIndex];
    const useBuildingGpsFallback = options.useBuildingGpsFallback ?? false;
    return {
      idImmeuble: String(building?.idImmeuble || building?.idImmeubleSysteme || building?._id || ''),
      gpsLatitude: String(gps?.latitude ?? (useBuildingGpsFallback ? building?.latitude : '') ?? ''),
      gpsLongitude: String(gps?.longitude ?? (useBuildingGpsFallback ? building?.longitude : '') ?? ''),
    };
  };

  const getCurrentGpsForPhoto = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return null;
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch {
      return null;
    }
  };

  const openPhotoTypeSelection = (source: 'camera' | 'gallery') => {
    setPhotoSource(source);
    setShowPhotoSourceModal(false);
    setShowPhotoTypeDropdown(false);
    setShowPhotoModal(true);
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const selectPhotoFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const metadata = selectedBuildingIndex !== null
          ? getPhotoMetadata(selectedBuildingIndex, null, { useBuildingGpsFallback: false })
          : {};
        const newPhoto: Photo = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: `${selectedPhotoType}_${Date.now()}.jpg`,
          type: selectedPhotoType,
          timestamp: new Date(),
          mimeType: result.assets[0].mimeType || 'image/jpeg',
          ...metadata,
        };

        if (selectedBuildingIndex !== null) {
          await addPhotoToBuilding(selectedBuildingIndex, newPhoto);
          const buildingDbId = buildingsData[selectedBuildingIndex]?._id;
          if (buildingDbId) {
            try {
              const response = await photosApi.uploadMobile(buildingDbId, newPhoto);
              const uploaded = Array.isArray(response.data) ? response.data[0] : response.data;
              if (uploaded) {
                await replacePhotoForBuilding(selectedBuildingIndex, newPhoto.id, uploaded);
              }
            } catch (error) {
              console.error('[PHOTO_UPLOAD] gallery upload failed', error);
            }
          }
        }

        closePhotoModal();
        Alert.alert('Photo ajoutée', `${selectedPhotoType} enregistrée avec succès`);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sélectionner la photo');
      console.error('Gallery Error:', error);
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permission first
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Permission refusée', 'Veuillez autoriser l\'accès à la caméra pour prendre des photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        exif: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        // Read GPS immediately after capture; do not fall back to building GPS for taken photos.
        const gps = await getCurrentGpsForPhoto();
        const metadata = selectedBuildingIndex !== null
          ? getPhotoMetadata(selectedBuildingIndex, gps, { useBuildingGpsFallback: false })
          : {};
        const newPhoto: Photo = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: `${selectedPhotoType}_${Date.now()}.jpg`,
          type: selectedPhotoType,
          timestamp: new Date(),
          mimeType: result.assets[0].mimeType || 'image/jpeg',
          ...metadata,
        };

        if (selectedBuildingIndex !== null) {
          await addPhotoToBuilding(selectedBuildingIndex, newPhoto);
          const buildingDbId = buildingsData[selectedBuildingIndex]?._id;
          if (buildingDbId) {
            try {
              const response = await photosApi.uploadMobile(buildingDbId, newPhoto);
              const uploaded = Array.isArray(response.data) ? response.data[0] : response.data;
              if (uploaded) {
                await replacePhotoForBuilding(selectedBuildingIndex, newPhoto.id, uploaded);
              }
            } catch (error) {
              console.error('[PHOTO_UPLOAD] camera upload failed', error);
            }
          }
        }

        closePhotoModal();
        Alert.alert('Photo ajoutée', `${selectedPhotoType} enregistrée avec succès`);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de prendre la photo');
      console.error('Camera Error:', error);
    }
  };

  const openPhotoPreview = (photo: Photo) => {
    setSelectedPhoto(photo);
    setShowPhotoPreview(true);
    setPhotoScale(1);
    setPhotoOffset({ x: 0, y: 0 });
  };

  const closePhotoPreview = () => {
    setShowPhotoPreview(false);
    setSelectedPhoto(null);
    setPhotoScale(1);
    setPhotoOffset({ x: 0, y: 0 });
  };

  const getSafePhotoFileName = (photo: Photo) => {
    const rawName = photo.name || `${photo.type || 'photo'}_${Date.now()}.jpg`;
    const withoutQuery = rawName.split('?')[0];
    const safeName = withoutQuery.replace(/[\\/:*?"<>|]/g, '_');
    return /\.(jpg|jpeg|png|gif)$/i.test(safeName) ? safeName : `${safeName}.jpg`;
  };

  const downloadPhoto = async (photo: Photo | null) => {
    if (!photo?.uri) {
      Alert.alert('Erreur', 'Aucune photo à télécharger.');
      return;
    }

    try {
      const fileName = getSafePhotoFileName(photo);
      const sourceUri = photo.uri.startsWith('http')
        ? (await FileSystem.downloadAsync(photo.uri, `${FileSystem.cacheDirectory}${fileName}`)).uri
        : photo.uri;

      if (Platform.OS === 'android') {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert('Téléchargement annulé', `Photo disponible ici : ${sourceUri}`);
          return;
        }

        const base64Content = await FileSystem.readAsStringAsync(sourceUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          photo.mimeType || 'image/jpeg',
        );
        await FileSystem.writeAsStringAsync(destinationUri, base64Content, {
          encoding: FileSystem.EncodingType.Base64,
        });
        Alert.alert('Photo téléchargée', `Fichier enregistré : ${fileName}`);
        return;
      }

      Alert.alert('Photo téléchargée', `Photo disponible ici : ${sourceUri}`);
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible de télécharger la photo.');
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    if (isSelectionMode) {
      setSelectedPhotos(prev => 
        prev.includes(photoId) 
          ? prev.filter(id => id !== photoId)
          : [...prev, photoId]
      );
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedPhotos([]);
  };

  const deletePhotoRecords = async (photos: Photo[]) => {
    await Promise.allSettled(
      photos
        .map((photo) => photo._id || photo.id)
        .filter(Boolean)
        .map((id) => photosApi.delete(String(id))),
    );
  };

  const removePhotosFromBuilding = async (buildingIndex: number, photoIds: string[]) => {
    const currentBuilding = buildingsData[buildingIndex];
    const currentPhotos = ((currentBuilding?.photos || []) as Photo[]);
    const removedPhotos = currentPhotos.filter((photo) => photoIds.includes(photo.id));
    const remainingPhotos = currentPhotos.filter((photo) => !photoIds.includes(photo.id));

    await deletePhotoRecords(removedPhotos);

    const updatedBuilding = {
      ...(currentBuilding || {}),
      photos: remainingPhotos as any,
    };

    setBuildingsData(prev => {
      const newData = [...prev];
      if (newData[buildingIndex]) {
        newData[buildingIndex] = updatedBuilding;
      }
      return newData;
    });

    await persistBuildingPhotos(updatedBuilding);
  };

  const deleteSelectedPhotos = (buildingIndex: number) => {
    if (selectedPhotos.length === 0) return;
    const idsToDelete = [...selectedPhotos];
    
    Alert.alert(
      'Supprimer les photos',
      `Voulez-vous supprimer ${idsToDelete.length} photo(s) sélectionnée(s)?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await removePhotosFromBuilding(buildingIndex, idsToDelete);
            setSelectedPhotos([]);
            Alert.alert('Photos supprimées', `${idsToDelete.length} photo(s) supprimée(s) avec succès`);
          }
        }
      ]
    );
  };

  const deletePhoto = async (buildingIndex: number, photoId: string) => {
    await removePhotosFromBuilding(buildingIndex, [photoId]);
    Alert.alert('Photo supprimée', 'La photo a été supprimée avec succès');
  };

  const renderPhotoGallery = (building: Partial<Building> | undefined, buildingIndex: number) => {
    if (!building) {
      return (
        <TouchableOpacity 
          style={[styles.addPhotoButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
          onPress={() => {
            console.log('Photo button pressed! Building index:', buildingIndex);
            openPhotoModal(buildingIndex);
          }}
        >
          <Text style={[styles.addPhotoText, { color: isDark ? '#fff' : '#000' }]}>+ Ajouter des photos</Text>
        </TouchableOpacity>
      );
    }
    
    const photos = building.photos || [];
    
    if (photos.length === 0) {
      return (
        <TouchableOpacity 
          style={[styles.addPhotoButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
          onPress={() => {
            console.log('Photo button pressed! Building index:', buildingIndex);
            openPhotoModal(buildingIndex);
          }}
        >
          <Text style={[styles.addPhotoText, { color: isDark ? '#fff' : '#000' }]}>+ Ajouter des photos</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View>
        <View style={styles.photoHeader}>
          <Text style={[styles.photoCount, { color: isDark ? '#fff' : '#000' }]}>
            {photos.length} photo(s) {selectedPhotos.length > 0 && `(${selectedPhotos.length} sélectionnée(s))`}
          </Text>
          <View style={styles.photoHeaderActions}>
            <TouchableOpacity 
              style={[styles.selectionModeButton, { backgroundColor: isSelectionMode ? '#007AFF' : (isDark ? '#333' : '#f0f0f0') }]}
              onPress={toggleSelectionMode}
            >
              <Text style={[styles.selectionModeButtonText, { color: isSelectionMode ? '#fff' : (isDark ? '#fff' : '#000') }]}>
                {isSelectionMode ? 'Annuler' : 'Sélectionner'}
              </Text>
            </TouchableOpacity>
            {isSelectionMode && selectedPhotos.length > 0 && (
              <TouchableOpacity 
                style={[styles.deleteSelectedButton, { backgroundColor: '#FF3B30' }]}
                onPress={() => deleteSelectedPhotos(buildingIndex)}
              >
                <Text style={styles.deleteSelectedButtonText}>Supprimer ({selectedPhotos.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
          {photos.map((photo, photoIndex) => (
            <TouchableOpacity 
              key={`${photo._id || photo.id || photo.uri || photo.name}-${photoIndex}`}
              style={[
                styles.photoItem,
                selectedPhotos.includes(photo.id) && styles.selectedPhotoItem
              ]}
              onPress={() => {
                if (isSelectionMode) {
                  togglePhotoSelection(photo.id);
                } else {
                  openPhotoPreview(photo);
                }
              }}
              onLongPress={() => {
                if (!isSelectionMode) {
                  setIsSelectionMode(true);
                  togglePhotoSelection(photo.id);
                }
              }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={styles.photoThumbnail}
                resizeMode="cover"
              />
              {isSelectionMode && (
                <View style={styles.selectionOverlay}>
                  <View style={[
                    styles.selectionCheckbox,
                    selectedPhotos.includes(photo.id) && styles.selectionCheckboxChecked
                  ]}>
                    {selectedPhotos.includes(photo.id) && (
                      <Text style={styles.selectionCheckmark}>✓</Text>
                    )}
                  </View>
                </View>
              )}
              <Text style={[styles.photoType, { color: isDark ? '#ccc' : '#666' }]}>{photo.type}</Text>
              <Text style={[styles.photoName, { color: isDark ? '#fff' : '#000' }]}>{photo.name}</Text>
              <View style={styles.photoMetaBox}>
                <Text style={[styles.photoMetaText, { color: isDark ? '#d1d5db' : '#334155' }]}>
                  {formatPhotoTimestamp(photo.timestamp)}
                </Text>
                <Text style={[styles.photoMetaText, { color: isDark ? '#d1d5db' : '#334155' }]}>
                  ID: {getPhotoBuildingId(photo, building)}
                </Text>
                <Text style={[styles.photoMetaText, { color: isDark ? '#d1d5db' : '#334155' }]}>
                  {getPhotoGpsLabel(photo)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.photoActions}>
          <TouchableOpacity 
            style={[styles.addMorePhotosButton, { backgroundColor: '#007AFF' }]}
            onPress={() => openPhotoModal(buildingIndex)}
          >
            <Text style={styles.addMorePhotosText}>+ Ajouter une photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const updateBuildingField = (buildingIndex: number, field: keyof Building, value: string) => {
    setBuildingsData(prev => {
      const newData = [...prev];
      if (newData[buildingIndex]) {
        newData[buildingIndex] = { ...newData[buildingIndex], [field]: value };
      }
      return newData;
    });
  };

  // For mobile version - show first building details
  const firstBuilding = buildingsData[0] || {
    idImmeuble: '',
    idImmeubleSysteme: '',
    ville: '',
    codePostal: '',
    longitude: '',
    latitude: '',
    rueNomNom: '',
    numeroNomImmeuble: '',
    utilisationImmeuble: '',
    nbreEtages: '',
    sousSol: '',
    sousSolCommun: '',
    solutionRaccordement: '',
    nbrB2B: '',
    nbrB2C: '',
    totalClients: '',
    cheminFibrePBO1: '',
    floorPBO1: '',
    typePBO1: '',
    PBO2: '',
    floorPBO2: '',
    typePBO2: '',
    syndic: '',
    numSyndic: '',
    remarques: '',
    typologieHabitat: '',
    verticalite: '',
    csp: '',
    serviceId: '',
    photos: []
  } as Building;
  const updateField = (field: keyof Building, value: string) => {
    updateBuildingField(0, field, value);
  };

  const renderInputField = (label: string, field: keyof Building, multiline?: boolean) => {
    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>{label}</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              backgroundColor: isDark ? '#333' : '#f9f9f9',
              color: isDark ? '#fff' : '#000',
              borderColor: isDark ? '#555' : '#ddd',
              height: multiline ? 80 : 50
            }
          ]}
          value={typeof firstBuilding[field] === 'string' ? firstBuilding[field] : ''}
          onChangeText={(text) => updateField(field, text)}
          placeholder={`Entrez ${label.toLowerCase()}`}
          placeholderTextColor={isDark ? '#888' : '#999'}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
        />
      </View>
    );
  };

  const renderTableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
      <View style={[styles.headerCell, styles.headerIdCell, { borderRightColor: isDark ? '#444' : '#e0e0e0' }]}>
        <Text style={[styles.tableHeaderLabel, { color: isDark ? '#fff' : '#000' }]}>ID Immeuble</Text>
      </View>
      {buildingFields.map((field, index) => (
        <View key={field} style={[styles.headerCell, { borderRightColor: isDark ? '#444' : '#e0e0e0', minWidth: 100 }]}>
          <Text style={[styles.tableHeaderLabel, { color: isDark ? '#fff' : '#000' }]}>
            {fieldLabels[field as keyof typeof fieldLabels] || field}
          </Text>
        </View>
      ))}
      <View style={[styles.headerCell, { minWidth: 200 }]}>
        <Text style={[styles.tableHeaderLabel, { color: isDark ? '#fff' : '#000' }]}>Photos</Text>
      </View>
    </View>
  );

  const renderBuildingRow = (building: Partial<Building>, buildingIndex: number) => (
    <View
      key={`building-${building.idImmeuble}`}
      style={[styles.tableRow, { backgroundColor: isDark ? '#1a1a1a' : '#fff', borderBottomColor: isDark ? '#333' : '#e0e0e0' }]}
    >
      <View key={`${building.idImmeuble}-id`} style={[styles.tableCell, styles.idCell, { borderRightColor: isDark ? '#444' : '#e0e0e0' }]}>
        <Text style={[styles.tableText, { color: isDark ? '#fff' : '#000' }]}>{building.idImmeuble}</Text>
      </View>
      {buildingFields.map((field, index) => (
        <View key={`${building.idImmeuble}-${field}`} style={[styles.tableCell, styles.valueCell, { borderRightColor: isDark ? '#444' : '#e0e0e0' }]}>
          {field === 'longitude' || field === 'latitude' ? (
            <View style={styles.gpsCell}>
              <TextInput
                style={[
                  styles.tableInput, 
                  { 
                    backgroundColor: 'transparent',
                    color: isDark ? '#fff' : '#000',
                    borderColor: 'transparent',
                    height: 30,
                    flex: 1
                  }
                ]}
                value={typeof building[field] === 'string' ? building[field] : ''}
                onChangeText={(text) => updateBuildingField(buildingIndex, field, text)}
                placeholder=""
                placeholderTextColor={isDark ? '#666' : '#999'}
              />
              <TouchableOpacity 
                style={[styles.gpsButton, { backgroundColor: '#007AFF' }]}
                onPress={() => updateGPSLocation(buildingIndex)}
              >
                <Text style={styles.gpsButtonText}>GPS</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TextInput
              style={[
                styles.tableInput, 
                { 
                  backgroundColor: 'transparent',
                  color: isDark ? '#fff' : '#000',
                  borderColor: 'transparent',
                  height: field === 'remarques' ? 60 : 30
                }
              ]}
              value={typeof building[field] === 'string' ? building[field] : ''}
              onChangeText={(text) => updateBuildingField(buildingIndex, field, text)}
              placeholder=""
              placeholderTextColor={isDark ? '#666' : '#999'}
              multiline={field === 'remarques'}
              numberOfLines={field === 'remarques' ? 2 : 1}
            />
          )}
        </View>
      ))}
      <View key={`${building.idImmeuble}-photos`} style={[styles.tableCell, styles.photoCell, { minWidth: 200 }]}>
        {renderPhotoGallery(building, buildingIndex)}
      </View>
      
    </View>
  );

  if (isLoadingBuilding) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
        <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center' }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <PanGestureHandler onHandlerStateChange={handleSwipeBack} activeOffsetX={30}>
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: isDark ? '#fff' : '#007AFF' }]}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
          Détails Immeuble - {buildingName}
        </Text>
        <TouchableOpacity
          onPress={() => setShowBuildingMenu(true)}
          style={styles.headerMenuButton}
        >
          <Text style={[styles.headerMenuText, { color: isDark ? '#fff' : '#334155' }]}>⋮</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusSelectorContainer}>
        <Text style={[styles.statusSelectorLabel, { color: isDark ? '#ccc' : '#64748b' }]}>État</Text>
        <TouchableOpacity
          onPress={() => setShowStatusDropdown((current) => !current)}
          style={[styles.statusSelectorButton, { backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: isDark ? '#374151' : '#cbd5e1' }]}
        >
          <Text style={[styles.statusSelectorText, { color: visibleStatusOptions.find((option) => option.value === buildingsData[0]?.status)?.color || '#16a34a' }]}>
            {visibleStatusOptions.find((option) => option.value === buildingsData[0]?.status)?.label || 'Actif'}
          </Text>
          <Text style={[styles.statusSelectorArrow, { color: isDark ? '#fff' : '#334155' }]}>
            {showStatusDropdown ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {currentUserRole === 'manager' ? (
          <TouchableOpacity
            onPress={() => {
              setShowStatusDropdown(false);
              setShowAddStatusModal(true);
            }}
            style={styles.statusAddButtonAlways}
          >
            <Text style={styles.statusAddText}>+ Ajouter état</Text>
          </TouchableOpacity>
        ) : null}
        {showStatusDropdown ? (
          <View style={[styles.statusDropdown, { backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: isDark ? '#374151' : '#cbd5e1' }]}>
            {visibleStatusOptions.map((option) => (
              <View key={option.value} style={styles.statusDropdownRow}>
                <TouchableOpacity
                  onPress={() => handleStatusChange(option.value)}
                  style={styles.statusDropdownItem}
                >
                  <Text style={[styles.statusDropdownText, { color: option.color }]}>
                    {option.label}{option.managerOnly ? ' (manager)' : ''}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteStatus(option.value, option.label)}
                  style={styles.statusDeleteButton}
                >
                  <Text style={styles.statusDeleteText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={() => {
                setShowStatusDropdown(false);
                setShowAddStatusModal(true);
              }}
              style={styles.statusAddButton}
            >
              <Text style={styles.statusAddText}>+ Ajouter un état</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Modal visible={showAddStatusModal} transparent animationType="fade" onRequestClose={() => setShowAddStatusModal(false)}>
        <View style={styles.menuOverlay}>
          <View style={[styles.buildingMenu, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
            <Text style={[styles.buildingMenuTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Ajouter un état</Text>
            <TextInput
              value={newStatusLabel}
              onChangeText={setNewStatusLabel}
              placeholder="Nom de l'état"
              placeholderTextColor={isDark ? '#9ca3af' : '#64748b'}
              style={[styles.statusInput, { color: isDark ? '#fff' : '#0f172a', borderColor: isDark ? '#374151' : '#cbd5e1' }]}
            />
            <TouchableOpacity
              onPress={() => setNewStatusManagerOnly((current) => !current)}
              style={styles.managerOnlyToggle}
            >
              <Text style={[styles.managerOnlyCheckbox, { backgroundColor: newStatusManagerOnly ? '#2563eb' : 'transparent' }]}>
                {newStatusManagerOnly ? '✓' : ''}
              </Text>
              <Text style={[styles.managerOnlyText, { color: isDark ? '#fff' : '#0f172a' }]}>
                Visible manager seul
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addStatus} style={[styles.buildingMenuAction, { backgroundColor: '#2563eb' }]}>
              <Text style={styles.buildingMenuActionText}>Ajouter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setNewStatusLabel('');
                setNewStatusManagerOnly(false);
                setShowAddStatusModal(false);
              }}
              style={[styles.buildingMenuAction, { backgroundColor: isDark ? '#374151' : '#e2e8f0' }]}
            >
              <Text style={[styles.buildingMenuCloseText, { color: isDark ? '#fff' : '#0f172a' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBuildingMenu} transparent animationType="fade" onRequestClose={() => setShowBuildingMenu(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowBuildingMenu(false)}
          style={styles.menuOverlay}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.buildingMenu, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
            <Text style={[styles.buildingMenuTitle, { color: isDark ? '#fff' : '#0f172a' }]}>
              {buildingName || buildingsData[0]?.idImmeuble || 'Immeuble'}
            </Text>
            <TouchableOpacity
              onPress={async () => {
                setShowBuildingMenu(false);
                await handleSave();
              }}
              style={[styles.buildingMenuAction, { backgroundColor: '#2563eb' }]}
            >
              <Text style={styles.buildingMenuActionText}>Enregistrer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={exportTechnicalDossier}
              disabled={isExportingTechnicalDossier}
              style={[styles.buildingMenuAction, { backgroundColor: '#16a34a', opacity: isExportingTechnicalDossier ? 0.6 : 1 }]}
            >
              <Text style={styles.buildingMenuActionText}>
                {isExportingTechnicalDossier ? 'Export en cours...' : 'Exporter dossier technique'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowBuildingMenu(false);
                router.push({
                  pathname: '/kmzMap',
                  params: {
                    zone: String(zone || buildingsData[0]?.zone || buildingsData[0]?.ville || ''),
                    buildingName: String(buildingName || buildingsData[0]?.idImmeuble || ''),
                    buildingLatitude: String(buildingsData[0]?.latitude || ''),
                    buildingLongitude: String(buildingsData[0]?.longitude || ''),
                  },
                });
              }}
              style={[styles.buildingMenuAction, { backgroundColor: '#0f766e' }]}
            >
              <Text style={styles.buildingMenuActionText}>Afficher carte KMZ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={archiveCurrentBuilding}
              style={[styles.buildingMenuAction, { backgroundColor: '#dc2626' }]}
            >
              <Text style={styles.buildingMenuActionText}>Archiver cet immeuble</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowBuildingMenu(false)}
              style={[styles.buildingMenuAction, { backgroundColor: isDark ? '#374151' : '#e2e8f0' }]}
            >
              <Text style={[styles.buildingMenuCloseText, { color: isDark ? '#fff' : '#0f172a' }]}>Fermer</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {Platform.OS === 'web' ? (
        <>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} horizontal>
            <View style={styles.tableContainer}>
              {renderTableHeader()}
              {buildingsData.map((building, index) => renderBuildingRow(building, index))}
            </View>

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#007AFF' }]} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>

            <View style={styles.bottomSpacing} />
          </ScrollView>

          {/* Photo Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={showPhotoModal}
            onRequestClose={closePhotoModal}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, styles.photoTypeModalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                  Type de photo
                </Text>

                <TouchableOpacity
                  style={[
                    styles.photoTypeDropdownButton,
                    {
                      backgroundColor: isDark ? '#1f2937' : '#fff',
                      borderColor: photoTypeColors[photoTypes.indexOf(selectedPhotoType) % photoTypeColors.length] || '#2563eb',
                    },
                  ]}
                  onPress={() => setShowPhotoTypeDropdown((current) => !current)}
                >
                  <View style={[
                    styles.photoTypeColorDot,
                    { backgroundColor: photoTypeColors[photoTypes.indexOf(selectedPhotoType) % photoTypeColors.length] || '#2563eb' },
                  ]} />
                  <Text style={[styles.photoTypeDropdownText, { color: isDark ? '#fff' : '#0f172a' }]}>
                    {selectedPhotoType}
                  </Text>
                  <Text style={[styles.photoTypeDropdownArrow, { color: isDark ? '#fff' : '#334155' }]}>
                    {showPhotoTypeDropdown ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {showPhotoTypeDropdown ? (
                  <View style={[styles.photoTypeDropdownList, { backgroundColor: isDark ? '#111827' : '#f8fafc' }]}>
                    <ScrollView style={styles.photoTypeScroll} contentContainerStyle={styles.photoTypeButtons} nestedScrollEnabled>
                    {photoTypes.map((type, typeIndex) => {
                      const isSelected = selectedPhotoType === type;
                      const typeColor = photoTypeColors[typeIndex % photoTypeColors.length];
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.photoTypeButton,
                            isSelected && styles.selectedPhotoTypeButton,
                            {
                              backgroundColor: isSelected ? typeColor : (isDark ? '#1f2937' : '#fff'),
                              borderColor: typeColor,
                            }
                          ]}
                          onPress={() => {
                            setSelectedPhotoType(type);
                            setShowPhotoTypeDropdown(false);
                          }}
                        >
                          <View style={[styles.photoTypeColorDot, { backgroundColor: isSelected ? '#fff' : typeColor }]} />
                          <Text style={[
                            styles.photoTypeButtonText,
                            { color: isSelected ? '#fff' : (isDark ? '#fff' : '#0f172a') }
                          ]}>
                            {type}
                          </Text>
                          <Text style={[styles.photoTypeCheck, { color: isSelected ? '#fff' : typeColor }]}>
                            {isSelected ? '✓' : '›'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={closePhotoModal}
                  >
                    <Text style={[styles.buttonText, { color: isDark ? '#fff' : '#000' }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.submitButton, { backgroundColor: '#007AFF' }]}
                    onPress={takePhoto}
                  >
                    <Text style={styles.submitButtonText}>Prendre photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Informations Générales
            </Text>
            {renderInputField('ID Immeuble', 'idImmeuble')}
            {renderInputField('ID Immeuble Système', 'idImmeubleSysteme')}
            {renderInputField('Ville', 'ville')}
            {renderInputField('Code Postal', 'codePostal')}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Longitude</Text>
              <View style={styles.gpsInputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: isDark ? '#333' : '#f9f9f9',
                      color: isDark ? '#fff' : '#000',
                      borderColor: isDark ? '#555' : '#ddd',
                      flex: 1
                    }
                  ]}
                  value={firstBuilding.longitude || ''}
                  onChangeText={(text) => updateField('longitude', text)}
                  placeholder="Entrez la longitude"
                  placeholderTextColor={isDark ? '#888' : '#999'}
                />
                <TouchableOpacity 
                  style={[styles.gpsButtonMobile, { backgroundColor: '#007AFF' }]}
                  onPress={() => updateGPSLocation(0)}
                >
                  <Text style={styles.gpsButtonText}>GPS</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>Latitude</Text>
              <View style={styles.gpsInputContainer}>
                <TextInput
                  style={[
                    styles.input, 
                    { 
                      backgroundColor: isDark ? '#333' : '#f9f9f9',
                      color: isDark ? '#fff' : '#000',
                      borderColor: isDark ? '#555' : '#ddd',
                      flex: 1
                    }
                  ]}
                  value={firstBuilding.latitude || ''}
                  onChangeText={(text) => updateField('latitude', text)}
                  placeholder="Entrez la latitude"
                  placeholderTextColor={isDark ? '#888' : '#999'}
                />
                <TouchableOpacity 
                  style={[styles.gpsButtonMobile, { backgroundColor: '#007AFF' }]}
                  onPress={() => updateGPSLocation(0)}
                >
                  <Text style={styles.gpsButtonText}>GPS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Adresse et Localisation
            </Text>
            {renderInputField('Rue Nom & Nom', 'rueNomNom')}
            {renderInputField('N°/Nom Immeuble', 'numeroNomImmeuble')}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Caractéristiques
            </Text>
            {renderInputField('Utilisation Immeuble', 'utilisationImmeuble')}
            {renderInputField('Nbre Etages', 'nbreEtages')}
            {renderInputField('Sous Sol', 'sousSol')}
            {renderInputField('Sous Sol Commun', 'sousSolCommun')}
            {renderInputField('Solution de Raccordement', 'solutionRaccordement')}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Clients
            </Text>
            {renderInputField('Nbr B2B', 'nbrB2B')}
            {renderInputField('Nbr B2C', 'nbrB2C')}
            {renderInputField('Total Clients', 'totalClients')}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Infrastructure Fibre
            </Text>
            {renderInputField('Chemin de Fibre PBO1', 'cheminFibrePBO1')}
            {renderInputField('Floor PBO1', 'floorPBO1')}
            {renderInputField('Type PBO1', 'typePBO1')}
            {renderInputField('PBO2', 'PBO2')}
            {renderInputField('Floor PBO2', 'floorPBO2')}
            {renderInputField('Type PBO2', 'typePBO2')}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Syndic et Gestion
            </Text>
            {renderInputField('SYNDIC', 'syndic')}
            {renderInputField('Num Syndic', 'numSyndic')}
            {renderInputField('Remarques', 'remarques', true)}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Classification
            </Text>
            {renderInputField('Typologie Habitat', 'typologieHabitat')}
            {renderInputField('Verticalité', 'verticalite')}
            {renderInputField('CSP', 'csp')}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Photos
            </Text>
            {renderPhotoGallery(firstBuilding, 0)}
          </View>

          {/* Photo Source Selection Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={showPhotoSourceModal}
            onRequestClose={closePhotoSourceModal}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                  Ajouter une photo
                </Text>
                
                <View style={styles.photoSourceButtons}>
                  <TouchableOpacity
                    style={[styles.photoSourceButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={() => openPhotoTypeSelection('camera')}
                  >
                    <Text style={styles.photoSourceIcon}>📷</Text>
                    <Text style={[styles.photoSourceText, { color: isDark ? '#fff' : '#000' }]}>Prendre une photo</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.photoSourceButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={() => openPhotoTypeSelection('gallery')}
                  >
                    <Text style={styles.photoSourceIcon}>🖼️</Text>
                    <Text style={[styles.photoSourceText, { color: isDark ? '#fff' : '#000' }]}>Galerie</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={closePhotoSourceModal}
                  >
                    <Text style={[styles.buttonText, { color: isDark ? '#fff' : '#000' }]}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Photo Type Selection Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={showPhotoModal}
            onRequestClose={closePhotoModal}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, styles.photoTypeModalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                  Type de photo
                </Text>

                <TouchableOpacity
                  style={[
                    styles.photoTypeDropdownButton,
                    {
                      backgroundColor: isDark ? '#1f2937' : '#fff',
                      borderColor: photoTypeColors[photoTypes.indexOf(selectedPhotoType) % photoTypeColors.length] || '#2563eb',
                    },
                  ]}
                  onPress={() => setShowPhotoTypeDropdown((current) => !current)}
                >
                  <View style={[
                    styles.photoTypeColorDot,
                    { backgroundColor: photoTypeColors[photoTypes.indexOf(selectedPhotoType) % photoTypeColors.length] || '#2563eb' },
                  ]} />
                  <Text style={[styles.photoTypeDropdownText, { color: isDark ? '#fff' : '#0f172a' }]}>
                    {selectedPhotoType}
                  </Text>
                  <Text style={[styles.photoTypeDropdownArrow, { color: isDark ? '#fff' : '#334155' }]}>
                    {showPhotoTypeDropdown ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {showPhotoTypeDropdown ? (
                  <View style={[styles.photoTypeDropdownList, { backgroundColor: isDark ? '#111827' : '#f8fafc' }]}>
                    <ScrollView style={styles.photoTypeScroll} contentContainerStyle={styles.photoTypeButtons} nestedScrollEnabled>
                      {photoTypes.map((type, typeIndex) => {
                        const isSelected = selectedPhotoType === type;
                        const typeColor = photoTypeColors[typeIndex % photoTypeColors.length];
                        return (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.photoTypeButton,
                              isSelected && styles.selectedPhotoTypeButton,
                              {
                                backgroundColor: isSelected ? typeColor : (isDark ? '#1f2937' : '#fff'),
                                borderColor: typeColor,
                              }
                            ]}
                            onPress={() => {
                              setSelectedPhotoType(type);
                              setShowPhotoTypeDropdown(false);
                            }}
                          >
                            <View style={[styles.photoTypeColorDot, { backgroundColor: isSelected ? '#fff' : typeColor }]} />
                            <Text style={[
                              styles.photoTypeButtonText,
                              { color: isSelected ? '#fff' : (isDark ? '#fff' : '#0f172a') }
                            ]}>
                              {type}
                            </Text>
                            <Text style={[styles.photoTypeCheck, { color: isSelected ? '#fff' : typeColor }]}>
                              {isSelected ? '✓' : '›'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={closePhotoModal}
                  >
                    <Text style={[styles.buttonText, { color: isDark ? '#fff' : '#000' }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.submitButton, { backgroundColor: '#007AFF' }]}
                    onPress={photoSource === 'camera' ? takePhoto : selectPhotoFromGallery}
                  >
                    <Text style={styles.submitButtonText}>
                      {photoSource === 'camera' ? 'Prendre photo' : 'Sélectionner'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>


          {/* Photo Preview Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={showPhotoPreview}
            onRequestClose={closePhotoPreview}
          >
            <View style={styles.photoPreviewOverlay}>
              <View style={styles.photoPreviewContainer}>
                <TouchableOpacity style={styles.closePreviewButton} onPress={closePhotoPreview}>
                  <Text style={styles.closePreviewText}>✕</Text>
                </TouchableOpacity>
                
                <View style={styles.photoPreviewImageContainer} {...photoPanResponder.panHandlers}>
                  <Image 
                    source={{ uri: selectedPhoto?.uri }} 
                    style={[
                      styles.photoPreviewImage,
                      {
                        transform: [
                          { translateX: photoOffset.x },
                          { translateY: photoOffset.y },
                          { scale: photoScale },
                        ],
                      }
                    ]}
                    resizeMode="contain"
                  />
                </View>
                
                <View style={styles.photoPreviewInfo}>
                  <Text style={[styles.photoPreviewType, { color: isDark ? '#fff' : '#000' }]}>
                    {selectedPhoto?.type}
                  </Text>
                  <Text style={[styles.photoPreviewName, { color: isDark ? '#ccc' : '#666' }]}>
                    {selectedPhoto?.name}
                  </Text>
                  {selectedPhoto ? (
                    <View style={[styles.photoPreviewMetaBox, { backgroundColor: isDark ? '#111827' : '#f1f5f9' }]}>
                      <Text style={[styles.photoPreviewMetaText, { color: isDark ? '#e5e7eb' : '#334155' }]}>
                        {formatPhotoTimestamp(selectedPhoto.timestamp)}
                      </Text>
                      <Text style={[styles.photoPreviewMetaText, { color: isDark ? '#e5e7eb' : '#334155' }]}>
                        ID immeuble: {getPhotoBuildingId(selectedPhoto, firstBuilding)}
                      </Text>
                      <Text style={[styles.photoPreviewMetaText, { color: isDark ? '#e5e7eb' : '#334155' }]}>
                        {getPhotoGpsLabel(selectedPhoto)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                
                <View style={styles.photoPreviewControls}>
                  <TouchableOpacity 
                    style={[styles.zoomButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={() => updatePhotoScale(photoScale - 0.25)}
                  >
                    <Text style={[styles.zoomButtonText, { color: isDark ? '#fff' : '#000' }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.zoomText, { color: isDark ? '#fff' : '#000' }]}>
                    {Math.round(photoScale * 100)}%
                  </Text>
                  <TouchableOpacity 
                    style={[styles.zoomButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={() => updatePhotoScale(photoScale + 0.25)}
                  >
                    <Text style={[styles.zoomButtonText, { color: isDark ? '#fff' : '#000' }]}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.downloadPhotoButton}
                  onPress={() => downloadPhoto(selectedPhoto)}
                >
                  <Text style={styles.downloadPhotoButtonText}>Télécharger la photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#007AFF' }]} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </View>
    </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 15,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  headerMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMenuText: {
    fontSize: 26,
    fontWeight: '700',
  },
  statusSelectorContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 20,
  },
  statusSelectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statusSelectorButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusSelectorText: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusSelectorArrow: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  statusDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statusDropdownItem: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusDropdownText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusDeleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statusDeleteText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  statusAddButton: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#eff6ff',
  },
  statusAddButtonAlways: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  statusAddText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  statusInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  managerOnlyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  managerOnlyCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2563eb',
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    overflow: 'hidden',
  },
  managerOnlyText: {
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 20,
  },
  buildingMenu: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  buildingMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  buildingMenuAction: {
    borderRadius: 10,
    padding: 13,
  },
  buildingMenuActionText: {
    color: '#fff',
    fontWeight: '700',
  },
  buildingMenuCloseText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  saveButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 30,
  },
  // Table styles for web
  tableContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 20,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableCell: {
    padding: 12,
  },
  labelCell: {
    width: '40%',
    borderRightWidth: 1,
  },
  valueCell: {
    width: '60%',
  },
  tableLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tableHeaderLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tableText: {
    fontSize: 12,
    color: '#000',
  },
  tableInput: {
    fontSize: 14,
    borderWidth: 0,
    padding: 0,
  },
  headerCell: {
    padding: 12,
    minWidth: 100,
  },
  headerIdCell: {
    width: 120,
  },
  idCell: {
    width: 120,
  },
  // GPS and Photo styles
  gpsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gpsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 5,
  },
  gpsButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  photoCell: {
    padding: 8,
  },
  addPhotoButton: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoCount: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  photoGallery: {
    flexDirection: 'row',
  },
  photoItem: {
    marginRight: 10,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
    width: 190,
  },
  photoThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 4,
    marginBottom: 5,
  },
  photoActions: {
    marginTop: 10,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  photoHeaderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  selectionModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectionModeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteSelectedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteSelectedButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  selectedPhotoItem: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
  },
  selectionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCheckboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  selectionCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  photoType: {
    fontSize: 10,
    marginBottom: 2,
  },
  photoName: {
    fontSize: 10,
    textAlign: 'center',
  },
  photoMetaBox: {
    width: '100%',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 2,
  },
  photoMetaText: {
    fontSize: 10,
    lineHeight: 14,
  },
  addMorePhotosButton: {
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 5,
  },
  addMorePhotosText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    borderRadius: 20,
    padding: 20,
  },
  photoTypeModalContent: {
    width: '92%',
    maxHeight: '72%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  photoTypeScroll: {
    maxHeight: 220,
  },
  photoTypeDropdownList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 8,
    marginBottom: 12,
    maxHeight: 240,
    overflow: 'hidden',
  },
  photoTypeDropdownButton: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  photoTypeDropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  photoTypeDropdownArrow: {
    fontSize: 13,
    fontWeight: '800',
  },
  photoTypeButtons: {
    gap: 8,
    paddingBottom: 4,
  },
  photoTypeButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectedPhotoTypeButton: {
    borderWidth: 2,
  },
  photoTypeButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  photoTypeColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  photoTypeCheck: {
    fontSize: 18,
    fontWeight: '800',
  },
  // Photo Source Selection styles
  photoSourceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  photoSourceButton: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    width: 120,
  },
  photoSourceIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  photoSourceText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 10,
  },
  submitButton: {
    marginLeft: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Mobile GPS styles
  gpsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  // Photo Preview Modal styles
  photoPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreviewContainer: {
    width: '90%',
    height: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    position: 'relative',
  },
  closePreviewButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closePreviewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoPreviewImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoPreviewInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoPreviewType: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  photoPreviewName: {
    fontSize: 14,
  },
  photoPreviewMetaBox: {
    marginTop: 10,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    padding: 10,
    gap: 4,
  },
  photoPreviewMetaText: {
    fontSize: 13,
    textAlign: 'center',
  },
  photoPreviewControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  downloadPhotoButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  downloadPhotoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomText: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  // Role management and ActionSheet styles
  actionTriggerButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionTriggerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Technician assignment styles
  techniciansList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  technicianItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  technicianInfo: {
    flex: 1,
  },
  technicianName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  technicianEmail: {
    fontSize: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  // Assigned technicians display
  assignedTechniciansContainer: {
    padding: 5,
  },
  assignedCount: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  assignedTechName: {
    fontSize: 11,
    marginBottom: 1,
  },
  moreTechs: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  // Mobile role management styles
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 4,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
  },
  roleInfoMobile: {
    backgroundColor: '#007AFF',
    padding: 12,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleInfoText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  assignedTechsMobile: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  assignedTechsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  assignedTechItem: {
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  assignedTechNameMobile: {
    fontSize: 13,
  },
});
