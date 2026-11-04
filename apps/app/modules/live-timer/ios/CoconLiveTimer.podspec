# Spec 048: the app's own module for the Live Activity (lib/live-timer-native.ios.ts).
Pod::Spec.new do |s|
  s.name           = 'CoconLiveTimer'
  s.version        = '1.0.0'
  s.summary        = 'Our Cocon timers on the Lock Screen and in the Dynamic Island'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Our Cocon'
  s.homepage       = 'https://ourcocon.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
