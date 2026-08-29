/**
 * monetization.js
 *
 * THE MASTER SWITCH FOR EVERY REVENUE SURFACE IN THE APP.
 *
 * v1 ships 100% FREE: MONETIZATION_ENABLED is false, which means
 *
 *   - App.js never initialises the AdMob SDK and never requests an ad
 *   - CaptureSaveScreen goes straight to the collection after every save
 *     (no interstitial, no in-app ad card, no subscribe offer)
 *   - the Account tab shows no "Remove ads" button and no ad-related copy
 *   - the splash does not even warm the subscription tier cache
 *
 * NOTHING IS DELETED. ads.js, AdInterstitial.js, subscriptionStore.js and
 * SubscribeScreen.js stay in the codebase exactly as they are, wired into
 * the screens behind this one flag -- they are simply dormant.
 *
 * TO RECONNECT (the planned update after 5000 users): flip the flag below
 * to `true`. No other file needs to change -- the ad preload, the post-save
 * interstitial, the upsell offer and the paywall all light up again as-is.
 */

export const MONETIZATION_ENABLED = false;
