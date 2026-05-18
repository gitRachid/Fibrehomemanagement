import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/ctx';
import { View, ActivityIndicator, Text } from 'react-native';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while auth state is being determined
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <Text style={{ color, fontSize: focused ? size + 2 : size }}>⌂</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="selection"
        options={{
          title: 'Zones',
          tabBarIcon: ({ color, size, focused }) => (
            <Text style={{ color, fontSize: focused ? size + 2 : size }}>⌖</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Text style={{ color, fontSize: focused ? size + 2 : size }}>⚙</Text>
          ),
        }}
      />
      <Tabs.Screen name="detailImmeuble" options={{ href: null }} />
      <Tabs.Screen name="infoImmeuble" options={{ href: null }} />
      <Tabs.Screen name="kmzMap" options={{ href: null }} />
      <Tabs.Screen name="gestionUtilisateurs" options={{ href: null }} />
    </Tabs>
  );
}