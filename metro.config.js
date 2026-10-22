// Metro config. With MOVIDO_UI_TEST=1 (web layout tests only) native-only
// modules and the live app state are swapped for test doubles in test/ui;
// normal and EAS builds are untouched.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

if (process.env.MOVIDO_UI_TEST === "1") {
  const stub = (name) => path.join(__dirname, "test/ui/stubs", name);
  const aliases = {
    "expo-secure-store": stub("secure-store.ts"),
    "expo-task-manager": stub("task-manager.ts"),
    "expo-location": stub("location.ts"),
    "expo-notifications": stub("notifications.ts"),
    "react-native-signature-canvas": stub("signature.tsx"),
  };
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (aliases[moduleName]) return { type: "sourceFile", filePath: aliases[moduleName] };
    if (/state\/AppContext$/.test(moduleName)) return { type: "sourceFile", filePath: path.join(__dirname, "test/ui/MockAppContext.tsx") };
    return (upstream ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
