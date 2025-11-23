import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export interface ScanItem {
    id: string;
    token: string;
    device_id: string;
    timestamp: number;
    gps?: { lat: number; lng: number } | null;
    status: 'pending' | 'synced' | 'failed';
}

const QUEUE_KEY = '@caceasy:pending_scans';

export const addToQueue = async (scan: Omit<ScanItem, 'status'>) => {
    const queue = await getQueue();
    const newItem: ScanItem = { ...scan, status: 'pending' };
    queue.push(newItem);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return newItem;
};

export const getQueue = async (): Promise<ScanItem[]> => {
    const json = await AsyncStorage.getItem(QUEUE_KEY);
    return json ? JSON.parse(json) : [];
};

export const clearQueue = async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
};

export const syncQueue = async () => {
    const queue = await getQueue();
    if (queue.length === 0) return;

    const newQueue: ScanItem[] = [];

    for (const item of queue) {
        if (item.status === 'synced') continue; // Should not happen if we clean up, but safety check

        try {
            await api.post('/scan', {
                token: item.token,
                device_id: item.device_id,
                timestamp: item.timestamp,
                gps: item.gps
            });
            // Success - we can remove it or mark it synced. For now, let's remove it to keep queue clean.
            // Or keep it in history? The requirement says "offline queue: scans saved locally... automatically synced".
            // And "Scan history list with status". So we might want to move it to a history storage.
            // For MVP, let's just remove from pending queue. We can have a separate history log if needed.
            // Wait, requirement 6 says "Scan history list with status (pending, credited, failed)".
            // So we should persist the status change.

            item.status = 'synced';
            await addToHistory(item); // Move to history
        } catch (error: any) {
            if (error.response && error.response.status === 409) {
                item.status = 'failed'; // Already redeemed
                await addToHistory(item);
            } else {
                // Network error or other retryable error
                // Keep in queue for retry
                newQueue.push(item);
            }
        }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
};

const HISTORY_KEY = '@caceasy:scan_history';

export const addToHistory = async (item: ScanItem) => {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    const history: ScanItem[] = historyJson ? JSON.parse(historyJson) : [];
    history.unshift(item); // Add to top
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const getHistory = async (): Promise<ScanItem[]> => {
    const historyJson = await AsyncStorage.getItem(HISTORY_KEY);
    const history: ScanItem[] = historyJson ? JSON.parse(historyJson) : [];
    const queue = await getQueue();
    // Combine queue (pending) and history (synced/failed) for display
    return [...queue, ...history];
};
