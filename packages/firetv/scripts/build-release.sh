#!/usr/bin/env bash
# Build a signed release AAB/APK for the Amazon Appstore (Fire TV).
# Prereqs: Android SDK, a keystore at android/app/apex-release.keystore,
# and signing config in android/gradle.properties.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Bundling JS…"
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

echo "▶ Gradle assembleRelease…"
cd android
./gradlew clean
./gradlew bundleRelease   # AAB → app/build/outputs/bundle/release
./gradlew assembleRelease # APK → app/build/outputs/apk/release

echo "✅ Release artifacts in android/app/build/outputs/"
