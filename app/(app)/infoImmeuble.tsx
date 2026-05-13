import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, RefreshControl, TextInput, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useBuildings, useTechnicians } from '@/hooks';
import { dataService } from '@/services/dataService';
import { Building as ApiBuilding, Technician as ApiTechnician, buildingsApi, technicalDossiersApi } from '@/api';
import { saveFileWithPicker } from '@/utils/saveFileWithPicker';
import { useAuth } from '@/ctx';

// Local Building interface mapped from API
interface Building {
  id: string;
  _id?: string;
  name: string;
  address: string;
  serviceId: string;
  zone?: string;
  ville?: string;
  status?: string;
  idImmeuble?: string;
  rueNomNom?: string;
  numeroNomImmeuble?: string;
}

type UserRole = 'manager' | 'supervisor' | 'technician';

interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  assignedItems?: string[];
}

interface ItemAssignment {
  itemId: string;
  technicianIds: string[];
  assignedBy: string;
  assignedAt: Date;
}

export default function InfoImmeubleScreen() {
  const { itemId, itemName, zone, importExcel } = useLocalSearchParams<{ itemId?: string; itemName?: string; zone?: string; importExcel?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const currentUser = useMemo<User>(() => ({
    id: user?.id || user?.sub || 'user1',
    name: user?.name || user?.email || 'Utilisateur',
    role: user?.role || 'technician',
    email: user?.email || '',
  }), [user]);
  const isManager = currentUser.role === 'manager';
  const { data: apiTechnicians, isLoading: isLoadingTechs } = useTechnicians({ status: 'active' });
  const technicians: ApiTechnician[] = apiTechnicians || [];
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedBuildingForAction, setSelectedBuildingForAction] = useState<Building | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [buildingAssignments, setBuildingAssignments] = useState<ItemAssignment[]>([]);
  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [selectedBuildingsForArchive, setSelectedBuildingsForArchive] = useState<string[]>([]);
  const [showTechDropdown, setShowTechDropdown] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing'>('synced');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFilePath, setImportFilePath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [locallyImportedBuildings, setLocallyImportedBuildings] = useState<ApiBuilding[]>([]);
  const [technicianFilter, setTechnicianFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportingTechnicalDossier, setIsExportingTechnicalDossier] = useState(false);
  const headerOffset = useRef(new Animated.Value(0)).current;
  const topControlsOffset = useRef(new Animated.Value(0)).current;
  const lastScrollOffsetRef = useRef(0);
  const isHeaderHiddenRef = useRef(false);

  const animateHeaderVisibility = (hidden: boolean) => {
    if (isHeaderHiddenRef.current === hidden) return;
    isHeaderHiddenRef.current = hidden;
    Animated.parallel([
      Animated.timing(headerOffset, {
        toValue: hidden ? -76 : 0,
        duration: hidden ? 360 : 280,
        useNativeDriver: true,
      }),
      Animated.timing(topControlsOffset, {
        toValue: hidden ? -140 : 0,
        duration: hidden ? 360 : 280,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleListScroll = (event: any) => {
    const currentOffset = Math.max(0, event.nativeEvent.contentOffset?.y || 0);
    const previousOffset = lastScrollOffsetRef.current;
    const delta = currentOffset - previousOffset;

    if (currentOffset < 8) {
      animateHeaderVisibility(false);
    } else if (delta > 8) {
      animateHeaderVisibility(true);
    } else if (delta < -12) {
      animateHeaderVisibility(false);
    }

    lastScrollOffsetRef.current = currentOffset;
  };

  const selectedZone = typeof zone === 'string' ? zone.trim() : '';
  useEffect(() => {
    if (importExcel === '1' && isManager) setShowImportModal(true);
  }, [importExcel, isManager]);
  const backendStatusFilter = statusFilter === 'all' ? 'active' : statusFilter;
  const { data: apiBuildings, isLoading, refetch } = useBuildings(selectedZone ? undefined : itemId, { status: backendStatusFilter });
  const mergedBuildings = Array.from(
    [...(apiBuildings ?? []), ...locallyImportedBuildings]
      .reduce((map, building) => map.set(building.idImmeuble, building), new Map<string, ApiBuilding>())
      .values(),
  );
  const visibleBuildings = selectedZone
    ? mergedBuildings.filter((b: ApiBuilding) => String(b.zone ?? '').trim() === selectedZone)
    : mergedBuildings;
  
  // Map API buildings to local format
  const data: Building[] | undefined = visibleBuildings?.map((b: ApiBuilding) => ({
    id: b._id || b.idImmeuble,
    _id: b._id,
    name: `${b.idImmeuble} - ${b.rueNomNom} ${b.numeroNomImmeuble}`,
    address: `${b.rueNomNom}, ${b.codePostal} ${b.ville}`,
    serviceId: b.serviceId,
    zone: b.zone,
    ville: b.ville,
    status: b.status,
    idImmeuble: b.idImmeuble,
    rueNomNom: b.rueNomNom,
    numeroNomImmeuble: b.numeroNomImmeuble,
  }));
  const filteredData = data?.filter((building) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesStatus = statusFilter === 'all' || building.status === statusFilter;
    const matchesTechnician =
      technicianFilter === 'all' ||
      buildingAssignments.some((assignment) => assignment.itemId === building.id && assignment.technicianIds.includes(technicianFilter));
    const matchesSearch =
      !query ||
      [
        building.idImmeuble,
        building.name,
        building.address,
        building.rueNomNom,
        building.numeroNomImmeuble,
        building.ville,
        building.zone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    return matchesStatus && matchesTechnician && matchesSearch;
  });

  // Load saved assignments from local storage
  useEffect(() => {
    loadSavedAssignments();
    setupNetworkListener();
  }, []);

  const loadSavedAssignments = async () => {
    try {
      const savedAssignments = await dataService.loadAssignments();
      if (savedAssignments) {
        setBuildingAssignments(savedAssignments as ItemAssignment[]);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const saveAssignmentsToLocal = async (assignments: ItemAssignment[]) => {
    try {
      await dataService.saveAssignments(assignments);
      if (isOnline) {
        setSyncStatus('pending');
        // Trigger sync to backend
        setTimeout(() => syncToBackend(assignments), 1000);
      } else {
        setSyncStatus('pending');
      }
    } catch (error) {
      console.error('Error saving assignments:', error);
    }
  };

  const syncToBackend = async (assignments: ItemAssignment[]) => {
    try {
      setSyncStatus('syncing');
      // Use dataService to sync
      const result = await dataService.syncData();
      if (result.success) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('pending');
      }
    } catch (error) {
      console.error('Error syncing to backend:', error);
      setSyncStatus('pending');
    }
  };

  const normalizeHeader = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

  const handlePickExcelFile = async () => {
    if (!isManager) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent importer des immeubles.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/vnd.ms-excel.sheet.macroEnabled.12',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length) {
        setImportFilePath(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier Excel');
    }
  };

  const handleImportBuildings = async () => {
    if (!isManager) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent importer des immeubles.');
      return;
    }
    if (!importFilePath) {
      Alert.alert('Erreur', 'Veuillez sélectionner un fichier Excel');
      return;
    }

    setIsImporting(true);
    try {
      const fileContent = await FileSystem.readAsStringAsync(importFilePath, { encoding: 'base64' });
      const workbook = XLSX.read(fileContent, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

      if (rows.length < 2) {
        Alert.alert('Erreur', 'Le fichier Excel est vide ou invalide');
        return;
      }

      const headers = (rows[0] as unknown[]).map((header) => String(header ?? '').trim());
      const serviceId = itemId || 'service_unique';
      const zoneName = selectedZone || itemName || '';
      const buildings = rows.slice(1).map((row, index) => {
        const building: any = {
          serviceId,
          status: 'active',
          __row: index + 2,
        };
        let floorIndex = 0;

        headers.forEach((header, columnIndex) => {
          const value = row[columnIndex] !== undefined && row[columnIndex] !== null ? String(row[columnIndex]).trim() : '';
          const normalized = normalizeHeader(header);

          switch (normalized) {
            case 'id immeuble':
            case 'id_immeuble':
              building.idImmeuble = value;
              break;
            case 'id immeuble système':
            case 'id immeuble systeme':
            case 'id_immeuble systeme':
              building.idImmeubleSysteme = value;
              break;
            case 'ville':
              building.ville = value;
              break;
            case 'code postal':
              building.codePostal = value;
              break;
            case 'longitude':
            case 'lonngitude':
              building.longitude = value;
              break;
            case 'latitude':
              building.latitude = value;
              break;
            case 'rue non.& nonm':
              building.rueNomNom = value;
              break;
            case 'n°/nonm immeuble':
              building.numeroNomImmeuble = value;
              break;
            case 'utilisation immeuble':
              building.utilisationImmeuble = value;
              break;
            case 'nbre etages':
              building.nbreEtages = value;
              break;
            case 'sous sol':
              building.sousSol = value;
              break;
            case 'sous sol-commun':
              building.sousSolCommun = value;
              break;
            case 'solution de raccordement':
              building.solutionRaccordement = value;
              break;
            case 'nbr b2b':
              building.nbrB2B = value;
              break;
            case 'nbr b2c':
              building.nbrB2C = value;
              break;
            case 'total clients':
              building.totalClients = value;
              break;
            case 'chemin de fibre':
            case 'pbo1':
              if (!building.cheminFibrePBO1) building.cheminFibrePBO1 = value;
              break;
            case 'floor':
              if (floorIndex === 0) building.floorPBO1 = value;
              else building.floorPBO2 = value;
              floorIndex++;
              break;
            case 'type pbo1':
              building.typePBO1 = value;
              break;
            case 'pbo2':
              building.PBO2 = value;
              break;
            case 'type pbo2':
              building.typePBO2 = value;
              break;
            case 'syndic':
              building.syndic = value;
              break;
            case 'num syndic':
              building.numSyndic = value;
              break;
            case 'remarques':
              building.remarques = value;
              break;
            case 'typologie habitat':
              building.typologieHabitat = value;
              break;
            case 'verticalité':
            case 'verticalite':
              building.verticalite = value;
              break;
            case 'csp':
              building.csp = value;
              break;
          }
        });

        building.idImmeubleSysteme = building.idImmeubleSysteme || building.idImmeuble;
        building.zone = zoneName;
        building.ville = building.ville || zoneName;

        return {
          idImmeuble: building.idImmeuble || '',
          idImmeubleSysteme: building.idImmeubleSysteme || '',
          ville: building.ville || '',
          zone: building.zone || '',
          codePostal: building.codePostal || '00000',
          longitude: building.longitude || '',
          latitude: building.latitude || '',
          rueNomNom: building.rueNomNom || '',
          numeroNomImmeuble: building.numeroNomImmeuble || '',
          utilisationImmeuble: building.utilisationImmeuble || '',
          nbreEtages: building.nbreEtages || '',
          sousSol: building.sousSol || '',
          sousSolCommun: building.sousSolCommun || '',
          solutionRaccordement: building.solutionRaccordement || '',
          nbrB2B: building.nbrB2B || '',
          nbrB2C: building.nbrB2C || '',
          totalClients: building.totalClients || '',
          cheminFibrePBO1: building.cheminFibrePBO1 || '',
          floorPBO1: building.floorPBO1 || '',
          typePBO1: building.typePBO1 || '',
          PBO2: building.PBO2 || '',
          floorPBO2: building.floorPBO2 || '',
          typePBO2: building.typePBO2 || '',
          syndic: building.syndic || '',
          numSyndic: building.numSyndic || '',
          remarques: building.remarques || '',
          typologieHabitat: building.typologieHabitat || '',
          verticalite: building.verticalite || '',
          csp: building.csp || '',
          serviceId,
          status: 'active',
          __row: building.__row,
        };
      }).filter((building) => building.idImmeuble && building.idImmeubleSysteme && building.ville && building.rueNomNom && building.numeroNomImmeuble);

      if (buildings.length === 0) {
        Alert.alert('Erreur', 'Aucun immeuble valide trouvé dans le fichier');
        return;
      }

      let successCount = 0;
      const errors: string[] = [];
      const importedNow: ApiBuilding[] = [];
      for (const building of buildings) {
        const { __row, ...payload } = building;
        try {
          const response = await buildingsApi.create(payload);
          const created = ((response as any)?.data ?? payload) as ApiBuilding;
          importedNow.push({ ...created, ...payload, zone: selectedZone });
          successCount++;
        } catch (error: any) {
          errors.push(`Ligne ${__row}: ${payload.idImmeuble} - ${error?.message || 'Erreur import'}`);
        }
      }

      if (importedNow.length > 0) {
        setLocallyImportedBuildings((previous) => [
          ...previous.filter((item) => !importedNow.some((created) => created.idImmeuble === item.idImmeuble)),
          ...importedNow,
        ]);
      }
      await queryClient.invalidateQueries({ queryKey: ['buildings'] });
      void refetch();
      setShowImportModal(false);
      setImportFilePath('');

      const detail = errors.length > 0 ? `\n\nDétails:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}` : '';
      Alert.alert('Import terminé', `${successCount} immeuble(s) importé(s)\n${errors.length} erreur(s)${detail}`);
    } catch (error) {
      Alert.alert('Erreur', `Échec de l'import Excel: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const setupNetworkListener = () => {
    // Simple and reliable: just use browser's built-in detection
    const updateStatus = () => {
      if (typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine);
      }
    };
    
    // Set initial status
    updateStatus();
    
    // Listen to browser events
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => setIsOnline(true));
      window.addEventListener('offline', () => setIsOnline(false));
    }
    
    // Return cleanup
    return () => {
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('online', () => setIsOnline(true));
        window.removeEventListener('offline', () => setIsOnline(false));
      }
    };
  };

  const handleBack = () => {
    router.replace('/(app)/selection');
  };

  const handleSwipeBack = (event: any) => {
    const { state, translationX, translationY } = event.nativeEvent;
    if (state === State.END && translationX > 90 && Math.abs(translationY) < 80) {
      handleBack();
    }
  };

  // Role management functions
  const canAccessBuilding = (building: Building): boolean => {
    if (currentUser.role === 'manager' || currentUser.role === 'supervisor') {
      return true;
    }
    if (currentUser.role === 'technician' && currentUser.assignedItems) {
      return currentUser.assignedItems.includes(building.id);
    }
    return false;
  };

  const handleBuildingLongPress = (building: Building) => {
    if (currentUser.role === 'manager') {
      setSelectedBuildingForAction(building);
      setShowActionSheet(true);
    }
  };

  const exportTechnicalDossier = async (building: Building | null) => {
    const id = building?._id || building?.id || building?.idImmeuble;

    if (!building || !id) {
      Alert.alert('Erreur', 'Aucun immeuble sélectionné pour exporter le dossier technique.');
      return;
    }

    setIsExportingTechnicalDossier(true);
    try {
      const request = await technicalDossiersApi.getDownloadRequest(String(id), building.idImmeuble || building.name);
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
      console.error('[TECHNICAL_DOSSIER_EXPORT][INFO] failed', {
        message: error?.message,
        error,
      });
      Alert.alert('Erreur', error?.message || 'Impossible d’exporter le dossier technique.');
    } finally {
      setIsExportingTechnicalDossier(false);
    }
  };

  const handleActionSheetOption = (option: string) => {
    setShowActionSheet(false);
    
    switch (option) {
      case 'Détails':
        router.push({
          pathname: '/(app)/detailImmeuble',
          params: { 
            buildingId: selectedBuildingForAction?.id, 
            buildingName: selectedBuildingForAction?.name,
            itemId: itemId,
            zone: selectedZone,
            itemName: itemName || selectedZone
          }
        });
        break;
      case 'Export':
        Alert.alert('Export', `Exportation de l'immeuble: ${selectedBuildingForAction?.name}`);
        break;
      case 'Exporter dossier technique':
        void exportTechnicalDossier(selectedBuildingForAction);
        break;
      case 'Affectation de plaque':
        setAssignmentMode(true);
        break;
      case 'Choix Qualifica':
        Alert.alert('Qualification', 'Choix de qualification');
        break;
      case 'Archive':
        setIsArchiveMode(true);
        break;
      case 'Annuler':
        // Do nothing
        break;
    }
  };

  const toggleArchiveSelection = (buildingId: string) => {
    setSelectedBuildingsForArchive(prev => 
      prev.includes(buildingId) 
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  };

  const confirmArchive = () => {
    if (selectedBuildingsForArchive.length > 0) {
      Alert.alert(
        'Archivage',
        `Archiver ${selectedBuildingsForArchive.length} immeuble(s) ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Archiver', 
            style: 'destructive',
            onPress: () => {
              setSelectedBuildingsForArchive([]);
              setIsArchiveMode(false);
              Alert.alert('Succès', `${selectedBuildingsForArchive.length} immeuble(s) archivé(s)`);
            }
          }
        ]
      );
    }
  };

  const cancelArchiveMode = () => {
    setSelectedBuildingsForArchive([]);
    setIsArchiveMode(false);
  };

  const toggleTechnicianSelection = (technicianId: string) => {
    setSelectedTechnicians(prev => 
      prev.includes(technicianId) 
        ? []
        : [technicianId]
    );
  };

  const persistAssignment = async (assignment: ItemAssignment) => {
    setSyncStatus('syncing');
    await dataService.createAssignment({
      ...assignment,
      status: 'active',
    });
    setSyncStatus(dataService.getNetworkStatus() ? 'synced' : 'pending');
  };

  const confirmAssignment = async () => {
    if (selectedBuildingsForArchive.length > 0 && selectedTechnicians.length === 1) {
      const nextAssignments = [...buildingAssignments];
      const assignmentsToPersist: ItemAssignment[] = [];

      selectedBuildingsForArchive.forEach(buildingId => {
        const newAssignment: ItemAssignment = {
          itemId: buildingId,
          technicianIds: [selectedTechnicians[0]],
          assignedBy: currentUser.id,
          assignedAt: new Date()
        };
        const previousIndex = nextAssignments.findIndex(a => a.itemId === buildingId);
        if (previousIndex >= 0) {
          nextAssignments[previousIndex] = newAssignment;
        } else {
          nextAssignments.push(newAssignment);
        }
        assignmentsToPersist.push(newAssignment);
      });

      setBuildingAssignments(nextAssignments);
      await saveAssignmentsToLocal(nextAssignments);

      try {
        await Promise.all(assignmentsToPersist.map(persistAssignment));
      } catch {
        setSyncStatus('pending');
        Alert.alert('Affectation', 'Affectation sauvegardée localement. Elle sera synchronisée dès que possible.');
      }
      
      setAssignmentMode(false);
      setSelectedTechnicians([]);
      setSelectedBuildingsForArchive([]);
      // Silent assignment - no success alert
    }
  };

  const cancelAssignmentMode = () => {
    setAssignmentMode(false);
    setSelectedTechnicians([]);
    setSelectedBuildingsForArchive([]);
  };

  // Add sync status indicator
  const renderSyncStatus = () => {
    if (syncStatus === 'synced') {
      return (
        <View style={styles.syncIndicator}>
          <Text style={[styles.syncText, { color: '#28a745' }]}>✓</Text>
        </View>
      );
    } else if (syncStatus === 'syncing') {
      return (
        <View style={styles.syncIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      );
    } else {
      return (
        <View style={styles.syncIndicator}>
          <Text style={[styles.syncText, { color: '#ffc107' }]}>⚡</Text>
        </View>
      );
    }
  };

  const renderHeader = () => {
    if (!assignmentMode || currentUser.role !== 'manager') return null;
    
    return (
      <View style={[styles.fixedAssignmentHeader, { backgroundColor: '#007AFF' }]}>
        <View style={styles.techDropdownContainer}>
          <TouchableOpacity 
            style={[styles.techDropdownButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
            onPress={() => setShowTechDropdown(!showTechDropdown)}
          >
            <Text style={styles.techDropdownText}>
              {selectedTechnicians.length > 0 
                ? `${technicians.find(t => t.id === selectedTechnicians[0])?.name}`
                : 'Sélectionner un technicien'
              }
            </Text>
            <Text style={styles.dropdownArrow}>{showTechDropdown ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {showTechDropdown && (
            <View style={[styles.fixedTechDropdownList, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
              <ScrollView 
                style={styles.techListScroll} 
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {technicians.map((technician: ApiTechnician) => (
                  <TouchableOpacity
                    key={technician.id}
                    style={[
                      styles.techDropdownItem,
                      { 
                        backgroundColor: selectedTechnicians.includes(technician.id) 
                          ? '#007AFF20' 
                          : 'transparent',
                        borderColor: isDark ? '#444' : '#e0e0e0'
                      }
                    ]}
                    onPress={() => {
                      if (selectedTechnicians.includes(technician.id)) {
                        setSelectedTechnicians([]);
                      } else {
                        setSelectedTechnicians([technician.id]);
                        setShowTechDropdown(false);
                      }
                    }}
                  >
                    <View style={styles.techItemContent}>
                      <Text style={[styles.techItemName, { color: isDark ? '#fff' : '#000' }]}>
                        {technician.name}
                      </Text>
                      <Text style={[styles.techItemEmail, { color: isDark ? '#aaa' : '#666' }]}>
                        {technician.email}
                      </Text>
                    </View>
                    <View style={[
                      styles.techCheckbox,
                      { 
                        backgroundColor: selectedTechnicians.includes(technician.id) 
                          ? '#007AFF' 
                          : 'transparent',
                        borderColor: selectedTechnicians.includes(technician.id) 
                          ? '#007AFF' 
                          : (isDark ? '#666' : '#ccc')
                      }
                    ]}>
                      {selectedTechnicians.includes(technician.id) && (
                        <Text style={styles.techCheckmark}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        
        <View style={styles.assignmentActions}>
          <TouchableOpacity 
            style={[styles.assignmentButton, styles.cancelAssignmentButton]} 
            onPress={cancelAssignmentMode}
          >
            <Text style={styles.cancelAssignmentText}>Terminer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getAssignedTechnicians = (buildingId: string): ApiTechnician[] => {
    const assignment = buildingAssignments.find(a => a.itemId === buildingId);
    if (!assignment) return [];
    return technicians.filter(tech => assignment.technicianIds.includes(tech.id));
  };

  const handleBuildingPress = async (building: Building) => {
    if (isArchiveMode) {
      toggleArchiveSelection(building.id);
    } else if (assignmentMode && selectedTechnicians.length === 1) {
      // Immediate assignment save
      const newAssignment: ItemAssignment = {
        itemId: building.id,
        technicianIds: selectedTechnicians,
        assignedBy: currentUser.id,
        assignedAt: new Date()
      };

      const updatedAssignments = (() => {
        const filtered = buildingAssignments.filter(a => a.itemId !== building.id);
        return [...filtered, newAssignment];
      })();

      setBuildingAssignments(updatedAssignments);
      await saveAssignmentsToLocal(updatedAssignments);

      try {
        await persistAssignment(newAssignment);
      } catch {
        setSyncStatus('pending');
        Alert.alert('Affectation', 'Affectation sauvegardée localement. Elle sera synchronisée dès que possible.');
      }

      // Silent assignment - no success alert
    } else if (canAccessBuilding(building)) {
      router.push({
        pathname: '/(app)/detailImmeuble',
        params: { 
          buildingId: building.id, 
          buildingName: building.name,
          itemId: itemId,
          zone: selectedZone,
          itemName: itemName || selectedZone
        }
      });
    }
  };

  const renderBuilding = ({ item }: { item: Building }) => {
    const assignedTechs = getAssignedTechnicians(item.id);
    const isSelectedForArchive = selectedBuildingsForArchive.includes(item.id);
    const statusLabels: Record<string, string> = {
      active: 'Actif',
      pending: 'En attente',
      archived: 'Archivé',
      inactive: 'Inactif',
    };
    const statusText = statusLabels[item.status || 'active'] || item.status || 'Actif';
    
    return (
      <TouchableOpacity 
        style={[
          styles.buildingItem, 
          { 
            backgroundColor: isSelectedForArchive 
              ? '#007AFF20' 
              : (isDark ? '#333' : '#f9f9f9'),
            opacity: canAccessBuilding(item) ? 1 : 0.5,
            borderWidth: isSelectedForArchive ? 2 : 0,
            borderColor: isSelectedForArchive ? '#007AFF' : 'transparent'
          }
        ]}
        onPress={() => handleBuildingPress(item)}
        onLongPress={() => !isArchiveMode && !assignmentMode && handleBuildingLongPress(item)}
        delayLongPress={500}
      >
        <View style={styles.buildingContent}>
          <View style={styles.buildingHeader}>
            {/* Archive checkbox */}
            {isArchiveMode && currentUser.role === 'manager' && (
              <View style={[
                styles.archiveCheckbox,
                { 
                  backgroundColor: isSelectedForArchive 
                    ? '#007AFF' 
                    : 'transparent',
                  borderColor: isSelectedForArchive 
                    ? '#007AFF' 
                    : (isDark ? '#666' : '#ccc')
                }
              ]}>
                {isSelectedForArchive && (
                  <Text style={styles.archiveCheckmark}>✓</Text>
                )}
              </View>
            )}
            
            <View style={styles.buildingTitleContainer}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.buildingName, { color: isDark ? '#fff' : '#000' }]}
              >
                {item.name}
              </Text>
            </View>
            {currentUser.role === 'manager' && !isArchiveMode && !assignmentMode ? (
              <TouchableOpacity
                onPress={(event) => {
                  event.stopPropagation?.();
                  setSelectedBuildingForAction(item);
                  setShowActionSheet(true);
                }}
                style={[styles.buildingMenuButton, { backgroundColor: isDark ? '#444' : '#e2e8f0' }]}
              >
                <Text style={[styles.buildingMenuButtonText, { color: isDark ? '#fff' : '#334155' }]}>⋮</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={[styles.buildingAddress, { color: isDark ? '#ccc' : '#666' }]}>
            {item.address}
          </Text>

          <View style={styles.buildingMetaRow}>
            <View style={styles.buildingMetaPill}>
              <Text style={[styles.buildingMetaValue, { color: assignedTechs.length > 0 ? '#007AFF' : '#64748b' }]}>
                {assignedTechs[0]?.name || 'Non affecté'}
              </Text>
            </View>
            <View style={styles.buildingMetaPill}>
              <Text style={[styles.buildingMetaValue, { color: item.status === 'archived' ? '#dc2626' : '#16a34a' }]}>
                {statusText}
              </Text>
            </View>
          </View>
          
          {/* User role indicator */}
          {currentUser.role === 'technician' && !canAccessBuilding(item) && (
            <View style={styles.accessDenied}>
              <Text style={styles.accessDeniedText}>🔒 Non assigné</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
        <View style={styles.userInfo}>
          <View style={styles.userStatusRow}>
            <Text style={[styles.userRole, { color: isDark ? '#ccc' : '#666' }]}>
              {currentUser.role === 'manager' ? 'Manager' : currentUser.role === 'supervisor' ? 'Superviseur' : 'Technicien'}
            </Text>
            {renderSyncStatus()}
          </View>
        </View>
      </Animated.View>
      
      {/* Archive Mode Header */}
      {isArchiveMode && currentUser.role === 'manager' && (
        <View style={[styles.archiveModeHeader, { backgroundColor: '#007AFF' }]}>
          <Text style={styles.archiveModeText}>
            Mode Archive - Sélectionnez les immeubles à archiver ({selectedBuildingsForArchive.length})
          </Text>
          <View style={styles.archiveActions}>
            <TouchableOpacity 
              style={[styles.archiveButton, styles.cancelArchiveButton]} 
              onPress={cancelArchiveMode}
            >
              <Text style={styles.cancelArchiveText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.archiveButton, 
                styles.confirmArchiveButton,
                { opacity: selectedBuildingsForArchive.length > 0 ? 1 : 0.5 }
              ]} 
              onPress={confirmArchive}
              disabled={selectedBuildingsForArchive.length === 0}
            >
              <Text style={styles.confirmArchiveText}>
                Archiver ({selectedBuildingsForArchive.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {isLoading ? (
        <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center' }} />
      ) : (
        <View style={styles.listContainer}>
          <Animated.View
            style={[
              styles.zoneTitleContainer,
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
              <Text style={[styles.zoneTitle, { color: isDark ? '#fff' : '#000' }]}>
                Zone : {itemName || selectedZone || 'Toutes les zones'}
              </Text>
              <Text style={[styles.zoneSubtitle, { color: isDark ? '#ccc' : '#666' }]}>
                {filteredData?.length ?? 0} immeuble{(filteredData?.length ?? 0) > 1 ? 's' : ''}
              </Text>
          </Animated.View>
          <Animated.View style={[styles.zoneControlsContainer, { transform: [{ translateY: topControlsOffset }], marginBottom: topControlsOffset }]}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher un immeuble..."
              placeholderTextColor="#94a3b8"
              style={[
                styles.searchInput,
                {
                  backgroundColor: isDark ? '#1f2937' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: isDark ? '#fff' : '#0f172a',
                },
              ]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
              <TouchableOpacity
                onPress={() => setTechnicianFilter('all')}
                style={[styles.filterChip, technicianFilter === 'all' && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, technicianFilter === 'all' && styles.filterChipTextActive]}>Tous techniciens</Text>
              </TouchableOpacity>
              {technicians.map((tech) => (
                <TouchableOpacity
                  key={tech.id}
                  onPress={() => setTechnicianFilter(tech.id)}
                  style={[styles.filterChip, technicianFilter === tech.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, technicianFilter === tech.id && styles.filterChipTextActive]}>{tech.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
              {[
                ['all', 'Tous états'],
                ['active', 'Actif'],
                ['pending', 'En attente'],
                ['archived', 'Archivé'],
                ['inactive', 'Inactif'],
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setStatusFilter(value)}
                  style={[styles.filterChip, statusFilter === value && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, statusFilter === value && styles.filterChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
          {renderHeader()}
          <FlatList
            data={filteredData}
            renderItem={renderBuilding}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: isDark ? '#ccc' : '#666' }]}>
                  Aucun immeuble trouvé pour cette zone
                </Text>
              </View>
            }
          />
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={showImportModal && isManager}
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.importModalContainer, { backgroundColor: isDark ? '#2a2a2a' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
              Importer les immeubles
            </Text>
            <Text style={[styles.importHint, { color: isDark ? '#ccc' : '#666' }]}>
              Le fichier Excel doit contenir au minimum : ID Immeuble, ID Immeuble Système, Rue, N° Immeuble. La ville sera la zone actuelle si elle est renseignée.
            </Text>

            <TouchableOpacity style={styles.pickFileButton} onPress={handlePickExcelFile} disabled={isImporting}>
              <Text style={styles.pickFileButtonText}>Choisir un fichier Excel</Text>
            </TouchableOpacity>

            {importFilePath ? (
              <Text style={[styles.selectedFileName, { color: isDark ? '#fff' : '#000' }]} numberOfLines={2}>
                {importFilePath.split('/').pop()}
              </Text>
            ) : null}

            <View style={styles.importActions}>
              <TouchableOpacity
                style={[styles.importActionButton, styles.cancelImportButton]}
                onPress={() => {
                  setShowImportModal(false);
                  setImportFilePath('');
                }}
                disabled={isImporting}
              >
                <Text style={styles.cancelImportText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importActionButton, styles.confirmImportButton, { opacity: isImporting ? 0.7 : 1 }]}
                onPress={handleImportBuildings}
                disabled={isImporting}
              >
                <Text style={styles.confirmImportText}>
                  {isImporting ? 'Import...' : 'Importer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ActionSheet Modal for Manager */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showActionSheet}
        onRequestClose={() => setShowActionSheet(false)}
      >
        <View style={styles.actionSheetOverlay}>
          <View style={[styles.actionSheetContainer, { backgroundColor: isDark ? '#2a2a2a' : '#fff' }]}>
            <View style={styles.actionSheetHandle} />
            <Text style={[styles.actionSheetTitle, { color: isDark ? '#fff' : '#000' }]}>
              Actions - {selectedBuildingForAction?.name}
            </Text>

            {['Détails', 'Exporter dossier technique', 'Export', 'Affectation de plaque', 'Choix Qualifica', 'Archive', 'Annuler'].map((option, index) => (
              <TouchableOpacity
                key={option}
                disabled={option === 'Exporter dossier technique' && isExportingTechnicalDossier}
                style={[
                  styles.actionSheetOption,
                  { 
                    backgroundColor: option === 'Annuler' ? (isDark ? '#ff3333' : '#ff4444') : 'transparent',
                    borderTopColor: isDark ? '#444' : '#e0e0e0'
                  }
                ]}
                onPress={() => handleActionSheetOption(option)}
              >
                <Text style={[
                  styles.actionSheetOptionText,
                  { 
                    color: option === 'Annuler' ? '#fff' : (isDark ? '#fff' : '#000'),
                    fontWeight: option === 'Annuler' ? 'bold' : 'normal'
                  }
                ]}>
                  {option === 'Exporter dossier technique' && isExportingTechnicalDossier ? 'Export en cours...' : option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Technician Assignment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAssignmentModal}
        onRequestClose={() => setShowAssignmentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
              Affectation de plaque - {selectedBuildingForAction?.name}
            </Text>

            <ScrollView style={styles.techniciansList} showsVerticalScrollIndicator={false}>
              {technicians.map((technician: ApiTechnician) => (
                <TouchableOpacity
                  key={technician.id}
                  style={[
                    styles.technicianItem,
                    { 
                      backgroundColor: selectedTechnicians.includes(technician.id) 
                        ? '#007AFF' 
                        : (isDark ? '#333' : '#f0f0f0'),
                      borderColor: isDark ? '#444' : '#ddd'
                    }
                  ]}
                  onPress={() => {
                    if (selectedTechnicians.includes(technician.id)) {
                      setSelectedTechnicians([]);
                    } else {
                      setSelectedTechnicians([technician.id]);
                    }
                  }}
                >
                  <View style={styles.technicianInfo}>
                    <Text style={[
                      styles.technicianName,
                      { 
                        color: selectedTechnicians.includes(technician.id) 
                          ? '#fff' 
                          : (isDark ? '#fff' : '#000')
                      }
                    ]}>
                      {technician.name}
                    </Text>
                    <Text style={[
                      styles.technicianEmail,
                      { 
                        color: selectedTechnicians.includes(technician.id) 
                          ? '#ccc' 
                          : (isDark ? '#aaa' : '#666')
                      }
                    ]}>
                      {technician.email}
                    </Text>
                  </View>
                  <View style={[
                    styles.checkbox,
                    { 
                      backgroundColor: selectedTechnicians.includes(technician.id) 
                        ? '#fff' 
                        : 'transparent',
                      borderColor: selectedTechnicians.includes(technician.id) 
                        ? '#fff' 
                        : (isDark ? '#666' : '#ccc')
                    }
                  ]}>
                    {selectedTechnicians.includes(technician.id) && (
                      <Text style={styles.checkmark}>?</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                onPress={() => {
                  setShowAssignmentModal(false);
                  setSelectedTechnicians([]);
                }}
              >
                <Text style={[styles.buttonText, { color: isDark ? '#fff' : '#000' }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.submitButton, { backgroundColor: '#007AFF' }]}
                onPress={confirmAssignment}
                disabled={selectedTechnicians.length === 0}
              >
                <Text style={styles.submitButtonText}>Confirmer ({selectedTechnicians.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // ActionSheet styles
  actionSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  actionSheetContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionSheetOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  actionSheetOptionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  techniciansList: {
    maxHeight: 300,
  },
  technicianItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  technicianInfo: {
    flex: 1,
  },
  technicianName: {
    fontSize: 16,
    fontWeight: '600',
  },
  technicianEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    // backgroundColor will be set dynamically
  },
  submitButton: {
    // backgroundColor will be set dynamically
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
  // Archive mode styles
  archiveCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  archiveCheckmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  buildingTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archiveModeHeader: {
    padding: 15,
    margin: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  archiveModeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  archiveActions: {
    flexDirection: 'row',
    gap: 10,
  },
  archiveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelArchiveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  confirmArchiveButton: {
    backgroundColor: '#ff4444',
  },
  cancelArchiveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmArchiveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Assignment mode styles
  fixedAssignmentHeader: {
    padding: 15,
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 5,
    borderRadius: 10,
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#007AFF',
  },
  assignmentHeader: {
    padding: 15,
    margin: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  assignmentHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  techDropdownContainer: {
    width: '100%',
    marginBottom: 15,
  },
  techDropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 5,
  },
  techDropdownText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dropdownArrow: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  fixedTechDropdownList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    maxHeight: 200,
    marginBottom: 10,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  techDropdownList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    maxHeight: 200,
    marginBottom: 10,
  },
  techListScroll: {
    maxHeight: 180,
  },
  listContainer: {
    flex: 1,
  },
  zoneTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  zoneControlsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  zoneTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  zoneSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  searchInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 12,
  },
  filtersScroll: {
    marginTop: 10,
    alignSelf: 'stretch',
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  importModalContainer: {
    borderRadius: 15,
    padding: 20,
  },
  importHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  pickFileButton: {
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickFileButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  selectedFileName: {
    fontSize: 13,
    marginTop: 10,
  },
  importActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  importActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelImportButton: {
    backgroundColor: '#e2e8f0',
  },
  confirmImportButton: {
    backgroundColor: '#16a34a',
  },
  cancelImportText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  confirmImportText: {
    color: '#fff',
    fontWeight: '700',
  },
  techDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  techItemContent: {
    flex: 1,
  },
  techItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  techItemEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  techCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  techCheckmark: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  assignmentActions: {
    flexDirection: 'row',
    gap: 10,
  },
  assignmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelAssignmentButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  confirmAssignmentButton: {
    backgroundColor: '#28a745',
  },
  cancelAssignmentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmAssignmentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Building item styles
  buildingContent: {
    flex: 1,
  },
  buildingMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  buildingMenuButtonText: {
    fontSize: 22,
    fontWeight: '700',
  },
  buildingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  assignedTechContainer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  assignedTechName: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  buildingMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  buildingMetaPill: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#eef2f8',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buildingMetaLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  buildingMetaValue: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  assignedTechsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  assignedTechsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  accessDenied: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#ff444420',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  accessDeniedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // User info styles
  userInfo: {
    alignItems: 'flex-end',
  },
  userStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userRole: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  syncIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Original styles
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  list: {
    paddingBottom: 20,
  },
  buildingItem: {
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
  },
  buildingName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  buildingAddress: {
    fontSize: 10,
    marginTop: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
