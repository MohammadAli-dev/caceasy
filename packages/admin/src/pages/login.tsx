import { useState } from 'react';
import { useRouter } from 'next/router';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Login() {
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Test API key by calling analytics endpoint
            sessionStorage.setItem('admin_api_key', apiKey);
            await api.get('/admin/analytics');

            toast.success('Login successful');
            router.push('/');
        } catch (error: any) {
            sessionStorage.removeItem('admin_api_key');
            toast.error(error.response?.data?.message || 'Invalid API key');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <p className="text-sm text-yellow-700">
                        <strong>Security Notice:</strong> This uses an API key stored in session storage. Do not use on untrusted devices.
                    </p>
                </div>
                <form onSubmit={handleLogin}>
                    <label className="block mb-4">
                        <span className="text-gray-700">Admin API Key</span>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                            placeholder="Enter your admin API key"
                            required
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {loading ? 'Verifying...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
