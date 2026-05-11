import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBuildings } from '@/hooks';
import { Screen } from '@/components/screen';
import { useOfflineStore } from '@/store/offline-store';

export default function DashboardScreen() {
  const router = useRouter();
  const { data: buildings = [], isLoading, isError, refetch } = useBuildings(undefined, { status: 'active' });
  const { isOnline, pendingCount, syncPendingChanges } = useOfflineStore();
  const [searchQuery, setSearchQuery] = useState('');
  const filteredBuildings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return buildings;
    return buildings.filter((building: any) => (
      [
        building.idImmeuble,
        building.rueNomNom,
        building.ville,
        building.codePostal,
        building.zone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));
  }, [buildings, searchQuery]);

  return (
    <Screen
      title="Accueil"
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: isOnline ? '#16a34a' : '#dc2626' }}>{isOnline ? 'En ligne' : 'Hors ligne'}</Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>{pendingCount} en attente sync</Text>
        </View>
      }
      sticky={
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 12, gap: 10 }}>
          <Pressable
            onPress={() => router.push('/(app)/selection')}
            style={{ borderRadius: 12, backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Zones / services</Text>
          </Pressable>

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
              Immeubles actifs{!isLoading ? ` (${filteredBuildings.length}/${buildings.length})` : ''}
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
          <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Impossible de charger les immeubles. Touchez pour réessayer.</Text>
        </Pressable>
      ) : null}
      {isLoading ? <ActivityIndicator color="#2563eb" style={{ paddingVertical: 16 }} /> : null}
      {!isLoading &&
        filteredBuildings.map((building: any) => (
        <Pressable
          key={building._id || building.idImmeuble}
          onPress={() => router.push({
            pathname: '/(app)/detailImmeuble',
            params: {
              buildingId: building._id || building.id || building.idImmeuble,
              buildingName: building.idImmeuble || building.rueNomNom || 'Immeuble',
            },
          })}
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
