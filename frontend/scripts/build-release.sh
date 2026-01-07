#!/bin/bash

# Build Release AAB Script for TossIt
# Usage: ./scripts/build-release.sh [patch|minor|major]
# Default: patch

set -e  # Exit on error

VERSION_BUMP=${1:-patch}  # Default to patch if not specified

if [[ ! "$VERSION_BUMP" =~ ^(patch|minor|major)$ ]]; then
    echo "Error: Version bump must be 'patch', 'minor', or 'major'"
    exit 1
fi

echo "🚀 Building Release AAB for TossIt"
echo "📦 Version bump: $VERSION_BUMP"
echo ""

# Get current directory (should be frontend/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$FRONTEND_DIR"

# Step 1: Bump version in package.json
echo "📝 Bumping version in package.json..."
CURRENT_VERSION=$(node -p "require('./package.json').version")
NEW_VERSION=$(npm version "$VERSION_BUMP" --no-git-tag-version | sed 's/v//')
echo "   Version: $CURRENT_VERSION → $NEW_VERSION"

# Step 2: Update version in app.json
echo "📝 Updating version in app.json..."
node -e "
const fs = require('fs');
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
appJson.expo.version = '$NEW_VERSION';
fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2) + '\n');
"

# Step 3: Extract version parts for Android
VERSION_PARTS=($(echo "$NEW_VERSION" | tr '.' ' '))
VERSION_MAJOR=${VERSION_PARTS[0]}
VERSION_MINOR=${VERSION_PARTS[1]}
VERSION_PATCH=${VERSION_PARTS[2]}

# Calculate versionCode (increment from current)
# Format: MMMNNNPPP (Major, Minor, Patch - each 3 digits)
# Example: 1.2.3 → 001002003
VERSION_CODE=$((VERSION_MAJOR * 1000000 + VERSION_MINOR * 1000 + VERSION_PATCH))

# Step 4: Update build.gradle
echo "📝 Updating version in android/app/build.gradle..."
GRADLE_FILE="android/app/build.gradle"

# Check if android directory exists, if not we need to prebuild
if [ ! -d "android" ]; then
    echo "⚠️  Android directory not found. Running prebuild..."
    npx expo prebuild --platform android --clean
fi

# Update versionCode and versionName in build.gradle
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE_FILE"
    sed -i '' "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" "$GRADLE_FILE"
else
    # Linux
    sed -i "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE_FILE"
    sed -i "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" "$GRADLE_FILE"
fi

echo "   versionCode: $VERSION_CODE"
echo "   versionName: $NEW_VERSION"
echo ""

# Step 5: Run prebuild to ensure native files are up to date
echo "🔧 Running expo prebuild..."
npx expo prebuild --platform android --clean

# Step 6: Re-apply build.gradle fixes (Hermes path, lint options)
echo "🔧 Re-applying build.gradle fixes..."

# Fix Hermes path (if not already fixed)
if grep -q "/sdks/hermesc/%OS-BIN%/hermesc" "$GRADLE_FILE"; then
    echo "   Fixing Hermes compiler path..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's|/sdks/hermesc/%OS-BIN%/hermesc|/hermesc/%OS-BIN%/hermesc|' "$GRADLE_FILE"
        sed -i '' "s|require.resolve('react-native/package.json')|require.resolve('hermes-compiler/package.json')|" "$GRADLE_FILE"
    else
        sed -i 's|/sdks/hermesc/%OS-BIN%/hermesc|/hermesc/%OS-BIN%/hermesc|' "$GRADLE_FILE"
        sed -i "s|require.resolve('react-native/package.json')|require.resolve('hermes-compiler/package.json')|" "$GRADLE_FILE"
    fi
fi

# Step 7: Copy google-services.json if needed
if [ -f "google-services.json" ] && [ ! -f "android/app/google-services.json" ]; then
    echo "📋 Copying google-services.json..."
    cp google-services.json android/app/google-services.json
fi

# Step 8: Build the AAB
echo ""
echo "🔨 Building AAB..."
cd android
./gradlew bundleRelease

# Step 9: Show output location
AAB_PATH="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_PATH" ]; then
    AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
    echo ""
    echo "✅ Build successful!"
    echo "📦 AAB Location: $(pwd)/$AAB_PATH"
    echo "📊 Size: $AAB_SIZE"
    echo "📱 Version: $NEW_VERSION (Code: $VERSION_CODE)"
    echo ""
    echo "🚀 Ready to upload to Google Play Console!"
else
    echo "❌ Error: AAB file not found at $AAB_PATH"
    exit 1
fi

