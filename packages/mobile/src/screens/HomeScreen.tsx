import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Title, Paragraph, Text, FAB } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export const HomeScreen = () => {
    const navigation = useNavigation<any>();
    const { user, logout } = useAuth();
    const [balance, setBalance] = useState({ points: 0, rupeeEquivalent: 0 });

    useEffect(() => {
        fetchBalance();
    }, []);

    const fetchBalance = async () => {
        try {
            if (user?.id) {
                const res = await api.get(`/users/${user.id}/wallet`);
                setBalance(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch wallet', error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Title>Welcome, Mason</Title>
                    <Button onPress={logout} icon="logout">Logout</Button>
                </View>

                <Card style={styles.card}>
                    <Card.Content>
                        <Title>Wallet Balance</Title>
                        <Paragraph style={styles.points}>{balance.points} Points</Paragraph>
                        <Paragraph style={styles.rupees}>₹ {balance.rupeeEquivalent}</Paragraph>
                    </Card.Content>
                    <Card.Actions>
                        <Button onPress={() => navigation.navigate('Wallet')}>View Details</Button>
                    </Card.Actions>
                </Card>

                <View style={styles.actions}>
                    <Button
                        mode="contained"
                        icon="camera"
                        style={styles.actionBtn}
                        contentStyle={styles.actionBtnContent}
                        onPress={() => navigation.navigate('Scanner')}
                    >
                        Scan Coupon
                    </Button>

                    <Button
                        mode="outlined"
                        icon="history"
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('History')}
                    >
                        Scan History
                    </Button>
                </View>
            </ScrollView>

            <FAB
                style={styles.fab}
                icon="cog"
                onPress={() => navigation.navigate('Settings')}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    card: {
        marginBottom: 20,
        elevation: 4,
    },
    points: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#6200ee',
    },
    rupees: {
        fontSize: 18,
        color: '#666',
    },
    actions: {
        gap: 15,
    },
    actionBtn: {
        marginBottom: 10,
    },
    actionBtnContent: {
        paddingVertical: 8,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
