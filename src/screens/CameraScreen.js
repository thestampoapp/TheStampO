/**
 * CameraScreen.js
 *
 * Responsibilities: capture a photo, crop it to the punch window, play the
 * punch feedback, eject the stamp, navigate.
 *
 * NON-responsibilities: this screen does not know what a stamp looks like.
 * It never builds borders, scallops, masks or clip paths. The ejected stamp is
 * rendered by <StampRenderer/>, the same component StampDetail and SavedStamp
 * use, so the shape never changes between screens.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  ActivityIndicator,
  Linking,
  AppState,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
// import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useAppDialog } from '../components/AppDialog';
import { useFocusEffect } from '@react-navigation/native';

import StampRenderer from '../components/StampRenderer';
import {
  PUNCHER_SRC,
  PUNCHER_ASPECT,
  PUNCHER_OPAQUE,
  APERTURE,
} from '../utils/puncherAsset';
import { STAMP } from '../utils/stampGeometry';
import { cropToStamp } from '../utils/cropStamp';
import { punchTap, lightTap } from '../utils/haptics';
import { getPunchSound } from '../utils/assets';
import {
  getDetailStampRect,
  FLIGHT,
} from '../utils/stampTransition';
import { STAMP_COLORS } from '../styles/stampTheme';
import { weight, STATUS_BAR_HEIGHT} from '../styles/platform';

/**
 * Puncher geometry comes from src/utils/puncherAsset.js -- the single source
 * of truth for the artwork and its measured aperture. Do not re-declare the
 * constants here.
 */
const STAMP_ROTATION = STAMP.ROTATION;

/**
 * The artwork does not fill its own canvas: the opaque puncher occupies only
 * x[144..943], y[147..1245] of the 1086x1448 png, i.e. 73.7% x 75.9%, with
 * transparent padding all round.
 *
 * So we size against the VISIBLE artwork, not the canvas -- otherwise a
 * "0.92 fill" silently renders a puncher at only ~68% of the screen width,
 * which is why it looked small.
 */

/** How much of the camera area the VISIBLE puncher should span. */
const PUNCHER_FILL = 0.82;

/**
 * Chrome proportions, measured from the reference build:
 *   status 4.4% | header 12.8% | camera 63.0% | bottom 19.9%
 *
 * These are ratios rather than fixed pixel heights because Android phones vary
 * far more in aspect ratio than iPhones. With the old fixed 86/118 heights the
 * camera grew to 68-74% of the screen on tall Android devices instead of 63%,
 * which is why the header and bottom bar looked too short here.
 */
const CHROME = {
  headerRatio: 0.128,
  bottomRatio: 0.199,
  // Clamps so the bars stay usable on very small / very large screens.
  headerMin: 76,
  headerMax: 150,
  bottomMin: 104,
  bottomMax: 210,
};

const clampSize = (v, min, max) => Math.max(min, Math.min(max, v));

const ANDROID_STATUS_BAR = STATUS_BAR_HEIGHT;

const CameraScreen = ({ navigation }) => {
  const { showDialog } = useAppDialog();
  const { height: screenHeight } = useWindowDimensions();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [isPunching, setIsPunching] = useState(false);
  const [capturedUri, setCapturedUri] = useState(null);
  const [cameraArea, setCameraArea] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const cameraRef = useRef(null);
  const previewRef = useRef(null);
  const windowRef = useRef(null);
  const soundRef = useRef(null);
  const isMounted = useRef(true);

  const eject = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  /** 0 = resting in the puncher, 1 = landed in the StampDetail position. */
  const flight = useRef(new Animated.Value(0)).current;

  const [rootSize, setRootSize] = useState({ width: 0, height: 0 });

  // -- permissions ---------------------------------------------------------
  /**
   * Native ask, exactly like Swiggy / Zomato's location prompt: the OS dialog
   * fires when you ENTER this screen without camera access. No custom sheet,
   * no detour through Settings.
   *
   * Two rules keep the dialog from appearing at the wrong moment:
   *   1. focusedRef -- only ask while THIS screen is the focused route, so
   *      resuming the app on some other screen (or on the Expo Go launcher)
   *      never throws a dialog at the user.
   *   2. askingRef  -- only one dialog in flight, so focus + resume firing
   *      together can't stack two.
   *
   * Android caveat we cannot code around: after two denials the system sets
   * canAskAgain=false and silently swallows every further request. Only in
   * that dead end do we offer Settings.
   */
  const askingRef = useRef(false);
  const focusedRef = useRef(false);

  const ask = useCallback(async () => {
    if (!focusedRef.current) return;        // screen isn't on top -- stay quiet
    if (askingRef.current) return;          // a dialog is already up
    askingRef.current = true;
    try {
      // Read fresh state first: the cached `permission` object can be stale
      // after a trip to Settings or a cold resume.
      const current = (await getPermission?.()) ?? permission;
      if (!focusedRef.current) return;      // navigated away while awaiting
      if (current?.granted) return;
      if (current && current.canAskAgain === false) return; // OS would no-op
      await requestPermission();
    } catch (e) {
      // Never let a permission hiccup take the screen down.
    } finally {
      askingRef.current = false;
    }
  }, [getPermission, requestPermission, permission]);

  // Fires on first mount AND on every re-entry (back from StampDetail, tab
  // switch, deep link). Blur flips the flag so nothing prompts off-screen.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      ask();
      return () => {
        focusedRef.current = false;
      };
    }, [ask])
  );

  // Returning from Settings or the app switcher: re-check, and ask again only
  // if this screen is still the one in front of the user.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!focusedRef.current) return;
      if (permission?.granted) return;
      ask();
    });
    return () => sub.remove();
  }, [permission, ask]);

  /** Fallback button: prompt if we still can, otherwise Settings. */
  const promptOrSettings = useCallback(async () => {
    const current = (await getPermission?.()) ?? permission;
    if (current?.granted) return;

    if (current && current.canAskAgain === false) {
      showDialog({
        title: 'Camera access is off',
        message: 'Android has stopped showing the permission dialog for TheStampO. Turn the camera on in Settings and come straight back.',
        actions: [
          { label: 'Not now', variant: 'secondary' },
          { label: 'Open Settings', variant: 'primary', onPress: () => Linking.openSettings().catch(() => {}) },
        ],
      });
      return;
    }
    await requestPermission();
  }, [getPermission, permission, requestPermission, showDialog]);

  // -- sound (preloaded once, played fire-and-forget so the UI never blocks) --
  useEffect(() => {
    isMounted.current = true;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
        // Guarded: a missing punch.mp3 must not take the whole app down.
        const asset = getPunchSound();
        if (!asset) return;
        const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.9 });
        if (isMounted.current) soundRef.current = sound;
        else sound.unloadAsync().catch(() => {});
      } catch (e) {
        soundRef.current = null;
      }
    })();

    return () => {
      isMounted.current = false;
      const s = soundRef.current;
      soundRef.current = null;
      if (s) s.unloadAsync().catch(() => {});
    };
  }, []);

  const playPunch = useCallback(() => {
    const s = soundRef.current;
    if (!s) return;
    s.replayAsync().catch(() => {});
  }, []);

  // -- puncher + aperture geometry -----------------------------------------
  // The puncher is fitted into the camera area ("contain"), then the punch
  // window is derived from the measured aperture fractions. One calculation,
  // memoized; nothing is hardcoded in JSX.
  // -- chrome sizing -------------------------------------------------------
  // Derived from the screen so the camera keeps the reference 63% share on
  // every Android aspect ratio, instead of whatever is left over.
  const chrome = useMemo(() => {
    const header = clampSize(
      screenHeight * CHROME.headerRatio,
      CHROME.headerMin,
      CHROME.headerMax
    );
    const bottom = clampSize(
      screenHeight * CHROME.bottomRatio,
      CHROME.bottomMin,
      CHROME.bottomMax
    );
    return { header, bottom };
  }, [screenHeight]);

  const puncher = useMemo(() => {
    const { width: aw, height: ah } = cameraArea;
    if (!aw || !ah) {
      return { body: { width: 0, height: 0, left: 0, top: 0 }, window: { width: 0, height: 0, left: 0, top: 0 } };
    }

    // Contain-fit so that the VISIBLE puncher (not the padded canvas) spans
    // PUNCHER_FILL of the camera area. We solve for the canvas size whose
    // opaque region hits the target, then clamp on whichever axis binds.
    const targetVisibleW = aw * PUNCHER_FILL;
    const targetVisibleH = ah * PUNCHER_FILL;

    let bw = targetVisibleW / PUNCHER_OPAQUE.width;
    let bh = bw / PUNCHER_ASPECT;

    const maxCanvasH = targetVisibleH / PUNCHER_OPAQUE.height;
    if (bh > maxCanvasH) {
      bh = maxCanvasH;
      bw = bh * PUNCHER_ASPECT;
    }

    const bLeft = (aw - bw) / 2;
    const bTop = (ah - bh) / 2;

    return {
      body: { width: bw, height: bh, left: bLeft, top: bTop },
      window: {
        width: bw * APERTURE.width,
        height: bh * APERTURE.height,
        left: bLeft + bw * APERTURE.left,
        top: bTop + bh * APERTURE.top,
      },
    };
  }, [cameraArea]);

  const windowSize = puncher.window;

  // -- measuring -----------------------------------------------------------
  const measure = (ref) =>
    new Promise((resolve) => {
      if (!ref.current) return resolve(null);
      ref.current.measureInWindow((x, y, width, height) =>
        resolve({ x, y, width, height })
      );
    });

  // -- animations ----------------------------------------------------------
  const runFlash = useCallback(() => {
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, {
        toValue: 1,
        duration: 60,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [flash]);

  const runEject = useCallback(
    (onDone) => {
      eject.setValue(0);
      Animated.spring(eject, {
        toValue: 1,
        damping: 13,
        stiffness: 110,
        mass: 0.9,
        useNativeDriver: true,
      }).start(({ finished }) => finished && onDone());
    },
    [eject]
  );

  /**
   * "Match and move": the punched stamp travels from the aperture to the exact
   * position StampDetail will render it, then we navigate underneath it. The
   * stamp the user is watching becomes the stamp on the next screen.
   */
  const runFlight = useCallback(
    (onArrive) => {
      flight.setValue(0);
      Animated.sequence([
        Animated.delay(FLIGHT.holdMs),
        Animated.timing(flight, {
          toValue: 1,
          duration: FLIGHT.durationMs,
          // Slow, deliberate glide: eases out of the machine and settles.
          easing: Easing.bezier(0.33, 0, 0.15, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => finished && onArrive());
    },
    [flight]
  );

  // -- actions -------------------------------------------------------------
  const handleFlip = useCallback(() => {
    // Pure state toggle: CameraView swaps sensors without remounting,
    // so there is no reload and no flicker.
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  // Gallery upload disabled for now.
  // const handleUpload = useCallback(async () => {
  //   try {
  //     const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  //     if (!perm.granted) {
  //       showDialog({ title: 'Permission needed', message: 'Please allow photo access to upload.' });
  //       return;
  //     }
  //     const result = await ImagePicker.launchImageLibraryAsync({
  //       // `MediaTypeOptions` is deprecated; the array form is the new API.
  //       mediaTypes: ['images'],
  //       quality: 1,
  //       allowsEditing: false,
  //     });
  //     if (!result.canceled && result.assets?.length) {
  //       // No additional processing: straight to StampDetail.
  //       lightTap();
  //       navigation.navigate('StampDetail', { photoUri: result.assets[0].uri });
  //     }
  //   } catch (e) {
  //     showDialog({ title: 'Upload failed', message: 'Could not open your photo library.' });
  //   }
  // }, [navigation, showDialog]);

  const handlePunch = useCallback(async () => {
    if (!cameraRef.current || isPunching) return;
    setIsPunching(true);

    // Feedback fires immediately on press -- never after the await, so the
    // punch feels instant. Haptic first: it is the fastest of the three and
    // the one the hand notices.
    punchTap();
    playPunch();
    runFlash();

    try {
      const [photo, previewRect, winRect] = await Promise.all([
        cameraRef.current.takePictureAsync({
          quality: 1,
          skipProcessing: false,
          // Silence the OS shutter click: the punch sound IS our feedback,
          // and hearing both reads as a double-trigger.
          shutterSound: false,
        }),
        measure(previewRef),
        measure(windowRef),
      ]);

      if (!photo || !previewRect || !winRect) throw new Error('measure failed');

      const uri = await cropToStamp({
        photo,
        previewSize: { width: previewRect.width, height: previewRect.height },
        windowRect: {
          x: winRect.x - previewRect.x,
          y: winRect.y - previewRect.y,
          width: winRect.width,
          height: winRect.height,
        },
        mirrored: facing === 'front',
      });

      if (!isMounted.current) return;

      setCapturedUri(uri);
      runEject(() => {
        runFlight(() => {
          // Navigate only once the stamp is already sitting in its final
          // position, so StampDetail fades up beneath a stamp that has not
          // moved -- the hand-off is invisible.
          navigation.navigate('StampDetail', { photoUri: uri });
          setTimeout(() => {
            if (!isMounted.current) return;
            setCapturedUri(null);
            eject.setValue(0);
            flight.setValue(0);
            setIsPunching(false);
          }, 260);
        });
      });
    } catch (err) {
      if (isMounted.current) setIsPunching(false);
      showDialog({ title: 'Punch failed', message: 'Could not capture your stamp. Try again.' });
    }
  }, [
    isPunching,
    facing,
    navigation,
    playPunch,
    runFlash,
    runEject,
    runFlight,
    eject,
    flight,
    showDialog,
  ]);

  // -- empty slot ----------------------------------------------------------
  // Snaps to dark almost immediately (the paper is gone the instant it is
  // punched), then holds while the stamp rides up out of the machine.
  const slotStyle = useMemo(
    () => ({
      opacity: eject.interpolate({
        inputRange: [0, 0.08, 1],
        outputRange: [0, 1, 1],
      }),
    }),
    [eject]
  );

  // -- ejection + flight transform -----------------------------------------
  // Phase 1 (eject): the stamp rides up out of the slot.
  // Phase 2 (flight): it travels to the exact rect StampDetail will draw it in.
  //
  // Both phases drive ONE view, so the stamp never re-mounts or jumps. The
  // flight target comes from the shared transition module, so it always
  // matches the next screen.
  const ejectStyle = useMemo(() => {
    // Where the stamp currently sits, in root-relative coordinates.
    const fromCx = cameraArea.x + windowSize.left + windowSize.width / 2;
    const fromCy = cameraArea.y + windowSize.top + windowSize.height / 2;

    const target = getDetailStampRect(rootSize.width || cameraArea.width);

    const dx = target.x - fromCx;
    const dy = target.y - fromCy;

    // Scale from the aperture-sized stamp up to the detail-sized stamp.
    const growTo = windowSize.width ? target.width / windowSize.width : 1;

    return {
      opacity: eject.interpolate({
        inputRange: [0, 0.12, 1],
        outputRange: [0, 1, 1],
      }),
      transform: [
        // --- travel (phase 2) ---
        {
          translateX: flight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, dx],
          }),
        },
        {
          translateY: Animated.add(
            // ejection lift (phase 1)
            eject.interpolate({
              inputRange: [0, 1],
              outputRange: [windowSize.height * 0.42, -windowSize.height * 0.22],
            }),
            // flight travel (phase 2)
            flight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, dy + windowSize.height * 0.22],
            })
          ),
        },
        {
          scale: Animated.multiply(
            eject.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
            flight.interpolate({ inputRange: [0, 1], outputRange: [1, growTo] })
          ),
        },
        {
          // settles onto the canonical -2deg resting angle
          rotate: flight.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', `${STAMP_ROTATION}deg`],
          }),
        },
      ],
    };
  }, [eject, flight, windowSize, cameraArea, rootSize.width]);

  const granted = permission?.granted;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>

      <View
        style={[
          styles.header,
          { height: chrome.header + ANDROID_STATUS_BAR, paddingTop: ANDROID_STATUS_BAR },
        ]}
      >
        <Text style={styles.title}>Punch your first stamp</Text>
        <Text style={styles.subtitle}>Frame one moment, then make it yours.</Text>
        <TouchableOpacity
          style={[styles.skip, { top: ANDROID_STATUS_BAR + 30 }]}
          // Skip means "not now": send them straight to the account gate
          // (Signup has a "Log in" link for existing users). Never open the
          // save screen here -- with no photo it would show an empty stamp.
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View
        style={styles.cameraArea}
        onLayout={(e) => setCameraArea(e.nativeEvent.layout)}
      >
        {granted ? (
          <View ref={previewRef} style={styles.preview} collapsable={false}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
          </View>
        ) : (
          <View style={styles.placeholder}>
            {!permission ? (
              <ActivityIndicator color="#999" />
            ) : (
              <>
                <Feather name="camera-off" size={30} color="#6E6376" />
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={promptOrSettings}
                  activeOpacity={0.85}
                >
                  <Text style={styles.permissionButtonText}>Enable camera</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Empty slot. Once the stamp has been punched out, the aperture is a
            hole in the machine, not a viewfinder -- so it goes dark. Drawn
            above the camera but BELOW the puncher, so the scalloped teeth and
            mechanism still overlap it correctly. */}
        {capturedUri ? (
          <View style={styles.windowLayer} pointerEvents="none">
            <Animated.View style={[styles.slot, windowSize, slotStyle]}>
              <View style={styles.slotLip} />
            </Animated.View>
          </View>
        ) : null}

        {/* Puncher body. Its transparent aperture is the viewfinder.
            Hidden while the permission gate is showing. */}
        <View
          style={[styles.windowLayer, !granted && styles.hidden]}
          pointerEvents="none"
        >
          <Image
            source={PUNCHER_SRC}
            resizeMode="contain"
            style={[styles.puncherBody, puncher.body]}
          />

          {/* Invisible probe aligned to the asset's aperture. This is the
              single source of truth the crop measures -- it is positioned
              from the measured fractions, never painted. */}
          <View
            ref={windowRef}
            collapsable={false}
            style={[styles.punchWindow, windowSize]}
          />
        </View>


        {/* One clean flash. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { opacity: flash }]}
        />
      </View>


      {/* Ejected stamp. Lives at the ROOT, not inside the camera area, so it
          is not clipped by overflow:hidden while it flies up to the header
          region on its way to the StampDetail position. */}
      {capturedUri ? (
        <View style={styles.flightLayer} pointerEvents="none">
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: cameraArea.x + windowSize.left,
                top: cameraArea.y + windowSize.top,
              },
              ejectStyle,
            ]}
          >
            <StampRenderer uri={capturedUri} width={windowSize.width} rotation={0} />
          </Animated.View>
        </View>
      ) : null}

      <View style={[styles.bottomBar, { height: chrome.bottom }]}>
        {/* Gallery upload disabled for now — spacer keeps the punch button centred. */}
        <View style={styles.sideButton} />

        {/*
        <TouchableOpacity style={styles.sideButton} onPress={handleUpload}>
          <View style={styles.sideIcon}>
            <Feather name="image" size={22} color="#777" />
          </View>
          <Text style={styles.sideLabel}>Upload</Text>
        </TouchableOpacity>
        */}

        <TouchableOpacity
          style={styles.captureOuter}
          onPress={handlePunch}
          activeOpacity={0.85}
          disabled={isPunching || !granted}
        >
          <View style={[styles.captureInner, isPunching && styles.captureBusy]}>
            <View style={styles.captureSquare} />
            <Text style={styles.captureText}>PUNCH</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sideButton} onPress={handleFlip}>
          <View style={styles.sideIcon}>
            <Feather name="refresh-cw" size={22} color="#777" />
          </View>
          <Text style={styles.sideLabel}>Flip</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: STAMP_COLORS.background },

  progressTrack: { height: 3, backgroundColor: '#EEE5F5' },
  progressFill: { width: '92%', height: 3, backgroundColor: STAMP_COLORS.accent },

  header: {
    backgroundColor: STAMP_COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2EDF6',
    paddingHorizontal: 18,
  },
  title: { fontSize: 24, ...weight(500), color: STAMP_COLORS.textPrimary },
  subtitle: { marginTop: 4, fontSize: 13, color: STAMP_COLORS.textSecondary },
  skip: { position: 'absolute', right: 18 },
  skipText: { fontSize: 14, color: STAMP_COLORS.textMuted },

  cameraArea: { flex: 1, backgroundColor: '#1A1A1A', overflow: 'hidden' },
  preview: { ...StyleSheet.absoluteFillObject },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  hidden: { opacity: 0 },
  permissionButton: {
    marginTop: 6,
    backgroundColor: STAMP_COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 24,
  },
  permissionButtonText: { color: '#fff', fontSize: 15, ...weight(600) },

  windowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  puncherBody: {
    position: 'absolute',
  },
  punchWindow: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  /* The empty aperture after the stamp has been ejected. Not pure black --
     a very dark plum grey reads as shadowed interior rather than a dead hole,
     and matches the machine's dark mechanism. */
  slot: {
    position: 'absolute',
    backgroundColor: '#0B0A09',
    overflow: 'hidden',
  },
  /* Subtle lit edge along the top of the recess, so the slot has depth. */
  slotLip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  flightLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },

  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 30,
  },

  bottomBar: {
    backgroundColor: STAMP_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingBottom: 18,
  },
  sideButton: { alignItems: 'center' },
  sideIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: STAMP_COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideLabel: { marginTop: 8, color: STAMP_COLORS.textSecondary, fontSize: 12 },

  captureOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E4D5F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    elevation: 10,
  },
  captureInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: STAMP_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBusy: { opacity: 0.6 },
  captureSquare: {
    width: 22,
    height: 22,
    borderWidth: 1.8,
    borderStyle: 'dashed',
    borderColor: '#fff',
    marginBottom: 4,
  },
  captureText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
  },
});

export default CameraScreen;
