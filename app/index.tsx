import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AppTextInput } from '@/components/app-text-input';
import { authApi } from '@/api';
import { API_BASE_URL } from '@/api/client';
import { useAuth } from '@/ctx';

export default function SignInScreen() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const logoRotation = useRef(new Animated.Value(0)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; generic?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiStatus, setApiStatus] = useState('');

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(logoRotation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoRotation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [logoRotation]);

  const logoRotateY = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (isAuthenticated) return <Redirect href="/(app)/selection" />;

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!email.includes('@')) nextErrors.email = 'Veuillez saisir une adresse e-mail valide';
    if (password.length < 6) nextErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const response = await authApi.login(email.trim().toLowerCase(), password);
      const token = response.data?.token;
      if (!token) throw new Error('Aucun jeton reçu depuis l’API');
      await login(token);
      router.replace('/(app)/selection');
    } catch (error: any) {
      setErrors({ generic: error?.message || 'Échec de connexion. Vérifiez vos identifiants.' });
    } finally {
      setSubmitting(false);
    }
  };

  const testApiConnection = async () => {
    setApiStatus('Test API...');
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const text = await response.text();
      setApiStatus(`API ${response.status}: ${API_BASE_URL} ${text.slice(0, 60)}`);
    } catch (error: any) {
      setApiStatus(`Erreur API: ${API_BASE_URL} - ${error?.message || 'Network request failed'}`);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#eef2f8', padding: 20 }}>
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: '#dbe2ef', backgroundColor: '#fff', padding: 20, gap: 14 }}>
        <Animated.Image
          source={require('../assets/icon-original-wide.png')}
          resizeMode="contain"
          style={{
            alignSelf: 'center',
            width: '100%',
            height: 90,
            transform: [{ perspective: 1000 }, { rotateY: logoRotateY }],
          }}
        />
        <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', textAlign: 'center' }}>Suivi technicien terrain</Text>
        <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 30, textAlign: 'center' }}>Connexion</Text>
        <Text style={{ color: '#64748b', fontSize: 14 }}>
          Accédez au suivi opérationnel et aux affectations. Les comptes sont créés par un gestionnaire après connexion.
        </Text>

        <AppTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="nom@entreprise.com"
          keyboardType="email-address"
          error={errors.email}
        />
        <AppTextInput
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="Saisissez votre mot de passe"
          secureTextEntry
          error={errors.password}
        />

        {errors.generic ? <Text style={{ color: '#dc2626', fontSize: 13 }}>{errors.generic}</Text> : null}
        {apiStatus ? <Text style={{ color: apiStatus.startsWith('API 200') ? '#16a34a' : '#dc2626', fontSize: 12 }}>{apiStatus}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={{ backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Se connecter</Text>}
        </Pressable>
        <Pressable
          onPress={testApiConnection}
          style={{ borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', paddingVertical: 11 }}
        >
          <Text style={{ color: '#0f172a', fontWeight: '700' }}>Tester connexion serveur</Text>
        </Pressable>
      </View>
    </View>
  );
}