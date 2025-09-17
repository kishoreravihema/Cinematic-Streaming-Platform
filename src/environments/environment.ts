
export const environment = {
  production: false,
  BaseUrl: "http://localhost:5008",
   apiBaseUrl:"",
 // useProxy: true,
  useMockData: false,
  
  // Enhanced configuration
  features: {
    enableAnalytics: true,
    enablePWA: true,
    enableOfflineMode: true,
    enablePushNotifications: true,
    enableVoiceSearch: false,
    enableVisualSearch: false
  },
  
  streaming: {
    defaultQuality: 'auto',
    enableAdaptiveBitrate: true,
    enableCrossfade: true,
    bufferSize: 30, // seconds
    maxRetries: 3
  },
  
  ui: {
    theme: 'dark',
    enableAnimations: true,
    enableGlassmorphism: true,
    primaryColor: '#00D4FF',
    secondaryColor: '#39FF14',
    accentColor: '#FF6B6B'
  }
};
