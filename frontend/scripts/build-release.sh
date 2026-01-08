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

# Step 3: Extract version parts for Android (calculate before prebuild, apply after)
VERSION_PARTS=($(echo "$NEW_VERSION" | tr '.' ' '))
VERSION_MAJOR=${VERSION_PARTS[0]}
VERSION_MINOR=${VERSION_PARTS[1]}
VERSION_PATCH=${VERSION_PARTS[2]}

# Calculate versionCode (increment from current)
# Format: MMMNNNPPP (Major, Minor, Patch - each 3 digits)
# Example: 1.2.3 → 001002003
VERSION_CODE=$((VERSION_MAJOR * 1000000 + VERSION_MINOR * 1000 + VERSION_PATCH))

echo "   Calculated versionCode: $VERSION_CODE"
echo "   Calculated versionName: $NEW_VERSION"
echo ""

# Step 4: Backup release.keystore before prebuild (it gets deleted)
KEYSTORE_BACKUP_DIR="$FRONTEND_DIR/keystores"
KEYSTORE_SOURCE="$FRONTEND_DIR/android/app/release.keystore"
KEYSTORE_BACKUP="$KEYSTORE_BACKUP_DIR/release.keystore"

if [ -f "$KEYSTORE_SOURCE" ]; then
    echo "💾 Backing up release.keystore..."
    mkdir -p "$KEYSTORE_BACKUP_DIR"
    cp "$KEYSTORE_SOURCE" "$KEYSTORE_BACKUP"
    echo "   Keystore backed up to: $KEYSTORE_BACKUP"
fi

# Step 6: Run prebuild to ensure native files are up to date
echo "🔧 Running expo prebuild..."
npx expo prebuild --platform android --clean

# Step 7: Restore release.keystore after prebuild
if [ -f "$KEYSTORE_BACKUP" ]; then
    echo "💾 Restoring release.keystore..."
    mkdir -p "$FRONTEND_DIR/android/app"
    cp "$KEYSTORE_BACKUP" "$KEYSTORE_SOURCE"
    echo "   Keystore restored to: $KEYSTORE_SOURCE"
elif [ ! -f "$KEYSTORE_SOURCE" ]; then
    echo "⚠️  WARNING: release.keystore not found!"
    echo "   Generating new release.keystore..."
    keytool -genkey -v -keystore "$KEYSTORE_SOURCE" -alias release -keyalg RSA -keysize 2048 -validity 10000 -storepass tossit123 -keypass tossit123 -dname "CN=TossIt, OU=TossIt, O=TossIt, L=Unknown, ST=Unknown, C=US"
    echo "   ⚠️  IMPORTANT: This is a NEW keystore. You'll need to:"
    echo "      1. Get the new SHA-1: keytool -list -v -keystore $KEYSTORE_SOURCE -alias release -storepass tossit123"
    echo "      2. Add it to Firebase Console"
    echo "      3. Update Google Play Console if you've already uploaded an AAB"
fi

# Step 8: Update versionCode and versionName in build.gradle (AFTER prebuild)
echo "📝 Updating version in android/app/build.gradle..."
GRADLE_FILE="$FRONTEND_DIR/android/app/build.gradle"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE_FILE"
    sed -i '' "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" "$GRADLE_FILE"
else
    # Linux
    sed -i "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE_FILE"
    sed -i "s/versionName \".*\"/versionName \"$NEW_VERSION\"/" "$GRADLE_FILE"
fi

echo "   ✅ versionCode: $VERSION_CODE"
echo "   ✅ versionName: $NEW_VERSION"
echo ""

# Step 9: Re-apply build.gradle fixes (Hermes path, release signing)
echo "🔧 Re-applying build.gradle fixes..."

# Fix Hermes path (if not already fixed)
# Only fix hermesCommand line, NOT reactNativeDir or codegenDir
if grep -q "hermesCommand.*sdks/hermesc" "$GRADLE_FILE" || ! grep -q "hermesCommand.*hermes-compiler" "$GRADLE_FILE"; then
    echo "   Fixing Hermes compiler path..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Only modify the hermesCommand line specifically
        sed -i '' '/hermesCommand =/s|require.resolve('\''react-native/package.json'\'')|require.resolve('\''hermes-compiler/package.json'\'')|' "$GRADLE_FILE"
        sed -i '' '/hermesCommand =/s|/sdks/hermesc/%OS-BIN%/hermesc|/hermesc/%OS-BIN%/hermesc|' "$GRADLE_FILE"
    else
        sed -i '/hermesCommand =/s|require.resolve('\''react-native/package.json'\'')|require.resolve('\''hermes-compiler/package.json'\'')|' "$GRADLE_FILE"
        sed -i '/hermesCommand =/s|/sdks/hermesc/%OS-BIN%/hermesc|/hermesc/%OS-BIN%/hermesc|' "$GRADLE_FILE"
    fi
fi

# Ensure reactNativeDir points to react-native (fix if accidentally changed)
if grep -q "reactNativeDir.*hermes-compiler" "$GRADLE_FILE"; then
    echo "   Fixing reactNativeDir path..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' '/reactNativeDir =/s|require.resolve('\''hermes-compiler/package.json'\'')|require.resolve('\''react-native/package.json'\'')|' "$GRADLE_FILE"
    else
        sed -i '/reactNativeDir =/s|require.resolve('\''hermes-compiler/package.json'\'')|require.resolve('\''react-native/package.json'\'')|' "$GRADLE_FILE"
    fi
fi

# Ensure codegenDir uses react-native path (fix if accidentally changed)
if grep -q "codegenDir.*hermes-compiler" "$GRADLE_FILE"; then
    echo "   Fixing codegenDir path..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' '/codegenDir =/s|paths: \[require.resolve('\''hermes-compiler/package.json'\'')\]|paths: [require.resolve('\''react-native/package.json'\'')]|' "$GRADLE_FILE"
    else
        sed -i '/codegenDir =/s|paths: \[require.resolve('\''hermes-compiler/package.json'\'')\]|paths: [require.resolve('\''react-native/package.json'\'')]|' "$GRADLE_FILE"
    fi
fi

# Re-apply release signing configuration (prebuild removes it)
echo "   Re-applying release signing configuration..."
if ! grep -q "signingConfigs.release" "$GRADLE_FILE"; then
    # Add release signing config after debug
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' '/signingConfigs {/,/^    }/ {
            /^    }/ i\
        release {\
            storeFile file('\''release.keystore'\'')\
            storePassword '\''tossit123'\''\
            keyAlias '\''release'\''\
            keyPassword '\''tossit123'\''\
        }
        }' "$GRADLE_FILE"
    else
        sed -i '/signingConfigs {/,/^    }/ {
            /^    }/ i\
        release {\
            storeFile file('\''release.keystore'\'')\
            storePassword '\''tossit123'\''\
            keyAlias '\''release'\''\
            keyPassword '\''tossit123'\''\
        }
        }' "$GRADLE_FILE"
    fi
fi

# Update release buildType to use release signing config
if grep -q "signingConfig signingConfigs.debug" "$GRADLE_FILE" && grep -q "buildTypes" "$GRADLE_FILE"; then
    echo "   Updating release buildType to use release signing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' '/release {/,/signingConfig signingConfigs.debug/s|signingConfig signingConfigs.debug|signingConfig signingConfigs.release|' "$GRADLE_FILE"
    else
        sed -i '/release {/,/signingConfig signingConfigs.debug/s|signingConfig signingConfigs.debug|signingConfig signingConfigs.release|' "$GRADLE_FILE"
    fi
fi

# Ensure debug buildType uses debug signing (fix if accidentally changed)
if grep -q "debug.*signingConfig signingConfigs.release" "$GRADLE_FILE"; then
    echo "   Fixing debug buildType to use debug signing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' '/debug {/,/signingConfig signingConfigs.release/s|signingConfig signingConfigs.release|signingConfig signingConfigs.debug|' "$GRADLE_FILE"
    else
        sed -i '/debug {/,/signingConfig signingConfigs.release/s|signingConfig signingConfigs.release|signingConfig signingConfigs.debug|' "$GRADLE_FILE"
    fi
fi

# Step 10: Ensure Gradle task removes camera and audio permissions from merged manifest
echo "🔧 Ensuring camera and audio permission removal in build.gradle..."
# Check if the Gradle task to remove permissions exists
if ! grep -q "Remove camera and audio permissions from merged manifest" "$GRADLE_FILE"; then
    echo "   Adding Gradle task to remove camera permission..."
    # Create a temporary file with the Gradle task code
    TEMP_GRADLE_FIX=$(mktemp)
    cat > "$TEMP_GRADLE_FIX" << 'GRADLE_FIX_EOF'
    
    // Remove camera and audio permissions from merged manifest (not used by app)
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            def processManifest = output.getProcessManifestProvider().get()
            processManifest.doLast { task ->
                def outputDir = task.multiApkManifestOutputDirectory.get().asFile
                File manifestOutFile = file("$outputDir/AndroidManifest.xml")
                if (manifestOutFile.exists()) {
                    def manifestContent = manifestOutFile.getText('UTF-8')
                    // Remove camera and audio permissions (not used by app)
                    manifestContent = manifestContent.replaceAll('<uses-permission android:name="android.permission.CAMERA" />', '')
                    manifestContent = manifestContent.replaceAll('<uses-permission android:name="android.permission.RECORD_AUDIO" />', '')
                    manifestOutFile.write(manifestContent, 'UTF-8')
                }
            }
        }
    }
GRADLE_FIX_EOF
    # Insert after namespace line
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "/namespace 'ai.tossit.app'/r $TEMP_GRADLE_FIX" "$GRADLE_FILE"
    else
        sed -i "/namespace 'ai.tossit.app'/r $TEMP_GRADLE_FIX" "$GRADLE_FILE"
    fi
    rm "$TEMP_GRADLE_FIX"
    echo "   ✅ Added Gradle task to remove camera and audio permissions"
else
    echo "   ℹ️  Permission removal task already exists"
fi

# Step 11: Ensure AndroidManifest has tools:node="remove" for RECORD_AUDIO
echo "🔧 Ensuring AndroidManifest removes RECORD_AUDIO permission..."
MANIFEST_FILE="$FRONTEND_DIR/android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST_FILE" ]; then
    if grep -q '<uses-permission android:name="android.permission.RECORD_AUDIO"/>' "$MANIFEST_FILE" && ! grep -q 'RECORD_AUDIO.*tools:node="remove"' "$MANIFEST_FILE"; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' 's|<uses-permission android:name="android.permission.RECORD_AUDIO"/>|<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>|' "$MANIFEST_FILE"
        else
            sed -i 's|<uses-permission android:name="android.permission.RECORD_AUDIO"/>|<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>|' "$MANIFEST_FILE"
        fi
        echo "   ✅ Added tools:node=\"remove\" for RECORD_AUDIO"
    elif grep -q 'RECORD_AUDIO.*tools:node="remove"' "$MANIFEST_FILE"; then
        echo "   ℹ️  RECORD_AUDIO already marked for removal"
    fi
fi

# Step 12: Copy google-services.json if needed
if [ -f "google-services.json" ] && [ ! -f "android/app/google-services.json" ]; then
    echo "📋 Copying google-services.json..."
    cp google-services.json android/app/google-services.json
fi

# Step 13: Build the AAB
echo ""
echo "🔨 Building AAB..."
cd android
./gradlew bundleRelease

# Step 14: Show output location
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

