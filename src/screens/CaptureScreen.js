/**
 * CaptureScreen.js
 *
 * The post-onboarding capture screen, reached from the Capture tab.
 *
 * Differs from CameraScreen (the guided first-run flow):
 *   - full-bleed camera, no header / progress bar
 *   - the puncher is pinch-resizable
 *   - zoom + flip controls float over the preview
 *   - the shared TabBar sits at the bottom
 *
 * The reference mock is iOS. Android adaptations:
 *   - translucent StatusBar with light icons (preview is dark)
 *   - no iOS blur: the tab bar uses a light scrim, since BlurView would need
 *     expo-blur and a native rebuild
 *   - controls are inset by STATUS_BAR_HEIGHT (SafeAreaView is a no-op here)
 *   - the shutter clears the tab bar and the Android gesture bar
 *   - all animation is transform/opacity => native driver
 *
 * Crop + stamp rendering reuse the SAME utilities as CameraScreen, so a stamp
 * punched here is identical to one punched during onboarding.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Linking,
  AppState,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
// import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { useAppDialog } from '../components/AppDialog';
import { useFocusEffect } from '@react-navigation/native';

import StampRenderer from '../components/StampRenderer';
import CaptureFrame, { getFrameOption } from '../components/CaptureFrame';
import TabBar from '../components/TabBar';
import { cropToStamp } from '../utils/cropStamp';
import { punchTap, lightTap } from '../utils/haptics';
import { getPunchSound } from '../utils/assets';
import {
  STATUS_BAR_HEIGHT,
  useBottomInset,
  weight,
  HAIRLINE,
  ACTIVE_OPACITY,
} from '../styles/platform';

/** Pinch range, as a fraction of screen width the VISIBLE puncher spans. */
const FILL_DEFAULT = 0.66;
const FILL_MIN = 0.44;
const FILL_MAX = 0.9;
// const FRAME_KEY = 'stampo.capture.frame';

// let AsyncStorage = null;
// try {
//   // eslint-disable-next-line global-require
//   AsyncStorage = require('@react-native-async-storage/async-storage').default;
// } catch (e) {
//   AsyncStorage = null;
// }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const CaptureScreen = ({ navigation }) => {
  const { showDialog } = useAppDialog();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const bottomInset = useBottomInset();
  const [facing, setFacing] = useState('back');
  const [zoom, setZoom] = useState(0);
  const [isPunching, setIsPunching] = useState(false);
  const [capturedUri, setCapturedUri] = useState(null);
  const [fill, setFill] = useState(FILL_DEFAULT);
  const frameId = 'steel';
  /** Fancy frame picker disabled — only the default steel puncher is active. */
  // const [frameId, setFrameId] = useState('steel');
  // const [framePickerOpen, setFramePickerOpen] = useState(false);
  /** 'off' | 'on' | 'auto' -- matches expo-camera's flash prop. */
  const [flashMode, setFlashMode] = useState('off');

  const cameraRef = useRef(null);
  const previewRef = useRef(null);
  const windowRef = useRef(null);
  const soundRef = useRef(null);
  const mounted = useRef(true);

  // pinch bookkeeping
  const pinchStart = useRef(null);
  const fillRef = useRef(FILL_DEFAULT);
  useEffect(() => {
    fillRef.current = fill;
  }, [fill]);

  const flash = useRef(new Animated.Value(0)).current;
  const eject = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;

  // Frame preference persistence disabled while only one puncher is available.
  // useEffect(() => {
  //   let alive = true;
  //   AsyncStorage?.getItem(FRAME_KEY)
  //     .then((saved) => {
  //       if (alive && FRAME_OPTIONS.some((frame) => frame.id === saved)) {
  //         setFrameId(saved);
  //       }
  //     })
  //     .catch(() => {});
  //   return () => {
  //     alive = false;
  //   };
  // }, []);

  // const selectFrame = useCallback((id) => {
  //   setFrameId(id);
  //   lightTap();
  //   AsyncStorage?.setItem(FRAME_KEY, id).catch(() => {});
  // }, []);

  const activeFrame = useMemo(() => getFrameOption(frameId), [frameId]);

  // -- permissions ---------------------------------------------------------
  /**
   * Native ask on entry to this screen -- same pattern as Swiggy / Zomato's
   * location prompt. No custom sheet.
   *
   * focusedRef gates every path: the dialog may only appear while this screen
   * is the focused route, so resuming the app elsewhere never triggers it.
   * askingRef keeps focus + resume from stacking two dialogs.
   *
   * Android hard limit: after two denials it sets canAskAgain=false and
   * swallows all further requests. Settings is offered only in that dead end.
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

  // Fires on first mount AND on every re-entry (back from CaptureSave, tab
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

  /** Fallback button: prompt if the OS still allows it, else Settings. */
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

  // -- sound ---------------------------------------------------------------
  useEffect(() => {
    mounted.current = true;
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
        if (mounted.current) soundRef.current = sound;
        else sound.unloadAsync().catch(() => {});
      } catch (e) {
        soundRef.current = null;
      }
    })();

    Animated.timing(hint, {
      toValue: 1,
      duration: 600,
      delay: 400,
      useNativeDriver: true,
    }).start();

    return () => {
      mounted.current = false;
      const s = soundRef.current;
      soundRef.current = null;
      if (s) s.unloadAsync().catch(() => {});
    };
  }, [hint]);

  // -- puncher geometry ----------------------------------------------------
  // Same contain-fit maths as CameraScreen, but the fill factor is live so
  // pinching rescales the whole rig (and therefore the crop window too).
  const puncher = useMemo(() => {
    const areaW = screenW;
    const areaH = screenH;
    if (!areaW || !areaH) {
      return {
        body: { width: 0, height: 0, left: 0, top: 0 },
        window: { width: 0, height: 0, left: 0, top: 0 },
      };
    }

    const { aspect, opaque, opaqueLeft, aperture } = activeFrame.geometry;
    let bw = (areaW * fill) / opaque.width;
    let bh = bw / aspect;

    // never let the rig exceed the vertical space between the controls
    const maxCanvasH = (areaH * 0.62) / opaque.height;
    if (bh > maxCanvasH) {
      bh = maxCanvasH;
      bw = bh * aspect;
    }

    // PNGs have different transparent padding. Centre the visible frame body,
    // not the full image canvas, so every selected design sits on the same
    // horizontal centre line as the original steel frame.
    const left = areaW / 2 - bw * (opaqueLeft + opaque.width / 2);
    const top = (areaH - bh) / 2 - areaH * 0.05;

    return {
      body: { width: bw, height: bh, left, top },
      window: {
        width: bw * aperture.width,
        height: bh * aperture.height,
        left: left + bw * aperture.left,
        top: top + bh * aperture.top,
      },
    };
  }, [screenW, screenH, fill, activeFrame]);

  const win = puncher.window;

  // -- pinch to resize -----------------------------------------------------
  // Implemented with raw touch responders rather than a gesture library, so
  // there is no extra dependency and it behaves the same on both platforms.
  const distance = (touches) => {
    const [a, b] = touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };

  const panHandlers = useMemo(
    () => ({
      onStartShouldSetResponder: () => false,
      onMoveShouldSetResponder: (e) => e.nativeEvent.touches.length === 2,
      onResponderGrant: (e) => {
        if (e.nativeEvent.touches.length === 2) {
          pinchStart.current = {
            d: distance(e.nativeEvent.touches),
            fill: fillRef.current,
          };
        }
      },
      onResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length !== 2) return;
        if (!pinchStart.current) {
          pinchStart.current = { d: distance(t), fill: fillRef.current };
          return;
        }
        const ratio = distance(t) / (pinchStart.current.d || 1);
        setFill(clamp(pinchStart.current.fill * ratio, FILL_MIN, FILL_MAX));
      },
      onResponderRelease: () => {
        pinchStart.current = null;
      },
      onResponderTerminate: () => {
        pinchStart.current = null;
      },
    }),
    []
  );

  // -- actions -------------------------------------------------------------
  const measure = (ref) =>
    new Promise((resolve) => {
      if (!ref.current) return resolve(null);
      ref.current.measureInWindow((x, y, width, height) =>
        resolve({ x, y, width, height })
      );
    });

  const cycleZoom = useCallback(() => {
    // expo-camera zoom is 0..1; expose three friendly stops.
    setZoom((z) => (z === 0 ? 0.25 : z === 0.25 ? 0.5 : 0));
  }, []);

  const zoomLabel = zoom === 0 ? '1×' : zoom === 0.25 ? '2×' : '3×';

  const flipCamera = useCallback(() => {
    lightTap();
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  /** Cycle off -> auto -> on, the order users expect from a camera app. */
  const cycleFlash = useCallback(() => {
    setFlashMode((m) => (m === 'off' ? 'auto' : m === 'auto' ? 'on' : 'off'));
  }, []);

  const flashIcon =
    flashMode === 'off' ? 'zap-off' : 'zap';

  /**
   * Pick an existing photo instead of shooting one. It goes straight to
   * CaptureSave -- the same destination as a punch -- so both entry points
   * converge on one flow.
   */
  // Gallery upload disabled for now.
  // const openGallery = useCallback(async () => {
  //   try {
  //     const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  //     if (!perm.granted) {
  //       showDialog({ title: 'Permission needed', message: 'Please allow photo access to upload.' });
  //       return;
  //     }
  //     const result = await ImagePicker.launchImageLibraryAsync({
  //       mediaTypes: ['images'],
  //       quality: 1,
  //       allowsEditing: false,
  //     });
  //     if (!result.canceled && result.assets?.length) {
  //       lightTap();
  //       navigation.navigate('CaptureSave', { photoUri: result.assets[0].uri });
  //     }
  //   } catch (e) {
  //     showDialog({ title: 'Upload failed', message: 'Could not open your photo library.' });
  //   }
  // }, [navigation, showDialog]);

  const runFlash = useCallback(() => {
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [flash]);

  const handlePunch = useCallback(async () => {
    if (!cameraRef.current || isPunching) return;
    setIsPunching(true);

    // Haptic first -- fastest feedback, fires before the async capture so the
    // shutter feels instant.
    punchTap();
    const s = soundRef.current;
    if (s) s.replayAsync().catch(() => {});
    runFlash();

    try {
      const [photo, previewRect, winRect] = await Promise.all([
        cameraRef.current.takePictureAsync({
          quality: 1,
          // Silence the OS shutter click -- the punch sound is our feedback.
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

      if (!mounted.current) return;
      setCapturedUri(uri);

      eject.setValue(0);
      Animated.spring(eject, {
        toValue: 1,
        damping: 13,
        stiffness: 110,
        mass: 0.9,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !mounted.current) return;
        navigation.navigate('CaptureSave', { photoUri: uri });
        setTimeout(() => {
          if (!mounted.current) return;
          setCapturedUri(null);
          eject.setValue(0);
          setIsPunching(false);
        }, 320);
      });
    } catch (e) {
      if (mounted.current) setIsPunching(false);
      showDialog({ title: 'Punch failed', message: 'Could not capture your stamp. Try again.' });
    }
  }, [isPunching, facing, navigation, runFlash, eject, showDialog]);

  const handleTab = useCallback(
    (tab) => {
      if (tab.route && tab.route !== 'Capture') navigation.navigate(tab.route);
    },
    [navigation]
  );

  // -- derived styles ------------------------------------------------------
  const ejectStyle = useMemo(
    () => ({
      opacity: eject.interpolate({
        inputRange: [0, 0.12, 1],
        outputRange: [0, 1, 1],
      }),
      transform: [
        {
          translateY: eject.interpolate({
            inputRange: [0, 1],
            outputRange: [win.height * 0.42, -win.height * 0.24],
          }),
        },
        { scale: eject.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
        {
          rotate: eject.interpolate({
            inputRange: [0, 1],
            outputRange: ['4deg', '-2deg'],
          }),
        },
      ],
    }),
    [eject, win.height]
  );

  const granted = permission?.granted;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Live preview, full bleed */}
      {granted ? (
        <View ref={previewRef} style={StyleSheet.absoluteFill} collapsable={false}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            zoom={zoom}
            flash={flashMode}
          />
        </View>
      ) : (
        // Quiet backdrop while the OS dialog is up (or after a hard denial),
        // so the screen never becomes a dead error page.
        <View style={styles.permission}>
          <Feather name="camera-off" size={30} color="#4B3E56" />
          <TouchableOpacity
            style={styles.permReopen}
            onPress={promptOrSettings}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={styles.permReopenText}>Enable camera</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pinch surface + puncher rig */}
      <View style={StyleSheet.absoluteFill} {...panHandlers} pointerEvents="box-only">
        {granted ? (
          <>
            <CaptureFrame
              frameId={frameId}
              style={[styles.puncher, puncher.body]}
            />
            {/* Invisible probe: the single source of truth for the crop. */}
            <View
              ref={windowRef}
              collapsable={false}
              style={[styles.probe, win]}
            />
          </>
        ) : null}
      </View>

      {/* Ejected stamp */}
      {capturedUri ? (
        <View style={styles.ejectLayer} pointerEvents="none">
          <Animated.View
            style={[{ position: 'absolute', left: win.left, top: win.top }, ejectStyle]}
          >
            <StampRenderer uri={capturedUri} width={win.width} rotation={0} />
          </Animated.View>
        </View>
      ) : null}

      {/* Top row: flash. Gallery upload disabled for now. */}
      <View style={styles.topBar} pointerEvents="box-none">
        {/*
        <TouchableOpacity
          style={styles.roundBtn}
          onPress={openGallery}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={HIT}
        >
          <Feather name="image" size={20} color="#fff" />
        </TouchableOpacity>
        */}

        <TouchableOpacity
          style={[styles.roundBtn, flashMode !== 'off' && styles.roundBtnOn]}
          onPress={cycleFlash}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={HIT}
        >
          <Feather
            name={flashIcon}
            size={20}
            color={flashMode === 'off' ? '#fff' : '#2F233B'}
          />
          {flashMode === 'auto' ? <Text style={styles.flashAuto}>A</Text> : null}
        </TouchableOpacity>
      </View>

      {/* Fancy frame picker disabled — default steel puncher only. */}
      {/*
      <TouchableOpacity
        style={styles.frameToggle}
        onPress={() => setFramePickerOpen((open) => !open)}
        activeOpacity={ACTIVE_OPACITY}
      >
        <Feather name="layers" size={16} color="#fff" />
        <Text style={styles.frameToggleText}>Frames</Text>
        <Feather name={framePickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#fff" />
      </TouchableOpacity>

      {framePickerOpen ? (
        <View style={[styles.framePicker, { bottom: TAB_SPACE + bottomInset + 116 }]}>
          <Text style={styles.framePickerTitle}>Choose your puncher</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.framePickerList}
          >
            {FRAME_OPTIONS.map((frame) => {
              const selected = frame.id === frameId;
              return (
                <TouchableOpacity
                  key={frame.id}
                  style={styles.frameChoice}
                  onPress={() => selectFrame(frame.id)}
                  activeOpacity={ACTIVE_OPACITY}
                >
                  <View style={[styles.framePreview, selected && styles.framePreviewSelected]}>
                    <Image source={frame.source} resizeMode="contain" style={styles.framePreviewImage} />
                  </View>
                  <Text style={[styles.frameChoiceText, selected && styles.frameChoiceTextSelected]}>{frame.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      */}

      {/* Bottom row: zoom / shutter / flip on one axis, so the two controls
          used while framing sit within thumb reach of the shutter. */}
      <View style={[styles.bottomArea, { bottom: TAB_SPACE + bottomInset }]} pointerEvents="box-none">
        <Animated.Text style={[styles.hint, { opacity: hint }]}>Pinch to resize</Animated.Text>

        <View style={styles.shutterRow}>
          <TouchableOpacity
            style={styles.sideBtn}
            onPress={cycleZoom}
            activeOpacity={ACTIVE_OPACITY}
            hitSlop={HIT}
          >
            <Text style={styles.zoomText}>{zoomLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shutterOuter}
            onPress={handlePunch}
            disabled={!granted || isPunching}
            activeOpacity={0.85}
          >
            <View style={[styles.shutterInner, isPunching && styles.shutterBusy]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideBtn}
            onPress={flipCamera}
            activeOpacity={ACTIVE_OPACITY}
            hitSlop={HIT}
          >
            <Feather name="refresh-cw" size={21} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* One clean flash */}
      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { opacity: flash }]}
      />

      <TabBar active="Capture" onTabPress={handleTab} translucent />

    </View>
  );
};

const TAB_SPACE = 104;

/** Generous touch slop: these are small targets over a live preview. */
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },

  puncher: { position: 'absolute' },
  probe: { position: 'absolute', backgroundColor: 'transparent' },

  ejectLayer: { ...StyleSheet.absoluteFillObject },

  topBar: {
    position: 'absolute',
    // +14 keeps the buttons clear of the status bar / camera cutout.
    top: STATUS_BAR_HEIGHT + 14,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  frameToggle: {
    position: 'absolute',
    top: STATUS_BAR_HEIGHT + 74,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30,26,24,0.58)',
  },
  frameToggleText: {
    color: '#fff',
    fontSize: 13,
    includeFontPadding: false,
    ...weight(600),
  },
  framePicker: {
    position: 'absolute',
    left: 14,
    right: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(27, 21, 35, 0.9)',
  },
  framePickerTitle: {
    marginLeft: 14,
    marginBottom: 8,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11.5,
    includeFontPadding: false,
    ...weight(600),
  },
  framePickerList: { paddingHorizontal: 10, gap: 10 },
  frameChoice: { width: 58, alignItems: 'center' },
  framePreview: {
    width: 50,
    height: 50,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  framePreviewSelected: { borderColor: '#fff', transform: [{ scale: 1.06 }] },
  framePreviewImage: { width: '100%', height: '100%' },
  frameChoiceText: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    includeFontPadding: false,
    ...weight(600),
  },
  frameChoiceTextSelected: { color: '#fff' },
  roundBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(30,26,24,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Flash on/auto: invert so the active state is unmistakable. */
  roundBtnOn: { backgroundColor: 'rgba(255,255,255,0.92)' },
  flashAuto: {
    position: 'absolute',
    top: 6,
    right: 9,
    fontSize: 9,
    includeFontPadding: false,
    color: '#2F233B',
    ...weight(700),
  },

  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 44,
  },
  /* Side controls are visually lighter than the shutter so it stays dominant. */
  sideBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(30,26,24,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 15,
    includeFontPadding: false,
    ...weight(600),
  },

  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    // `bottom` applied inline from useBottomInset() -- per-device.
    alignItems: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    includeFontPadding: false,
    marginBottom: 14,
    ...weight(500),
  },
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  shutterBusy: { opacity: 0.55 },

  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 30,
  },

  permission: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#241E2A',
    paddingHorizontal: 40,
  },
  permReopen: {
    marginTop: 16,
    borderWidth: HAIRLINE,
    borderColor: '#5F5569',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 22,
  },
  permReopenText: {
    color: '#C9C0D0',
    fontSize: 14.5,
    includeFontPadding: false,
    ...weight(600),
  },
});

export default CaptureScreen;
