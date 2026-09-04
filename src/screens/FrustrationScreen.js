import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, OptionItem } from '../components/Common';
import OnboardingStepLayout from '../components/OnboardingStepLayout';
import { COLORS, SPACING } from '../styles/theme';
import { weight } from '../styles/platform';

const FrustrationScreen = ({ navigation }) => {
  const [selected, setSelected] = useState([]);

  const options = [
    { id: 'mess', label: 'My camera roll is a mess with thousands of unsorted photos', icon: '😫' },
    { id: 'same', label: 'Every photo feels the same, nothing stands out', icon: '📱' },
    { id: 'time', label: "I'd love to scrapbook but don't have the time or supplies", icon: '⏳' },
    { id: 'forget', label: 'I forget what I did last week, let alone last month', icon: '📅' },
    { id: 'nothing', label: 'I take photos but never do anything with them', icon: '🐣' },
    { id: 'artsy', label: "I want a creative outlet but I'm not artsy", icon: '🎨' },
  ];

  const toggleSelection = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((i) => i !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  return (
    <OnboardingStepLayout
      progressWidth="40%"
      footer={
        <Button
          title="Continue"
          variant="secondary"
          style={selected.length > 0 ? styles.activeButton : styles.disabledButton}
          textStyle={selected.length > 0 ? styles.activeButtonText : null}
          onPress={() => selected.length > 0 && navigation.navigate('PersonaSwipe')}
        />
      }
    >
      <Text style={styles.title}>What's frustrating about your photos right now?</Text>
      <Text style={styles.subtitle}>Pick all that apply</Text>

      <View style={styles.optionsContainer}>
        {options.map((opt) => (
          <OptionItem
            key={opt.id}
            label={opt.label}
            icon={<Text style={styles.iconText}>{opt.icon}</Text>}
            type="multi"
            selected={selected.includes(opt.id)}
            onPress={() => toggleSelection(opt.id)}
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

export default FrustrationScreen;
