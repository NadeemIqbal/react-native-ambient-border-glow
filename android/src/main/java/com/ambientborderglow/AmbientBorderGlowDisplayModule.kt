package com.ambientborderglow

import android.os.Build
import android.view.RoundedCorner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Reports the display's real rounded-corner radii.
 *
 * Android 12 (API 31) added `WindowInsets.getRoundedCorner`, the only public
 * way to ask the platform how round the screen actually is. Each corner is
 * reported separately, which matters: some displays are not symmetric, and the
 * glow takes per-corner radii anyway.
 *
 * Below API 31, or on a squared display, every corner reports 0 — a real
 * answer meaning "draw square", not a failure.
 */
class AmbientBorderGlowDisplayModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  @ReactMethod
  fun getCornerRadii(promise: Promise) {
    try {
      val result = Arguments.createMap()

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        listOf("topLeft", "topRight", "bottomRight", "bottomLeft")
          .forEach { result.putDouble(it, 0.0) }
        promise.resolve(result)
        return
      }

      // The insets come from the attached window, so this has to run once the
      // activity has one. Falling back to the app context would report nothing.
      //
      // Via the context rather than the module's own `getCurrentActivity()`:
      // that one is deprecated as of RN 0.80, and being a Kotlin `fun` it has
      // no synthetic property to read either.
      val activity = reactApplicationContext.currentActivity
      val insets = activity?.window?.decorView?.rootWindowInsets
      if (insets == null) {
        promise.reject(NO_WINDOW, "No window is attached yet.")
        return
      }

      // Radii come back in physical pixels; the JS side works in dp.
      val density = reactApplicationContext.resources.displayMetrics.density
      fun radiusOf(position: Int): Double =
        (insets.getRoundedCorner(position)?.radius ?: 0) / density.toDouble()

      result.putDouble("topLeft", radiusOf(RoundedCorner.POSITION_TOP_LEFT))
      result.putDouble("topRight", radiusOf(RoundedCorner.POSITION_TOP_RIGHT))
      result.putDouble("bottomRight", radiusOf(RoundedCorner.POSITION_BOTTOM_RIGHT))
      result.putDouble("bottomLeft", radiusOf(RoundedCorner.POSITION_BOTTOM_LEFT))

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject(FAILED, error)
    }
  }

  companion object {
    const val NAME = "AmbientBorderGlowDisplay"
    private const val NO_WINDOW = "no_window"
    private const val FAILED = "corner_radius_failed"
  }
}
