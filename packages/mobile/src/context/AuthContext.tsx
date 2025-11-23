import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

interface User {
    id: string;
    phone: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (phone: string, otp: string) => Promise<void>;
    logout: () => Promise<void>;
    requestOtp: (phone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    const loadStorageData = async () => {
        try {
            const storedToken = await AsyncStorage.getItem('@caceasy:token');
            const storedUser = await AsyncStorage.getItem('@caceasy:user');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error('Failed to load auth data', error);
        } finally {
            setIsLoading(false);
        }
    };

    const requestOtp = async (phone: string) => {
        await api.post('/auth/otp', { phone });
    };

    const login = async (phone: string, otp: string) => {
        const response = await api.post('/auth/verify', { phone, otp });
        const { token: newToken, user: newUser } = response.data;

        setToken(newToken);
        setUser(newUser);

        await AsyncStorage.setItem('@caceasy:token', newToken);
        await AsyncStorage.setItem('@caceasy:user', JSON.stringify(newUser));
    };

    const logout = async () => {
        setToken(null);
        setUser(null);
        await AsyncStorage.removeItem('@caceasy:token');
        await AsyncStorage.removeItem('@caceasy:user');
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, requestOtp }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
