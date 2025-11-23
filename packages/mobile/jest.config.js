module.exports = {
    preset: 'jest-expo',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[t|j]sx?$': 'babel-jest'
    },
    transformIgnorePatterns: [
        // allow transformation for react-native and commonly used RN modules
        "node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|@react-native-community|@react-native/polyfills|expo|expo-barcode-scanner|expo-location|expo-av)/)"
    ],
    setupFiles: [
        '<rootDir>/jest/setupEnv.js'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
