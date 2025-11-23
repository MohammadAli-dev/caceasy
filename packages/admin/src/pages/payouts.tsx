import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Payout {
    id: string;
    user_phone: string;
    amount: number;
    status: string;
    created_at: string;
    reference?: string;
}

export default function Payouts() {
    const router = useRouter();
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined' && !sessionStorage.getItem('admin_api_key')) {
            router.push('/login');
            return;
        }
        fetchPayouts();
    }, []);

    const fetchPayouts = async () => {
        try {
            const res = await api.get('/admin/payouts?status=pending');
            setPayouts(res.data.payouts);
        } catch (error) {
            console.error('Error fetching payouts:', error);
            toast.error('Failed to fetch payouts');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string, reference: string) => {
        try {
            await api.post(`/admin/payouts/${id}/approve`, { reference });
            toast.success('Payout approved');
            fetchPayouts();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to approve payout');
        }
    };

    const handleBulkApprove = async () => {
        if (selected.size === 0) {
            toast.error('Please select at least one payout');
            return;
        }

        const confirmed = confirm(`Approve ${selected.size} payout(s)?`);
        if (!confirmed) return;

        try {
            const promises = Array.from(selected).map((id) =>
                api.post(`/admin/payouts/${id}/approve`, { reference: `BULK-${Date.now()}` })
            );
            await Promise.all(promises);
            toast.success(`${selected.size} payout(s) approved`);
            setSelected(new Set());
            fetchPayouts();
        } catch (error) {
            toast.error('Some payouts failed to approve');
        }
    };

    const exportCSV = () => {
        const csv = [
            ['ID', 'Phone', 'Amount', 'Status', 'Date'].join(','),
            ...payouts.map((p) =>
                [p.id, p.user_phone, p.amount, p.status, p.created_at].join(',')
            ),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payouts-${Date.now()}.csv`;
        a.click();
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
                    <h1 className="text-2xl font-bold">Payouts Management</h1>
                    <button onClick={() => router.push('/')} className="text-blue-600">
                        ← Dashboard
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white p-6 rounded-lg shadow mb-4 flex justify-between">
                    <button
                        onClick={handleBulkApprove}
                        disabled={selected.size === 0}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-300"
                    >
                        Approve Selected ({selected.size})
                    </button>
                    <button
                        onClick={exportCSV}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Export CSV
                    </button>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-left">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelected(new Set(payouts.map((p) => p.id)));
                                            } else {
                                                setSelected(new Set());
                                            }
                                        }}
                                    />
                                </th>
                                <th className="p-3 text-left">User</th>
                                <th className="p-3 text-left">Amount (₹)</th>
                                <th className="p-3 text-left">Status</th>
                                <th className="p-3 text-left">Created</th>
                                <th className="p-3 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.map((payout) => (
                                <tr key={payout.id} className="border-t">
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(payout.id)}
                                            onChange={(e) => {
                                                const newSelected = new Set(selected);
                                                if (e.target.checked) {
                                                    newSelected.add(payout.id);
                                                } else {
                                                    newSelected.delete(payout.id);
                                                }
                                                setSelected(newSelected);
                                            }}
                                        />
                                    </td>
                                    <td className="p-3">{payout.user_phone}</td>
                                    <td className="p-3 font-semibold">{payout.amount}</td>
                                    <td className="p-3">
                                        <span
                                            className={`px-2 py-1 rounded text-sm ${payout.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-green-100 text-green-800'
                                                }`}
                                        >
                                            {payout.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-sm text-gray-500">
                                        {format(new Date(payout.created_at), 'MMM d, yyyy')}
                                    </td>
                                    <td className="p-3">
                                        <button
                                            onClick={() => {
                                                const ref = prompt('Enter reference number:');
                                                if (ref) handleApprove(payout.id, ref);
                                            }}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Approve
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
