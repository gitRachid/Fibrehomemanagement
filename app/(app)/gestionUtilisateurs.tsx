import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useTechnicians, useCreateTechnician, useUpdateTechnician } from '@/hooks';
import { Technician } from '@/api';

type UserRole = 'technician' | 'supervisor' | 'manager';

interface UserFormData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'inactive';
  password?: string;
}

export default function GestionUtilisateursScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: apiTechnicians, isLoading: isLoadingTechs } = useTechnicians();
  const technicians: Technician[] = apiTechnicians || [];
  const createTechnician = useCreateTechnician();
  const updateTechnician = useUpdateTechnician();

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<Technician | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    id: '',
    name: '',
    email: '',
    phone: '',
    role: 'technician',
    status: 'active',
    password: '',
  });

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'technician',
      status: 'active',
      password: '',
    });
    setEditingUser(null);
  };

  const handleOpenForm = (user?: Technician) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role as UserRole,
        status: user.status as 'active' | 'inactive',
      });
    } else {
      resetForm();
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    resetForm();
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return false;
    }
    if (!formData.email.trim()) {
      Alert.alert('Erreur', 'L\'email est requis');
      return false;
    }
    if (!formData.email.includes('@')) {
      Alert.alert('Erreur', 'Email invalide');
      return false;
    }
    if (!editingUser && !formData.password?.trim()) {
      Alert.alert('Erreur', 'Le mot de passe est requis pour un nouvel utilisateur');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (editingUser && editingUser._id) {
        // Update existing user
        await updateTechnician.mutateAsync({
          id: editingUser._id,
          data: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: formData.role,
            status: formData.status,
          },
        });
        Alert.alert('Succès', 'Utilisateur mis à jour avec succès');
      } else {
        // Create new user
        const newUser = {
          id: formData.id || `user_${Date.now()}`,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          status: formData.status,
          password: formData.password,
        };
        await createTechnician.mutateAsync(newUser as Omit<Technician, '_id'> & { password: string });
        Alert.alert('Succès', 'Nouvel utilisateur créé avec succès');
      }
      handleCloseForm();
    } catch (error: any) {
      const errorMessage = error?.message || 'Une erreur est survenue lors de la sauvegarde';
      Alert.alert('Erreur', errorMessage);
      console.error('Save error:', error);
    }
  };

  const handleToggleStatus = async (user: Technician) => {
    if (!user._id) return;
    
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateTechnician.mutateAsync({
        id: user._id,
        data: { status: newStatus },
      });
      Alert.alert('Succès', `Utilisateur ${newStatus === 'active' ? 'activé' : 'désactivé'}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le statut');
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'manager':
        return 'Manager';
      case 'supervisor':
        return 'Superviseur';
      case 'technician':
        return 'Technicien';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'manager':
        return '#FF6B6B';
      case 'supervisor':
        return '#4ECDC4';
      case 'technician':
        return '#45B7D1';
      default:
        return '#999';
    }
  };

  const renderUserItem = ({ item }: { item: Technician }) => (
    <View style={[styles.userCard, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: isDark ? '#fff' : '#000' }]}>
          {item.name}
        </Text>
        <Text style={[styles.userEmail, { color: isDark ? '#aaa' : '#666' }]}>
          {item.email}
        </Text>
        {item.phone && (
          <Text style={[styles.userPhone, { color: isDark ? '#aaa' : '#666' }]}>
            {item.phone}
          </Text>
        )}
        <View style={styles.badgesRow}>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}>
            <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
              {getRoleLabel(item.role)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { 
            backgroundColor: item.status === 'active' ? '#28a74520' : '#dc354520' 
          }]}>
            <Text style={[styles.statusText, { 
              color: item.status === 'active' ? '#28a745' : '#dc3545' 
            }]}>
              {item.status === 'active' ? 'Actif' : 'Inactif'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
          onPress={() => handleOpenForm(item)}
        >
          <Text style={styles.actionButtonText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { 
            backgroundColor: item.status === 'active' ? '#dc3545' : '#28a745' 
          }]}
          onPress={() => handleToggleStatus(item)}
        >
          <Text style={styles.actionButtonText}>
            {item.status === 'active' ? 'Désactiver' : 'Activer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: isDark ? '#fff' : '#007AFF' }]}>
            ← Retour
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
          Gestion des Utilisateurs
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
          <Text style={[styles.statNumber, { color: isDark ? '#fff' : '#000' }]}>
            {technicians?.filter(t => t.role === 'technician').length || 0}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#aaa' : '#666' }]}>
            Techniciens
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
          <Text style={[styles.statNumber, { color: isDark ? '#fff' : '#000' }]}>
            {technicians?.filter(t => t.role === 'supervisor').length || 0}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#aaa' : '#666' }]}>
            Superviseurs
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
          <Text style={[styles.statNumber, { color: isDark ? '#fff' : '#000' }]}>
            {technicians?.filter(t => t.status === 'active').length || 0}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#aaa' : '#666' }]}>
            Actifs
          </Text>
        </View>
      </View>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => handleOpenForm()}
      >
        <Text style={styles.addButtonText}>+ Nouvel Utilisateur</Text>
      </TouchableOpacity>

      {/* Users List */}
      {isLoadingTechs ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : (
        <FlatList
          data={technicians}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Form Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseForm}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#2c2c2c' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#000' }]}>
                {editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
              </Text>
              <TouchableOpacity onPress={handleCloseForm}>
                <Text style={[styles.closeButton, { color: isDark ? '#fff' : '#000' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ID Field (only for new users) */}
              {!editingUser && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
                    ID Utilisateur (optionnel)
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0',
                      color: isDark ? '#fff' : '#000'
                    }]}
                    value={formData.id}
                    onChangeText={(text) => setFormData({ ...formData, id: text })}
                    placeholder="Généré automatiquement si vide"
                    placeholderTextColor={isDark ? '#888' : '#999'}
                  />
                </View>
              )}

              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
                  Nom complet *
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0',
                    color: isDark ? '#fff' : '#000'
                  }]}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Ex: Jean Dupont"
                  placeholderTextColor={isDark ? '#888' : '#999'}
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
                  Email *
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0',
                    color: isDark ? '#fff' : '#000'
                  }]}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="exemple@email.com"
                  placeholderTextColor={isDark ? '#888' : '#999'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Phone */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
                  Téléphone
                </Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0',
                    color: isDark ? '#fff' : '#000'
                  }]}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Ex: 06 12 34 56 78"
                  placeholderTextColor={isDark ? '#888' : '#999'}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Password (only for new users) */}
              {!editingUser && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
                    Mot de passe *
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0',
                      color: isDark ? '#fff' : '#000'
                    }]}
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    placeholder="Min. 6 caractères"
                    placeholderTextColor={isDark ? '#888' : '#999'}
                    secureTextEntry
                  />
                </View>
              )}

              {/* Role */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
                  Rôle *
                </Text>
                <View style={styles.roleSelector}>
                  {(['technician', 'supervisor', 'manager'] as UserRole[]).map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        { backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0' },
                        formData.role === role && [styles.roleOptionSelected, { 
                          backgroundColor: getRoleColor(role) + '30',
                          borderColor: getRoleColor(role)
                        }],
                      ]}
                      onPress={() => setFormData({ ...formData, role })}
                    >
                      <View style={[styles.roleDot, { backgroundColor: getRoleColor(role) }]} />
                      <Text style={[
                        styles.roleOptionText,
                        { color: isDark ? '#fff' : '#000' },
                        formData.role === role && { color: getRoleColor(role), fontWeight: '600' }
                      ]}>
                        {getRoleLabel(role)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Status */}
              {editingUser && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: isDark ? '#fff' : '#000' }]}>
                    Statut
                  </Text>
                  <View style={styles.statusSelector}>
                    <TouchableOpacity
                      style={[
                        styles.statusOption,
                        { backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0' },
                        formData.status === 'active' && [styles.statusOptionSelected, { 
                          backgroundColor: '#28a74530',
                          borderColor: '#28a745'
                        }],
                      ]}
                      onPress={() => setFormData({ ...formData, status: 'active' })}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        { color: isDark ? '#fff' : '#000' },
                        formData.status === 'active' && { color: '#28a745', fontWeight: '600' }
                      ]}>
                        Actif
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.statusOption,
                        { backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0' },
                        formData.status === 'inactive' && [styles.statusOptionSelected, { 
                          backgroundColor: '#dc354530',
                          borderColor: '#dc3545'
                        }],
                      ]}
                      onPress={() => setFormData({ ...formData, status: 'inactive' })}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        { color: isDark ? '#fff' : '#000' },
                        formData.status === 'inactive' && { color: '#dc3545', fontWeight: '600' }
                      ]}>
                        Inactif
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, { 
                  opacity: createTechnician.isPending || updateTechnician.isPending ? 0.7 : 1 
                }]}
                onPress={handleSave}
                disabled={createTechnician.isPending || updateTechnician.isPending}
              >
                {createTechnician.isPending || updateTechnician.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingUser ? 'Mettre à jour' : 'Créer Utilisateur'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#007AFF',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13,
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  userActions: {
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 15,
  },
  roleSelector: {
    gap: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleOptionSelected: {
    borderWidth: 2,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  roleOptionText: {
    fontSize: 15,
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusOptionSelected: {
    borderWidth: 2,
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
