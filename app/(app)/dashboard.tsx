import { Pressable, Text, View } from 'react-native';
import { useBuildings } from '@/hooks';
import { Screen } from '@/components/screen';
import { useOfflineStore } from '@/store/offline-store';

export default function DashboardScreen() {
  const { data: buildings = [], isLoading, isError, refetch } = useBuildings(undefined, { status: 'active' });
  const { isOnline, pendingCount, syncPendingChanges } = useOfflineStore();

  return (
    <Screen
      title="Buildings"
      subtitle="Field inventory and current interventions"
      right={
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: isOnline ? '#16a34a' : '#dc2626' }}>{isOnline ? 'Online' : 'Offline'}</Text>
          <Text style={{ fontSize: 12, color: '#64748b' }}>{pendingCount} pending sync</Text>
        </View>
      }
      loading={isLoading}
    >
      {isError ? (
        <Pressable
          onPress={() => refetch()}
          style={{ borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', padding: 14 }}
        >
          <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Unable to load buildings. Tap to retry.</Text>
        </Pressable>
      ) : null}
      {!isOnline && pendingCount > 0 ? (
        <Pressable onPress={syncPendingChanges} style={{ borderRadius: 12, backgroundColor: '#e0e7ff', padding: 14 }}>
          <Text style={{ color: '#1d4ed8', fontWeight: '600' }}>Sync pending changes</Text>
        </Pressable>
      ) : null}
      {buildings.map((building: any) => (
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
