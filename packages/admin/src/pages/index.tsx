import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';
import { BarChart3, Users, TrendingUp, DollarSign } from 'lucide-react';

interface Analytics {
    scans_per_day: number;
    active_masons: number;
    redemption_rate: number;
    pending_payouts_count: number;
    top_regions: { region: string; count: number }[];
}

export default function Dashboard() {
    const router = useRouter();
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasKey = sessionStorage.getItem('admin_api_key');
            if (!hasKey) {
                router.push('/login');
                return;
            }
        }

        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const res = await api.get('/admin/analytics');
            setAnalytics(res.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold">CACeasy Admin Dashboard</h1>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Scans/Day</p>
                                <p className="text-3xl font-bold">{analytics?.scans_per_day || 0}</p>
                            </div>
                            <BarChart3 className="text-blue-600" size={40} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Active Masons</p>
                                <p className="text-3xl font-bold">{analytics?.active_masons || 0}</p>
                            </div>
                            <Users className="text-green-600" size={40} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Redemption Rate</p>
                                <p className="text-3xl font-bold">{((analytics?.redemption_rate || 0) * 100).toFixed(0)}%</p>
                            </div>
                            <TrendingUp className="text-purple-600" size={40} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Pending Payouts</p>
                                <p className="text-3xl font-bold">{analytics?.pending_payouts_count || 0}</p>
                            </div>
                            <DollarSign className="text-yellow-600" size={40} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Top Regions</h2>
                        <div className="space-y-2">
                            {analytics?.top_regions?.map((region, idx) => (
                                <div key={idx} className="flex justify-between items-center">
                                    <span>{region.region}</span>
                                    <span className="font-semibold">{region.count} scans</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
                        <div className="space-y-2">
                            <button
                                onClick={() => router.push('/analytics')}
                                className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded font-semibold text-blue-700"
                            >
                                📊 View Analytics Dashboard
                            </button>
                            <button
                                onClick={() => router.push('/flagged')}
                                className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded"
                            >
                                View Flagged Events
                            </button>
                            <button
                                onClick={() => router.push('/payouts')}
                                className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded"
                            >
                                Manage Payouts
                            </button>
                            <button
                                onClick={() => router.push('/batches')}
                                className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded"
                            >
                                Batch Management
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
