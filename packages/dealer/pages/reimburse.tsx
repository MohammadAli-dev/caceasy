import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '../utils/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, DollarSign } from 'lucide-react';

export default function Reimburse() {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState(0);
    const router = useRouter();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('dealer_user');
        if (!storedUser) {
            router.push('/');
            return;
        }
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        fetchBalance(parsedUser.id);
    }, [router]);

    const fetchBalance = async (userId: string) => {
        try {
            const res = await api.get(`/dealer/${userId}/wallet`);
            setBalance(res.data.balance);
        } catch (error) {
            console.error('Failed to fetch balance', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid amount');
            setLoading(false);
            return;
        }

        if (amountNum > balance) {
            toast.error('Insufficient balance');
            setLoading(false);
            return;
        }

        try {
            await api.post(`/dealer/${user.id}/reimburse`, { amount: amountNum });
            toast.success('Payout request submitted!');
            router.push('/wallet');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Request failed');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/wallet" className="text-gray-600 hover:text-gray-900 flex items-center">
                                <ArrowLeft className="h-5 w-5 mr-1" />
                                Back to Wallet
                            </Link>
                        </div>
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-900">Request Payout</h1>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-md mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="mb-6">
                        <p className="text-sm text-gray-500">Available Balance</p>
                        <p className="text-2xl font-bold text-gray-900">{balance}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                                Amount to Withdraw
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="number"
                                    name="amount"
                                    id="amount"
                                    required
                                    min="1"
                                    max={balance}
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || balance <= 0}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
