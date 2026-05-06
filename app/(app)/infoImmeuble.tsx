import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert, RefreshControl, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useBuildings, useTechnicians, useCreateAssignment, useBulkCreateAssignments } from '@/hooks';
import { dataService } from '@/services/dataService';
import { Building as ApiBuilding, Technician as ApiTechnician } from '@/api';

// Local Building interface mapped from API
interface Building {
  id: string;
  _id?: string;
  name: string;
  address: string;
  serviceId: string;
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
  const { itemId, itemName } = useLocalSearchParams<{ itemId: string; itemName: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Debug logging
  useEffect(() => {
    console.log('[INFO_IMMEUBLE] Params received:', { itemId, itemName });
  }, [itemId, itemName]);

  // Role management state
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user1',
    name: 'Manager Test',
    role: 'manager',
    email: 'manager@test.com'
  });
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

  const { data: apiBuildings, isLoading, refetch } = useBuildings(itemId, { status: 'active' });
  
  // Map API buildings to local format
  const data: Building[] | undefined = apiBuildings?.map((b: ApiBuilding) => ({
    id: b._id || b.idImmeuble,
    _id: b._id,
    name: `${b.idImmeuble} - ${b.rueNomNom} ${b.numeroNomImmeuble}`,
    address: `${b.rueNomNom}, ${b.codePostal} ${b.ville}`,
    serviceId: b.serviceId,
    idImmeuble: b.idImmeuble,
    rueNomNom: b.rueNomNom,
    numeroNomImmeuble: b.numeroNomImmeuble,
  }));

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
        console.log('Assignments synced to backend:', assignments);
      } else {
        setSyncStatus('pending');
      }
    } catch (error) {
      console.error('Error syncing to backend:', error);
      setSyncStatus('pending');
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
    router.back();
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

  const handleActionSheetOption = (option: string) => {
    setShowActionSheet(false);
    
    switch (option) {
      case 'Détails':
        router.push({
          pathname: '/(app)/detailImmeuble',
          params: { 
            buildingId: selectedBuildingForAction?.id, 
            buildingName: selectedBuildingForAction?.name,
            itemId: itemId
          }
        });
        break;
      case 'Export':
        Alert.alert('Export', `Exportation de l'immeuble: ${selectedBuildingForAction?.name}`);
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
              console.log('Archiving buildings:', selectedBuildingsForArchive);
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

  const confirmAssignment = () => {
    if (selectedBuildingsForArchive.length > 0 && selectedTechnicians.length === 1) {
      const selectedTechnician = technicians.find(t => t.id === selectedTechnicians[0]);
      
      selectedBuildingsForArchive.forEach(buildingId => {
        const newAssignment: ItemAssignment = {
          itemId: buildingId,
          technicianIds: [selectedTechnicians[0]],
          assignedBy: currentUser.id,
          assignedAt: new Date()
        };
        
        setBuildingAssignments(prev => {
          const filtered = prev.filter(a => a.itemId !== buildingId);
          return [...filtered, newAssignment];
        });
      });
      
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

  const handleBuildingPress = (building: Building) => {
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
      
      setBuildingAssignments(prev => {
        const filtered = prev.filter(a => a.itemId !== building.id);
        const updated = [...filtered, newAssignment];
        // Save to local storage immediately
        saveAssignmentsToLocal(updated);
        return updated;
      });
      
      // Silent assignment - no success alert
    } else if (canAccessBuilding(building)) {
      router.push({
        pathname: '/(app)/detailImmeuble',
        params: { 
          buildingId: building.id, 
          buildingName: building.name,
          itemId: itemId
        }
      });
    }
  };

  const renderBuilding = ({ item }: { item: Building }) => {
    const assignedTechs = getAssignedTechnicians(item.id);
    const isSelectedForArchive = selectedBuildingsForArchive.includes(item.id);
    
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
              <Text style={[styles.buildingName, { color: isDark ? '#fff' : '#000' }]}>
                {item.name}
              </Text>
            </View>
          </View>
          <Text style={[styles.buildingAddress, { color: isDark ? '#ccc' : '#666' }]}>
            {item.address}
          </Text>
          
          {/* Display assigned technician at the bottom */}
          {assignedTechs.length > 0 && (
            <View style={styles.assignedTechContainer}>
              <Text style={[styles.assignedTechName, { color: '#007AFF' }]}>
                {assignedTechs[0].name}
              </Text>
            </View>
          )}
          
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
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <View style={styles.header}>
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
          <Text style={[styles.userName, { color: isDark ? '#fff' : '#000' }]}>
            {currentUser.name}
          </Text>
        </View>
        
        {/* User Management Button for Managers */}
        {currentUser.role === 'manager' && (
          <TouchableOpacity 
            style={styles.userManageButton}
            onPress={() => router.push('/(app)/gestionUtilisateurs')}
          >
            <Text style={styles.userManageButtonText}>👥</Text>
          </TouchableOpacity>
        )}
      </View>
      
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
          {renderHeader()}
          <FlatList
            data={data}
            renderItem={renderBuilding}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: isDark ? '#ccc' : '#666' }]}>
                  Aucun immeuble trouvé pour ce service
                </Text>
              </View>
            }
          />
        </View>
      )}

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

            {['Détails', 'Export', 'Affectation de plaque', 'Choix Qualifica', 'Archive', 'Annuler'].map((option, index) => (
              <TouchableOpacity
                key={option}
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
                  {option}
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
  userName: {
    fontSize: 14,
    fontWeight: '500',
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
  userManageButton: {
    padding: 8,
    backgroundColor: '#007AFF20',
    borderRadius: 20,
    marginLeft: 12,
  },
  userManageButtonText: {
    fontSize: 20,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  buildingAddress: {
    fontSize: 14,
    marginTop: 5,
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
