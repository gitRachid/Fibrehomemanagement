import { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  loading?: boolean;
  children: ReactNode;
};

export function Screen({ title, subtitle, right, loading, children }: Props) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f5f7fb' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
    >
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#e2e8f0',
          backgroundColor: '#ffffff',
          padding: 16,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#0f172a' }}>{title}</Text>
            {subtitle ? <Text style={{ fontSize: 14, color: '#475569' }}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      </View>
      {loading ? <ActivityIndicator color="#2563eb" size="large" style={{ marginTop: 24 }} /> : children}
    </ScrollView>
  );
}
