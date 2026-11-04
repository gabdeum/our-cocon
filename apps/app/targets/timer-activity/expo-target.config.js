// Spec 048: the Live Activity (Lock Screen and Dynamic Island), a SwiftUI widget extension made by
// @bacons/apple-targets at prebuild. Its buttons need iOS 17 (FR-004), so the card does too.
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'TimerActivity',
  displayName: 'Our Cocon timers',
  bundleIdentifier: '.timer-activity',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AppIntents'],
};
