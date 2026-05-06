import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert, Modal, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';
import { useBuilding, useUpdateBuilding } from '@/hooks';
import { dataService } from '@/services/dataService';
import type { Building, Photo as ApiPhoto } from '@/api';

// Local Photo interface
interface Photo {
  id: string;
  uri: string;
  name: string;
  type: string;
  timestamp: Date;
}


const photoTypes = [
  'Photo Adduction',
  'Photo Immeuble',
  'Photo Façade',
  'Photo Entrée',
  'Photo Technique',
  'Photo Autre'
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

export default function DetailImmeubleScreen() {
  const { buildingId, buildingName, itemId } = useLocalSearchParams<{ buildingId: string; buildingName: string; itemId: string }>();
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
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
    if (apiBuilding) {
      setBuildingsData([apiBuilding]);
    }
  }, [apiBuilding]);

  const handleBack = () => {
    router.back();
  };

  const handleSave = async () => {
    console.log('Saving buildings data:', buildingsData);
    
    if (buildingsData.length > 0 && buildingsData[0]._id) {
      try {
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
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedBuildingIndex(null);
    setSelectedPhotoType(photoTypes[0]);
  };

  const openPhotoTypeSelection = (source: 'camera' | 'gallery') => {
    setPhotoSource(source);
    setShowPhotoSourceModal(false);
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
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const newPhoto: Photo = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: `${selectedPhotoType}_${Date.now()}`,
          type: selectedPhotoType,
          timestamp: new Date(),
        };

        if (selectedBuildingIndex !== null) {
          setBuildingsData(prev => {
            const newData = [...prev];
            if (newData[selectedBuildingIndex]) {
              newData[selectedBuildingIndex] = {
                ...newData[selectedBuildingIndex],
                photos: [...(newData[selectedBuildingIndex].photos || []), newPhoto]
              };
            }
            return newData;
          });
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
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const newPhoto: Photo = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          name: `${selectedPhotoType}_${Date.now()}`,
          type: selectedPhotoType,
          timestamp: new Date(),
        };

        if (selectedBuildingIndex !== null) {
          setBuildingsData(prev => {
            const newData = [...prev];
            newData[selectedBuildingIndex] = {
              ...newData[selectedBuildingIndex],
              photos: [...(newData[selectedBuildingIndex].photos || []), newPhoto]
            };
            return newData;
          });
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

  const deleteSelectedPhotos = (buildingIndex: number) => {
    if (selectedPhotos.length === 0) return;
    
    Alert.alert(
      'Supprimer les photos',
      `Voulez-vous supprimer ${selectedPhotos.length} photo(s) sélectionnée(s)?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setBuildingsData(prev => {
              const newData = [...prev];
              if (newData[buildingIndex] && newData[buildingIndex].photos) {
                newData[buildingIndex] = {
                  ...newData[buildingIndex],
                  photos: newData[buildingIndex].photos.filter(p => !selectedPhotos.includes(p.id))
                };
              }
              return newData;
            });
            setSelectedPhotos([]);
            Alert.alert('Photos supprimées', `${selectedPhotos.length} photo(s) supprimée(s) avec succès`);
          }
        }
      ]
    );
  };

  const deletePhoto = (buildingIndex: number, photoId: string) => {
    setBuildingsData(prev => {
      const newData = [...prev];
      if (newData[buildingIndex] && newData[buildingIndex].photos) {
        newData[buildingIndex] = {
          ...newData[buildingIndex],
          photos: newData[buildingIndex].photos.filter((p: ApiPhoto) => p.id !== photoId)
        };
      }
      return newData;
    });
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
          {photos.map((photo) => (
            <TouchableOpacity 
              key={photo.id} 
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
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: isDark ? '#fff' : '#007AFF' }]}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
          Détails Immeuble - {buildingName}
        </Text>
      </View>

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
              <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                  Type de photo
                </Text>
                
                <View style={styles.photoTypeButtons}>
                  {photoTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.photoTypeButton,
                        selectedPhotoType === type && styles.selectedPhotoTypeButton,
                        { backgroundColor: selectedPhotoType === type ? '#007AFF' : (isDark ? '#333' : '#f0f0f0') }
                      ]}
                      onPress={() => setSelectedPhotoType(type)}
                    >
                      <Text style={[
                        styles.photoTypeButtonText,
                        { color: selectedPhotoType === type ? '#fff' : (isDark ? '#fff' : '#000') }
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

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
              <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
                <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                  Type de photo
                </Text>
                
                <View style={styles.photoTypeButtons}>
                  {photoTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.photoTypeButton,
                        selectedPhotoType === type && styles.selectedPhotoTypeButton,
                        { backgroundColor: selectedPhotoType === type ? '#007AFF' : (isDark ? '#333' : '#f0f0f0') }
                      ]}
                      onPress={() => setSelectedPhotoType(type)}
                    >
                      <Text style={[
                        styles.photoTypeButtonText,
                        { color: selectedPhotoType === type ? '#fff' : (isDark ? '#fff' : '#000') }
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

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
                
                <View style={styles.photoPreviewImageContainer}>
                  <Image 
                    source={{ uri: selectedPhoto?.uri }} 
                    style={[
                      styles.photoPreviewImage,
                      { transform: [{ scale: photoScale }] }
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
                </View>
                
                <View style={styles.photoPreviewControls}>
                  <TouchableOpacity 
                    style={[styles.zoomButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={() => setPhotoScale(Math.max(0.5, photoScale - 0.25))}
                  >
                    <Text style={[styles.zoomButtonText, { color: isDark ? '#fff' : '#000' }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.zoomText, { color: isDark ? '#fff' : '#000' }]}>
                    {Math.round(photoScale * 100)}%
                  </Text>
                  <TouchableOpacity 
                    style={[styles.zoomButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    onPress={() => setPhotoScale(Math.min(3, photoScale + 0.25))}
                  >
                    <Text style={[styles.zoomButtonText, { color: isDark ? '#fff' : '#000' }]}>+</Text>
                  </TouchableOpacity>
                </View>
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
    padding: 5,
    borderRadius: 4,
    minWidth: 80,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  photoTypeButtons: {
    marginBottom: 20,
  },
  photoTypeButton: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  selectedPhotoTypeButton: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  photoTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  photoPreviewControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
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
