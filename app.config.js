// Dynamic layer over app.json (which stays the single source of app settings).
// Only adds Android FCM: google-services.json is never committed. EAS supplies
// it as a file environment variable (GOOGLE_SERVICES_JSON holds the path of
// the uploaded file on the build server); a local copy in the project root is
// used for local builds. Without either, the build has no FCM and push
// registration reports "Could not register" (the behaviour before this file).
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const local = path.join(__dirname, "google-services.json");
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? "./google-services.json" : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
