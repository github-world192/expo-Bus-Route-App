// Mock for react-native-maps on web platform
import { View } from 'react-native';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = null;

export const Marker = ({ children, ...props }) => <View {...props}>{children}</View>;
export const MapView = ({ children, ...props }) => <View {...props}>{children}</View>;

export default MapView;