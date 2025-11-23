// nativeMocks.js
// Mock implementations for Expo native modules used in the app
jest.mock('expo-camera', () => ({
    Camera: {
        Constants: { FlashMode: { off: 'off', torch: 'torch' } },
        requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
        getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
        takePictureAsync: jest.fn(() => Promise.resolve({ uri: 'file://dummy.jpg' })),
    },
}));

jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 0, longitude: 0 } })),
}));

jest.mock('expo-av', () => ({
    Audio: {
        Sound: {
            createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn() } })),
        },
    },
}));

jest.mock('expo-speech', () => ({
    speak: jest.fn(),
}));

jest.mock('expo-barcode-scanner', () => ({
    BarCodeScanner: {
        Constants: { Type: {} },
        requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
        scanFromURLAsync: jest.fn(() => Promise.resolve([])),
    },
}));
