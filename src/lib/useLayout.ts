import { useWindowDimensions } from 'react-native';

/** Wide screens (desktop, tablet landscape, unfolded foldables) get the two-pane layout. */
export const WIDE_MIN = 900;
export const useWide = () => useWindowDimensions().width >= WIDE_MIN;
