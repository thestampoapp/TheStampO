import { View, Text, StyleSheet, SafeAreaView, StatusBar} from 'react-native';
import { Button } from '../components/Common';
import { COLORS, SPACING } from '../styles/theme';
import { STATUS_BAR_HEIGHT, weight } from '../styles/platform';

const IntroItem = ({ icon, title, description }) => (
  <View style={styles.item}>
    <View style={styles.iconContainer}>
      <Text style={styles.iconText}>{icon}</Text>
    </View>
    <View style={styles.textContainer}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  </View>
);

const CameraIntroScreen = ({ navigation }) => {
  const items = [
    {
      icon: '🎯',
      title: 'Frame your shot as a stamp',
      description: 'See your world through the stamp-shaped viewfinder before you capture',
    },
    {
      icon: '🔘',
      title: 'One-tap stamp punch',
      description: 'Instantly turn any photo into a collectible stamp with serrated edges',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.androidStatusSpacer} />
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '95%' }]} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.cameraIcon}>📷</Text>
        </View>

        <Text style={styles.title}>Ready to capture your first stamp?</Text>
        <Text style={styles.subtitle}>Stampa uses your camera to frame the world through a stamp-shaped viewfinder</Text>

        <View style={styles.list}>
          {items.map((item, i) => (
            <IntroItem key={i} {...item} />
          ))}
        </View>

        <Button 
          title="Continue" 
          onPress={() => navigation.navigate('Camera')} 
        />
      </View>
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
  content: {
    flex: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1E9F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  cameraIcon: {
    fontSize: 30,
    includeFontPadding: false,
  },
  title: {
    fontSize: 32,
    includeFontPadding: false,
    ...weight(500),
    textAlign: 'center',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    includeFontPadding: false,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl * 2,
    lineHeight: 24,
  },
  list: {
    width: '100%',
    marginBottom: SPACING.xl * 2,
  },
  item: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F3F0F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  iconText: {
    fontSize: 24,
    includeFontPadding: false,
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    includeFontPadding: false,
    ...weight(600),
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    includeFontPadding: false,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default CameraIntroScreen;
