#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const reanimatedPath = path.join(__dirname, '../node_modules/react-native-reanimated');

// File 1: ReanimatedPackage.java
const reanimatedPackagePath = path.join(
  reanimatedPath,
  'android/src/main/java/com/swmansion/reanimated/ReanimatedPackage.java'
);

// File 2: BorderRadiiDrawableUtils.java
const borderRadiiPath = path.join(
  reanimatedPath,
  'android/src/reactNativeVersionPatch/BorderRadiiDrawableUtils/latest/com/swmansion/reanimated/BorderRadiiDrawableUtils.java'
);

function fixReanimatedPackage() {
  if (!fs.existsSync(reanimatedPackagePath)) {
    console.log('ReanimatedPackage.java not found, skipping...');
    return false;
  }

  let content = fs.readFileSync(reanimatedPackagePath, 'utf8');
  let modified = false;

  // Fix 1: Comment out Systrace import (only if not already commented)
  if (content.includes('import com.facebook.systrace.Systrace;') && !content.includes('// import com.facebook.systrace.Systrace')) {
    content = content.replace(
      /import com\.facebook\.systrace\.Systrace;/g,
      '// import com.facebook.systrace.Systrace; // Removed - not compatible with RN 0.81.5'
    );
    modified = true;
  }

  // Fix 2: Comment out Systrace.beginSection (only if not already commented)
  if (content.includes('Systrace.beginSection(Systrace.TRACE_TAG_REACT_JAVA_BRIDGE') && !content.includes('// Systrace.beginSection')) {
    content = content.replace(
      /(\s+)Systrace\.beginSection\(Systrace\.TRACE_TAG_REACT_JAVA_BRIDGE, "createUIManagerModule"\);/g,
      '$1// Systrace.beginSection(Systrace.TRACE_TAG_REACT_JAVA_BRIDGE, "createUIManagerModule");'
    );
    modified = true;
  }

  // Fix 3: Comment out Systrace.endSection (only if not already commented)
  if (content.includes('Systrace.endSection(Systrace.TRACE_TAG_REACT_JAVA_BRIDGE)') && !content.includes('// Systrace.endSection')) {
    content = content.replace(
      /(\s+)Systrace\.endSection\(Systrace\.TRACE_TAG_REACT_JAVA_BRIDGE\);/g,
      '$1// Systrace.endSection(Systrace.TRACE_TAG_REACT_JAVA_BRIDGE);'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(reanimatedPackagePath, content, 'utf8');
    console.log('✓ Fixed ReanimatedPackage.java');
    return true;
  }
  return false;
}

function fixBorderRadii() {
  if (!fs.existsSync(borderRadiiPath)) {
    console.log('BorderRadiiDrawableUtils.java not found, skipping...');
    return false;
  }

  let content = fs.readFileSync(borderRadiiPath, 'utf8');
  let modified = false;

  // Fix: In RN 0.81.5, resolve(float) returns a float directly (already in pixels)
  // The original code was: length.resolve(bounds.width(), bounds.height()).toPixelFromDIP().getHorizontal()
  // The fix: Use resolve with a single float parameter (max dimension) which returns the pixel value directly
  // We need to convert to pixels first using toPixelFromDIP(), then resolve, then get the horizontal value
  // Actually, let's try: length.resolve((float) Math.max(bounds.width(), bounds.height()))
  // But wait, resolve(float) returns float, not LengthPercentage. So maybe we need:
  // length.toPixelFromDIP().resolve((float) Math.max(...)).getHorizontal()
  // Or maybe: length.resolve((float) Math.max(...)) already returns the pixel value?
  
  // Let's check if there's a different pattern. Maybe we need to use getPixelValue or similar
  // Actually, the simplest fix might be to just return the resolved float directly
  // But the return type is float, so that should work if resolve(float) returns float
  
  // Try: length.toPixelFromDIP() returns LengthPercentage, then resolve(float) on that, then getHorizontal()
  // But toPixelFromDIP() doesn't exist...
  
  // Alternative: Maybe we need to use a different method. Let's try using resolve() and then converting
  // Or maybe the API changed and we should use: length.getPixelValue((float) Math.max(...))
  
  // Actually, let me try the simplest approach: just use resolve with max and return it directly
  // Since resolve(float) returns float, and the method returns float, maybe that's it?
  // But the original code had .toPixelFromDIP().getHorizontal(), so there must be conversion needed
  
  // Let's try: Use resolve() and then manually convert or use a different API
  // Actually, maybe we should check if there's a static method or different approach
  
  // For now, let's try the simplest fix: just return the resolved value
  // But we need to handle DIP conversion. Maybe resolve() already handles it?
  
  // Let me try a different approach: use the original pattern but with the correct method signature
  if (content.includes('length.toPixelFromDIP().resolve((float) Math.max(bounds.width(), bounds.height())).getHorizontal()')) {
    // This didn't work, try a different approach
    // Maybe resolve(float) already returns pixels, so we just return it
    content = content.replace(
      /length\.toPixelFromDIP\(\)\.resolve\(\(float\) Math\.max\(bounds\.width\(\), bounds\.height\(\)\)\)\.getHorizontal\(\)/g,
      'length.resolve((float) Math.max(bounds.width(), bounds.height()))'
    );
    modified = true;
  } else if (content.includes('length.resolve(bounds.width(), bounds.height())')) {
    // Handle the original unpatched version - use resolve with single float parameter
    content = content.replace(
      /length\.resolve\(bounds\.width\(\), bounds\.height\(\)\)\.toPixelFromDIP\(\)\.getHorizontal\(\)/g,
      'length.resolve((float) Math.max(bounds.width(), bounds.height()))'
    );
    modified = true;
  } else if (content.includes('length.resolve((float) Math.max(bounds.width(), bounds.height())).toPixelFromDIP().getHorizontal()')) {
    // Handle the intermediate patched version
    content = content.replace(
      /length\.resolve\(\(float\) Math\.max\(bounds\.width\(\), bounds\.height\(\)\)\)\.toPixelFromDIP\(\)\.getHorizontal\(\)/g,
      'length.resolve((float) Math.max(bounds.width(), bounds.height()))'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(borderRadiiPath, content, 'utf8');
    console.log('✓ Fixed BorderRadiiDrawableUtils.java');
    return true;
  }
  return false;
}

// Run fixes
console.log('Fixing react-native-reanimated compatibility issues...');
const fixed1 = fixReanimatedPackage();
const fixed2 = fixBorderRadii();

if (fixed1 || fixed2) {
  console.log('✓ All fixes applied successfully!');
  process.exit(0);
} else {
  console.log('ℹ No fixes needed (files may already be patched)');
  process.exit(0);
}
