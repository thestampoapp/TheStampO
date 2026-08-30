import { useEffect } from 'react';
import { Text, TextInput, StatusBar, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ErrorBoundary from './src/components/ErrorBoundary';
import { AppDialogProvider } from './src/components/AppDialog';
import { MONETIZATION_ENABLED } from './src/data/monetization';
import SplashScreen from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import ReferralScreen from './src/screens/ReferralScreen';
import ExcitementScreen from './src/screens/ExcitementScreen';
import FrustrationScreen from './src/screens/FrustrationScreen';
import PersonaSwipeScreen from './src/screens/PersonaSwipeScreen';
import ConfirmationScreen from './src/screens/ConfirmationScreen';
import FeaturesScreen from './src/screens/FeaturesScreen';
import InterestsScreen from './src/screens/InterestsScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import CameraIntroScreen from './src/screens/CameraIntroScreen';
import CameraScreen from './src/screens/CameraScreen';
import StampDetailScreen from './src/screens/StampDetailScreen';
import SavedStampScreen from './src/screens/SavedStampScreen';
import RatingScreen from './src/screens/RatingScreen';
import SignupScreen from './src/screens/SignupScreen';
import LoginScreen from './src/screens/LoginScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import PhoneAuthScreen from './src/screens/PhoneAuthScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import CollectionScreen from './src/screens/CollectionScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import CaptureSaveScreen from './src/screens/CaptureSaveScreen';
import StampViewerScreen from './src/screens/StampViewerScreen';
import EditorScreen from './src/screens/EditorScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AccountScreen from './src/screens/AccountScreen';
import SubscribeScreen from './src/screens/SubscribeScreen';

const Stack = createStackNavigator();

/**
 * Lazy screen loader — keeps native modules and heavy screens off the critical
 * path until they are actually navigated to.
 */


/**
 * Android: the OS font-size slider goes up to 1.3x+, which overflows fixed
 * layouts. Cap the scaling so the design stays intact while still honouring
 * a reasonable accessibility bump.
 */
const MAX_FONT_SCALE = 1.15;

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.maxFontSizeMultiplier = MAX_FONT_SCALE;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.maxFontSizeMultiplier = MAX_FONT_SCALE;

export default function App() {
  useEffect(() => {
    // v1 ships completely free: the AdMob SDK is never initialised while
    // MONETIZATION_ENABLED is false. ads.js itself is untouched -- flipping
    // the flag in src/data/monetization.js re-enables ad preload as-is.
    if (!MONETIZATION_ENABLED) return;
    import('./src/data/ads')
      .then((m) => m.initAds())
      .catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppDialogProvider>
          <NavigationContainer>
            <StatusBar
              barStyle="dark-content"
              backgroundColor="transparent"
              translucent
            />
            <Stack.Navigator
  initialRouteName="Splash"
  screenOptions={{
    headerShown: false,
    ...TransitionPresets.FadeFromBottomAndroid,
    cardStyle: { backgroundColor: '#FAF8FC' },
    detachPreviousScreen: false,
  }}
>
  <Stack.Screen name="Splash" component={SplashScreen} />
  <Stack.Screen name="Welcome" component={WelcomeScreen} />
  <Stack.Screen name="Referral" component={ReferralScreen} />
  <Stack.Screen name="Excitement" component={ExcitementScreen} />
  <Stack.Screen name="Frustration" component={FrustrationScreen} />
  <Stack.Screen name="PersonaSwipe" component={PersonaSwipeScreen} />
  <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
  <Stack.Screen name="Features" component={FeaturesScreen} />
  <Stack.Screen name="Interests" component={InterestsScreen} />
  <Stack.Screen name="Privacy" component={PrivacyScreen} />

  <Stack.Screen name="CameraIntro" component={CameraIntroScreen} />

  <Stack.Screen
    name="Camera"
    component={CameraScreen}
    options={{ cardStyle: { backgroundColor: '#000' } }}
  />

  <Stack.Screen name="StampDetail" component={StampDetailScreen} />
  <Stack.Screen name="SavedStamp" component={SavedStampScreen} />
  <Stack.Screen name="Rating" component={RatingScreen} />

  <Stack.Screen
    name="Signup"
    component={SignupScreen}
    options={{ gestureEnabled: false }}
  />

  <Stack.Screen name="Login" component={LoginScreen} />
  <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
  <Stack.Screen name="PhoneAuth" component={PhoneAuthScreen} />
  <Stack.Screen name="Collections" component={CollectionsScreen} />

  <Stack.Screen
    name="Collection"
    component={CollectionScreen}
    options={{ ...TransitionPresets.FadeFromBottomAndroid }}
  />

  <Stack.Screen
    name="Capture"
    component={CaptureScreen}
    options={{
      cardStyle: { backgroundColor: '#111' },
      ...TransitionPresets.FadeFromBottomAndroid,
    }}
  />

  <Stack.Screen name="CaptureSave" component={CaptureSaveScreen} />
  <Stack.Screen name="StampViewer" component={StampViewerScreen} />
  <Stack.Screen name="Editor" component={EditorScreen} />

  <Stack.Screen
    name="Calendar"
    component={CalendarScreen}
    options={{
      ...TransitionPresets.FadeFromBottomAndroid,
      gestureEnabled: false,
    }}
  />

  <Stack.Screen name="Account" component={AccountScreen} />
  <Stack.Screen name="Subscribe" component={SubscribeScreen} />
</Stack.Navigator>
          </NavigationContainer>
          </AppDialogProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
