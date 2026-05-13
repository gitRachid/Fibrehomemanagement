import React, { useMemo, useState } from 'react';

import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert, ScrollView } from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import * as DocumentPicker from 'expo-document-picker';

import * as FileSystem from 'expo-file-system/legacy';

import * as XLSX from 'xlsx';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useColorScheme } from 'react-native';

import { buildingsApi } from '../../src/api/buildings';
import { useAuth } from '@/ctx';



interface Building {

  id: string;

  name: string;

  address: string;

}



interface Item {

  id: string;

  name: string;

  description: string;

}



type UserRole = 'manager' | 'supervisor' | 'technician';



interface User {

  id: string;

  name: string;

  role: UserRole;

  email: string;

  assignedItems?: string[];

}



interface Technician {

  id: string;

  name: string;

  email: string;

}



interface ItemAssignment {

  itemId: string;

  technicianIds: string[];

  assignedBy: string;

  assignedAt: Date;

}



export default function DetailsScreen() {

  const { service, serviceName } = useLocalSearchParams<{ service: string; serviceName?: string }>();


  const router = useRouter();

  const queryClient = useQueryClient();

  const colorScheme = useColorScheme();

  const isDark = colorScheme === 'dark';
  const { user } = useAuth();



  const currentUser = useMemo<User>(() => ({

    id: user?.id || user?.sub || 'user1',

    name: user?.name || user?.email || 'Utilisateur',

    role: user?.role || 'technician',

    email: user?.email || ''

  }), [user]);

  const [technicians, setTechnicians] = useState<Technician[]>([

    { id: 'tech1', name: 'Technicien Alpha', email: 'alpha@test.com' },

    { id: 'tech2', name: 'Technicien Beta', email: 'beta@test.com' },

    { id: 'tech3', name: 'Technicien Gamma', email: 'gamma@test.com' },

    { id: 'tech4', name: 'Technicien Delta', email: 'delta@test.com' },

    { id: 'tech5', name: 'Technicien Epsilon', email: 'epsilon@test.com' },

    { id: 'tech6', name: 'Technicien Zeta', email: 'zeta@test.com' },

    { id: 'tech7', name: 'Technicien Eta', email: 'eta@test.com' },

    { id: 'tech8', name: 'Technicien Theta', email: 'theta@test.com' },

    { id: 'tech9', name: 'Technicien Iota', email: 'iota@test.com' },

    { id: 'tech10', name: 'Technicien Kappa', email: 'kappa@test.com' }

  ]);

  const [showActionSheet, setShowActionSheet] = useState(false);

  const [selectedItemForAction, setSelectedItemForAction] = useState<Item | null>(null);

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);

  const [itemAssignments, setItemAssignments] = useState<ItemAssignment[]>([]);

  const [isArchiveMode, setIsArchiveMode] = useState(false);

  const [selectedItemsForArchive, setSelectedItemsForArchive] = useState<string[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);

  const [newItemName, setNewItemName] = useState('');

  const [newItemDescription, setNewItemDescription] = useState('');

  const [showImportModal, setShowImportModal] = useState(false);

  const [importFilePath, setImportFilePath] = useState('');

  const [isImporting, setIsImporting] = useState(false);



  const { data, isLoading, refetch, isRefetching } = useQuery({

    queryKey: ['serviceData', service],

    queryFn: async () => {

      await new Promise(resolve => setTimeout(resolve, 1000));

      return Array.from({ length: 20 }, (_, index) => ({

        id: (index + 1).toString(),

        name: `Item ${index + 1} for ${service}`,

        description: `Description ${index + 1} - This is a detailed description for item ${index + 1} with more content to test scrolling performance and layout stability.`

      })) as Item[];

    },

  });



  const handleBack = () => {

    router.push('/(app)/selection');

  };



  // Role management functions

  const canAccessItem = (item: Item): boolean => {

    if (currentUser.role === 'manager' || currentUser.role === 'supervisor') {

      return true;

    }

    if (currentUser.role === 'technician' && currentUser.assignedItems) {

      return currentUser.assignedItems.includes(item.id);

    }

    return false;

  };



  const handleItemLongPress = (item: Item) => {

    if (currentUser.role === 'manager') {

      setSelectedItemForAction(item);

      setShowActionSheet(true);

    }

  };



  const handleActionSheetOption = (option: string) => {

    setShowActionSheet(false);

    

    switch (option) {

      case 'Détails':


        if (!selectedItemForAction?.id) {

          console.error('[DETAILS] Error: selectedItemForAction.id is undefined!');

          Alert.alert('Erreur', 'Aucun item sélectionné');

          return;

        }

        router.push({

          pathname: '/(app)/infoImmeuble',

          params: { itemId: selectedItemForAction.id, itemName: selectedItemForAction.name }

        });

        break;

      case 'Export':

        Alert.alert('Export', `Exportation de l'item: ${selectedItemForAction?.name}`);

        break;

      case 'Affectation de plaque':

        setShowAssignmentModal(true);

        break;

      case 'Choix Qualifica':

        Alert.alert('Qualification', 'Choix de qualification');

        break;

      case 'Archive':

        setIsArchiveMode(true);

        break;

      case 'Import d\'immeuble':

        setShowImportModal(true);

        break;

      case 'Annuler':

        // Do nothing

        break;

    }

  };

  const handleImportBuilding = async () => {

    if (!importFilePath.trim()) {

      Alert.alert('Erreur', 'Veuillez sélectionner un fichier Excel');

      return;

    }
    setIsImporting(true);

    try {


      // Read the Excel file

      const fileContent = await FileSystem.readAsStringAsync(importFilePath, {

        encoding: 'base64'

      });



      // Parse Excel

      const workbook = XLSX.read(fileContent, { type: 'base64' });


      const firstSheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[firstSheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });



      if (jsonData.length < 2) {

        Alert.alert('Erreur', 'Le fichier Excel est vide ou invalide');

        setIsImporting(false);

        return;

      }


      // Get headers from first row

      const headers = jsonData[0] as string[];



      // Map Excel columns to Building fields

      const buildings = [];

      for (let i = 1; i < jsonData.length; i++) {

        const row = jsonData[i] as any[];

        if (row.length === 0) continue; // Skip empty rows

        

        const building: any = {

          serviceId: service,

          status: 'active'

        };

        

        if (i === 1) {


        }

        

        // Map each column

        headers.forEach((header: string, index: number) => {

          const value = row[index] !== undefined ? String(row[index]).trim() : '';

          

          switch (header.trim()) {

            case 'ID Immeuble':

            case 'ID_Immeuble':

              building.idImmeuble = value;

              break;

            case 'ID Immeuble Système':

            case 'ID_Immeuble Systeme':

            case 'ID Immeuble Systeme':

              building.idImmeubleSysteme = value;

              break;

            case 'Ville':

              building.ville = value;

              break;

            case 'Code postal':

              building.codePostal = value;

              break;

            case 'Longitude':

            case 'Lonngitude':

              building.longitude = value;

              break;

            case 'Latitude':

              building.latitude = value;

              break;

            case 'Rue Non.& Nonm':

              building.rueNomNom = value;

              break;

            case 'Rue Nom':

              if (!building.rueNomNom) building.rueNomNom = value;

              break;

            case 'N°/Nonm  Immeuble':

              building.numeroNomImmeuble = value;

              break;

            case 'N° Immeuble':

              if (!building.numeroNomImmeuble) building.numeroNomImmeuble = value;

              break;

            case 'Utilisation Immeuble':

              building.utilisationImmeuble = value;

              break;

            case 'Nbre Etages':

              building.nbreEtages = value;

              break;

            case 'Sous Sol':

              building.sousSol = value;

              break;

            case 'sous sol-commun':

              building.sousSolCommun = value;

              break;

            case 'Solution de raccordement':

              building.solutionRaccordement = value;

              break;

            case 'Nbr B2B':

              building.nbrB2B = value;

              break;

            case 'Nbr B2C':

              building.nbrB2C = value;

              break;

            case 'Total Clients':

              building.totalClients = value;

              break;

            case 'Chemin de fibre':

              building.cheminFibrePBO1 = value;

              break;

            case 'Chemin de fibre\tPBO1':

            case 'Chemin de fibre PBO1':

              building.cheminFibrePBO1 = value;

              break;

            case 'PBO1':

              // This column contains the PBO1 identifier

              if (!building.cheminFibrePBO1) {

                building.cheminFibrePBO1 = value;

              }

              break;

            case 'Floor':

              if (!building.floorPBO1) {

                building.floorPBO1 = value;

              } else {

                building.floorPBO2 = value;

              }

              break;

            case 'Type PBO1':

            case 'Type PBO1 ': // avec espace

              building.typePBO1 = value;

              break;

            case 'PBO2':

              building.PBO2 = value;

              break;

            case 'TYPE PBO2':

            case 'Type PBO2':

              building.typePBO2 = value;

              break;

            case 'SYNDIC':

              building.syndic = value;

              break;

            case 'Num Syndic':

              building.numSyndic = value;

              break;

            case 'Remarques':

              building.remarques = value;

              break;

            case 'Typologie habitat':

              building.typologieHabitat = value;

              break;

            case 'Verticalité':

              building.verticalite = value;

              break;

            case 'CSP':

              building.csp = value;

              break;

          }

        });

        

        // Validate required fields

        if (building.idImmeuble && building.idImmeubleSysteme && building.ville) {

          buildings.push(building);


        } else {


        }

      }

      


      

      if (buildings.length === 0) {

        Alert.alert('Erreur', 'Aucun immeuble valide trouvé dans le fichier');

        setIsImporting(false);

        return;

      }

      

      // Create buildings via API

      let successCount = 0;

      let errorCount = 0;

      const errors: string[] = [];

      


      

      for (const building of buildings) {

        try {


          await buildingsApi.create(building);

          successCount++;


        } catch (error: any) {

          errorCount++;

          const errorMsg = error.message || error.response?.data?.message || 'Erreur API';


          

          if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') || errorMsg.includes('exists')) {

            errors.push(`${building.idImmeuble}: déjà existe`);

          } else if (errorMsg.includes('required') || errorMsg.includes('manquant')) {

            errors.push(`${building.idImmeuble}: champ manquant`);

          } else {

            errors.push(`${building.idImmeuble}: ${errorMsg}`);

          }

        }

      }

      


      

      // Show result and navigate to building list

      const message = `${successCount} immeuble(s) importé(s) avec succès${errorCount > 0 ? `\n${errorCount} erreur(s)` : ''}`;

      

      Alert.alert(

        'Résultat de l\'import',

        message,

        [

          {

            text: 'Voir les immeubles',

            onPress: async () => {

              setShowImportModal(false);

              setImportFilePath('');

              // Invalidate cache to refresh buildings list

              await queryClient.invalidateQueries({ queryKey: ['buildings'] });


              // Navigate to infoImmeuble to see the list

              router.push({

                pathname: '/(app)/infoImmeuble',

                params: { 

                  itemId: service,

                  itemName: serviceName || `Service ${service}`

                }

              });

            }

          },

          {

            text: 'Fermer',

            style: 'cancel',

            onPress: () => {

              setShowImportModal(false);

              setImportFilePath('');

            }

          }

        ]

      );

    } catch (error) {

      console.error('Import error:', error);

      Alert.alert('Erreur', 'Échec de l\'importation du fichier Excel: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));

    } finally {

      setIsImporting(false);

    }

  };

  const handlePickExcelFile = async () => {

    try {

      const result = await DocumentPicker.getDocumentAsync({

        type: [

          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          'application/vnd.ms-excel',

          'application/vnd.ms-excel.sheet.macroEnabled.12'

        ],

        copyToCacheDirectory: true

      });

      

      if (result.canceled === false && result.assets && result.assets.length > 0) {

        const file = result.assets[0];

        setImportFilePath(file.uri);

      }

    } catch (error) {

      Alert.alert('Erreur', 'Impossible de sélectionner le fichier');

    }

  };



  const toggleArchiveSelection = (itemId: string) => {

    setSelectedItemsForArchive(prev => 

      prev.includes(itemId) 

        ? prev.filter(id => id !== itemId)

        : [...prev, itemId]

    );

  };



  const confirmArchive = () => {

    if (selectedItemsForArchive.length > 0) {

      Alert.alert(

        'Archivage',

        `Archiver ${selectedItemsForArchive.length} item(s) ?`,

        [

          { text: 'Annuler', style: 'cancel' },

          { 

            text: 'Archiver', 

            style: 'destructive',

            onPress: () => {


              setSelectedItemsForArchive([]);

              setIsArchiveMode(false);

              Alert.alert('Succès', `${selectedItemsForArchive.length} item(s) archivé(s)`);

            }

          }

        ]

      );

    }

  };



  const cancelArchiveMode = () => {

    setSelectedItemsForArchive([]);

    setIsArchiveMode(false);

  };



  const toggleTechnicianSelection = (technicianId: string) => {

    setSelectedTechnicians(prev => 

      prev.includes(technicianId) 

        ? prev.filter(id => id !== technicianId)

        : [...prev, technicianId]

    );

  };



  const confirmAssignment = () => {

    if (selectedItemForAction && selectedTechnicians.length > 0) {

      const newAssignment: ItemAssignment = {

        itemId: selectedItemForAction.id,

        technicianIds: selectedTechnicians,

        assignedBy: currentUser.id,

        assignedAt: new Date()

      };

      

      setItemAssignments(prev => {

        const filtered = prev.filter(a => a.itemId !== selectedItemForAction!.id);

        return [...filtered, newAssignment];

      });

      

      setShowAssignmentModal(false);

      setSelectedTechnicians([]);

      Alert.alert('Succès', 'Affectation réalisée avec succès');

    }

  };



  const handleAddItem = () => {

    if (newItemName.trim() === '') {

      Alert.alert('Erreur', 'Veuillez entrer un nom pour l\'item');

      return;

    }

    

    const newItem: Item = {

      id: Date.now().toString(),

      name: newItemName.trim(),

      description: newItemDescription.trim() || 'Aucune description'

    };

    

    // Add to data (in a real app, this would be an API call)

    data?.push(newItem);

    

    setShowAddModal(false);

    setNewItemName('');

    setNewItemDescription('');

    Alert.alert('Succès', 'Item ajouté avec succès');

  };



  const getAssignedTechnicians = (itemId: string): Technician[] => {

    const assignment = itemAssignments.find(a => a.itemId === itemId);

    if (!assignment) return [];

    return technicians.filter(tech => assignment.technicianIds.includes(tech.id));

  };



  const renderItem = ({ item }: { item: Item }) => {

    const assignedTechs = getAssignedTechnicians(item.id);

    const isSelectedForArchive = selectedItemsForArchive.includes(item.id);

    

    return (

      <TouchableOpacity 

        style={[

          styles.item, 

          { 

            backgroundColor: isSelectedForArchive 

              ? '#007AFF20' 

              : (isDark ? '#333' : '#f9f9f9'),

            opacity: canAccessItem(item) ? 1 : 0.5,

            borderWidth: isSelectedForArchive ? 2 : 0,

            borderColor: isSelectedForArchive ? '#007AFF' : 'transparent'

          }

        ]}

        onPress={() => {


          if (isArchiveMode) {

            toggleArchiveSelection(item.id);

          } else if (canAccessItem(item)) {


            router.push({

              pathname: '/(app)/infoImmeuble',

              params: { itemId: item.id, itemName: item.name }

            });

          } else {


          }

        }}

        onLongPress={() => !isArchiveMode && handleItemLongPress(item)}

        delayLongPress={500}

      >

        <View style={styles.itemContent}>

          <View style={styles.itemHeader}>

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

          </View>

          <View style={styles.itemTitleContainer}>

            <Text style={[styles.itemTitle, { color: isDark ? '#fff' : '#000' }]}>

              {item.name}

            </Text>

          </View>

          <Text style={[styles.itemDesc, { color: isDark ? '#ccc' : '#666' }]}>

            {item.description}

          </Text>

          {/* Display assigned technicians */}

          {assignedTechs.length > 0 && (

            <View style={styles.assignedTechsContainer}>

              <Text style={[styles.assignedTechsTitle, { color: isDark ? '#fff' : '#000' }]}>

                Techniciens: {assignedTechs.map(t => t.name).join(', ')}

              </Text>

            </View>

          )}

          {/* User role indicator */}

          {currentUser.role === 'technician' && !canAccessItem(item) && (

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

          <Text style={[styles.backText, { color: isDark ? '#fff' : '#007AFF' }]}>Retour aux services</Text>

        </TouchableOpacity>

        <View style={styles.userInfo}>

          <Text style={[styles.userRole, { color: isDark ? '#ccc' : '#666' }]}>

            {currentUser.role === 'manager' ? 'Manager' : currentUser.role === 'supervisor' ? 'Superviseur' : 'Technicien'}

          </Text>

          <Text style={[styles.userName, { color: isDark ? '#fff' : '#000' }]}>

            {currentUser.name}

          </Text>

        </View>

      </View>

      

      {/* Archive Mode Header */}

      {isArchiveMode && currentUser.role === 'manager' && (

        <View style={[styles.archiveModeHeader, { backgroundColor: '#007AFF' }]}>

          <Text style={styles.archiveModeText}>

            Mode Archive - Sélectionnez les items à archiver ({selectedItemsForArchive.length})

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

                { opacity: selectedItemsForArchive.length > 0 ? 1 : 0.5 }

              ]} 

              onPress={confirmArchive}

              disabled={selectedItemsForArchive.length === 0}

            >

              <Text style={styles.confirmArchiveText}>

                Archiver ({selectedItemsForArchive.length})

              </Text>

            </TouchableOpacity>

          </View>

        </View>

      )}

      

      {isLoading ? (

        <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center' }} />

      ) : (

        <FlatList

          data={data}

          renderItem={renderItem}

          keyExtractor={(item) => item.id}

          refreshControl={

            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />

          }

          contentContainerStyle={styles.list}

        />

      )}



      {/* Floating Action Button for adding items */}

      <TouchableOpacity

        style={[

          styles.fabButton,

          { backgroundColor: '#007AFF' }

        ]}

        onPress={() => setShowAddModal(true)}

      >

        <Text style={styles.fabButtonText}>+</Text>

      </TouchableOpacity>

      

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

              Actions - {selectedItemForAction?.name}

            </Text>



            {['Détails', 'Export', 'Import d\'immeuble', 'Affectation de plaque', 'Choix Qualifica', 'Archive', 'Annuler'].map((option, index) => (

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



      {/* Import Building Modal */}

      <Modal

        animationType="slide"

        transparent={true}

        visible={showImportModal}

        onRequestClose={() => {

          setShowImportModal(false);

          setImportFilePath('');

        }}

      >

        <View style={styles.modalOverlay}>

          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>

            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>

              Import d'immeuble

            </Text>



            <Text style={[styles.importDescription, { color: isDark ? '#ccc' : '#666' }]}>

              Sélectionnez un fichier Excel (.xlsx, .xls) à importer

            </Text>



            <TouchableOpacity

              style={[

                styles.filePickerButton,

                {

                  backgroundColor: isDark ? '#333' : '#f0f0f0',

                  borderColor: isDark ? '#555' : '#ddd'

                }

              ]}

              onPress={handlePickExcelFile}

              disabled={isImporting}

            >

              <Text style={[styles.filePickerButtonText, { color: isDark ? '#fff' : '#007AFF' }]}>

                📁 Choisir un fichier Excel

              </Text>

            </TouchableOpacity>



            {importFilePath ? (

              <View style={styles.selectedFileContainer}>

                <Text style={[styles.selectedFileLabel, { color: isDark ? '#aaa' : '#666' }]}>

                  Fichier sélectionné:

                </Text>

                <Text style={[styles.selectedFilePath, { color: isDark ? '#fff' : '#000' }]} numberOfLines={2}>

                  {importFilePath.split('/').pop()}

                </Text>

              </View>

            ) : null}



            <View style={styles.modalButtons}>

              <TouchableOpacity

                style={[styles.button, styles.cancelButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}

                onPress={() => {

                  setShowImportModal(false);

                  setImportFilePath('');

                }}

                disabled={isImporting}

              >

                <Text style={[styles.buttonText, { color: isDark ? '#fff' : '#000' }]}>Annuler</Text>

              </TouchableOpacity>

              <TouchableOpacity

                style={[styles.button, styles.submitButton, { backgroundColor: '#28a745', opacity: isImporting ? 0.7 : 1 }]}

                onPress={handleImportBuilding}

                disabled={isImporting}

              >

                {isImporting ? (

                  <ActivityIndicator color="#fff" size="small" />

                ) : (

                  <Text style={styles.submitButtonText}>Importer</Text>

                )}

              </TouchableOpacity>

            </View>

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

              Affectation de plaque - {selectedItemForAction?.name}

            </Text>



            <ScrollView style={styles.techniciansList} showsVerticalScrollIndicator={false}>

              {technicians.map(technician => (

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

                  onPress={() => toggleTechnicianSelection(technician.id)}

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

                      <Text style={styles.checkmark}>✓</Text>

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



      {/* Add Item Modal */}

      <Modal

        animationType="slide"

        transparent={true}

        visible={showAddModal}

        onRequestClose={() => setShowAddModal(false)}

      >

        <View style={styles.modalOverlay}>

          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>

            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>

              Ajouter un nouvel item

            </Text>

            

            <TextInput

              style={[styles.input, { 

                backgroundColor: isDark ? '#333' : '#f0f0f0',

                color: isDark ? '#fff' : '#000',

                borderColor: isDark ? '#444' : '#ddd'

              }]}

              placeholder="Nom de l'item"

              placeholderTextColor={isDark ? '#888' : '#666'}

              value={newItemName}

              onChangeText={setNewItemName}

            />

            

            <TextInput

              style={[styles.input, { 

                backgroundColor: isDark ? '#333' : '#f0f0f0',

                color: isDark ? '#fff' : '#000',

                borderColor: isDark ? '#444' : '#ddd',

                height: 80

              }]}

              placeholder="Description (optionnelle)"

              placeholderTextColor={isDark ? '#888' : '#666'}

              value={newItemDescription}

              onChangeText={setNewItemDescription}

              multiline={true}

              numberOfLines={3}

            />

            

            <View style={styles.modalButtons}>

              <TouchableOpacity

                style={[styles.button, styles.cancelButton, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}

                onPress={() => {

                  setShowAddModal(false);

                  setNewItemName('');

                  setNewItemDescription('');

                }}

              >

                <Text style={[styles.buttonText, { color: isDark ? '#fff' : '#000' }]}>Annuler</Text>

              </TouchableOpacity>

              <TouchableOpacity

                style={[styles.button, styles.submitButton, { backgroundColor: '#007AFF' }]}

                onPress={handleAddItem}

              >

                <Text style={styles.submitButtonText}>Ajouter</Text>

              </TouchableOpacity>

            </View>

          </View>

        </View>

      </Modal>

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

    justifyContent: 'space-between',

    marginBottom: 20,

  },

  backButton: {

    paddingVertical: 10,

    paddingHorizontal: 14,

  },

  backText: {

    fontSize: 16,

    fontWeight: '600',

  },

  userInfo: {

    alignItems: 'flex-end',

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

  roleInfo: {

    padding: 12,

    borderRadius: 8,

    marginBottom: 15,

    alignItems: 'center',

  },

  roleInfoText: {

    color: '#fff',

    fontSize: 14,

    fontWeight: '600',

    textAlign: 'center',

  },

  list: {

    paddingBottom: 20,

  },

  item: {

    padding: 15,

    marginVertical: 5,

    borderRadius: 10,

  },

  itemContent: {

    flex: 1,

  },

  itemHeader: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginBottom: 5,

  },

  longPressHint: {

    fontSize: 16,

    opacity: 0.6,

  },

  itemTitle: {

    fontSize: 18,

    fontWeight: 'bold',

    flex: 1,

  },

  itemDesc: {

    fontSize: 14,

    marginTop: 5,

  },

  assignedTechsContainer: {

    marginTop: 10,

    paddingTop: 8,

    borderTopWidth: 1,

    borderTopColor: '#e0e0e0',

  },

  assignedTechsTitle: {

    fontSize: 12,

    fontWeight: '600',

    color: '#666',

  },

  accessDenied: {

    marginTop: 8,

    padding: 6,

    backgroundColor: '#ff4444',

    borderRadius: 4,

    alignItems: 'center',

  },

  accessDeniedText: {

    color: '#fff',

    fontSize: 12,

    fontWeight: '600',

  },

  // ActionSheet styles

  actionSheetOverlay: {

    flex: 1,

    justifyContent: 'flex-end',

    backgroundColor: 'rgba(0, 0, 0, 0.5)',

  },

  actionSheetContainer: {

    borderTopLeftRadius: 20,

    borderTopRightRadius: 20,

    paddingTop: 10,

    paddingBottom: 30,

  },

  actionSheetHandle: {

    width: 40,

    height: 4,

    backgroundColor: '#ccc',

    borderRadius: 2,

    alignSelf: 'center',

    marginBottom: 20,

  },

  actionSheetTitle: {

    fontSize: 16,

    fontWeight: '600',

    textAlign: 'center',

    marginBottom: 20,

    paddingHorizontal: 20,

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

  // Assignment modal styles

  modalOverlay: {

    flex: 1,

    justifyContent: 'center',

    backgroundColor: 'rgba(0, 0, 0, 0.5)',

    padding: 20,

  },

  modalContent: {

    borderRadius: 15,

    padding: 20,

    maxHeight: '80%',

  },

  modalTitle: {

    fontSize: 18,

    fontWeight: '600',

    marginBottom: 20,

    textAlign: 'center',

  },

  input: {

    borderWidth: 1,

    borderRadius: 10,

    padding: 12,

    marginBottom: 15,

    fontSize: 16,

  },

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

  modalButtons: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    gap: 10,

  },

  button: {

    flex: 1,

    padding: 15,

    borderRadius: 10,

    alignItems: 'center',

  },

  cancelButton: {

    // backgroundColor handled inline

  },

  submitButton: {

    // backgroundColor handled inline

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

  itemTitleContainer: {

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

  // FAB Button styles

  fabButton: {

    position: 'absolute',

    bottom: 70,

    right: 25,

    width: 60,

    height: 60,

    borderRadius: 30,

    justifyContent: 'center',

    alignItems: 'center',

    elevation: 5,

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.25,

    shadowRadius: 4,

    zIndex: 100,

  },

  fabButtonText: {

    fontSize: 32,

    fontWeight: 'bold',

    color: '#fff',

    lineHeight: 36,

  },

  // Import modal styles

  importDescription: {

    fontSize: 14,

    marginBottom: 20,

    textAlign: 'center',

    lineHeight: 20,

  },

  importInput: {

    width: '100%',

    paddingHorizontal: 12,

    paddingVertical: 12,

    borderRadius: 8,

    borderWidth: 1,

    fontSize: 14,

    marginBottom: 20,

  },

  filePickerButton: {

    width: '100%',

    paddingVertical: 15,

    paddingHorizontal: 20,

    borderRadius: 10,

    borderWidth: 1,

    borderStyle: 'dashed',

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 15,

  },

  filePickerButtonText: {

    fontSize: 16,

    fontWeight: '600',

  },

  selectedFileContainer: {

    width: '100%',

    padding: 12,

    backgroundColor: 'rgba(0, 122, 255, 0.1)',

    borderRadius: 8,

    marginBottom: 20,

  },

  selectedFileLabel: {

    fontSize: 12,

    marginBottom: 4,

  },

  selectedFilePath: {

    fontSize: 14,

    fontWeight: '500',

  },

});