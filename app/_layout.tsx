// This file is required by expo-router but the app uses @react-navigation
// This is a minimal layout to prevent expo-router from throwing errors
import { Redirect } from 'expo-router';

export default function RootLayout() {
  // Redirect to the actual App component
  // Since we're using @react-navigation, this won't be used
  return null;
}

