import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, StatusBar} from 'react-native';
import { Button, OptionItem } from '../components/Common';
import { COLORS, SPACING } from '../styles/theme';
import { STATUS_BAR_HEIGHT, weight } from '../styles/platform';

const ReferralScreen = ({ navigation }) => {
  const [selected, setSelected] = useState(null);

  const options = [
    { id: 'instagram', label: 'Instagram', icon: '📷' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'youtube', label: 'YouTube Shorts', icon: '▶️' },
    { id: 'x', label: 'X (Twitter)', icon: '𝕏' },
    { id: 'reddit', label: 'Reddit', icon: '🤖' },
    { id: 'friend', label: 'A friend', icon: '👫' },
    { id: 'appstore', label: 'App Store search', icon: '🔍' },
    { id: 'other', label: 'Other', icon: '🔘' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.androidStatusSpacer} />
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '20%' }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>How did you hear about us?</Text>
        <Text style={styles.subtitle}>We'd love to know what brought you here</Text>

        <View style={styles.optionsContainer}>
          {options.map((opt) => (
            <OptionItem 
              key={opt.id}
              label={opt.label}
              icon={<Text style={styles.iconText}>{opt.icon}</Text>}
              selected={selected === opt.id}
              onPress={() => setSelected(opt.id)}
            />
          ))}
        </View>

        <Button 
          title="Continue" 
          variant="secondary"
          style={selected ? styles.activeButton : styles.disabledButton}
          onPress={() => selected && navigation.navigate('Excitement')} 
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  androidStatusSpacer: { height: STATUS_BAR_HEIGHT },
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
  scrollContent: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    includeFontPadding: false,
    ...weight(500),
    textAlign: 'left',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    width: '100%',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    includeFontPadding: false,
    textAlign: 'left',
    color: COLORS.textSecondary,
    marginTop: SPACING.m,
    marginBottom: SPACING.xl,
    width: '100%',
  },
  optionsContainer: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  iconText: {
    fontSize: 20,
    includeFontPadding: false,
  },
  activeButton: {
    backgroundColor: COLORS.primary,
  },
  disabledButton: {
    backgroundColor: COLORS.greyMedium,
  },
});

export default ReferralScreen;
