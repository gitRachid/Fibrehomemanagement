import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { buildingsApi, type Building, type BuildingStatus } from '@/api';
import { apiListField } from '@/api/client';
import type { BuildingsResponse } from '@/api/buildings';
import { Screen } from '@/components/screen';
import { useAuth } from '@/ctx';
import { useBuildingStatuses } from '@/hooks';
import { useOfflineStore } from '@/store/offline-store';

const BUILDINGS_QUERY_ROOT = 'buildings';
const DASHBOARD_FETCH_LIMIT = 200;

const FALLBACK_STATUSES: BuildingStatus[] = [
  { value: 'active', label: 'Actif', color: '#16a34a' },
  { value: 'pending', label: 'En attente', color: '#f59e0b' },
  { value: 'archived', label: 'Archivé', color: '#dc2626' },
  { value: 'inactive', label: 'Inactif', color: '#64748b' },
];

function immeublesHeadingForStatus(value: string, label: string): string {
  switch (value) {
    case 'active':
      return 'Immeubles actifs';
    case 'archived':
      return 'Immeubles archivés';
    case 'pending':
      return 'Immeubles en attente';
    case 'inactive':
      return 'Immeubles inactifs';
    default:
      return `Immeubles — ${label}`;
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline, pendingCount, syncPendingChanges } = useOfflineStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const { data: apiStatuses = [] } = useBuildingStatuses();
  const statusOptions = useMemo(() => {
    const list = apiStatuses.length > 0 ? apiStatuses : FALLBACK_STATUSES;
    const role = user?.role;
    return list.filter((s) => !s.managerOnly || role === 'manager');
  }, [apiStatuses, user?.role]);

  const selectedStatusMeta = useMemo(
    () => statusOptions.find((s) => s.value === statusFilter) ?? FALLBACK_STATUSES[0],
    [statusOptions, statusFilter],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [BUILDINGS_QUERY_ROOT, undefined, { status: statusFilter, limit: DASHBOARD_FETCH_LIMIT }],
    queryFn: async () => {
      const response = (await buildingsApi.getAll({
        status: statusFilter,
        limit: DASHBOARD_FETCH_LIMIT,
        page: 1,
      })) as BuildingsResponse;
      const list = apiListField(response) as Building[];
      return { list, total: typeof response.count === 'number' ? response.count : list.length };
    },
  });

  const buildings = data?.list ?? [];
  const totalForStatus = data?.total ?? 0;

  const filteredBuildings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return buildings;
    return buildings.filter((building: Building) =>
      [building.idImmeuble, building.rueNomNom, building.ville, building.codePostal, building.zone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [buildings, searchQuery]);

  const countLabel = !isLoading ? ` (${filteredBuildings.length}/${totalForStatus})` : '';

  return (
    <Screen
      title="Accueil"
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: isOnline ? '#16a34a' : '#dc2626' }}>
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>{pendingCount} en attente sync</Text>
        </View>
      }
      sticky={
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 12, gap: 10 }}>
          <Pressable
            onPress={() => setStatusMenuOpen(true)}
            style={{
              borderRadius: 12,
              backgroundColor: '#2563eb',
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            accessibilityRole="button"
            accessibilityLabel="Choisir l'état des immeubles à afficher"
          >
            <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }} numberOfLines={1}>
              État : {selectedStatusMeta.label}
            </Text>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, marginLeft: 8 }}>▼</Text>
          </Pressable>

          <Modal
            visible={statusMenuOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setStatusMenuOpen(false)}
          >
            <View style={{ flex: 1 }}>
              <Pressable
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15,23,42,0.45)' }]}
                onPress={() => setStatusMenuOpen(false)}
              />
              <View style={{ flex: 1, justifyContent: 'center', padding: 24 }} pointerEvents="box-none">
                <View
                  style={{
                    borderRadius: 16,
                    backgroundColor: '#fff',
                    maxHeight: '72%',
                    paddingVertical: 8,
                    overflow: 'hidden',
                  }}
                >
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', paddingHorizontal: 16, paddingVertical: 12 }}>
                  État des immeubles
                </Text>
                <FlatList
                  data={statusOptions}
                  keyExtractor={(item) => item.value}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        setStatusFilter(item.value);
                        setStatusMenuOpen(false);
                      }}
                      style={{
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        backgroundColor: item.value === statusFilter ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: item.color || '#64748b',
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: item.value === statusFilter ? '700' : '500',
                            color: '#0f172a',
                            flex: 1,
                          }}
                        >
                          {item.label}
                        </Text>
                        {item.value === statusFilter ? <Text style={{ color: '#2563eb', fontWeight: '700' }}>✓</Text> : null}
                      </View>
                    </Pressable>
                  )}
                />
                </View>
              </View>
            </View>
          </Modal>

          {!isOnline && pendingCount > 0 ? (
            <Pressable onPress={syncPendingChanges} style={{ borderRadius: 12, backgroundColor: '#e0e7ff', padding: 14 }}>
              <Text style={{ color: '#1d4ed8', fontWeight: '600' }}>Synchroniser les changements</Text>
            </Pressable>
          ) : null}

          <View style={{ gap: 8 }}>
            <View
              style={{
                borderRadius: 12,
                backgroundColor: '#ecfeff',
                borderWidth: 1,
                borderColor: '#67e8f9',
                paddingHorizontal: 12,
                paddingVertical: 10,
                width: '100%',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0e7490', textAlign: 'center' }}>
                {immeublesHeadingForStatus(selectedStatusMeta.value, selectedStatusMeta.label)}
                {countLabel}
              </Text>
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher par ID, rue, ville, code postal..."
              placeholderTextColor="#94a3b8"
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
              }}
            />
          </View>
        </View>
      }
    >
      {isError ? (
        <Pressable
          onPress={() => refetch()}
          style={{ borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', padding: 14 }}
        >
          <Text style={{ color: '#b91c1c', fontWeight: '600' }}>
            Impossible de charger les immeubles. Touchez pour réessayer.
          </Text>
        </Pressable>
      ) : null}
      {isLoading ? <ActivityIndicator color="#2563eb" style={{ paddingVertical: 16 }} /> : null}
      {!isLoading &&
        filteredBuildings.map((building: Building) => (
          <Pressable
            key={building._id || building.idImmeuble}
            onPress={() =>
              router.push({
                pathname: '/(app)/detailImmeuble',
                params: {
                  buildingId: building._id || (building as { id?: string }).id || building.idImmeuble,
                  buildingName: building.idImmeuble || building.rueNomNom || 'Immeuble',
                },
              })
            }
            style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 14, gap: 5 }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{building.idImmeuble}</Text>
            <Text style={{ fontSize: 14, color: '#334155' }}>{building.rueNomNom}</Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              {building.ville} - {building.codePostal}
            </Text>
          </Pressable>
        ))}
      {!isLoading && filteredBuildings.length === 0 ? (
        <Text style={{ color: '#64748b', textAlign: 'center', paddingVertical: 16 }}>Aucun immeuble trouvé.</Text>
      ) : null}
    </Screen>
  );
}
