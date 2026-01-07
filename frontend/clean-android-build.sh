#!/bin/bash
# Clean Android build script

echo "Cleaning Android build..."

# Clean Gradle build
cd android
./gradlew clean
cd ..

# Remove build directories
rm -rf android/app/build
rm -rf android/build
rm -rf android/.gradle

# Remove node_modules and reinstall (to ensure patches apply)
echo "Reinstalling dependencies..."
rm -rf node_modules
npm install

# Reapply patches
echo "Applying patches..."
npx patch-package

echo "Clean complete! Now run: npm run android"

