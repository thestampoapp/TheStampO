import { View, ScrollView, StatusBar, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../styles/theme';
import { STATUS_BAR_HEIGHT } from '../styles/platform';

const OnboardingStepLayout = ({
  progressWidth,
  children,
  footer,
  contentContainerStyle,
  scrollStyle,
}) => {
  const insets = useSafeAreaInsets();
  const topInset =
    Platform.OS === 'android' ? insets.top + STATUS_BAR_HEIGHT : insets.top;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topInset, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <ScrollView
        style={[styles.scroll, scrollStyle]}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.greyLight,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    alignItems: 'center',
  },
  footer: {
    width: '100%',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.m,
  },
});

export default OnboardingStepLayout;
