import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { Screen } from '@/components/screen';
import { useBuildings, useTechnicians } from '@/hooks';
import { dataService } from '@/services/dataService';
import { buildingsApi, kmzApi, routeOptiqueApi, zoneDocumentsApi, Technician as ApiTechnician } from '@/api';
import { useAuth } from '@/ctx';

type ZoneRow = { zone: string; label: string; count: number };
const CUSTOM_ZONES_KEY = 'custom_zones_v1';
const ARCHIVED_ZONES_KEY = 'archived_zones_v1';
const ZONE_IMPORT_FILES_KEY = 'zone_import_files_v1';
const ZONE_TECHNICIAN_ASSIGNMENTS_KEY = 'zone_technician_assignments_v1';
const FLOATING_BUTTON_SIZE = 62;

type ZoneImportKind = 'kmz' | 'routeOptiqueExcel' | 'planTirageFusionPdf';

type ZoneImportFile = {
  documentId?: string;
  zone: string;
  kind: ZoneImportKind;
  name: string;
  uri: string;
  importedAt: string;
};

type ZoneTechnicianAssignment = {
  zone: string;
  technicianIds: string[];
  assignedBy: string;
  assignedAt: Date;
};

type AuthPayload = {
  sub?: string;
  email?: string;
  role?: string;
};

const getZoneKey = (zone?: string) => {
  const raw = String(zone ?? '').trim();
  return raw || '__none__';
};

const getBuildingSearchText = (building: Record<string, unknown>) => (
  [
    building.zone,
    building.ville,
    building.codePostal,
    building.rueNomNom,
    building.numeroNomImmeuble,
    building.idImmeuble,
    building.idImmeubleSysteme,
  ]
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ')
);

const getUserPrimaryKey = (user: ApiTechnician) => String(user.id || user._id || user.email || '').trim();

const getUserIdentityKeys = (user: ApiTechnician) => (
  [user.id, user._id, user.email]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
);

const sanitizeFileName = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'document.pdf'
);

export default function SelectionScreen() {
  const router = useRouter();
  const screen = Dimensions.get('window');
  const { token } = useAuth();
  const { data: buildings = [], isLoading, isError, refetch } = useBuildings(undefined, { status: 'active' });
  const { data: allTechnicians = [], isLoading: isLoadingAllTechnicians } = useTechnicians({ status: 'all' });
  const { data: activeTechnicians = [], isLoading: isLoadingActiveTechnicians } = useTechnicians({ status: 'active' });
  const { data: inactiveTechnicians = [], isLoading: isLoadingInactiveTechnicians } = useTechnicians({ status: 'inactive' });
  const [customZones, setCustomZones] = useState<string[]>([]);
  const [archivedZones, setArchivedZones] = useState<string[]>([]);
  const [zoneAssignments, setZoneAssignments] = useState<ZoneTechnicianAssignment[]>([]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddZone, setShowAddZone] = useState(false);
  const [selectedMenuZone, setSelectedMenuZone] = useState<ZoneRow | null>(null);
  const [selectedAssignmentZone, setSelectedAssignmentZone] = useState<ZoneRow | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isAssigningZone, setIsAssigningZone] = useState(false);
  const [isImportingKmz, setIsImportingKmz] = useState(false);
  const [isImportingRouteOptique, setIsImportingRouteOptique] = useState(false);
  const [isImportingPlanPdf, setIsImportingPlanPdf] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const floatingButtonPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const floatingButtonOffset = useRef({ x: 0, y: 0 });
  const canManageZonesRef = useRef(false);

  const floatingButtonPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        floatingButtonPosition.setOffset(floatingButtonOffset.current);
        floatingButtonPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: floatingButtonPosition.x, dy: floatingButtonPosition.y }],
        { useNativeDriver: false },
      ),
      onPanResponderRelease: (_, gesture) => {
        const maxX = Math.max(0, screen.width - FLOATING_BUTTON_SIZE - 40);
        const maxY = Math.max(0, screen.height - FLOATING_BUTTON_SIZE - 130);
        const next = {
          x: Math.max(0, Math.min(maxX, floatingButtonOffset.current.x + gesture.dx)),
          y: Math.max(-maxY, Math.min(40, floatingButtonOffset.current.y + gesture.dy)),
        };

        floatingButtonPosition.flattenOffset();
        floatingButtonOffset.current = next;
        Animated.spring(floatingButtonPosition, {
          toValue: next,
          useNativeDriver: false,
          friction: 6,
          tension: 90,
        }).start();

        if (canManageZonesRef.current && Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
          setShowAddZone(true);
        }
      },
    }),
  ).current;

  const currentUser = useMemo<AuthPayload>(() => {
    if (!token) return {};
    try {
      return jwtDecode<AuthPayload>(token);
    } catch {
      return {};
    }
  }, [token]);

  const canManageZones = currentUser.role === 'manager';
  canManageZonesRef.current = canManageZones;

  const technicians = useMemo(() => {
    const byKey = new Map<string, ApiTechnician>();
    for (const user of [...allTechnicians, ...activeTechnicians, ...inactiveTechnicians]) {
      const key = getUserPrimaryKey(user);
      if (key) byKey.set(key, user);
    }
    return Array.from(byKey.values());
  }, [allTechnicians, activeTechnicians, inactiveTechnicians]);

  const isLoadingTechnicians = isLoadingAllTechnicians || isLoadingActiveTechnicians || isLoadingInactiveTechnicians;

  const assignableUsers = useMemo(
    () => technicians.filter((user: ApiTechnician) => user.role !== 'manager'),
    [technicians],
  );

  const getAssignedUsersForZone = (zoneKey: string) => {
    const assignment = zoneAssignments.find((item) => item.zone === zoneKey);
    if (!assignment) return [];

    return assignableUsers.filter((user) =>
      getUserIdentityKeys(user).some((key) => assignment.technicianIds.includes(key)),
    );
  };

  useEffect(() => {
    void dataService.loadFromStorage<string[]>(CUSTOM_ZONES_KEY).then((saved) => {
      if (Array.isArray(saved)) setCustomZones(saved);
    });
    void dataService.loadFromStorage<string[]>(ARCHIVED_ZONES_KEY).then((saved) => {
      if (Array.isArray(saved)) setArchivedZones(saved);
    });
    void dataService.loadFromStorage<ZoneTechnicianAssignment[]>(ZONE_TECHNICIAN_ASSIGNMENTS_KEY).then((saved) => {
      if (Array.isArray(saved)) setZoneAssignments(saved);
    });
  }, []);

  const zones: ZoneRow[] = useMemo(() => {
    const map = new Map<string, number>();
    const searchMap = new Map<string, string>();
    const normalizedSearch = searchQuery.trim().toLowerCase();

    for (const b of buildings) {
      const key = getZoneKey((b as { zone?: string }).zone);
      map.set(key, (map.get(key) ?? 0) + 1);
      searchMap.set(key, `${searchMap.get(key) ?? ''} ${getBuildingSearchText(b as unknown as Record<string, unknown>)}`);
    }
    for (const zone of customZones) {
      const key = zone.trim();
      if (key && !map.has(key)) map.set(key, 0);
      if (key && !searchMap.has(key)) searchMap.set(key, key.toLowerCase());
    }
    return Array.from(map.entries()).map(([zone, count]) => ({
      zone,
      count,
      label: zone === '__none__' ? 'Sans zone' : zone,
    }))
      .filter((z) => !archivedZones.includes(z.zone))
      .filter((z) => {
        if (currentUser.role !== 'technician' && currentUser.role !== 'supervisor') return true;
        const currentUserKeys = [currentUser.sub, currentUser.email].filter(Boolean) as string[];
        if (currentUserKeys.length === 0) return false;
        return zoneAssignments.some((assignment) =>
          assignment.zone === z.zone && currentUserKeys.some((key) => assignment.technicianIds.includes(key)),
        );
      })
      .filter((z) => {
        if (!normalizedSearch) return true;
        const text = `${z.label.toLowerCase()} ${searchMap.get(z.zone) ?? ''}`;
        return text.includes(normalizedSearch);
      })
      .sort((a, b) => sortDirection === 'asc' ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label));
  }, [buildings, customZones, archivedZones, currentUser.role, currentUser.sub, currentUser.email, zoneAssignments, searchQuery, sortDirection]);

  const openZone = (z: ZoneRow) => {
    const zoneParam = z.zone === '__none__' ? '' : z.zone;
    router.push({
      pathname: '/(app)/infoImmeuble',
      params: { zone: zoneParam, itemName: z.label },
    });
  };

  const importZone = (z: ZoneRow) => {
    if (!canManageZones) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent importer des données.');
      return;
    }
    const zoneParam = z.zone === '__none__' ? '' : z.zone;
    setSelectedMenuZone(null);
    router.push({
      pathname: '/(app)/infoImmeuble',
      params: { zone: zoneParam, itemName: z.label, importExcel: '1' },
    });
  };

  const openZoneAssignment = (z: ZoneRow) => {
    if (!canManageZones) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent modifier les affectations de zone.');
      return;
    }
    setSelectedMenuZone(null);
    setSelectedAssignmentZone(z);
    const existing = zoneAssignments.find((assignment) => assignment.zone === z.zone);
    setSelectedUserIds(
      assignableUsers
        .filter((user) => getUserIdentityKeys(user).some((key) => existing?.technicianIds.includes(key)))
        .map(getUserPrimaryKey),
    );
  };

  const assignZoneToTechnician = async () => {
    if (!canManageZones) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent modifier les affectations de zone.');
      return;
    }
    if (!selectedAssignmentZone) return;
    if (selectedUserIds.length === 0) {
      Alert.alert('Affectation', 'Veuillez sélectionner au moins un utilisateur.');
      return;
    }

    setIsAssigningZone(true);
    try {
      const savedAssignments = await dataService.loadFromStorage<ZoneTechnicianAssignment[]>(ZONE_TECHNICIAN_ASSIGNMENTS_KEY);
      const previous = Array.isArray(savedAssignments) ? savedAssignments : [];
      const selectedUsers = assignableUsers.filter((user) => selectedUserIds.includes(getUserPrimaryKey(user)));
      const selectedIdentityKeys = selectedUsers.flatMap(getUserIdentityKeys);
      const nextAssignment: ZoneTechnicianAssignment = {
        zone: selectedAssignmentZone.zone,
        technicianIds: Array.from(new Set(selectedIdentityKeys)),
        assignedBy: currentUser.sub ?? 'user1',
        assignedAt: new Date(),
      };
      const nextAssignments: ZoneTechnicianAssignment[] = [
        ...previous.filter((assignment) => assignment.zone !== selectedAssignmentZone.zone),
        nextAssignment,
      ];

      setZoneAssignments(nextAssignments);
      await dataService.saveToStorage(ZONE_TECHNICIAN_ASSIGNMENTS_KEY, nextAssignments);
      const assignedNames = selectedUsers.map((item: ApiTechnician) => item.name);
      setSelectedAssignmentZone(null);
      setSelectedUserIds([]);
      Alert.alert(
        'Affectation',
        `La zone "${selectedAssignmentZone.label}" sera visible pour ${assignedNames.join(', ') || 'les utilisateurs sélectionnés'}.`,
      );
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible d’affecter cette zone.');
    } finally {
      setIsAssigningZone(false);
    }
  };

  const importKmzToDatabase = async (z: ZoneRow) => {
    if (!canManageZones) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent importer des données.');
      return;
    }
    Alert.alert('Import KMZ en base', `Choisissez le fichier KMZ pour la zone "${z.label}".`);

    setIsImportingKmz(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.google-earth.kmz', 'application/zip', '*/*'],
        copyToCacheDirectory: true,
      });


      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const response = await kmzApi.importMobile(z.zone, {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
      });

      setSelectedMenuZone(null);
      Alert.alert(
        'KMZ stocké en base',
        `${response.data.fileName} importé dans MongoDB pour la zone "${z.label}".`,
      );
    } catch (error: any) {
      console.error('[KMZ_IMPORT][MOBILE] dedicated failed', {
        zone: z.zone,
        message: error?.message,
        error,
      });
      Alert.alert('Erreur KMZ', error?.message || 'Impossible d’importer le KMZ en base.');
    } finally {
      setIsImportingKmz(false);
    }
  };

  const pickZoneFile = async (z: ZoneRow, kind: ZoneImportKind) => {
    if (!canManageZones) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent importer des données.');
      return;
    }

    const config = {
      kmz: {
        title: 'KMZ',
        type: ['application/vnd.google-earth.kmz', 'application/zip', '*/*'],
      },
      routeOptiqueExcel: {
        title: 'Excel Route optique',
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/vnd.ms-excel.sheet.macroEnabled.12',
        ],
      },
      planTirageFusionPdf: {
        title: 'PDF plan Tirage et Fusion',
        type: ['application/pdf'],
      },
    }[kind];

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: config.type,
        copyToCacheDirectory: true,
        multiple: kind === 'planTirageFusionPdf',
      });


      if (result.canceled || !result.assets?.length) return;

      const selectedFiles = result.assets.slice(0, kind === 'planTirageFusionPdf' ? 10 : 1);
      const file = selectedFiles[0];

      if (kind === 'routeOptiqueExcel') {
        setIsImportingRouteOptique(true);
        const response = await routeOptiqueApi.importMobile(z.zone, {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
        });

        setSelectedMenuZone(null);
        Alert.alert(
          'Route optique importée',
          `${response.data.stored} élément${response.data.stored > 1 ? 's' : ''} stocké${response.data.stored > 1 ? 's' : ''} en base sur ${response.data.rows} ligne${response.data.rows > 1 ? 's' : ''} lue${response.data.rows > 1 ? 's' : ''}. Total zone : ${response.data.zoneTotal}. Feuilles : ${response.data.sheets.join(', ')}.`,
        );
        return;
      }

      if (kind === 'planTirageFusionPdf') {
        setIsImportingPlanPdf(true);
        const pdfDirectory = `${FileSystem.documentDirectory}zone-documents/`;
        await FileSystem.makeDirectoryAsync(pdfDirectory, { intermediates: true });
        const previous = await dataService.loadFromStorage<ZoneImportFile[]>(ZONE_IMPORT_FILES_KEY);

        const importedPdfFiles: ZoneImportFile[] = [];
        for (const selectedFile of selectedFiles) {
          const response = await zoneDocumentsApi.importPlanTirageFusionPdf(z.zone, {
            uri: selectedFile.uri,
            name: selectedFile.name,
            mimeType: selectedFile.mimeType,
          });
          const localPdfUri = `${pdfDirectory}${Date.now()}_${sanitizeFileName(selectedFile.name)}`;
          await FileSystem.copyAsync({ from: selectedFile.uri, to: localPdfUri });
          importedPdfFiles.push({
            documentId: response.data.documentId,
            zone: z.zone,
            kind,
            name: selectedFile.name,
            uri: localPdfUri,
            importedAt: new Date().toISOString(),
          });
        }

        const next: ZoneImportFile[] = [
          ...(Array.isArray(previous) ? previous : []),
          ...importedPdfFiles,
        ];
        await dataService.saveToStorage(ZONE_IMPORT_FILES_KEY, next);

        setSelectedMenuZone(null);
        Alert.alert(
          'PDF importé',
          `${importedPdfFiles.length} fichier${importedPdfFiles.length > 1 ? 's' : ''} PDF stocké${importedPdfFiles.length > 1 ? 's' : ''} en base et sauvegardé${importedPdfFiles.length > 1 ? 's' : ''} localement pour la zone "${z.label}".`,
        );
        return;
      }

      const previous = await dataService.loadFromStorage<ZoneImportFile[]>(ZONE_IMPORT_FILES_KEY);
      const next: ZoneImportFile[] = [
        ...(Array.isArray(previous) ? previous : []),
        {
          zone: z.zone,
          kind,
          name: file.name,
          uri: file.uri,
          importedAt: new Date().toISOString(),
        },
      ];

      await dataService.saveToStorage(ZONE_IMPORT_FILES_KEY, next);
      setSelectedMenuZone(null);
      Alert.alert('Import', `${config.title} ajouté pour la zone "${z.label}".`);
    } catch (error: any) {
      console.error('[ZONE_FILE_IMPORT][MOBILE] failed', {
        kind,
        zone: z.zone,
        message: error?.message,
        error,
      });
      Alert.alert('Erreur', error?.message || `Impossible d’importer ${config.title}.`);
    } finally {
      if (kind === 'kmz') setIsImportingKmz(false);
      if (kind === 'routeOptiqueExcel') setIsImportingRouteOptique(false);
      if (kind === 'planTirageFusionPdf') setIsImportingPlanPdf(false);
    }
  };

  const saveCustomZones = async (zonesToSave: string[]) => {
    setCustomZones(zonesToSave);
    await dataService.saveToStorage(CUSTOM_ZONES_KEY, zonesToSave);
  };

  const archiveZone = async (z: ZoneRow) => {
    if (!canManageZones) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent archiver une zone.');
      return;
    }
    Alert.alert('Archiver la zone', `Archiver la zone "${z.label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Archiver',
        style: 'destructive',
        onPress: async () => {
          setIsArchiving(true);
          try {
            const zoneBuildings = buildings.filter((building) => getZoneKey((building as { zone?: string }).zone) === z.zone);
            for (const building of zoneBuildings) {
              const id = building._id || building.idImmeuble;
              if (id) await buildingsApi.archive(id);
            }

            const nextArchived = Array.from(new Set([...archivedZones, z.zone]));
            setArchivedZones(nextArchived);
            await dataService.saveToStorage(ARCHIVED_ZONES_KEY, nextArchived);
            await saveCustomZones(customZones.filter((zone) => zone !== z.zone));
            await refetch();
            setSelectedMenuZone(null);
          } catch (error: any) {
            Alert.alert('Erreur', error?.message || 'Impossible d’archiver la zone.');
          } finally {
            setIsArchiving(false);
          }
        },
      },
    ]);
  };

  const addZone = async () => {
    if (!canManageZones) {
      Alert.alert('Accès refusé', 'Seuls les gestionnaires peuvent ajouter une zone.');
      setShowAddZone(false);
      return;
    }
    const name = newZoneName.trim();
    if (!name) {
      Alert.alert('Zone', 'Veuillez saisir le nom de la zone.');
      return;
    }

    const alreadyExists = zones.some((z) => z.zone.toLowerCase() === name.toLowerCase());
    if (alreadyExists) {
      Alert.alert('Zone', 'Cette zone existe déjà.');
      return;
    }

    await saveCustomZones([...customZones, name]);
    setNewZoneName('');
    setShowAddZone(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title="Zones" 
        titleStyle={{ textAlign: 'center' }}
        subtitle="Choisissez une zone pour voir ses immeubles"
        subtitleStyle={{ textAlign: 'center' }}
        loading={isLoading}
      >
      {isError ? (
        <Pressable
          onPress={() => refetch()}
          style={{ borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', padding: 14 }}
        >
          <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Impossible de charger les immeubles. Appuyez pour réessayer.</Text>
        </Pressable>
      ) : null}

      <View
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#cbd5e1',
          backgroundColor: '#fff',
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher par nom de zone ou adresse"
          placeholderTextColor="#94a3b8"
          style={{ color: '#0f172a', fontSize: 15, padding: 0 }}
        />
      </View>

      <Pressable
        onPress={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')}
        style={{ borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', padding: 12, alignItems: 'center', backgroundColor: '#fff' }}
      >
        <Text style={{ fontWeight: '700', color: '#334155' }}>
          Trier par nom : {sortDirection === 'asc' ? 'A → Z' : 'Z → A'}
        </Text>
      </Pressable>

      {!isLoading && zones.length === 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>
            {searchQuery.trim()
              ? 'Aucune zone ne correspond à cette recherche.'
              : 'Aucune zone détectée : il n’y a pas encore d’immeuble actif rattaché à une zone.'}
          </Text>
          <Pressable
            onPress={() => router.push('/(app)/dashboard')}
            style={{ borderRadius: 12, backgroundColor: '#e2e8f0', padding: 14, alignItems: 'center' }}
          >
            <Text style={{ fontWeight: '700', color: '#0f172a' }}>Voir le tableau de bord</Text>
          </Pressable>
        </View>
      ) : null}

      {zones.map((z) => (
        (() => {
          const assignedUsers = getAssignedUsersForZone(z.zone);
          return (
            <Pressable
              key={z.zone}
              onPress={() => openZone(z)}
              onLongPress={canManageZones ? () => setSelectedMenuZone(z) : undefined}
              delayLongPress={350}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                backgroundColor: '#fff',
                padding: 14,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#0f172a' }}>{z.label}</Text>
                  <Text style={{ fontSize: 13, color: '#64748b' }}>
                    {z.count} immeuble{z.count > 1 ? 's' : ''}
                  </Text>
                </View>
                {canManageZones ? (
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    setSelectedMenuZone(z);
                  }}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '700', color: '#334155' }}>⋮</Text>
                </Pressable>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {assignedUsers.length > 0 ? (
                  assignedUsers.map((user) => (
                    <View
                      key={getUserPrimaryKey(user)}
                      style={{ borderRadius: 999, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 5 }}
                    >
                      <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: '700' }}>
                        {user.name}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>
                    Aucun technicien/superviseur affecté
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })()
      ))}

      <Pressable
        onPress={() => router.push('/(app)/dashboard')}
        style={{ borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', padding: 14, alignItems: 'center' }}
      >
        <Text style={{ fontWeight: '600', color: '#334155' }}>Liste globale des immeubles</Text>
      </Pressable>

      <Modal visible={showAddZone && canManageZones} transparent animationType="fade" onRequestClose={() => setShowAddZone(false)}>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', padding: 20 }}>
          <View style={{ borderRadius: 16, backgroundColor: '#fff', padding: 18, gap: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>Ajouter une zone</Text>
            <TextInput
              value={newZoneName}
              onChangeText={setNewZoneName}
              placeholder="Nom de la zone"
              autoFocus
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: '#0f172a',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => {
                  setNewZoneName('');
                  setShowAddZone(false);
                }}
                style={{ flex: 1, borderRadius: 10, backgroundColor: '#e2e8f0', paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#0f172a', fontWeight: '700' }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={addZone}
                style={{ flex: 1, borderRadius: 10, backgroundColor: '#2563eb', paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedMenuZone} transparent animationType="fade" onRequestClose={() => setSelectedMenuZone(null)}>
        <Pressable
          onPress={() => setSelectedMenuZone(null)}
          style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', padding: 20 }}
        >
          <Pressable onPress={(event) => event.stopPropagation()} style={{ borderRadius: 16, backgroundColor: '#fff', padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>
              {selectedMenuZone?.label}
            </Text>
            <Pressable
              onPress={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')}
              style={{ borderRadius: 10, backgroundColor: '#f1f5f9', padding: 13 }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '700' }}>
                Trier par nom ({sortDirection === 'asc' ? 'A → Z' : 'Z → A'})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')}
              style={{ borderRadius: 10, backgroundColor: '#f1f5f9', padding: 13 }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '700' }}>
                Trier par nom ({sortDirection === 'asc' ? 'A → Z' : 'Z → A'})
              </Text>
            </Pressable>
            {canManageZones && selectedMenuZone ? (
              <Pressable
                onPress={() => importZone(selectedMenuZone)}
                style={{ borderRadius: 10, backgroundColor: '#2563eb', padding: 13 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Importer Excel immeubles</Text>
              </Pressable>
            ) : null}
            {canManageZones && selectedMenuZone ? (
              <Pressable
                onPress={() => openZoneAssignment(selectedMenuZone)}
                style={{ borderRadius: 10, backgroundColor: '#0284c7', padding: 13 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Affectation technicien/superviseur</Text>
              </Pressable>
            ) : null}
            {canManageZones && selectedMenuZone ? (
              <Pressable
                onPress={() => {
                  void importKmzToDatabase(selectedMenuZone);
                }}
                disabled={isImportingKmz}
                style={{ borderRadius: 10, backgroundColor: '#0f766e', padding: 13, opacity: isImportingKmz ? 0.6 : 1 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isImportingKmz ? 'Import KMZ en base...' : 'Importer KMZ en base'}
                </Text>
              </Pressable>
            ) : null}
            {canManageZones && selectedMenuZone ? (
              <Pressable
                onPress={() => pickZoneFile(selectedMenuZone, 'routeOptiqueExcel')}
                disabled={isImportingRouteOptique}
                style={{ borderRadius: 10, backgroundColor: '#7c3aed', padding: 13, opacity: isImportingRouteOptique ? 0.6 : 1 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isImportingRouteOptique ? 'Import Route optique...' : 'Importer Excel Route optique'}
                </Text>
              </Pressable>
            ) : null}
            {canManageZones && selectedMenuZone ? (
              <Pressable
                onPress={() => pickZoneFile(selectedMenuZone, 'planTirageFusionPdf')}
                disabled={isImportingPlanPdf}
                style={{ borderRadius: 10, backgroundColor: '#b45309', padding: 13, opacity: isImportingPlanPdf ? 0.6 : 1 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isImportingPlanPdf ? 'Import PDF...' : 'Importer PDF plan Tirage et Fusion'}
                </Text>
              </Pressable>
            ) : null}
            {canManageZones && selectedMenuZone ? (
              <Pressable
                onPress={() => archiveZone(selectedMenuZone)}
                disabled={isArchiving}
                style={{ borderRadius: 10, backgroundColor: '#dc2626', padding: 13, opacity: isArchiving ? 0.6 : 1 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isArchiving ? 'Archivage...' : 'Archiver cette zone'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setSelectedMenuZone(null)}
              style={{ borderRadius: 10, backgroundColor: '#e2e8f0', padding: 13, alignItems: 'center' }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '700' }}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!selectedAssignmentZone}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAssignmentZone(null)}
      >
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', padding: 20 }}>
          <View style={{ borderRadius: 16, backgroundColor: '#fff', padding: 16, gap: 12, maxHeight: '80%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>
              Affectation technicien/superviseur
            </Text>
            <Text style={{ color: '#64748b' }}>
              Zone : {selectedAssignmentZone?.label}
            </Text>

            {isLoadingTechnicians ? (
              <Text style={{ color: '#64748b' }}>Chargement des utilisateurs...</Text>
            ) : assignableUsers.length === 0 ? (
              <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Aucun technicien ou superviseur trouvé.</Text>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Pressable
                    onPress={() => setSelectedUserIds(assignableUsers.map(getUserPrimaryKey).filter(Boolean))}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#2563eb',
                      backgroundColor: '#2563eb',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Tous</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedUserIds([])}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      backgroundColor: '#fff',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginRight: 8,
                    }}
                  >
                    <Text style={{ color: '#334155', fontSize: 12, fontWeight: '700' }}>Effacer</Text>
                  </Pressable>
                  {assignableUsers.map((user: ApiTechnician) => {
                    const userId = getUserPrimaryKey(user);
                    const isSelected = selectedUserIds.includes(userId);
                    return (
                      <Pressable
                        key={userId}
                        onPress={() => {
                          setSelectedUserIds((current) =>
                            current.includes(userId)
                              ? current.filter((id) => id !== userId)
                              : [...current, userId],
                          );
                        }}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: isSelected ? '#2563eb' : '#cbd5e1',
                          backgroundColor: isSelected ? '#2563eb' : '#fff',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          marginRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#fff' : '#334155',
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          {isSelected ? '✓ ' : ''}{user.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={{ color: '#64748b', fontSize: 12 }}>
                  {selectedUserIds.length} utilisateur{selectedUserIds.length > 1 ? 's' : ''} sélectionné{selectedUserIds.length > 1 ? 's' : ''}
                </Text>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => {
                  setSelectedAssignmentZone(null);
                  setSelectedUserIds([]);
                }}
                style={{ flex: 1, borderRadius: 10, backgroundColor: '#e2e8f0', paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#0f172a', fontWeight: '700' }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={assignZoneToTechnician}
                disabled={isAssigningZone || isLoadingTechnicians || assignableUsers.length === 0}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  backgroundColor: '#2563eb',
                  paddingVertical: 12,
                  alignItems: 'center',
                  opacity: isAssigningZone || isLoadingTechnicians || assignableUsers.length === 0 ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isAssigningZone ? 'Affectation...' : 'Affecter'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </Screen>
      {canManageZones ? (
      <Animated.View
        {...floatingButtonPanResponder.panHandlers}
        style={[
          {
            position: 'absolute',
            left: 18,
            bottom: 35,
            width: FLOATING_BUTTON_SIZE,
            height: FLOATING_BUTTON_SIZE,
            borderRadius: FLOATING_BUTTON_SIZE / 2,
            backgroundColor: 'rgba(114, 125, 140, 0.26)',
            borderWidth: 5,
            borderColor: 'rgba(229, 233, 241, 0.92)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#f8fafc',
            shadowOpacity: 0.22,
            shadowRadius: 1,
            shadowOffset: { width: 0, height: 1 },
            elevation: 14,
            zIndex: 50,
          },
          { transform: floatingButtonPosition.getTranslateTransform() },
        ]}
      >
        <Text style={{ color: '#f8fafc', fontSize: 36, lineHeight: 40, fontWeight: '700', marginTop: -2 }}>+</Text>
      </Animated.View>
      ) : null}
    </View>
  );
}
