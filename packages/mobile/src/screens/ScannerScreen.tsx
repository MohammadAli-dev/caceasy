import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Vibration } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { Camera, BarCodeScanningResult } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { addToQueue, syncQueue } from '../utils/offlineQueue';
import { SafeAreaView } from 'react-native-safe-area-context';

export const ScannerScreen = () => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [torch, setTorch] = useState(Camera.Constants.FlashMode.off);
    const navigation = useNavigation();

    useEffect(() => {
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');

            // Request location silently
            await Location.requestForegroundPermissionsAsync();
        })();
    }, []);

    const playSuccessSound = async () => {
        try {
            // In a real app, load from assets. For MVP, we'll just speak.
            // const { sound } = await Audio.Sound.createAsync(require('../../assets/ka-ching.mp3'));
            // await sound.playAsync();
            Speech.speak('50 Rupees Added', { language: 'en' });
            // Also Hindi
            // Speech.speak('पचास रुपये जोड़े गए', { language: 'hi' });
        } catch (error) {
            console.error('Audio error', error);
        }
    };

    const handleBarCodeScanned = async ({ type, data }: BarCodeScanningResult) => {
        if (scanned) return;
        setScanned(true);
        Vibration.vibrate();

        try {
            // Capture location
            let location = null;
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    location = { lat: loc.coords.latitude, lng: loc.coords.longitude };
                }
            } catch (e) {
                console.warn('Location error', e);
            }

            // Add to queue
            await addToQueue({
                id: Math.random().toString(36).substring(7),
                token: data,
                device_id: 'device-123', // TODO: Get real device ID
                timestamp: Date.now(),
                gps: location
            });

            // Try to sync immediately
            await syncQueue();

            // Feedback
            await playSuccessSound();

            Alert.alert(
                'Scanned!',
                `Coupon code: ${data}`,
                [{ text: 'Scan Again', onPress: () => setScanned(false) }]
            );

        } catch (error) {
            Alert.alert('Error', 'Failed to process scan');
            setScanned(false);
        }
    };

    if (hasPermission === null) {
        return <View style={styles.center}><Text>Requesting camera permission...</Text></View>;
    }
    if (hasPermission === false) {
        return (
            <View style={styles.center}>
                <Text>No access to camera</Text>
                <Button onPress={() => navigation.goBack()}>Go Back</Button>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Camera
                onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                style={StyleSheet.absoluteFillObject}
                flashMode={torch}
            />

            <View style={styles.overlay}>
                <View style={styles.topControls}>
                    <IconButton
                        icon="arrow-left"
                        iconColor="white"
                        size={30}
                        onPress={() => navigation.goBack()}
                    />
                    <IconButton
                        icon={torch === Camera.Constants.FlashMode.torch ? "flash" : "flash-off"}
                        iconColor="white"
                        size={30}
                        onPress={() => setTorch(
                            torch === Camera.Constants.FlashMode.torch
                                ? Camera.Constants.FlashMode.off
                                : Camera.Constants.FlashMode.torch
                        )}
                    />
                </View>

                <View style={styles.scanFrame} />

                <View style={styles.bottomControls}>
                    <Text style={styles.hint}>Align QR code within the frame</Text>
                    {scanned && (
                        <Button mode="contained" onPress={() => setScanned(false)} style={styles.scanBtn}>
                            Scan Again
                        </Button>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 20,
    },
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: 'white',
        alignSelf: 'center',
        backgroundColor: 'transparent',
    },
    bottomControls: {
        alignItems: 'center',
        marginBottom: 40,
    },
    hint: {
        color: 'white',
        marginBottom: 20,
        fontSize: 16,
    },
    scanBtn: {
        width: '100%',
    }
});
