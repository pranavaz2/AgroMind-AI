import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import ScreenContainer from '../../components/ScreenContainer';
import { ROOT_ROUTES } from '../../constants/routes';
import { theme } from '../../constants/theme';
import { analyzeCrop } from '../../services/scanService';
import { notifyDiseaseAlert, notifyScanCompletion } from '../../services/notificationService';

export default function ScanScreen({ navigation }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  async function pickFromGallery() {
    setErrorMessage('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErrorMessage('Gallery permission is required to upload a crop image.');
      return;
    }
    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!result.canceled) setSelectedImage(result.assets[0]);
    } catch {
      setErrorMessage('Could not open gallery. Please try again.');
    } finally {
      setIsPickingImage(false);
    }
  }

  async function openCamera() {
    setErrorMessage('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setErrorMessage('Camera permission is required to scan a crop leaf.');
      return;
    }
    try {
      setIsPickingImage(true);
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!result.canceled) setSelectedImage(result.assets[0]);
    } catch {
      setErrorMessage('Could not open camera. Please try again.');
    } finally {
      setIsPickingImage(false);
    }
  }

  async function handleScan() {
    if (!selectedImage) {
      setErrorMessage('Please add a leaf image before scanning.');
      return;
    }

    // Basic Validation
    const ext = selectedImage.uri.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    if (!validExts.includes(ext)) {
      setErrorMessage('Unsupported image format. Please upload a JPG or PNG leaf image.');
      return;
    }

    if (selectedImage.fileSize && selectedImage.fileSize > 15 * 1024 * 1024) {
      setErrorMessage('Image is too large. Please use a clearer, compressed image under 15MB.');
      return;
    }

    setErrorMessage('');
    setIsAnalyzing(true);
    setUploadProgress(0);
    
    try {
      const imageUri = selectedImage.uri;
      // The API orchestrates Node + FastAPI with multipart form-data
      const result = await analyzeCrop(selectedImage, null, (progress) => {
        setUploadProgress(progress);
      });
      
      await notifyScanCompletion(result);
      await notifyDiseaseAlert(result);
      setSelectedImage(null);
      navigation.navigate(ROOT_ROUTES.RESULT, {
        imageUri,
        scanData: result,
      });
    } catch (error) {
      // Graceful AI service handling (503/504)
      const errStr = error.message?.toLowerCase() || '';
      if (errStr.includes('503') || errStr.includes('504') || errStr.includes('unavailable') || errStr.includes('timed out')) {
        setErrorMessage('AI Service is currently booting up or unavailable. Please retry in a few moments.');
      } else {
        setErrorMessage(error.message || 'AI analysis failed. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
      setUploadProgress(0);
    }
  }

  return (
    <ScreenContainer padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <Ionicons name="scan" size={14} color={theme.colors.primary} />
            <Text style={styles.headerBadgeText}>AI Crop Scan</Text>
          </View>
          <Text style={styles.title}>Upload a leaf image</Text>
          <Text style={styles.subtitle}>
            Take a clear photo of the affected leaf or choose one from your gallery.
          </Text>
        </View>

        {/* Image preview */}
        <View style={styles.previewCard}>
          {selectedImage ? (
            <View style={styles.imageContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.8}
                disabled={isAnalyzing}
              >
                <Ionicons name="close" size={18} color={theme.colors.text} />
              </TouchableOpacity>
              {isAnalyzing ? (
                <View style={[StyleSheet.absoluteFill, styles.analyzingOverlay]}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.analyzingOverlayText}>
                    {uploadProgress < 100 
                      ? `Uploading... ${uploadProgress}%` 
                      : 'Analyzing crop disease using AgroMind AI...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.imageOverlay}>
                  <View style={styles.imageLabel}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                    <Text style={styles.imageLabelText}>Image ready</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyPreview}>
              <View style={styles.emptyIconRing}>
                <View style={styles.emptyIconInner}>
                  <Ionicons name="image-outline" size={32} color={theme.colors.primary} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>No crop image selected</Text>
              <Text style={styles.emptyText}>
                Use a focused, well-lit leaf photo for more accurate AI results.
              </Text>
              {/* Tips row */}
              <View style={styles.tipsRow}>
                {['Close-up', 'Good light', 'Steady hand'].map((tip) => (
                  <View key={tip} style={styles.tipChip}>
                    <Ionicons name="checkmark" size={12} color={theme.colors.primary} />
                    <Text style={styles.tipChipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Error */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={pickFromGallery}
            activeOpacity={0.8}
            disabled={isPickingImage || isAnalyzing}
          >
            <View style={styles.actionIconBox}>
              <Ionicons name="images-outline" size={22} color={theme.colors.info} />
            </View>
            <Text style={styles.actionLabel}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={openCamera}
            activeOpacity={0.8}
            disabled={isPickingImage || isAnalyzing}
          >
            <View style={[styles.actionIconBox, { backgroundColor: theme.colors.primaryGlow }]}>
              <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Scan button */}
        <TouchableOpacity
          onPress={handleScan}
          activeOpacity={0.85}
          disabled={isAnalyzing || !selectedImage}
          style={[styles.scanButtonOuter, !selectedImage && styles.scanButtonDisabled]}
        >
          <LinearGradient
            colors={selectedImage
              ? [theme.colors.primary, theme.colors.primaryDark]
              : [theme.colors.surfaceMuted, theme.colors.surfaceSoft]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scanButtonGradient}
          >
            {isAnalyzing ? (
              <>
                <ActivityIndicator size="small" color={theme.colors.background} />
                <Text style={styles.scanButtonText}>Processing...</Text>
              </>
            ) : (
              <>
                {errorMessage ? (
                   <Ionicons name="refresh" size={22} color={theme.colors.background} />
                ) : (
                   <Ionicons
                     name="scan"
                     size={22}
                     color={selectedImage ? theme.colors.background : theme.colors.textSoft}
                   />
                )}
                <Text style={[
                  styles.scanButtonText,
                  !selectedImage && { color: theme.colors.textSoft },
                ]}>
                  {errorMessage ? 'Retry Analysis' : 'Analyze with AI'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>


      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingBottom: theme.layout.tabBarBottomPadding,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.primaryGlow,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
    marginBottom: theme.spacing.md,
  },
  headerBadgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.bold,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.size.xxl,
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.base,
    lineHeight: theme.typography.lineHeight.base,
  },

  // ── Preview ──
  previewCard: {
    overflow: 'hidden',
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...theme.shadows.sm,
  },
  imageContainer: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 300,
  },
  removeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: theme.colors.overlay,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.overlay,
  },
  imageLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  imageLabelText: {
    color: theme.colors.success,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.weight.bold,
  },
  emptyPreview: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  emptyIconInner: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceSoft,
  },
  emptyTitle: {
    marginTop: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.typography.size.lg,
    fontWeight: theme.typography.weight.black,
  },
  emptyText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
    textAlign: 'center',
    maxWidth: 260,
  },
  tipsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
  },
  tipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surfaceSoft,
  },
  tipChipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
  },

  // ── Error ──
  errorBox: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
  },
  errorText: {
    flex: 1,
    color: theme.colors.danger,
    fontSize: theme.typography.size.md,
    lineHeight: theme.typography.lineHeight.md,
  },

  // ── Actions ──
  actionGrid: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: theme.colors.infoSoft,
  },
  actionLabel: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.bold,
  },

  // ── Scan button ──
  scanButtonOuter: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadows.glow,
  },
  scanButtonDisabled: {
    ...theme.shadows.sm,
    shadowColor: theme.colors.black,
  },
  scanButtonGradient: {
    height: theme.layout.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  scanButtonText: {
    color: theme.colors.background,
    fontSize: theme.typography.size.base,
    fontWeight: theme.typography.weight.heavy,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  analyzingOverlay: {
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    opacity: 0.9,
  },
  analyzingOverlayText: {
    color: theme.colors.primary,
    fontSize: theme.typography.size.md,
    fontWeight: theme.typography.weight.bold,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
});
