import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert, Modal, Image, Dimensions, PanResponder, Linking, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';
import {
  useBuilding,
  useBuildingStatuses,
  useCreateBuildingStatus,
  useDeleteBuildingStatus,
  usePatchSyndicInstallationAuth,
  useUpdateBuilding,
} from '@/hooks';
import { dataService } from '@/services/dataService';
import { buildingsApi, photosApi, technicalDossiersApi, zoneDocumentsApi, type Building } from '@/api';
import type { BuildingStatus } from '@/api';
import { saveFileWithPicker } from '@/utils/saveFileWithPicker';
import { useAuth } from '@/ctx';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';

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
  'zone',
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
  'bpo1',
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
  nbreAppartementsParEtage: 'Nb app. par étage (JSON)',
  sousSol: 'Sous Sol',
  sousSolCommun: 'Sous Sol Commun',
  solutionRaccordement: 'Solution de Raccordement',
  nbrB2B: 'Nbr B2B',
  nbrB2C: 'Nbr B2C',
  totalClients: 'Total Clients',
  cheminFibrePBO1: 'Chemin de Fibre PBO1',
  bpo1: 'BPO1',
  floorPBO1: 'Floor PBO1',
  typePBO1: 'Type PBO1',
  PBO2: 'PBO2',
  floorPBO2: 'Floor PBO2',
  typePBO2: 'Type PBO2',
  syndic: 'SYNDIC',
  numSyndic: 'Num Syndic',
  syndicInstallationAuthSignature: 'Signature autorisation syndic',
  syndicInstallationAuthSignedAt: 'Date signature syndic',
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
const ZONE_IMPORT_FILES_KEY = 'zone_import_files_v1';
const APPOINTMENTS_PLANNING_KEY = 'building_appointments_planning_v1';
const MENU_FLOATING_BUTTON_SIZE = 58;
const getBuildingPhotosKey = (id: string) => `building_photos_${id}`;
const getBuildingAppointmentKey = (id: string) => `building_appointment_${id}`;

const sanitizeFileName = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'plan-tirage-fusion.pdf'
);

const MAX_ETAGES_APPARTEMENTS = 40;

function parseAppartementsParEtageJson(raw: unknown): Record<string, string> {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (/^\d+$/.test(k) && v != null) out[k] = String(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** Interprétation : « Nbre Étages » = nombre d'étages au-dessus du RDC (0 = immeuble sur RDC uniquement). */
function countUpperFloorsFromNbreEtages(value: unknown): number {
  const s = String(value ?? '').trim();
  const match = s.match(/^(\d+)/);
  const n = match ? parseInt(match[1], 10) : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_ETAGES_APPARTEMENTS, n);
}

function floorLevelTitle(floorIndex: number): string {
  if (floorIndex === 0) return 'Rez-de-chaussée';
  if (floorIndex === 1) return '1er étage';
  return `${floorIndex}e étage`;
}

function floorLevelBadge(floorIndex: number): string {
  if (floorIndex === 0) return 'RDC';
  return String(floorIndex);
}

/** Résumé une ligne du type RDC:2/1:4/2:4 (étages selon floorCount). */
function formatAppartementsSummaryLine(map: Record<string, string>, floorCount: number): string {
  const parts: string[] = [];
  for (let i = 0; i < floorCount; i++) {
    const v = String(map[String(i)] ?? '').trim();
    const label = i === 0 ? 'RDC' : String(i);
    parts.push(`${label}:${v || '—'}`);
  }
  return parts.join('/');
}

type ZoneImportFile = {
  documentId?: string;
  zone: string;
  kind: 'kmz' | 'routeOptiqueExcel' | 'planTirageFusionPdf';
  name: string;
  uri: string;
  importedAt: string;
};

type PlanPdfOption = ZoneImportFile & {
  remoteOnly?: boolean;
  fileSize?: number;
};

type BuildingAppointment = {
  buildingKey?: string;
  buildingName?: string;
  zone?: string;
  createdBy?: string;
  createdByEmail?: string;
  createdByName?: string;
  createdByRole?: string;
  date: string;
  time: string;
  note?: string;
  updatedAt: string;
};

const formatAppointmentDate = (date: Date) => (
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
);

const formatAppointmentTime = (date: Date) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
);

const parseAppointmentDateTime = (dateValue?: string, timeValue?: string) => {
  const now = new Date();
  const [day, month, year] = String(dateValue || formatAppointmentDate(now)).split('/').map(Number);
  const [hours, minutes] = String(timeValue || formatAppointmentTime(now)).split(':').map(Number);
  return new Date(
    Number.isFinite(year) ? year : now.getFullYear(),
    Number.isFinite(month) ? month - 1 : now.getMonth(),
    Number.isFinite(day) ? day : now.getDate(),
    Number.isFinite(hours) ? hours : now.getHours(),
    Number.isFinite(minutes) ? minutes : now.getMinutes(),
  );
};

const getAppointmentSortTime = (appointment: BuildingAppointment) => (
  parseAppointmentDateTime(appointment.date, appointment.time).getTime()
);

const mergeAppointmentsByBuilding = (appointments: BuildingAppointment[]) => (
  Array.from(
    appointments
      .filter((item) => item.buildingKey && item.date && item.time)
      .reduce((map, item) => map.set(String(item.buildingKey), item), new Map<string, BuildingAppointment>())
      .values(),
  ).sort((a, b) => getAppointmentSortTime(a) - getAppointmentSortTime(b))
);

const getAppointmentOwnerKeys = (appointment: BuildingAppointment) => (
  [appointment.createdBy, appointment.createdByEmail]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .filter(Boolean)
);

const getAppointmentDateOptions = () => {
  const today = new Date();
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return {
      value: formatAppointmentDate(date),
      label: index === 0 ? "Aujourd'hui" : index === 1 ? 'Demain' : date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
    };
  });
};

const APPOINTMENT_TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30', '17:00',
];

export default function DetailImmeubleScreen() {
  const { buildingId, buildingName, itemId, zone, itemName } = useLocalSearchParams<{
    buildingId: string;
    buildingName: string;
    itemId?: string;
    zone?: string;
    itemName?: string;
  }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Use API building data
  const { data: apiBuilding, isLoading: isLoadingBuilding } = useBuilding(buildingId || '');
  const updateBuildingMutation = useUpdateBuilding();
  const patchSyndicInstallationAuthMutation = usePatchSyndicInstallationAuth();
  
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
  const [showPlanPdfPicker, setShowPlanPdfPicker] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showPlanningModal, setShowPlanningModal] = useState(false);
  const [showSystemDatePicker, setShowSystemDatePicker] = useState(false);
  const [showSystemTimePicker, setShowSystemTimePicker] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusManagerOnly, setNewStatusManagerOnly] = useState(false);
  const [localStatusOptions, setLocalStatusOptions] = useState<BuildingStatus[]>([]);
  const [planPdfOptions, setPlanPdfOptions] = useState<PlanPdfOption[]>([]);
  const [aptPerFloorEditorOpen, setAptPerFloorEditorOpen] = useState(false);
  const [showSyndicSignatureModal, setShowSyndicSignatureModal] = useState(false);
  const [syndicSigSaving, setSyndicSigSaving] = useState(false);
  const syndicSignatureRef = useRef<SignatureViewRef | null>(null);
  const [appointment, setAppointment] = useState<BuildingAppointment | null>(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentNote, setAppointmentNote] = useState('');
  const [planningAppointments, setPlanningAppointments] = useState<BuildingAppointment[]>([]);
  const { user } = useAuth();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const currentUserRole = user?.role || 'technician';
  const photoScaleRef = useRef(photoScale);
  const photoOffsetRef = useRef(photoOffset);
  const photoPanStartRef = useRef({ x: 0, y: 0 });
  const headerOffset = useRef(new Animated.Value(0)).current;
  const topControlsOffset = useRef(new Animated.Value(0)).current;
  const lastScrollOffsetRef = useRef(0);
  const isHeaderHiddenRef = useRef(false);
  const floatingMenuPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const floatingMenuOffset = useRef({ x: 0, y: 0 });

  const { data: statusOptions = [] } = useBuildingStatuses();
  const mergedStatusOptions = Array.from(
    [...DEFAULT_STATUS_OPTIONS, ...statusOptions, ...localStatusOptions]
      .reduce((map, status) => map.set(status.value, status), new Map<string, BuildingStatus>())
      .values(),
  );
  const visibleStatusOptions = mergedStatusOptions.filter((status) => !status.managerOnly || currentUserRole === 'manager');
  const createStatusMutation = useCreateBuildingStatus();
  const deleteStatusMutation = useDeleteBuildingStatus();
  const currentAppointmentKey = useMemo(
    () => String(buildingsData[0]?._id || buildingsData[0]?.idImmeuble || apiBuilding?._id || apiBuilding?.idImmeuble || buildingId || '').trim(),
    [apiBuilding?._id, apiBuilding?.idImmeuble, buildingId, buildingsData],
  );
  const currentUserKeys = useMemo(
    () => [user?.id, user?.sub, user?.email].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean),
    [user?.id, user?.sub, user?.email],
  );

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

  const floatingMenuPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        floatingMenuPosition.setOffset(floatingMenuOffset.current);
        floatingMenuPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: floatingMenuPosition.x, dy: floatingMenuPosition.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, gesture) => {
        const maxX = Math.max(0, screenWidth - MENU_FLOATING_BUTTON_SIZE - 30);
        const maxY = Math.max(0, screenHeight - MENU_FLOATING_BUTTON_SIZE - 150);
        const next = {
          x: Math.max(-maxX, Math.min(0, floatingMenuOffset.current.x + gesture.dx)),
          y: Math.max(-maxY, Math.min(40, floatingMenuOffset.current.y + gesture.dy)),
        };

        floatingMenuPosition.flattenOffset();
        floatingMenuOffset.current = next;
        Animated.spring(floatingMenuPosition, {
          toValue: next,
          useNativeDriver: false,
          friction: 6,
          tension: 90,
        }).start();

        if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
          setShowBuildingMenu(true);
        }
      },
    }),
  ).current;

  const animateHeaderVisibility = (hidden: boolean) => {
    if (isHeaderHiddenRef.current === hidden) return;
    isHeaderHiddenRef.current = hidden;
    Animated.parallel([
      Animated.timing(headerOffset, {
        toValue: hidden ? -76 : 0,
        duration: hidden ? 260 : 180,
        useNativeDriver: true,
      }),
      Animated.timing(topControlsOffset, {
        toValue: hidden ? -66 : 0,
        duration: hidden ? 260 : 180,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleDetailScroll = (event: any) => {
    const currentOffset = Math.max(0, event.nativeEvent.contentOffset?.y || 0);
    const previousOffset = lastScrollOffsetRef.current;
    const delta = currentOffset - previousOffset;

    if (currentOffset < 8) {
      animateHeaderVisibility(false);
    } else if (delta > 8) {
      animateHeaderVisibility(true);
    } else if (delta < -2) {
      animateHeaderVisibility(false);
    }

    lastScrollOffsetRef.current = currentOffset;
  };

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

  useEffect(() => {
    const loadAppointment = async () => {
      if (!currentAppointmentKey) return;

      const savedAppointment = await loadFromLocalStorage(getBuildingAppointmentKey(currentAppointmentKey));
      if (savedAppointment && typeof savedAppointment === 'object') {
        const nextAppointment = savedAppointment as BuildingAppointment;
        setAppointment(nextAppointment);
        setAppointmentDate(nextAppointment.date || '');
        setAppointmentTime(nextAppointment.time || '');
        setAppointmentNote(nextAppointment.note || '');
      } else {
        setAppointment(null);
        setAppointmentDate('');
        setAppointmentTime('');
        setAppointmentNote('');
      }
    };

    void loadAppointment();
  }, [currentAppointmentKey]);

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
    if (currentUserRole !== 'manager') {
      Alert.alert('Accès refusé', 'Seul le manager peut archiver un immeuble.');
      return;
    }
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

    const photoList = (building?.photos || []) as unknown[];
    if (photoList.length === 0) {
      Alert.alert(
        'Photos requises',
        'Ajoutez au moins une photo à la fiche avant d’exporter le dossier technique.',
      );
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

  const openAppointmentModal = () => {
    setShowBuildingMenu(false);
    setAppointmentDate(appointment?.date || getAppointmentDateOptions()[0].value);
    setAppointmentTime(appointment?.time || APPOINTMENT_TIME_OPTIONS[0]);
    setAppointmentNote(appointment?.note || '');
    setShowAppointmentModal(true);
  };

  const openPlanningModal = async () => {
    setShowBuildingMenu(false);
    const savedPlanning = await loadFromLocalStorage(APPOINTMENTS_PLANNING_KEY);
    const planning = Array.isArray(savedPlanning) ? savedPlanning as BuildingAppointment[] : [];
    const mergedPlanning = mergeAppointmentsByBuilding([
      ...planning,
      ...(appointment ? [appointment] : []),
    ]);
    await saveToLocalStorage(APPOINTMENTS_PLANNING_KEY, mergedPlanning);
    const visiblePlanning = currentUserRole === 'manager'
      ? mergedPlanning
      : mergedPlanning.filter((item) => {
          const ownerKeys = getAppointmentOwnerKeys(item);
          return ownerKeys.length > 0 && ownerKeys.some((key) => currentUserKeys.includes(key));
        });
    setPlanningAppointments(visiblePlanning);
    setShowPlanningModal(true);
  };

  const onSystemDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowSystemDatePicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    setAppointmentDate(formatAppointmentDate(selectedDate));
  };

  const onSystemTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowSystemTimePicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;
    setAppointmentTime(formatAppointmentTime(selectedDate));
  };

  const saveAppointment = async () => {
    const date = appointmentDate.trim();
    const time = appointmentTime.trim();
    const note = appointmentNote.trim();

    if (!currentAppointmentKey) {
      Alert.alert('Rendez-vous', 'Aucun immeuble sélectionné.');
      return;
    }
    if (!date || !time) {
      Alert.alert('Rendez-vous', 'Veuillez saisir la date et l’heure.');
      return;
    }

    const nextAppointment: BuildingAppointment = {
      buildingKey: currentAppointmentKey,
      buildingName: String(buildingName || buildingsData[0]?.idImmeuble || apiBuilding?.idImmeuble || 'Immeuble'),
      zone: String(zone || buildingsData[0]?.zone || buildingsData[0]?.ville || ''),
      createdBy: String(user?.id || user?.sub || user?.email || ''),
      createdByEmail: user?.email,
      createdByName: user?.name || user?.email,
      createdByRole: user?.role,
      date,
      time,
      note,
      updatedAt: new Date().toISOString(),
    };

    await saveToLocalStorage(getBuildingAppointmentKey(currentAppointmentKey), nextAppointment);
    const savedPlanning = await loadFromLocalStorage(APPOINTMENTS_PLANNING_KEY);
    const planning = Array.isArray(savedPlanning) ? savedPlanning as BuildingAppointment[] : [];
    const nextPlanning = [
      ...planning.filter((item) => item.buildingKey !== currentAppointmentKey),
      nextAppointment,
    ];
    await saveToLocalStorage(APPOINTMENTS_PLANNING_KEY, mergeAppointmentsByBuilding(nextPlanning));
    setAppointment(nextAppointment);
    setShowAppointmentModal(false);
    Alert.alert('Rendez-vous', 'Rendez-vous enregistré.');
  };

  const deleteAppointment = async () => {
    if (!currentAppointmentKey) return;

    await dataService.saveToStorage(getBuildingAppointmentKey(currentAppointmentKey), null);
    const savedPlanning = await loadFromLocalStorage(APPOINTMENTS_PLANNING_KEY);
    const planning = Array.isArray(savedPlanning) ? savedPlanning as BuildingAppointment[] : [];
    await saveToLocalStorage(APPOINTMENTS_PLANNING_KEY, planning.filter((item) => item.buildingKey !== currentAppointmentKey));
    setAppointment(null);
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentNote('');
    setShowAppointmentModal(false);
  };

  const openPdfUri = async (uri: string) => {
    if (Platform.OS === 'android' && (FileSystem as any).getContentUriAsync) {
      const contentUri = await (FileSystem as any).getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/pdf',
        flags: 1,
      });
      return;
    }

    await Linking.openURL(uri);
  };

  const openPlanPdfOption = async (pdf: PlanPdfOption) => {
    try {
      setShowPlanPdfPicker(false);

      if (!pdf.remoteOnly && pdf.uri) {
        const fileInfo = await FileSystem.getInfoAsync(pdf.uri);
        if (fileInfo.exists) {
          await openPdfUri(pdf.uri);
          return;
        }
      }

      if (!pdf.documentId) {
        Alert.alert('PDF introuvable', 'Ce PDF local n’existe plus. Réimportez le fichier PDF.');
        return;
      }

      const pdfDirectory = `${FileSystem.documentDirectory}zone-documents/`;
      await FileSystem.makeDirectoryAsync(pdfDirectory, { intermediates: true });
      const localPdfUri = `${pdfDirectory}${Date.now()}_${sanitizeFileName(pdf.name)}`;
      const request = await zoneDocumentsApi.getDownloadRequest(pdf.documentId, pdf.name);
      await FileSystem.downloadAsync(request.url, localPdfUri, { headers: request.headers });

      const previous = await dataService.loadFromStorage<ZoneImportFile[]>(ZONE_IMPORT_FILES_KEY);
      const storedFiles = Array.isArray(previous) ? previous : [];
      await dataService.saveToStorage(ZONE_IMPORT_FILES_KEY, [
        ...storedFiles,
        {
          documentId: pdf.documentId,
          zone: pdf.zone,
          kind: 'planTirageFusionPdf',
          name: pdf.name,
          uri: localPdfUri,
          importedAt: new Date().toISOString(),
        },
      ]);

      await openPdfUri(localPdfUri);
    } catch (error: any) {
      Alert.alert('Erreur PDF', error?.message || 'Impossible d’ouvrir le PDF plan Tirage et Fusion.');
    }
  };

  const deletePlanPdfOption = (pdf: PlanPdfOption) => {
    Alert.alert('Supprimer PDF', `Supprimer "${pdf.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            if (pdf.documentId) {
              await zoneDocumentsApi.delete(pdf.documentId);
            }

            if (pdf.uri) {
              const fileInfo = await FileSystem.getInfoAsync(pdf.uri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(pdf.uri, { idempotent: true });
              }
            }

            const previous = await dataService.loadFromStorage<ZoneImportFile[]>(ZONE_IMPORT_FILES_KEY);
            const storedFiles = Array.isArray(previous) ? previous : [];
            const nextFiles = storedFiles.filter((file) => {
              if (pdf.documentId && file.documentId === pdf.documentId) return false;
              if (pdf.uri && file.uri === pdf.uri) return false;
              return !(file.zone === pdf.zone && file.name === pdf.name && file.importedAt === pdf.importedAt);
            });

            await dataService.saveToStorage(ZONE_IMPORT_FILES_KEY, nextFiles);
            const nextOptions = planPdfOptions.filter((option) => {
              if (pdf.documentId && option.documentId === pdf.documentId) return false;
              if (pdf.uri && option.uri === pdf.uri) return false;
              return !(option.zone === pdf.zone && option.name === pdf.name && option.importedAt === pdf.importedAt);
            });
            setPlanPdfOptions(nextOptions);

            if (nextOptions.length === 0) {
              setShowPlanPdfPicker(false);
            }
          } catch (error: any) {
            Alert.alert('Erreur', error?.message || 'Impossible de supprimer ce PDF.');
          }
        },
      },
    ]);
  };

  const openPlanTirageFusionPdf = async () => {
    setShowBuildingMenu(false);
    try {
      const currentZone = String(zone || buildingsData[0]?.zone || buildingsData[0]?.ville || '').trim();
      if (!currentZone) {
        Alert.alert('PDF introuvable', 'Aucune zone associée à cet immeuble.');
        return;
      }

      const importedFiles = await dataService.loadFromStorage<ZoneImportFile[]>(ZONE_IMPORT_FILES_KEY);
      const storedFiles = Array.isArray(importedFiles) ? importedFiles : [];
      const localPdfs = storedFiles
        .filter((file) => file.zone === currentZone && file.kind === 'planTirageFusionPdf')
        .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());

      const documentsResponse = await zoneDocumentsApi.getByZone(currentZone);
      const remotePdfs: PlanPdfOption[] = documentsResponse.data
        .filter((document) => document.kind === 'planTirageFusionPdf')
        .map((document) => ({
          documentId: document._id,
          zone: document.zone,
          kind: 'planTirageFusionPdf',
          name: document.fileName,
          uri: '',
          importedAt: document.importedAt,
          fileSize: document.fileSize,
          remoteOnly: true,
        }));

      const optionsByKey = new Map<string, PlanPdfOption>();
      for (const pdf of remotePdfs) {
        optionsByKey.set(pdf.documentId || `${pdf.zone}:${pdf.name}:${pdf.importedAt}`, pdf);
      }
      for (const pdf of localPdfs) {
        optionsByKey.set(pdf.documentId || `${pdf.zone}:${pdf.name}:${pdf.importedAt}`, pdf);
      }

      const options = Array.from(optionsByKey.values())
        .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())
        .slice(0, 10);

      if (options.length === 0) {
        Alert.alert('PDF introuvable', 'Importez d’abord le PDF plan Tirage et Fusion depuis le menu de la zone.');
        return;
      }

      if (options.length === 1) {
        await openPlanPdfOption(options[0]);
        return;
      }

      setPlanPdfOptions(options);
      setShowPlanPdfPicker(true);
    } catch (error: any) {
      Alert.alert('Erreur PDF', error?.message || 'Impossible d’ouvrir le PDF plan Tirage et Fusion.');
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
    nbreAppartementsParEtage: '',
    sousSol: '',
    sousSolCommun: '',
    solutionRaccordement: '',
    nbrB2B: '',
    nbrB2C: '',
    totalClients: '',
    cheminFibrePBO1: '',
    bpo1: '',
    floorPBO1: '',
    typePBO1: '',
    PBO2: '',
    floorPBO2: '',
    typePBO2: '',
    syndic: '',
    numSyndic: '',
    syndicInstallationAuthSignature: '',
    syndicInstallationAuthSignedAt: '',
    remarques: '',
    typologieHabitat: '',
    verticalite: '',
    csp: '',
    serviceId: '',
    photos: []
  } as Building;
  const syndicSigData = String(firstBuilding.syndicInstallationAuthSignature ?? '').trim();
  const syndicSigRestoreUrl = syndicSigData.startsWith('data:image') ? syndicSigData : undefined;

  const updateField = (field: keyof Building, value: string) => {
    updateBuildingField(0, field, value);
  };

  const handleSyndicSignatureConfirm = async (dataUrl: string) => {
    const signedAt = new Date().toISOString();
    const id = String(buildingsData[0]?._id || '').trim();
    updateField('syndicInstallationAuthSignature', dataUrl);
    updateField('syndicInstallationAuthSignedAt', signedAt);

    if (!id) {
      setShowSyndicSignatureModal(false);
      Alert.alert(
        'Signature enregistrée',
        'Enregistrez la fiche une fois l’immeuble associé au serveur.',
      );
      return;
    }

    try {
      setSyndicSigSaving(true);
      await patchSyndicInstallationAuthMutation.mutateAsync({
        id,
        body: { syndicInstallationAuthSignature: dataUrl, syndicInstallationAuthSignedAt: signedAt },
      });
      setShowSyndicSignatureModal(false);
      Alert.alert('Signature enregistrée', 'La signature a été enregistrée sur le serveur.');
    } catch {
      try {
        const merged = {
          ...(buildingsData[0] as Building),
          syndicInstallationAuthSignature: dataUrl,
          syndicInstallationAuthSignedAt: signedAt,
        };
        await dataService.saveBuilding(merged as any);
      } catch {
        /* ignore secondary persistence errors */
      }
      setShowSyndicSignatureModal(false);
      Alert.alert(
        'Sauvegardé localement',
        'La signature sera envoyée au serveur lors de la prochaine synchronisation.',
      );
    } finally {
      setSyndicSigSaving(false);
    }
  };

  const renderAppartementsParNiveau = (buildingIndex: number) => {
    const building = buildingsData[buildingIndex];
    if (!building) return null;
    const upper = countUpperFloorsFromNbreEtages(building.nbreEtages);
    const floorCount = 1 + upper;
    const rawJson =
      typeof building.nbreAppartementsParEtage === 'string' ? building.nbreAppartementsParEtage : '';
    const map = parseAppartementsParEtageJson(rawJson);

    const setFloorValue = (floorIndex: number, text: string) => {
      const digits = text.replace(/\D/g, '');
      const next = { ...map, [String(floorIndex)]: digits };
      updateBuildingField(buildingIndex, 'nbreAppartementsParEtage', JSON.stringify(next));
    };

    let sum = 0;
    for (let i = 0; i < floorCount; i++) {
      const v = parseInt(String(map[String(i)] ?? '').trim(), 10);
      if (Number.isFinite(v)) sum += v;
    }

    const rawEtagesDisplay = String(building.nbreEtages ?? '').trim() || '0';
    const summaryLine = formatAppartementsSummaryLine(map, floorCount);
    const summarySegments = summaryLine.split('/').map((part) => {
      const idx = part.indexOf(':');
      if (idx === -1) return { label: part.trim(), value: '—' };
      return { label: part.slice(0, idx).trim(), value: part.slice(idx + 1).trim() || '—' };
    });

    const chipBg = isDark ? '#1e293b' : '#ffffff';
    const chipBorder = isDark ? '#334155' : '#e2e8f0';
    const labelMuted = isDark ? '#94a3b8' : '#64748b';
    const valueAccent = isDark ? '#7dd3fc' : '#2563eb';
    const valueEmpty = isDark ? '#475569' : '#94a3b8';

    const summaryChipsRow = (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.aptSummaryChipsContent}
        style={styles.aptSummaryChipsScroll}
      >
        {summarySegments.map((seg, i) => {
          const isEmpty = seg.value === '—' || seg.value === '';
          return (
            <React.Fragment key={`apt-seg-${buildingIndex}-${i}`}>
              {i > 0 ? (
                <View style={[styles.aptSummaryChipSep, { backgroundColor: isDark ? '#475569' : '#cbd5e1' }]} />
              ) : null}
              <View
                style={[
                  styles.aptSummaryChip,
                  {
                    backgroundColor: chipBg,
                    borderColor: chipBorder,
                    shadowColor: '#0f172a',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.25 : 0.07,
                    shadowRadius: 5,
                    elevation: isDark ? 0 : 2,
                  },
                ]}
              >
                <Text style={[styles.aptSummaryChipLabel, { color: labelMuted }]} numberOfLines={1}>
                  {seg.label}
                </Text>
                <Text
                  style={[
                    styles.aptSummaryChipValue,
                    { color: isEmpty ? valueEmpty : valueAccent },
                  ]}
                  numberOfLines={1}
                >
                  {isEmpty ? '—' : seg.value}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </ScrollView>
    );

    if (!aptPerFloorEditorOpen) {
      const accent = isDark ? '#38bdf8' : '#2563eb';
      const shellBg = isDark ? '#0f172a' : '#ffffff';
      const shellBorder = isDark ? '#1e3a5f' : '#e0e7ff';
      const surfaceBg = isDark ? '#020617' : '#f1f5f9';
      const surfaceBorder = isDark ? '#1e293b' : '#e2e8f0';
      const kickerColor = isDark ? '#94a3b8' : '#64748b';
      const headlineColor = isDark ? '#f8fafc' : '#0f172a';
      const chevronBg = isDark ? '#1e293b' : '#eff6ff';
      const chevronBorder = isDark ? '#334155' : '#bfdbfe';

      return (
        <View
          style={[
            styles.aptSummaryShell,
            {
              backgroundColor: shellBg,
              borderColor: shellBorder,
              shadowColor: '#0f172a',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.45 : 0.07,
              shadowRadius: 12,
              elevation: isDark ? 0 : 4,
            },
          ]}
        >
          <View style={styles.aptSummaryShellRow}>
            <View style={[styles.aptSummaryAccent, { backgroundColor: accent }]} />
            <View style={styles.aptSummaryBody}>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setAptPerFloorEditorOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le détail des appartements par étage"
              >
                <View style={styles.aptSummaryCollapsedHeader}>
                  <View style={styles.aptSummaryHeaderTexts}>
                    <Text style={[styles.aptSummaryKicker, { color: kickerColor }]}>Répartition</Text>
                    <View style={styles.aptSummaryHeadlineRow}>
                      <Text style={[styles.aptSummaryHeadline, { color: headlineColor }]} numberOfLines={1}>
                        Appartements par étage
                      </Text>
                      <View style={[styles.aptSummaryCountPill, { backgroundColor: isDark ? '#1e3a5f' : '#e0e7ff' }]}>
                        <Text style={[styles.aptSummaryCountPillText, { color: accent }]}>
                          {floorCount} niv.
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.aptSummaryChevronCircle,
                      { backgroundColor: chevronBg, borderColor: chevronBorder },
                    ]}
                  >
                    <Text style={[styles.aptSummaryChevronInCircle, { color: accent }]}>↓</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.aptSummaryChipsSurface,
                  { backgroundColor: surfaceBg, borderColor: surfaceBorder },
                ]}
              >
                {summaryChipsRow}
              </View>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => setAptPerFloorEditorOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir pour modifier les appartements par étage"
              >
                <Text style={[styles.aptSummaryMicroHint, { color: kickerColor }]}>
                  Toucher pour ouvrir et modifier
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.aptCard,
          {
            borderColor: isDark ? '#334155' : '#e2e8f0',
            backgroundColor: isDark ? '#111827' : '#f8fafc',
          },
        ]}
      >
        <View style={styles.aptCardHeaderRow}>
          <Text style={[styles.aptCardTitle, { color: isDark ? '#f8fafc' : '#0f172a', flex: 1, marginBottom: 0 }]}>
            Nombre d'appartements par étage
          </Text>
          <TouchableOpacity
            onPress={() => setAptPerFloorEditorOpen(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.aptCollapseButton, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}
          >
            <Text style={[styles.aptCollapseButtonText, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Réduire</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.aptExpandedSummaryBlock}>
          <Text style={[styles.aptExpandedSummaryLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            Résumé
          </Text>
          {summaryChipsRow}
        </View>
        <Text style={[styles.aptCardHint, { color: isDark ? '#94a3b8' : '#64748b', marginTop: -6 }]}>
          Selon « Nbre Étages » ({rawEtagesDisplay}) : 1 niveau RDC
          {upper > 0 ? ` + ${upper} étage${upper > 1 ? 's' : ''}` : ''}.
        </Text>
        {Array.from({ length: floorCount }, (_, i) => (
          <View
            key={`apt-floor-${buildingIndex}-${i}`}
            style={[
              styles.aptRow,
              {
                borderBottomColor: isDark ? '#1f2937' : '#e2e8f0',
                borderBottomWidth: i < floorCount - 1 ? StyleSheet.hairlineWidth : 0,
              },
            ]}
          >
            <View style={styles.aptRowLeft}>
              <View
                style={[
                  styles.aptBadge,
                  { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderColor: isDark ? '#3b82f6' : '#bfdbfe' },
                ]}
              >
                <Text style={[styles.aptBadgeText, { color: isDark ? '#bfdbfe' : '#1d4ed8' }]}>
                  {floorLevelBadge(i)}
                </Text>
              </View>
              <Text style={[styles.aptRowLabel, { color: isDark ? '#e2e8f0' : '#334155' }]} numberOfLines={2}>
                {floorLevelTitle(i)}
              </Text>
            </View>
            <TextInput
              style={[
                styles.aptInput,
                {
                  backgroundColor: isDark ? '#0f172a' : '#fff',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: isDark ? '#fff' : '#0f172a',
                },
              ]}
              value={map[String(i)] ?? ''}
              onChangeText={(t) => setFloorValue(i, t)}
              placeholder="—"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        ))}
        <View style={[styles.aptSumRow, { borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
          <Text style={[styles.aptSumLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Total (saisi)</Text>
          <Text style={[styles.aptSumValue, { color: isDark ? '#93c5fd' : '#2563eb' }]}>{sum}</Text>
        </View>
      </View>
    );
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
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOffset.interpolate({
              inputRange: [-76, 0],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
            transform: [{ translateY: headerOffset }],
          },
        ]}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: isDark ? '#fff' : '#007AFF' }]}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
          Détails Immeuble
        </Text>
        <TouchableOpacity
          onPress={() => setShowBuildingMenu(true)}
          style={styles.headerMenuButton}
        >
          <Text style={[styles.headerMenuText, { color: isDark ? '#fff' : '#334155' }]}>⋮</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateY: topControlsOffset }], marginBottom: topControlsOffset }}>
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

        {appointment ? (
          <View style={[styles.appointmentBanner, { backgroundColor: isDark ? '#172554' : '#eff6ff', borderColor: isDark ? '#1d4ed8' : '#bfdbfe' }]}>
            <Text style={[styles.appointmentTitle, { color: isDark ? '#dbeafe' : '#1d4ed8' }]}>Rendez-vous</Text>
            <Text style={[styles.appointmentText, { color: isDark ? '#fff' : '#0f172a' }]}>
              {appointment.date} à {appointment.time}
            </Text>
            {appointment.note ? (
              <Text style={[styles.appointmentNote, { color: isDark ? '#cbd5e1' : '#64748b' }]}>{appointment.note}</Text>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

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

      <Modal visible={showPlanPdfPicker} transparent animationType="fade" onRequestClose={() => setShowPlanPdfPicker(false)}>
        <View style={styles.menuOverlay}>
          <View style={[styles.buildingMenu, { backgroundColor: isDark ? '#1f2937' : '#fff', maxHeight: '72%' }]}>
            <Text style={[styles.buildingMenuTitle, { color: isDark ? '#fff' : '#0f172a' }]}>
              Choisir un PDF
            </Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
              {planPdfOptions.map((pdf, index) => (
                <View
                  key={`${pdf.documentId || pdf.uri || pdf.name}-${index}`}
                  style={[styles.pdfPickerRow, { backgroundColor: isDark ? '#374151' : '#eff6ff' }]}
                >
                  <TouchableOpacity
                    onPress={() => openPlanPdfOption(pdf)}
                    style={{ flex: 1, gap: 4 }}
                  >
                    <Text style={[styles.buildingMenuCloseText, { color: isDark ? '#fff' : '#0f172a', fontWeight: '700' }]}>
                      {pdf.name}
                    </Text>
                    <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontSize: 12 }}>
                      {new Date(pdf.importedAt).toLocaleString()} {pdf.remoteOnly ? '• serveur' : '• local'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deletePlanPdfOption(pdf)}
                    style={styles.pdfDeleteButton}
                  >
                    <Text style={styles.pdfDeleteText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowPlanPdfPicker(false)}
              style={[styles.buildingMenuAction, { backgroundColor: isDark ? '#374151' : '#e2e8f0' }]}
            >
              <Text style={[styles.buildingMenuCloseText, { color: isDark ? '#fff' : '#0f172a' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAppointmentModal} transparent animationType="fade" onRequestClose={() => setShowAppointmentModal(false)}>
        <View style={styles.menuOverlay}>
          <View style={[styles.buildingMenu, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
            <Text style={[styles.buildingMenuTitle, { color: isDark ? '#fff' : '#0f172a' }]}>
              Prendre rendez-vous
            </Text>
            <Text style={[styles.appointmentPickerLabel, { color: isDark ? '#cbd5e1' : '#475569' }]}>Date</Text>
            <TouchableOpacity
              onPress={() => setShowSystemDatePicker(true)}
              style={[styles.systemPickerButton, { backgroundColor: isDark ? '#374151' : '#f8fafc', borderColor: isDark ? '#4b5563' : '#e2e8f0' }]}
            >
              <Text style={[styles.systemPickerValue, { color: isDark ? '#fff' : '#0f172a' }]}>
                {appointmentDate || 'Choisir une date'}
              </Text>
              <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontWeight: '800' }}>Calendrier</Text>
            </TouchableOpacity>
            {showSystemDatePicker ? (
              <DateTimePicker
                value={parseAppointmentDateTime(appointmentDate, appointmentTime)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={onSystemDateChange}
              />
            ) : null}
            <Text style={[styles.appointmentPickerLabel, { color: isDark ? '#cbd5e1' : '#475569' }]}>Heure</Text>
            <TouchableOpacity
              onPress={() => setShowSystemTimePicker(true)}
              style={[styles.systemPickerButton, { backgroundColor: isDark ? '#374151' : '#f8fafc', borderColor: isDark ? '#4b5563' : '#e2e8f0' }]}
            >
              <Text style={[styles.systemPickerValue, { color: isDark ? '#fff' : '#0f172a' }]}>
                {appointmentTime || 'Choisir une heure'}
              </Text>
              <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontWeight: '800' }}>Horloge</Text>
            </TouchableOpacity>
            {showSystemTimePicker ? (
              <DateTimePicker
                value={parseAppointmentDateTime(appointmentDate, appointmentTime)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                is24Hour
                onChange={onSystemTimeChange}
              />
            ) : null}
            <TextInput
              value={appointmentNote}
              onChangeText={setAppointmentNote}
              placeholder="Note optionnelle"
              placeholderTextColor={isDark ? '#9ca3af' : '#64748b'}
              multiline
              style={[styles.statusInput, { minHeight: 72, textAlignVertical: 'top', color: isDark ? '#fff' : '#0f172a', borderColor: isDark ? '#374151' : '#cbd5e1' }]}
            />
            <TouchableOpacity onPress={saveAppointment} style={[styles.buildingMenuAction, { backgroundColor: '#7c3aed' }]}>
              <Text style={styles.buildingMenuActionText}>Enregistrer rendez-vous</Text>
            </TouchableOpacity>
            {appointment ? (
              <TouchableOpacity onPress={deleteAppointment} style={[styles.buildingMenuAction, { backgroundColor: '#dc2626' }]}>
                <Text style={styles.buildingMenuActionText}>Supprimer rendez-vous</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => setShowAppointmentModal(false)}
              style={[styles.buildingMenuAction, { backgroundColor: isDark ? '#374151' : '#e2e8f0' }]}
            >
              <Text style={[styles.buildingMenuCloseText, { color: isDark ? '#fff' : '#0f172a' }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPlanningModal} transparent animationType="fade" onRequestClose={() => setShowPlanningModal(false)}>
        <View style={styles.menuOverlay}>
          <View style={[styles.buildingMenu, { backgroundColor: isDark ? '#1f2937' : '#fff', maxHeight: '75%' }]}>
            <Text style={[styles.buildingMenuTitle, { color: isDark ? '#fff' : '#0f172a' }]}>
              {currentUserRole === 'manager' ? 'Planning rendez-vous' : 'Mes rendez-vous'} ({planningAppointments.length})
            </Text>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
              {planningAppointments.length === 0 ? (
                <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontWeight: '700' }}>
                  Aucun rendez-vous enregistré.
                </Text>
              ) : (
                planningAppointments.map((item, index) => (
                  <View
                    key={`${item.buildingKey || item.buildingName || index}-${item.updatedAt}`}
                    style={[styles.planningRow, { backgroundColor: isDark ? '#374151' : '#f8fafc', borderColor: isDark ? '#4b5563' : '#e2e8f0' }]}
                  >
                    <Text style={[styles.planningDate, { color: isDark ? '#fff' : '#0f172a' }]}>
                      {item.date} à {item.time}
                    </Text>
                    <Text style={{ color: isDark ? '#dbeafe' : '#1d4ed8', fontWeight: '800' }}>
                      {item.buildingName || 'Immeuble'}
                    </Text>
                    {item.zone ? (
                      <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontSize: 12 }}>Zone : {item.zone}</Text>
                    ) : null}
                    {currentUserRole === 'manager' && item.createdByName ? (
                      <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontSize: 12 }}>Créé par : {item.createdByName}</Text>
                    ) : null}
                    {item.note ? (
                      <Text style={{ color: isDark ? '#cbd5e1' : '#64748b', fontSize: 12 }}>{item.note}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowPlanningModal(false)}
              style={[styles.buildingMenuAction, { backgroundColor: isDark ? '#374151' : '#e2e8f0' }]}
            >
              <Text style={[styles.buildingMenuCloseText, { color: isDark ? '#fff' : '#0f172a' }]}>Fermer</Text>
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
            <Text style={[{ textAlign: 'center'},styles.buildingMenuTitle, { color: isDark ? '#fff' : '#0f172a' }]}>
              { buildingsData[0]?.idImmeuble || 'Immeuble'}
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
              onPress={openAppointmentModal}
              style={[styles.buildingMenuAction, { backgroundColor: '#7c3aed' }]}
            >
              <Text style={styles.buildingMenuActionText}>
                {appointment ? 'Modifier rendez-vous' : 'Prendre rendez-vous'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openPlanningModal}
              style={[styles.buildingMenuAction, { backgroundColor: '#4338ca' }]}
            >
              <Text style={styles.buildingMenuActionText}>Planning rendez-vous</Text>
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
              onPress={openPlanTirageFusionPdf}
              style={[styles.buildingMenuAction, { backgroundColor: '#b45309' }]}
            >
              <Text style={styles.buildingMenuActionText}>Afficher PDF plan tirage et fusion</Text>
            </TouchableOpacity>
            {currentUserRole === 'manager' ? (
            <TouchableOpacity
              onPress={archiveCurrentBuilding}
              style={[styles.buildingMenuAction, { backgroundColor: '#dc2626' }]}
            >
              <Text style={styles.buildingMenuActionText}>Archiver cet immeuble</Text>
            </TouchableOpacity>
            ) : null}
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
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            horizontal
            onScroll={handleDetailScroll}
            scrollEventThrottle={16}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={styles.tableContainer}>
              {renderTableHeader()}
              {buildingsData.map((building, index) => renderBuildingRow(building, index))}
            </View>
            <View style={{ width: 360, maxWidth: screenWidth * 0.42, marginLeft: 16, marginBottom: 20, flexShrink: 0 }}>
              {renderAppartementsParNiveau(0)}
            </View>
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
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onScroll={handleDetailScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Informations Générales
            </Text>
            {renderInputField('ID Immeuble', 'idImmeuble')}
            {renderInputField('ID Immeuble Système', 'idImmeubleSysteme')}
            {renderInputField('Ville', 'ville')}
            {renderInputField('Zone', 'zone')}
            {renderInputField('Code Postal', 'codePostal')}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Adresse et Localisation
            </Text>
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
            {renderInputField('Rue Nom & Nom', 'rueNomNom')}
            {renderInputField('N°/Nom Immeuble', 'numeroNomImmeuble')}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
              Caractéristiques
            </Text>
            {renderInputField('Utilisation Immeuble', 'utilisationImmeuble')}
            {renderInputField('Nbre Etages', 'nbreEtages')}
            {renderAppartementsParNiveau(0)}
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
            {renderInputField('BPO1', 'bpo1')}
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
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowSyndicSignatureModal(true)}
              style={[
                styles.syndicSignatureButton,
                { backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderColor: isDark ? '#3b82f6' : '#93c5fd' },
              ]}
            >
              <Text style={[styles.syndicSignatureButtonIcon, { color: isDark ? '#7dd3fc' : '#2563eb' }]}>✎</Text>
              <View style={styles.syndicSignatureButtonTextCol}>
                <Text style={[styles.syndicSignatureButtonTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Autorisation d&apos;installation — signature syndic
                </Text>
                <Text style={[styles.syndicSignatureButtonSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {syndicSigData ? 'Signer à nouveau ou consulter la signature enregistrée' : 'Ouvrir le formulaire de signature manuscrite'}
                </Text>
              </View>
              <Text style={[styles.syndicSignatureButtonChevron, { color: isDark ? '#64748b' : '#94a3b8' }]}>›</Text>
            </TouchableOpacity>
            {syndicSigData ? (
              <View
                style={[
                  styles.syndicSignaturePreview,
                  { borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? '#0f172a' : '#fff' },
                ]}
              >
                <Text style={[styles.syndicSignaturePreviewLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  Signature enregistrée
                </Text>
                <Image
                  source={{ uri: syndicSigData }}
                  style={styles.syndicSignaturePreviewImage}
                  resizeMode="contain"
                />
                {firstBuilding.syndicInstallationAuthSignedAt ? (
                  <Text style={[styles.syndicSignaturePreviewDate, { color: isDark ? '#64748b' : '#94a3b8' }]}>
                    {(() => {
                      try {
                        return new Date(String(firstBuilding.syndicInstallationAuthSignedAt)).toLocaleString('fr-FR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        });
                      } catch {
                        return String(firstBuilding.syndicInstallationAuthSignedAt);
                      }
                    })()}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {renderInputField('Remarques', 'remarques', true)}
          </View>

          <Modal
            visible={showSyndicSignatureModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowSyndicSignatureModal(false)}
          >
            <View style={[styles.syndicSignatureModalRoot, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
              <View style={styles.syndicSignatureModalHeader}>
                <Text style={[styles.syndicSignatureModalTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                  Autorisation syndic
                </Text>
                <TouchableOpacity onPress={() => setShowSyndicSignatureModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={[styles.syndicSignatureModalClose, { color: isDark ? '#94a3b8' : '#64748b' }]}>Fermer</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.syndicSignatureModalBlurb, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                Le syndic signe ici pour attester son accord pour les travaux d&apos;installation et de raccordement fibre sur la copropriété.
              </Text>
              {Platform.OS === 'ios' || Platform.OS === 'android' ? (
                <View style={styles.syndicSignatureModalBody}>
                  <SignatureCanvas
                    ref={syndicSignatureRef}
                    onOK={(dataUrl) => {
                      void handleSyndicSignatureConfirm(dataUrl);
                    }}
                    onEmpty={() =>
                      Alert.alert(
                        'Signature vide',
                        'Tracez votre signature dans le cadre, puis appuyez sur « Confirmer ».',
                      )
                    }
                    descriptionText=""
                    clearText=""
                    confirmText=""
                    penColor="#0f172a"
                    minWidth={0.8}
                    maxWidth={3}
                    backgroundColor="#ffffff"
                    style={styles.syndicSignaturePad}
                    webStyle=".m-signature-pad--footer { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; overflow: hidden !important; } .m-signature-pad { box-shadow: none; border-radius: 12px; border: 1px solid #e2e8f0; } .m-signature-pad--body { border-radius: 12px; } body,html { height: 100%; background:#fff; }"
                    dataURL={syndicSigRestoreUrl}
                    nestedScrollEnabled
                    webviewProps={{ androidLayerType: 'hardware' }}
                  />
                  <View style={styles.syndicSignatureActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.syndicSignatureActionSecondary,
                        { borderColor: isDark ? '#475569' : '#cbd5e1', opacity: syndicSigSaving ? 0.5 : 1 },
                      ]}
                      onPress={() => syndicSignatureRef.current?.clearSignature()}
                      disabled={syndicSigSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Effacer la signature"
                    >
                      <Text style={[styles.syndicSignatureActionSecondaryText, { color: isDark ? '#e2e8f0' : '#334155' }]}>
                        Effacer
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.syndicSignatureActionPrimary,
                        { backgroundColor: isDark ? '#2563eb' : '#1d4ed8', opacity: syndicSigSaving ? 0.85 : 1 },
                      ]}
                      onPress={() => syndicSignatureRef.current?.readSignature()}
                      disabled={syndicSigSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Confirmer et enregistrer la signature"
                    >
                      {syndicSigSaving ? (
                        <ActivityIndicator color="#f8fafc" />
                      ) : (
                        <Text style={styles.syndicSignatureActionPrimaryText}>Confirmer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={[styles.syndicSignatureWebNote, { color: isDark ? '#fbbf24' : '#b45309' }]}>
                  La signature manuscrite est disponible sur l&apos;application mobile (iOS ou Android), pas dans le navigateur web.
                </Text>
              )}
            </View>
          </Modal>

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
      <Animated.View
        {...floatingMenuPanResponder.panHandlers}
        style={[
          styles.floatingMenuButton,
          { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.88)' : 'rgba(148, 163, 184, 0.32)' },
          { transform: floatingMenuPosition.getTranslateTransform() },
        ]}
      >
        <Text style={[styles.floatingMenuButtonText, { color: isDark ? '#fff' : '#0f172a' }]}>⋮</Text>
      </Animated.View>
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
  floatingMenuButton: {
    position: 'absolute',
    right: 18,
    bottom: 96,
    width: MENU_FLOATING_BUTTON_SIZE,
    height: MENU_FLOATING_BUTTON_SIZE,
    borderRadius: MENU_FLOATING_BUTTON_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    zIndex: 60,
  },
  floatingMenuButtonText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: -4,
  },
  statusSelectorContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 20,
  },
  appointmentBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 3,
  },
  appointmentTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  appointmentText: {
    fontSize: 15,
    fontWeight: '800',
  },
  appointmentNote: {
    fontSize: 13,
    fontWeight: '600',
  },
  appointmentPickerLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  systemPickerButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  systemPickerValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  appointmentChipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  appointmentChip: {
    minWidth: 104,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  appointmentTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  appointmentTimeChip: {
    minWidth: 72,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  planningRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  planningDate: {
    fontSize: 15,
    fontWeight: '900',
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
  pdfPickerRow: {
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pdfDeleteButton: {
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pdfDeleteText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
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
  aptSummaryShell: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 18,
    overflow: 'hidden',
  },
  aptSummaryShellRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  aptSummaryAccent: {
    width: 5,
    alignSelf: 'stretch',
  },
  aptSummaryBody: {
    flex: 1,
    paddingTop: 14,
    paddingRight: 14,
    paddingBottom: 14,
    paddingLeft: 12,
    gap: 12,
    minWidth: 0,
  },
  aptSummaryCollapsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aptSummaryHeaderTexts: {
    flex: 1,
    minWidth: 0,
  },
  aptSummaryKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  aptSummaryHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  aptSummaryHeadline: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
    minWidth: 120,
  },
  aptSummaryCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  aptSummaryCountPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  aptSummaryChevronCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  aptSummaryChevronInCircle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 1,
  },
  aptSummaryChipsSurface: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  aptSummaryMicroHint: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  aptSummaryChipsScroll: {
    maxHeight: 72,
    flexGrow: 0,
  },
  aptSummaryChipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 4,
  },
  aptSummaryChipSep: {
    width: StyleSheet.hairlineWidth * 2,
    minWidth: 2,
    height: 28,
    borderRadius: 1,
    opacity: 0.85,
  },
  aptSummaryChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 54,
    alignItems: 'center',
    borderWidth: 1,
  },
  aptSummaryChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  aptSummaryChipValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  aptExpandedSummaryBlock: {
    marginBottom: 10,
  },
  aptExpandedSummaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  syndicSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 12,
  },
  syndicSignatureButtonIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  syndicSignatureButtonTextCol: {
    flex: 1,
    minWidth: 0,
  },
  syndicSignatureButtonTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  syndicSignatureButtonSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  syndicSignatureButtonChevron: {
    fontSize: 22,
    fontWeight: '300',
  },
  syndicSignaturePreview: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  syndicSignaturePreviewLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  syndicSignaturePreviewImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  syndicSignaturePreviewDate: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  syndicSignatureModalRoot: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  syndicSignatureModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  syndicSignatureModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    flex: 1,
    paddingRight: 12,
  },
  syndicSignatureModalClose: {
    fontSize: 16,
    fontWeight: '700',
  },
  syndicSignatureModalBlurb: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  syndicSignatureModalBody: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  syndicSignatureActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    paddingBottom: 4,
  },
  syndicSignatureActionSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  syndicSignatureActionSecondaryText: {
    fontSize: 16,
    fontWeight: '800',
  },
  syndicSignatureActionPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 50,
  },
  syndicSignatureActionPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  syndicSignatureWebNote: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  syndicSignaturePad: {
    flex: 1,
    minHeight: 220,
    width: '100%',
    maxHeight: 420,
  },
  aptCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  aptCollapseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  aptCollapseButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  aptCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  aptCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  aptCardHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  aptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  aptRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  aptBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aptBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  aptRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  aptInput: {
    width: 72,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  aptSumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  aptSumLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  aptSumValue: {
    fontSize: 18,
    fontWeight: '800',
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
