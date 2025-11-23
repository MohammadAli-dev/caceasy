import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { List, Text, Chip, Divider } from 'react-native-paper';
import { getHistory, ScanItem } from '../utils/offlineQueue';
import { SafeAreaView } from 'react-native-safe-area-context';

export const HistoryScreen = () => {
    const [history, setHistory] = useState<ScanItem[]>([]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const items = await getHistory();
        setHistory(items);
    };

    const renderItem = ({ item }: { item: ScanItem }) => (
        <View>
            <List.Item
                title={`Token: ${item.token.substring(0, 8)}...`}
                description={new Date(item.timestamp).toLocaleString()}
                right={() => (
                    <Chip
                        icon={item.status === 'synced' ? 'check' : item.status === 'failed' ? 'alert' : 'clock'}
                        mode="outlined"
                        style={styles.chip}
                    >
                        {item.status}
                    </Chip>
                )}
            />
            <Divider />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={history}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>No scan history</Text>}
                onRefresh={loadHistory}
                refreshing={false}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    list: {
        padding: 10,
    },
    chip: {
        height: 32,
    },
    empty: {
        textAlign: 'center',
        marginTop: 50,
        color: '#666',
    }
});
