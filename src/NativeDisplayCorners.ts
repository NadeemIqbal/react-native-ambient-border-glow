import { NativeModules } from 'react-native';

export type NativeCornerRadii = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

type DisplayCornersModule = {
  getCornerRadii(): Promise<NativeCornerRadii>;
};

/**
 * The optional Android native module. It reads the display's real rounded
 * corners through the public `WindowInsets` API (Android 12 / API 31+).
 *
 * Optional on purpose: the package is otherwise pure JS, so when the module
 * isn't linked — Expo Go, an older RN, a consumer who hasn't rebuilt — this
 * resolves to `undefined` and the caller falls back rather than throwing.
 */
export const NativeDisplayCorners: DisplayCornersModule | undefined =
  NativeModules.AmbientBorderGlowDisplay;
