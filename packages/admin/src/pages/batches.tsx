import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface Batch {
    id: string;
    name: string;
    sku: string;
    points_per_coupon: number;
    issued: number;
    redeemed: number;
    pending: number;
}

export default function Batches() {
    const router = useRouter();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newBatch, setNewBatch] = useState({
        name: '',
        sku: '',
        points_per_scan: 10,
        quantity: 100,
    });

    useEffect(() => {
        if (typeof window !== 'undefined' && !sessionStorage.getItem('admin_api_key')) {
            router.push('/login');
            return;
        }
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const res = await api.get('/admin/batches');
            setBatches(res.data.batches);
        } catch (error) {
            console.error('Error fetching batches:', error);
            toast.error('Failed to fetch batches');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        try {
            await api.post('/admin/batch', newBatch);
            toast.success('Batch created');
            setShowCreate(false);
            setNewBatch({ name: '', sku: '', points_per_scan: 10, quantity: 100 });
            fetchBatches();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to create batch');
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
                    <h1 className="text-2xl font-bold">Batch Management</h1>
                    <button onClick={() => router.push('/')} className="text-blue-600">
                        ← Dashboard
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="mb-4">
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Create Batch
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left">Name</th>
                                <th className="p-3 text-left">SKU</th>
                                <th className="p-3 text-left">Points</th>
                                <th className="p-3 text-left">Issued</th>
                                <th className="p-3 text-left">Redeemed</th>
                                <th className="p-3 text-left">Pending</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map((batch) => (
                                <tr key={batch.id} className="border-t">
                                    <td className="p-3 font-semibold">{batch.name}</td>
                                    <td className="p-3">{batch.sku}</td>
                                    <td className="p-3">{batch.points_per_coupon}</td>
                                    <td className="p-3">{batch.issued}</td>
                                    <td className="p-3 text-green-600">{batch.redeemed}</td>
                                    <td className="p-3 text-yellow-600">{batch.pending}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {showCreate && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Create Batch</h2>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Batch Name"
                                value={newBatch.name}
                                onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                                className="w-full border rounded p-2"
                            />
                            <input
                                type="text"
                                placeholder="SKU"
                                value={newBatch.sku}
                                onChange={(e) => setNewBatch({ ...newBatch, sku: e.target.value })}
                                className="w-full border rounded p-2"
                            />
                            <input
                                type="number"
                                placeholder="Points per Scan"
                                value={newBatch.points_per_scan}
                                onChange={(e) => setNewBatch({ ...newBatch, points_per_scan: parseInt(e.target.value) })}
                                className="w-full border rounded p-2"
                            />
                            <input
                                type="number"
                                placeholder="Quantity"
                                value={newBatch.quantity}
                                onChange={(e) => setNewBatch({ ...newBatch, quantity: parseInt(e.target.value) })}
                                className="w-full border rounded p-2"
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowCreate(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
