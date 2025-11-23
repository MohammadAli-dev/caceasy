import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Switch, Divider, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SettingsScreen = () => {
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState('en');

    const toggleSound = () => setSoundEnabled(!soundEnabled);
    const toggleLanguage = () => setLanguage(language === 'en' ? 'hi' : 'en');

    const clearData = async () => {
        await AsyncStorage.clear();
        alert('Data cleared. Please restart app.');
    };

    return (
        <SafeAreaView style={styles.container}>
            <List.Section>
                <List.Subheader>Preferences</List.Subheader>
                <List.Item
                    title="Sound & TTS"
                    right={() => <Switch value={soundEnabled} onValueChange={toggleSound} />}
                />
                <Divider />
                <List.Item
                    title="Language"
                    description={language === 'en' ? 'English' : 'Hindi'}
                    right={() => <Switch value={language === 'hi'} onValueChange={toggleLanguage} />}
                />
            </List.Section>

            <List.Section>
                <List.Subheader>About</List.Subheader>
                <List.Item title="Version" description="1.0.0" />
            </List.Section>

            <List.Section>
                <List.Subheader>Debug</List.Subheader>
                <List.Item
                    title="Clear Local Data"
                    onPress={clearData}
                    description="Clears all stored data and logs you out"
                />
            </List.Section>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
});
