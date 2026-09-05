const fs = require('fs');
const path = require('path');

const basePath = path.resolve(__dirname, '..');

// 1. Patch weak let to weak var
const filesToPatch = [
  'node_modules/expo-modules-core/ios/Core/Events/EventEmitter.swift',
  'node_modules/expo-modules-core/ios/Core/SharedObjects/SharedObjectRegistry.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptPropNameID.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptError.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptFunction.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptArrayBuffer.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptTypedArray.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptPromise.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptArray.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptBigInt.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptActor.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptWeakObject.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptValue.swift',
  'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptObject.swift',
];

for (const relFile of filesToPatch) {
  const fullPath = path.join(basePath, relFile);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    const original = content;
    content = content.replace(/\bweak let\b/g, 'weak var');
    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`[patch-swift6] Patched weak let -> weak var: ${relFile}`);
    }
  }
}

// 2. Patch Sendable mutable weak var
const sendablePatches = [
  {
    file: 'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptError.swift',
    search: /^\s*private weak var runtime: JavaScriptRuntime\?/m,
    replace: '  nonisolated(unsafe) private weak var runtime: JavaScriptRuntime?',
  },
  {
    file: 'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptValue.swift',
    search: /^\s*internal weak var runtime: JavaScriptRuntime\?/m,
    replace: '  nonisolated(unsafe) internal weak var runtime: JavaScriptRuntime?',
  },
  {
    file: 'node_modules/expo-modules-core/ios/Core/SharedObjects/SharedObjectRegistry.swift',
    search: /^\s*private weak var appContext: AppContext\?/m,
    replace: '  nonisolated(unsafe) private weak var appContext: AppContext?',
  },
  {
    file: 'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptPropNameID.swift',
    search: /^\s*private weak var runtime: JavaScriptRuntime\?/m,
    replace: '  nonisolated(unsafe) private weak var runtime: JavaScriptRuntime?',
  }
];

for (const p of sendablePatches) {
  const fullPath = path.join(basePath, p.file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    if (p.search.test(content)) {
      content = content.replace(p.search, p.replace);
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`[patch-swift6] Patched Sendable nonisolated(unsafe): ${p.file}`);
    }
  }
}

// 3. Patch RuntimeScheduler.h: remove SWIFT_RETURNS_RETAINED from constructors
const runtimeSchedulerHeader = path.join(basePath, 'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h');
if (fs.existsSync(runtimeSchedulerHeader)) {
  let content = fs.readFileSync(runtimeSchedulerHeader, 'utf8');
  const original = content;
  content = content.replace(/SWIFT_RETURNS_RETAINED\s+RuntimeScheduler\(/g, 'RuntimeScheduler(');
  if (content !== original) {
    fs.writeFileSync(runtimeSchedulerHeader, content, 'utf8');
    console.log(`[patch-swift6] Patched SWIFT_RETURNS_RETAINED in RuntimeScheduler.h`);
  }
}

// 4. Patch JavaScriptRuntime.swift: pointer captures across actor boundary
const jsRuntimeFile = path.join(basePath, 'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift');
if (fs.existsSync(jsRuntimeFile)) {
  let content = fs.readFileSync(jsRuntimeFile, 'utf8');
  const original = content;

  // Closure 1:
  content = content.replace(
    /nonisolated\(unsafe\) let thisPtr = thisPtr\s+nonisolated\(unsafe\) let argumentsPtr = argumentsPtr\s+nonisolated\(unsafe\) let resultPtr = resultPtr([\s\S]*?)resultPtr\.pointee = JavaScriptActor\.assumeIsolated \{\s+return forwardingSwiftErrorsToJS\(runtime: runtime\) \{\s+let this = UnsafeMutablePointer\(mutating: thisPtr\)\.move\(\)/,
    `let thisBits = UInt(bitPattern: thisPtr)\n    let argumentsBits = UInt(bitPattern: argumentsPtr)\n    let resultBits = UInt(bitPattern: resultPtr)$1let resPtr = UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: resultBits)!\n      resPtr.pointee = JavaScriptActor.assumeIsolated {\n        return forwardingSwiftErrorsToJS(runtime: runtime) {\n          let thisPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: thisBits)!\n          let argumentsPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: argumentsBits)!\n          let this = UnsafeMutablePointer(mutating: thisPtr).move()`
  );

  // Closure 2:
  content = content.replace(
    /nonisolated\(unsafe\) let thisPtr = thisPtr\s+nonisolated\(unsafe\) let argumentsPtr = argumentsPtr\s+nonisolated\(unsafe\) let resultPtr = resultPtr([\s\S]*?)resultPtr\.pointee = JavaScriptActor\.assumeIsolated \{\s+return forwardingSwiftErrorsToJS\(runtime: runtime\) \{\s+let arguments = JavaScriptValuesBuffer\(runtime, start: argumentsPtr, count: argumentsCount\)\s+let thisValue = JavaScriptUnownedValue\(runtime\.pointee, thisPtr\)/,
    `let thisBits = UInt(bitPattern: thisPtr)\n    let argumentsBits = UInt(bitPattern: argumentsPtr)\n    let resultBits = UInt(bitPattern: resultPtr)$1let resPtr = UnsafeMutablePointer<facebook.jsi.Value>(bitPattern: resultBits)!\n      resPtr.pointee = JavaScriptActor.assumeIsolated {\n        return forwardingSwiftErrorsToJS(runtime: runtime) {\n          let thisPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: thisBits)!\n          let argumentsPtr = UnsafePointer<facebook.jsi.Value>(bitPattern: argumentsBits)!\n          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)\n          let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtr)`
  );

  if (content !== original) {
    fs.writeFileSync(jsRuntimeFile, content, 'utf8');
    console.log(`[patch-swift6] Patched pointer bitPattern in JavaScriptRuntime.swift`);
  }
}

console.log('[patch-swift6] Done applying patches.');
