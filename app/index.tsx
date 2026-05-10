import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { AppTextInput } from '@/components/app-text-input';
import { authApi } from '@/api';
import { useAuth } from '@/ctx';

export default function SignInScreen() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; generic?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Redirect href="/(app)/selection" />;

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!email.includes('@')) nextErrors.email = 'Enter a valid email';
    if (password.length < 6) nextErrors.password = 'Password must have at least 6 characters';
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
      if (!token) throw new Error('No token returned by API');
      await login(token);
      router.replace('/(app)/selection');
    } catch (error: any) {
      setErrors({ generic: error?.message || 'Authentication failed. Verify your credentials.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#eef2f8', padding: 20 }}>
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: '#dbe2ef', backgroundColor: '#fff', padding: 20, gap: 14 }}>
        <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }}>Field Technician Suite</Text>
        <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 30 }}>Sign in</Text>
        <Text style={{ color: '#64748b', fontSize: 14 }}>Access operational dashboards and assignments.</Text>

        <AppTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@company.com"
          keyboardType="email-address"
          error={errors.email}
        />
        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          error={errors.password}
        />

        {errors.generic ? <Text style={{ color: '#dc2626', fontSize: 13 }}>{errors.generic}</Text> : null}

        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={{ backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Sign in</Text>}
        </Pressable>
        <Link href="/register" asChild>
          <Pressable style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: '#1d4ed8', fontWeight: '600' }}>Create an account</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}