import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function KmzMapWebScreen() {
  const router = useRouter();
  const { zone, buildingName } = useLocalSearchParams<{ zone?: string; buildingName?: string }>();

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#f8fafc', padding: 20, gap: 12 }}>
      <Text style={{ color: '#0f172a', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
        Carte KMZ disponible sur Android
      </Text>
      <Text style={{ color: '#64748b', fontSize: 15, textAlign: 'center' }}>
        Zone {zone || '-'}{buildingName ? ` - ${buildingName}` : ''}
      </Text>
      <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>
        La carte Google KMZ utilise un module natif et doit être ouverte dans l'app mobile.
      </Text>
      <Pressable
        onPress={() => router.back()}
        style={{ borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center', paddingVertical: 13 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Retour</Text>
      </Pressable>
    </View>
  );
}
