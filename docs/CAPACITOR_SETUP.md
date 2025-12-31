# Capacitor Native App Setup

This document describes how to set up and build the Fleet2 mobile application using Capacitor.

## Prerequisites

### Android Development
- Android Studio (latest version)
- Android SDK (API level 22+)
- Java Development Kit (JDK) 17+

### iOS Development (macOS only)
- Xcode (latest version)
- CocoaPods (`sudo gem install cocoapods`)
- Apple Developer Account (for App Store deployment)

## Initial Setup

1. **Build the web app**
   ```bash
   bun run build
   ```

2. **Add native platforms**
   ```bash
   # Add Android
   bun run cap:add:android

   # Add iOS (macOS only)
   bun run cap:add:ios
   ```

3. **Sync the web build to native platforms**
   ```bash
   bun run cap:sync
   ```

## Development Workflow

### Building for Development

1. **Build and sync**
   ```bash
   bun run cap:build
   ```

2. **Open in IDE**
   ```bash
   # Android Studio
   bun run cap:android

   # Xcode
   bun run cap:ios
   ```

3. **Run on device/emulator**
   - Use the IDE's run/debug functionality

### Live Reload (Development)

For development with live reload, update `capacitor.config.ts`:

```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:3000',
  cleartext: true,
}
```

Then run `bun dev` and the app will connect to your development server.

## Building for Production

### Android

1. **Generate APK**
   ```bash
   bun run cap:android:build
   ```

2. **Generate AAB for Play Store**
   - Open Android Studio: `bun run cap:android`
   - Build > Generate Signed Bundle / APK
   - Select "Android App Bundle"
   - Create or use existing keystore
   - Select release build variant

### iOS

1. **Build for App Store**
   ```bash
   bun run cap:ios:build
   ```

2. **Archive in Xcode**
   - Open Xcode: `bun run cap:ios`
   - Product > Archive
   - Distribute to App Store Connect

## App Icons and Splash Screens

Source assets are located in `/resources`:
- `icon.svg` - Base app icon (1024x1024 for highest quality)
- `splash.svg` - Splash screen background (2732x2732 for largest iPad)

### Generating Native Assets

Use `@capacitor/assets` to generate all required icon sizes:

```bash
npx @capacitor/assets generate --iconBackgroundColor '#1b1718' --splashBackgroundColor '#1b1718'
```

Or manually place assets in:
- `android/app/src/main/res/` (various drawable folders)
- `ios/App/App/Assets.xcassets/`

## Configuration

### Android (android/app/build.gradle)

Key configurations:
- `applicationId`: `com.fleet2.app`
- `versionCode`: Increment for each release
- `versionName`: Semantic version (e.g., "1.0.0")
- `minSdkVersion`: 22 (Android 5.1+)
- `targetSdkVersion`: 34 (Android 14)

### iOS (ios/App/App.xcodeproj)

Key configurations:
- Bundle Identifier: `com.fleet2.app`
- Version: Semantic version
- Build: Increment for each release
- Deployment Target: iOS 13.0+

## Permissions

### Android (android/app/src/main/AndroidManifest.xml)

Required permissions are configured automatically. Add additional permissions as needed:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### iOS (ios/App/App/Info.plist)

Add usage descriptions for permissions:
```xml
<key>NSCameraUsageDescription</key>
<string>Fleet2 needs camera access for scanning QR codes.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Fleet2 needs location access for fleet tracking.</string>
```

## Troubleshooting

### Android Build Fails

1. Ensure Android SDK is properly installed
2. Check `local.properties` has correct SDK path
3. Run `./gradlew clean` in `android/` directory

### iOS Build Fails

1. Run `pod install` in `ios/App/` directory
2. Ensure Xcode command line tools are installed
3. Check provisioning profile in Xcode

### Web Assets Not Updating

1. Delete `.output/` directory
2. Run `bun run cap:build` to rebuild and sync

## App Store Requirements

### Google Play Store
- 512x512 app icon
- Feature graphic (1024x500)
- Screenshots for various device sizes
- Privacy policy URL
- App description and metadata

### Apple App Store
- 1024x1024 app icon
- Screenshots for all supported devices
- App preview videos (optional)
- Privacy policy URL
- App description and metadata
