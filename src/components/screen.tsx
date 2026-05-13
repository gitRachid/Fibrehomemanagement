import { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, TextStyle, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  sticky?: ReactNode;
  loading?: boolean;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  children: ReactNode;
};

export function Screen({ title, subtitle, right, sticky, loading, titleStyle, subtitleStyle, children }: Props) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f5f7fb' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
      stickyHeaderIndices={sticky ? [1] : undefined}
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
            <Text style={[{ fontSize: 22, fontWeight: '700', color: '#0f172a' }, titleStyle]}>{title}</Text>
            {subtitle ? <Text style={[{ fontSize: 14, color: '#475569' }, subtitleStyle]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      </View>
      {sticky ? <View style={{ backgroundColor: '#f5f7fb', paddingBottom: 2 }}>{sticky}</View> : null}
      {loading ? <ActivityIndicator color="#2563eb" size="large" style={{ marginTop: 24 }} /> : children}
    </ScrollView>
  );
}
