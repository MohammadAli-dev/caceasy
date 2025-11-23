import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Title, Card, TextInput, Button, RadioButton } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export const WalletScreen = () => {
    const { user } = useAuth();
    const [balance, setBalance] = useState({ points: 0, rupeeEquivalent: 0 });
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('upi');
    const [account, setAccount] = useState('');
    const [loading, setLoading] = useState(false);

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

    const handleRedeem = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }
        if (!account) {
            Alert.alert('Error', 'Please enter account details');
            return;
        }
        if (Number(amount) > balance.rupeeEquivalent) {
            Alert.alert('Error', 'Insufficient balance');
            return;
        }

        setLoading(true);
        try {
            await api.post(`/users/${user?.id}/redeem`, {
                amount: Number(amount),
                method,
                account
            });
            Alert.alert('Success', 'Redemption request submitted');
            setAmount('');
            setAccount('');
            fetchBalance(); // Refresh balance
        } catch (error) {
            Alert.alert('Error', 'Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.card}>
                    <Card.Content>
                        <Title>Current Balance</Title>
                        <Text style={styles.points}>{balance.points} Points</Text>
                        <Text style={styles.rupees}>₹ {balance.rupeeEquivalent}</Text>
                    </Card.Content>
                </Card>

                <Title style={styles.sectionTitle}>Withdraw Funds</Title>

                <Card style={styles.formCard}>
                    <Card.Content>
                        <TextInput
                            label="Amount (₹)"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            mode="outlined"
                            style={styles.input}
                        />

                        <Text style={styles.label}>Payout Method</Text>
                        <RadioButton.Group onValueChange={setMethod} value={method}>
                            <View style={styles.radioRow}>
                                <RadioButton value="upi" />
                                <Text>UPI</Text>
                            </View>
                            <View style={styles.radioRow}>
                                <RadioButton value="bank" />
                                <Text>Bank Transfer</Text>
                            </View>
                        </RadioButton.Group>

                        <TextInput
                            label={method === 'upi' ? "UPI ID" : "Account Number"}
                            value={account}
                            onChangeText={setAccount}
                            mode="outlined"
                            style={styles.input}
                        />

                        <Button
                            mode="contained"
                            onPress={handleRedeem}
                            loading={loading}
                            disabled={loading}
                            style={styles.button}
                        >
                            Submit Request
                        </Button>
                    </Card.Content>
                </Card>
            </ScrollView>
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
    card: {
        marginBottom: 20,
        backgroundColor: '#6200ee',
    },
    points: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
    },
    rupees: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.8)',
    },
    sectionTitle: {
        marginBottom: 10,
    },
    formCard: {
        marginBottom: 20,
    },
    input: {
        marginBottom: 15,
    },
    label: {
        marginBottom: 5,
        fontWeight: 'bold',
    },
    radioRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    button: {
        marginTop: 10,
    }
});
