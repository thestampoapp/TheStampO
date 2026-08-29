/**
 * location.js
 *
 * Optional place-tagging for a stamp.
 *
 * expo-location is resolved through a GUARDED require: a bare import of an
 * uninstalled package is a bundler error, and the app must still save stamps
 * (just without a place tag) if the dep is absent. Same pattern as
 * AsyncStorage in stampStore.
 *
 * Everything resolves to { ok, ... } instead of throwing, because these are
 * called straight from onPress handlers.
 */

let Location = null;
try {
  // eslint-disable-next-line global-require
  Location = require('expo-location');
} catch (e) {
  Location = null;
}

/** True when expo-location is installed. */
export function isLocationAvailable() {
  return !!Location;
}

/**
 * Ask for permission and read the current position, then reverse-geocode it
 * into something a human would recognise ("Chennai, Tamil Nadu").
 *
 * Uses Balanced accuracy, not High: a stamp tag needs the neighbourhood, not
 * a 3-metre fix, and High spins the GPS radio for several seconds.
 *
 * @returns {Promise<{ok: boolean, location?: object, error?: string}>}
 */
export async function captureLocation() {
  if (!Location) {
    return {
      ok: false,
      error: 'Location is not available (run: npx expo install expo-location)',
    };
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, error: 'Location permission denied' };
    }

    /**
     * Balanced == city-block accuracy, which COARSE location satisfies.
     *
     * Do not raise this to High/Highest: that needs ACCESS_FINE_LOCATION,
     * which the manifest deliberately blocks (a stamp tag wants the
     * neighbourhood, not a 3-metre fix, and fine location makes Play Protect
     * and the Play Console data-safety review much stricter).
     */
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = pos.coords;
    let label = null;

    // Reverse geocoding is a network call and fails offline. A tag with
    // coordinates but no label is still useful, so this never aborts.
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const p = places && places[0];
      if (p) {
        label =
          [p.city || p.subregion || p.district, p.region]
            .filter(Boolean)
            .join(', ') ||
          p.name ||
          null;
      }
    } catch (e) {
      label = null;
    }

    return {
      ok: true,
      location: {
        label: label || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        latitude,
        longitude,
      },
    };
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.toLowerCase().includes('location services')) {
      return { ok: false, error: 'Turn on location services and try again' };
    }
    return { ok: false, error: 'Could not get your location' };
  }
}

/** Short display string for a stored tag. */
export function formatLocation(loc) {
  if (!loc) return null;
  return loc.label || null;
}
