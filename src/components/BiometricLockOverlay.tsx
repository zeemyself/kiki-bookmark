import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface BiometricLockOverlayProps {
  visible: boolean;
  biometricName: string;
  biometricIcon: string;
  isAuthenticating: boolean;
  onUnlock: () => void;
  onSignOut: () => void;
}

export const BiometricLockOverlay: React.FC<BiometricLockOverlayProps> = ({
  visible,
  biometricName,
  biometricIcon,
  isAuthenticating,
  onUnlock,
  onSignOut,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Lock Icon & Badge */}
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>{biometricIcon || '🔒'}</Text>
          </View>

          <Text style={styles.title}>Kiki Bookmark is Locked</Text>
          <Text style={styles.subtitle}>
            Please authenticate using {biometricName || 'Biometrics'} to resume your session and access your bookmarks.
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.unlockButton, isAuthenticating && styles.buttonDisabled]}
              onPress={onUnlock}
              disabled={isAuthenticating}
              activeOpacity={0.85}
            >
              {isAuthenticating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>{biometricIcon || '🔒'}</Text>
                  <Text style={styles.unlockButtonText}>
                    Unlock with {biometricName || 'Biometrics'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={onSignOut}
              disabled={isAuthenticating}
              activeOpacity={0.7}
            >
              <Text style={styles.signOutButtonText}>Sign Out of Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Security Watermark */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🛡️ Protected by Hardware Security Enclave & Local Biometrics
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  lockBadge: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  lockIcon: {
    fontSize: 44,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 290,
    marginBottom: 36,
  },
  actionContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 14,
  },
  unlockButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signOutButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
