import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface FlaggedEvent {
    id: string;
    user_phone: string;
    device_id: string;
    batch_name: string;
    risk_score: number;
    reason: string;
    status: string;
    created_at: string;
}

export default function Flagged() {
    const router = useRouter();
    const [events, setEvents] = useState<FlaggedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolveModal, setResolveModal] = useState<{ id: string; open: boolean }>({
        id: '',
        open: false,
    });
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined' && !sessionStorage.getItem('admin_api_key')) {
            router.push('/login');
            return;
        }
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/admin/flagged');
            setEvents(res.data.flagged);
        } catch (error) {
            console.error('Error fetching flagged events:', error);
            toast.error('Failed to fetch flagged events');
        } finally {
            setLoading(false);
        }
    };

    const handleResolve = async () => {
        if (!notes.trim()) {
            toast.error('Please enter notes');
            return;
        }

        try {
            await api.post(`/admin/flagged/${resolveModal.id}/resolve`, {
                action: 'manual_review',
                notes,
            });
            toast.success('Event resolved');
            setResolveModal({ id: '', open: false });
            setNotes('');
            fetchEvents();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to resolve event');
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
                    <h1 className="text-2xl font-bold">Flagged Events</h1>
                    <button onClick={() => router.push('/')} className="text-blue-600">
                        ← Dashboard
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left">User</th>
                                <th className="p-3 text-left">Device</th>
                                <th className="p-3 text-left">Batch</th>
                                <th className="p-3 text-left">Risk</th>
                                <th className="p-3 text-left">Reason</th>
                                <th className="p-3 text-left">Status</th>
                                <th className="p-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event) => (
                                <tr key={event.id} className="border-t">
                                    <td className="p-3">{event.user_phone}</td>
                                    <td className="p-3 text-sm text-gray-600">{event.device_id}</td>
                                    <td className="p-3">{event.batch_name}</td>
                                    <td className="p-3">
                                        <span
                                            className={`px-2 py-1 rounded text-sm ${event.risk_score > 70
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                                }`}
                                        >
                                            {event.risk_score}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm">{event.reason}</td>
                                    <td className="p-3">
                                        <span
                                            className={`px-2 py-1 rounded text-sm ${event.status === 'open'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}
                                        >
                                            {event.status}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        {event.status === 'open' && (
                                            <button
                                                onClick={() => setResolveModal({ id: event.id, open: true })}
                                                className="text-blue-600 hover:underline"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {resolveModal.open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Resolve Flagged Event</h2>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Enter resolution notes..."
                            className="w-full border rounded p-2 mb-4"
                            rows={4}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setResolveModal({ id: '', open: false })}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolve}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Resolve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
