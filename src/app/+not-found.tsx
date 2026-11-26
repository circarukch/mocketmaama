import { Redirect } from 'expo-router';

// Unknown links (for example when the web build is hosted under a sub-path) go to Markets.
export default function NotFound() {
  return <Redirect href="/" />;
}
