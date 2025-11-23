import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import App from '../../App';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Mocks
jest.mock('../services/api');
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
}));
jest.mock('expo-camera', () => ({
    Camera: {
        Constants: { FlashMode: { off: 'off', torch: 'torch' } },
        requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    }
}));
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 0, longitude: 0 } })),
    getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}));
jest.mock('expo-speech', () => ({
    speak: jest.fn(),
}));
jest.mock('expo-av', () => ({
    Audio: {
        Sound: {
            createAsync: jest.fn(() => Promise.resolve({ sound: { playAsync: jest.fn() } })),
        },
    },
}));

describe('App Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    });

    it('renders login screen initially', async () => {
        const { getByText, getByLabelText } = render(<App />);
        await waitFor(() => {
            expect(getByText('Mason Login')).toBeTruthy();
        });
    });

    it('completes login flow', async () => {
        (api.post as jest.Mock).mockImplementation((url) => {
            if (url === '/auth/otp') return Promise.resolve({ data: {} });
            if (url === '/auth/verify') return Promise.resolve({
                data: { token: 'fake-jwt', user: { id: 'u1', phone: '123' } }
            });
            return Promise.reject(new Error('not found'));
        });

        const { getByText, getByLabelText, queryByText } = render(<App />);

        // Wait for AuthContext loading to complete
        await waitFor(() => expect(getByLabelText('Phone Number')).toBeTruthy());

        // Step 1: Request OTP
        fireEvent.changeText(getByLabelText('Phone Number'), '1234567890');
        fireEvent.press(getByText('Send OTP'));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/auth/otp', { phone: '1234567890' });
        });

        // Step 2: Verify OTP
        // Note: In real app, UI switches to OTP input. 
        // We need to wait for state update.
        await waitFor(() => getByText('Verify & Login'));

        fireEvent.changeText(getByLabelText('OTP'), '123456');
        fireEvent.press(getByText('Verify & Login'));

        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/auth/verify', { phone: '1234567890', otp: '123456' });
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('@caceasy:token', 'fake-jwt');
        });
    });

    it('navigates to wallet and shows balance', async () => {
        // Mock logged in state
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
            if (key === '@caceasy:token') return Promise.resolve('fake-jwt');
            if (key === '@caceasy:user') return Promise.resolve(JSON.stringify({ id: 'u1', phone: '123' }));
            return Promise.resolve(null);
        });

        (api.get as jest.Mock).mockResolvedValue({ data: { points: 500, rupeeEquivalent: 500 } });

        const { getByText, findByText } = render(<App />);

        // Wait for Home screen
        await findByText('Welcome, Mason');

        // Navigate to Wallet (via "View Details" or similar, but we can test Home display first)
        expect(getByText('500 Points')).toBeTruthy();
        expect(getByText('₹ 500')).toBeTruthy();
    });
});
