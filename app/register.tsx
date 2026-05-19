import { Redirect } from 'expo-router';

/** Inscription publique désactivée — création de compte réservée aux gestionnaires connectés. */
export default function RegisterScreen() {
  return <Redirect href="/" />;
}
