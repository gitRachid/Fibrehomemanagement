import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/screen';
import { useAuth } from '@/ctx';
import { useOfflineStore } from '@/store/offline-store';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, token, user } = useAuth();
  const { isOnline, pendingCount, syncPendingChanges, initNetworkListener } = useOfflineStore();
  const isManager = user?.role === 'manager';

  useEffect(() => {
    const unsubscribe = initNetworkListener();
    return unsubscribe;
  }, [initNetworkListener]);

  return (
    <Screen title="Paramètres"     
        titleStyle={{ textAlign: 'center' }}
        subtitle="Contrôles de session et de synchronisation"
        subtitleStyle={{ textAlign: 'center' }}>
      <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', padding: 14, gap: 8 }}>
        <Text style={{ color: '#0f172a', fontWeight: '600' }}>Session</Text>
        <Text style={{ color: '#64748b', fontSize: 13 }}>Token loaded: {token ? 'Yes' : 'No'}</Text>
        <Text style={{ color: isOnline ? '#16a34a' : '#dc2626', fontSize: 13 }}>Connectivity: {isOnline ? 'Online' : 'Offline'}</Text>
        <Text style={{ color: '#64748b', fontSize: 13 }}>Pending operations: {pendingCount}</Text>
      </View>
      <Pressable onPress={syncPendingChanges} style={{ borderRadius: 12, backgroundColor: '#0ea5e9', alignItems: 'center', paddingVertical: 12 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Sync now</Text>
      </Pressable>
      {isManager ? (
        <Pressable
          onPress={() => router.push('/(app)/gestionUtilisateurs')}
          style={{ borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>👥 Gestion utilisateurs</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={async () => {
          await logout();
          router.replace('/');
        }}
        style={{ borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center', paddingVertical: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Se déconnecter</Text>
      </Pressable>
    </Screen>
  );
}
