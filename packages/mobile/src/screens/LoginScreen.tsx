import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, Title } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export const LoginScreen = () => {
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const { requestOtp, login } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleRequestOtp = async () => {
        if (!phone || phone.length < 10) {
            Alert.alert('Error', 'Please enter a valid phone number');
            return;
        }
        setLoading(true);
        try {
            await requestOtp(phone);
            setStep('otp');
            Alert.alert('Success', 'OTP sent to your phone');
        } catch (error) {
            Alert.alert('Error', 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length < 6) {
            Alert.alert('Error', 'Please enter a valid OTP');
            return;
        }
        setLoading(true);
        try {
            await login(phone, otp);
        } catch (error) {
            Alert.alert('Error', 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Title style={styles.title}>Mason Login</Title>

                {step === 'phone' ? (
                    <>
                        <TextInput
                            label="Phone Number"
                            accessibilityLabel="Phone Number"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            mode="outlined"
                            style={styles.input}
                        />
                        <Button
                            mode="contained"
                            onPress={handleRequestOtp}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                        >
                            Send OTP
                        </Button>
                    </>
                ) : (
                    <>
                        <Text style={styles.subtitle}>Enter OTP sent to {phone}</Text>
                        <TextInput
                            label="OTP"
                            accessibilityLabel="OTP"
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            mode="outlined"
                            style={styles.input}
                        />
                        <Button
                            mode="contained"
                            onPress={handleVerifyOtp}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                        >
                            Verify & Login
                        </Button>
                        <Button
                            onPress={() => setStep('phone')}
                            style={styles.textButton}
                            disabled={loading}
                        >
                            Change Phone Number
                        </Button>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
    input: {
        marginBottom: 15,
    },
    button: {
        marginTop: 10,
        paddingVertical: 5,
    },
    textButton: {
        marginTop: 10,
    }
});
