import * as LocalAuthentication from 'expo-local-authentication';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getBooleanSetting, setBooleanSetting } from '../db';

export const BIOMETRIC_SETTING_KEY = 'biometric_auth_enabled';

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  enrolledLevel: LocalAuthentication.SecurityLevel;
  biometricName: string;
  biometricIcon: string;
  isAvailable: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  warning?: string;
}

/**
 * Audit and determine device biometric capabilities, enrolled modalities,
 * and friendly label (Face ID, Touch ID, Biometric Scanner).
 */
export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  try {
    const [hasHardware, isEnrolled, supportedTypes, enrolledLevel] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);

    let biometricName = 'Biometrics';
    let biometricIcon = '🔒';

    if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricName = 'Face ID';
      biometricIcon = '👤';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricName = 'Touch ID / Fingerprint';
      biometricIcon = '👆';
    } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      biometricName = 'Iris Scan';
      biometricIcon = '👁️';
    } else if (enrolledLevel === LocalAuthentication.SecurityLevel.SECRET) {
      biometricName = 'Device Passcode';
      biometricIcon = '🔢';
    } else if (!hasHardware) {
      biometricName = 'Not Available';
      biometricIcon = '⚠️';
    }

    return {
      hasHardware,
      isEnrolled,
      supportedTypes,
      enrolledLevel,
      biometricName,
      biometricIcon,
      isAvailable: hasHardware && isEnrolled,
    };
  } catch (error) {
    console.error('Error querying biometric capabilities:', error);
    return {
      hasHardware: false,
      isEnrolled: false,
      supportedTypes: [],
      enrolledLevel: LocalAuthentication.SecurityLevel.NONE,
      biometricName: 'Unknown',
      biometricIcon: '❓',
      isAvailable: false,
    };
  }
}

/**
 * Prompt the user for biometric verification (Face ID / Touch ID / Fingerprint).
 */
export async function authenticateWithBiometrics(
  options?: LocalAuthentication.LocalAuthenticationOptions
): Promise<BiometricAuthResult> {
  try {
    const promptOptions: LocalAuthentication.LocalAuthenticationOptions = {
      promptMessage: 'Authenticate to access Kiki Bookmark',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Device Passcode',
      disableDeviceFallback: false,
      ...options,
    };

    const result = await LocalAuthentication.authenticateAsync(promptOptions);

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: (result as any).error || 'Biometric authentication was cancelled or failed.',
      warning: (result as any).warning,
    };
  } catch (error: any) {
    console.error('Biometric authentication error:', error);
    return {
      success: false,
      error: error?.message || 'Unexpected biometric authentication error',
    };
  }
}

/**
 * Check if the user has enabled biometric unlock in the local SQLite database.
 */
export async function isBiometricUnlockEnabled(db: SQLiteDatabase): Promise<boolean> {
  return await getBooleanSetting(db, BIOMETRIC_SETTING_KEY, false);
}

/**
 * Set the biometric unlock preference in the local SQLite database.
 */
export async function setBiometricUnlockEnabled(
  db: SQLiteDatabase,
  enabled: boolean
): Promise<void> {
  await setBooleanSetting(db, BIOMETRIC_SETTING_KEY, enabled);
}
