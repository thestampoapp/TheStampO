import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, OptionItem } from '../components/Common';
import OnboardingStepLayout from '../components/OnboardingStepLayout';
import { COLORS, SPACING } from '../styles/theme';
import { weight } from '../styles/platform';

const ExcitementScreen = ({ navigation }) => {
  const [selected, setSelected] = useState(null);

  const options = [
    { id: 'stamps', label: 'Turning my photos into cute collectible stamps', icon: '📷' },
    { id: 'diary', label: 'Keeping a visual diary of my everyday life', icon: '📖' },
    { id: 'scrapbook', label: 'Creating scrapbook pages with stickers and tape', icon: '✂️' },
    { id: 'personal', label: 'Making something personal to share with loved ones', icon: '✉️' },
    { id: 'all', label: 'All of the above, I want it all!', icon: '✨' },
  ];

  return (
    <OnboardingStepLayout
      progressWidth="30%"
      footer={
        <Button
          title="Continue"
          variant="secondary"
          style={selected ? styles.activeButton : styles.disabledButton}
          textStyle={selected ? styles.activeButtonText : null}
          onPress={() => selected && navigation.navigate('Frustration')}
        />
      }
    >
      <Text style={styles.title}>What excites you most about StampO?</Text>
      <Text style={styles.subtitle}>Pick the one that fits you best</Text>

      <View style={styles.optionsContainer}>
        {options.map((opt) => (
          <OptionItem
            key={opt.id}
            label={opt.label}
            icon={<Text style={styles.iconText}>{opt.icon}</Text>}
            selected={selected === opt.id}
            onPress={() => setSelected(opt.id)}
            alignLeft={true}
          />
        ))}
      </View>
    </OnboardingStepLayout>
  );
};

const styles = StyleSheet.create({
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
  },
  iconText: {
    fontSize: 20,
    includeFontPadding: false,
  },
  activeButton: {
    backgroundColor: COLORS.primary,
  },
  activeButtonText: {
    color: COLORS.white,
  },
  disabledButton: {
    backgroundColor: COLORS.greyMedium,
  },
});

export default ExcitementScreen;
