import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '../utils/api';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

export default function Wallet() {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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
        fetchWallet(parsedUser.id);
    }, [router]);

    const fetchWallet = async (userId: string) => {
        try {
            const res = await api.get(`/dealer/${userId}/wallet`);
            setBalance(res.data.balance);
            setTransactions(res.data.transactions);
        } catch (error) {
            console.error('Failed to fetch wallet', error);
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
                            <Link href="/scan" className="text-gray-600 hover:text-gray-900 flex items-center">
                                <ArrowLeft className="h-5 w-5 mr-1" />
                                Back to Scan
                            </Link>
                        </div>
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-900">My Wallet</h1>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-md mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-500">Current Balance</p>
                        <p className="mt-2 text-4xl font-extrabold text-gray-900">{balance}</p>
                        <p className="text-sm text-gray-500">Points / Rupees</p>
                    </div>
                    <div className="mt-6">
                        <Link
                            href="/reimburse"
                            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            <Plus className="h-5 w-5 mr-1" />
                            Request Payout
                        </Link>
                    </div>
                </div>

                <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-gray-200">
                        {transactions.map((tx) => (
                            <li key={tx.id}>
                                <div className="px-4 py-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-indigo-600 truncate capitalize">
                                            {tx.type.replace('_', ' ')}
                                        </p>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tx.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {tx.type === 'credit' ? '+' : '-'}{tx.amount}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 sm:flex sm:justify-between">
                                        <div className="sm:flex">
                                            <p className="flex items-center text-sm text-gray-500">
                                                {tx.note || 'No description'}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                            <p>
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))}
                        {transactions.length === 0 && (
                            <li className="px-4 py-4 text-center text-gray-500 text-sm">
                                No transactions yet.
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}
