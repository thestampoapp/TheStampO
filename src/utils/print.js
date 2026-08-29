/**
 * print.js
 *
 * "Print" hands the stamp images to Blinkit's print store, where the user
 * picks quantity and pays inside Blinkit.
 *
 * How this actually works
 * ----------------------
 * Blinkit has no public print API or documented deep link that accepts an
 * image, so we cannot push files straight into their upload form. What we CAN
 * do reliably is a two-step handoff:
 *
 *   1. share the stamp image(s) to Blinkit via the Android share sheet
 *      (their app appears if it handles image/*), OR
 *   2. open the Blinkit print store so the user taps "upload" there
 *
 * Step 1 is attempted first because it carries the image with it. If sharing
 * is unavailable we fall back to opening Blinkit, then the Play Store.
 *
 * Nothing here can throw: printing must never break the collection screen.
 *
 * If Blinkit later publishes a real print deep link, only BLINKIT_PRINT_URL
 * and openBlinkitPrint() need to change.
 */

import { Linking } from 'react-native';

/** Blinkit print store. Their app intercepts blinkit.com links when installed. */
export const BLINKIT_PRINT_URL = 'https://blinkit.com/print-store';
export const BLINKIT_APP_SCHEME = 'blinkit://';
export const BLINKIT_PACKAGE = 'com.grofers.customerapp';
const PLAY_URL = `https://play.google.com/store/apps/details?id=${BLINKIT_PACKAGE}`;

/** Optional dependency; resolved once so a missing package cannot break the bundle. */
let Sharing = null;
try {
  // eslint-disable-next-line global-require
  Sharing = require('expo-sharing');
} catch (e) {
  Sharing = null;
}

async function open(url) {
  try {
    await Linking.openURL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Open Blinkit's print store (app if installed, else browser, else Play Store).
 * @returns {Promise<boolean>}
 */
export async function openBlinkitPrint() {
  // https link first: Android app links route it into the app when installed,
  // and it degrades to the browser when not.
  if (await open(BLINKIT_PRINT_URL)) return true;
  if (await open(BLINKIT_APP_SCHEME)) return true;
  return open(PLAY_URL);
}

/**
 * Send stamps to Blinkit for printing.
 *
 * Android's share sheet only takes ONE file, so multi-select shares the first
 * and tells the user. (A real multi-image flow needs a zip or repeated shares,
 * neither of which Blinkit's uploader would understand.)
 *
 * @param {Array<{uri:string}>} stamps
 * @returns {Promise<'shared'|'opened'|'cancelled'|'failed'>}
 */
export async function printStamps(stamps) {
  const list = (Array.isArray(stamps) ? stamps : [stamps]).filter(
    (s) => s && s.uri
  );
  if (!list.length) return 'failed';

  const canShare = Sharing && (await Sharing.isAvailableAsync().catch(() => false));

  if (canShare) {
    try {
      await Sharing.shareAsync(list[0].uri, {
        mimeType: 'image/png',
        dialogTitle:
          list.length > 1
            ? `Send to Blinkit to print (1 of ${list.length})`
            : 'Send to Blinkit to print',
        UTI: 'public.png',
      });
      return 'shared';
    } catch (e) {
      // user dismissed the sheet, or no handler -- fall through
    }
  }

  const opened = await openBlinkitPrint();
  return opened ? 'opened' : 'failed';
}

/**
 * Full UX: explain the handoff, then act.
 *
 * The explanation matters — tapping "Print" and landing in a grocery app with
 * no context is confusing. One short prompt sets the expectation.
 */
export async function printWithPrompt(stamps, showDialog) {
  const list = (Array.isArray(stamps) ? stamps : [stamps]).filter(
    (s) => s && s.uri
  );
  if (!list.length) return;

  const many = list.length > 1;

  return new Promise((resolve) => {
    showDialog({
      title: many ? `Print ${list.length} stamps` : 'Print this stamp',
      message: many
        ? `We'll open Blinkit's print store. Upload your stamps there, choose a quantity and pay.\n\nAndroid can only attach one image at a time, so you'll add the other ${
            list.length - 1
          } in Blinkit.`
        : "We'll hand this stamp to Blinkit's print store. Choose your quantity and pay there.",
      actions: [
        { label: 'Cancel', variant: 'secondary', onPress: () => resolve('cancelled') },
        {
          label: 'Continue',
          variant: 'primary',
          onPress: async () => {
            const result = await printStamps(list);
            if (result === 'failed') {
              showDialog({
                title: 'Could not open Blinkit',
                message: 'Install Blinkit from the Play Store to print your stamps.',
              });
            }
            resolve(result);
          },
        },
      ],
      onDismiss: () => resolve('cancelled'),
    });
  });
}
