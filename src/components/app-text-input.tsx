import { Text, TextInput, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  error?: string;
};

export function AppTextInput(props: Props) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: props.error ? '#dc2626' : '#cbd5e1',
          borderRadius: 12,
          backgroundColor: '#ffffff',
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: '#0f172a',
        }}
      />
      {props.error ? <Text style={{ fontSize: 12, color: '#dc2626' }}>{props.error}</Text> : null}
    </View>
  );
}
