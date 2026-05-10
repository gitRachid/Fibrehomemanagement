import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBuildings } from '@/hooks';
import { Screen } from '@/components/screen';
import { useOfflineStore } from '@/store/offline-store';

export default function DashboardScreen() {
  const router = useRouter();
  const { data: buildings = [], isLoading, isError, refetch } = useBuildings(undefined, { status: 'active' });
  const { isOnline, pendingCount, syncPendingChanges } = useOfflineStore();

  return (
    <Screen
      title="Accueil"
      subtitle="Inventaire terrain et interventions"
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: isOnline ? '#16a34a' : '#dc2626' }}>{isOnline ? 'En ligne' : 'Hors ligne'}</Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>{pendingCount} en attente sync</Text>
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

      <View style={{ marginTop: 8, gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>
          Immeubles actifs{!isLoading ? ` (${buildings.length})` : ''}
        </Text>
        {isLoading ? (
          <ActivityIndicator color="#2563eb" style={{ paddingVertical: 16 }} />
        ) : null}
      </View>
      {!isLoading &&
        buildings.map((building: any) => (
        <View
          key={building._id || building.idImmeuble}
          style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 14, gap: 5 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>{building.idImmeuble}</Text>
          <Text style={{ fontSize: 14, color: '#334155' }}>{building.rueNomNom}</Text>
          <Text style={{ fontSize: 13, color: '#64748b' }}>
            {building.ville} - {building.codePostal}
          </Text>
        </View>
        ))}
    </Screen>
  );
}
