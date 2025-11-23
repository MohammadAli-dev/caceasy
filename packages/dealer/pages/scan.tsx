import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { QrCode, User, DollarSign, CreditCard, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function Scan() {
    const [token, setToken] = useState('');
    const [masonPhone, setMasonPhone] = useState('');
    const [cashPaid, setCashPaid] = useState(false);
    const [creditToDealer, setCreditToDealer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const storedUser = sessionStorage.getItem('dealer_user');
        if (!storedUser) {
            router.push('/');
            return;
        }
        setUser(JSON.parse(storedUser));
    }, [router]);

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!masonPhone && !creditToDealer) {
            toast.error('Please specify either Mason Phone or Credit to Dealer');
            setLoading(false);
            return;
        }

        try {
            const payload: any = { token };
            if (masonPhone) {
                payload.mason_phone = masonPhone;
                payload.cash_paid = cashPaid;
            } else if (creditToDealer) {
                payload.credit_to_dealer = true;
            }

            const res = await api.post('/dealer/scan-proxy', payload);
            toast.success(`Success! ${res.data.points} points processed.`);
            setToken('');
            setMasonPhone('');
            setCashPaid(false);
            setCreditToDealer(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Scan failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.clear();
        router.push('/');
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-900">Dealer Dashboard</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link href="/wallet" className="text-gray-600 hover:text-gray-900 flex items-center">
                                <CreditCard className="h-5 w-5 mr-1" />
                                Wallet
                            </Link>
                            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900 flex items-center">
                                <LogOut className="h-5 w-5 mr-1" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-md mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
                        <QrCode className="h-6 w-6 mr-2 text-indigo-600" />
                        Process Coupon
                    </h2>

                    <form onSubmit={handleScan} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Coupon Token</label>
                            <input
                                type="text"
                                required
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="Enter token manually"
                            />
                        </div>

                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-medium text-gray-700">Scan Type</label>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="credit_dealer"
                                            type="checkbox"
                                            checked={creditToDealer}
                                            onChange={(e) => {
                                                setCreditToDealer(e.target.checked);
                                                if (e.target.checked) setMasonPhone('');
                                            }}
                                            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="credit_dealer" className="font-medium text-gray-700">Credit to My Wallet</label>
                                        <p className="text-gray-500">I am redeeming this for myself.</p>
                                    </div>
                                </div>

                                <div className="relative flex py-2 items-center">
                                    <div className="flex-grow border-t border-gray-300"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR PROXY FOR MASON</span>
                                    <div className="flex-grow border-t border-gray-300"></div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Mason Phone Number</label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="tel"
                                            value={masonPhone}
                                            onChange={(e) => {
                                                setMasonPhone(e.target.value);
                                                if (e.target.value) setCreditToDealer(false);
                                            }}
                                            disabled={creditToDealer}
                                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border disabled:bg-gray-100"
                                            placeholder="+1555..."
                                        />
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="cash_paid"
                                            type="checkbox"
                                            checked={cashPaid}
                                            onChange={(e) => setCashPaid(e.target.checked)}
                                            disabled={!masonPhone || creditToDealer}
                                            className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="cash_paid" className="font-medium text-gray-700">Cash Paid to Mason</label>
                                        <p className="text-gray-500">I paid cash to the mason for this coupon.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Submit Scan'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
