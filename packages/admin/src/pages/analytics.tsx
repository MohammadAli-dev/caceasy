import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';
import { BarChart3, Users, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';

interface AnalyticsOverview {
    scans_per_day: number;
    active_masons: number;
    redemption_rate: number;
    pending_payouts_count: number;
    top_regions: { region: string; count: number }[];
    date: string;
}

interface DailyData {
    date: string;
    scans: number;
    active_masons: number;
    redemptions: number;
    redemption_rate: number;
}

export default function AnalyticsPage() {
    const router = useRouter();
    const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
    const [dailyData, setDailyData] = useState<DailyData[]>([]);
    const [regions, setRegions] = useState<{ region: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasKey = sessionStorage.getItem('admin_api_key');
            if (!hasKey) {
                router.push('/login');
                return;
            }
        }

        fetchAnalytics();
    }, [days]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch overview
            const overviewRes = await api.get('/admin/analytics/overview');
            setOverview(overviewRes.data);

            // Fetch daily time-series
            const dailyRes = await api.get(`/admin/analytics/daily?days=${days}`);
            setDailyData(dailyRes.data.daily || []);

            // Fetch regions
            const regionsRes = await api.get(`/admin/analytics/regions?days=${days}`);
            setRegions(regionsRes.data.regions || []);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl">Loading analytics...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => router.push('/')}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* KPI Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Scans/Day</p>
                                <p data-testid="kpi-scans" className="text-3xl font-bold">{overview?.scans_per_day || 0}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {overview?.date || 'Latest'}
                                </p>
                            </div>
                            <BarChart3 className="text-blue-600" size={40} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Active Masons</p>
                                <p data-testid="kpi-active-masons" className="text-3xl font-bold">{overview?.active_masons || 0}</p>
                                <p className="text-xs text-gray-400 mt-1">Unique users</p>
                            </div>
                            <Users className="text-green-600" size={40} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Redemption Rate</p>
                                <p data-testid="kpi-redemption-rate" className="text-3xl font-bold">
                                    {((overview?.redemption_rate || 0) * 100).toFixed(1)}%
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Success rate</p>
                            </div>
                            <TrendingUp className="text-purple-600" size={40} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm">Pending Payouts</p>
                                <p data-testid="kpi-pending-payouts" className="text-3xl font-bold">
                                    {overview?.pending_payouts_count || 0}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Awaiting approval</p>
                            </div>
                            <DollarSign className="text-yellow-600" size={40} />
                        </div>
                    </div>
                </div>

                {/* Time Range Selector */}
                <div className="mb-6 flex items-center space-x-4">
                    <Calendar className="text-gray-600" size={20} />
                    <span className="text-gray-700 font-medium">Time Range:</span>
                    <div className="flex space-x-2">
                        {[7, 14, 30, 60, 90].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-4 py-2 rounded ${days === d
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                {d} days
                            </button>
                        ))}
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Scans Time Series */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Scans Over Time</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return `${date.getMonth() + 1}/${date.getDate()}`;
                                    }}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(value) => `Date: ${value}`}
                                    formatter={(value: any) => [value, 'Scans']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="scans"
                                    stroke="#3b82f6"
                                    fill="#93c5fd"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Active Masons Time Series */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Active Masons Over Time</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return `${date.getMonth() + 1}/${date.getDate()}`;
                                    }}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(value) => `Date: ${value}`}
                                    formatter={(value: any) => [value, 'Active Masons']}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="active_masons"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Redemption Rate and Top Regions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Redemption Rate Over Time */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Redemption Rate Trend</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return `${date.getMonth() + 1}/${date.getDate()}`;
                                    }}
                                />
                                <YAxis
                                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                                />
                                <Tooltip
                                    labelFormatter={(value) => `Date: ${value}`}
                                    formatter={(value: any) => [
                                        `${(value * 100).toFixed(1)}%`,
                                        'Redemption Rate',
                                    ]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="redemption_rate"
                                    stroke="#a855f7"
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Top Regions Bar Chart */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-xl font-bold mb-4">Top Regions</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={regions.slice(0, 10)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#f59e0b" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Summary Table */}
                <div className="mt-8 bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-bold mb-4">Daily Summary</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Scans
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Active Masons
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Redemptions
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dailyData.slice(0, 10).map((day, idx) => (
                                    <tr key={idx}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {day.date}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {day.scans}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {day.active_masons}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {day.redemptions}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {(day.redemption_rate * 100).toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

