export default {
  expo: {
    name: "SmartFactory",
    slug: "smartfactory",
    version: "1.0.0",
    scheme: "smartfactory",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",

    ios: {
      supportsTablet: true,
    },

    android: {
      package: "com.smartfactory.app",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
      },
    },

    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 340,
          resizeMode: "contain",
          backgroundColor: "#FFFFFF",
        },
      ],
      "expo-notifications",
      [
        "expo-build-properties",
        {
          android: {
            // Release APKs block plain http:// by default (Android 9+).
            // Our backend runs on a LAN IP over http, so permit it.
            usesCleartextTraffic: true,
          },
        },
      ],
    ],

    extra: {
      router: {},
      eas: {
        projectId: "14753398-6c1b-4eba-aa2f-e9e452bc03d5",
      },
    },
  },
};
