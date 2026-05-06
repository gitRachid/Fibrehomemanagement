import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AppTextInput } from '@/components/app-text-input';
import { authApi } from '@/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 3) next.name = 'Name is too short';
    if (!email.includes('@')) next.email = 'Invalid email';
    if (password.length < 6) next.password = 'Minimum 6 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await authApi.register({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password });
      router.replace('/');
    } catch (error: any) {
      setErrors({ generic: error?.message || 'Registration failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#eef2f8', padding: 20 }}>
      <View style={{ borderRadius: 20, borderWidth: 1, borderColor: '#dbe2ef', backgroundColor: '#fff', padding: 20, gap: 14 }}>
        <Text style={{ color: '#0f172a', fontWeight: '700', fontSize: 30 }}>Register</Text>
        <Text style={{ color: '#64748b', fontSize: 14 }}>Create a technician account to access assignments.</Text>
        <AppTextInput label="Full name" value={name} onChangeText={setName} placeholder="John Doe" error={errors.name} />
        <AppTextInput label="Email" value={email} onChangeText={setEmail} placeholder="name@company.com" keyboardType="email-address" error={errors.email} />
        <AppTextInput label="Phone" value={phone} onChangeText={setPhone} placeholder="+212..." keyboardType="phone-pad" />
        <AppTextInput label="Password" value={password} onChangeText={setPassword} placeholder="Choose password" secureTextEntry error={errors.password} />
        {errors.generic ? <Text style={{ color: '#dc2626', fontSize: 13 }}>{errors.generic}</Text> : null}
        <Pressable onPress={onSubmit} disabled={submitting} style={{ backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', paddingVertical: 13 }}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Create account</Text>}
        </Pressable>
        <Link href="/" asChild>
          <Pressable style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: '#1d4ed8', fontWeight: '600' }}>Back to sign in</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
