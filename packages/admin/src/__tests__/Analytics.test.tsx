import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AnalyticsPage from '../pages/analytics';
import api from '../lib/api';

// Mock the Next.js router
jest.mock('next/router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        pathname: '/analytics',
        query: {},
        asPath: '/analytics',
    }),
}));

// Mock the api module
jest.mock('../lib/api');



describe('Analytics Page', () => {
    beforeEach(() => {
        // Mock sessionStorage
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                getItem: jest.fn(() => 'test-admin-key'),
                setItem: jest.fn(),
                removeItem: jest.fn(),
            },
            writable: true,
        });

        // Reset mocks
        jest.clearAllMocks();
    });

    it('should render KPI tiles with data from API', async () => {
        // Mock API responses
        const mockOverview = {
            scans_per_day: 150,
            active_masons: 60,
            redemption_rate: 0.8,
            pending_payouts_count: 5,
            top_regions: [
                { region: 'North', count: 50 },
                { region: 'South', count: 40 },
            ],
            date: '2023-11-23',
        };

        const mockDaily = {
            daily: [
                {
                    date: '2023-11-20',
                    scans: 120,
                    active_masons: 50,
                    redemptions: 96,
                    redemption_rate: 0.8,
                },
                {
                    date: '2023-11-21',
                    scans: 135,
                    active_masons: 55,
                    redemptions: 108,
                    redemption_rate: 0.8,
                },
                {
                    date: '2023-11-22',
                    scans: 150,
                    active_masons: 60,
                    redemptions: 120,
                    redemption_rate: 0.8,
                },
            ],
        };

        const mockRegions = {
            regions: [
                { region: 'North', count: 150 },
                { region: 'South', count: 120 },
                { region: 'East', count: 100 },
            ],
        };

        (api.get as jest.Mock).mockImplementation((url: string) => {
            if (url === '/admin/analytics/overview') {
                return Promise.resolve({ data: mockOverview });
            } else if (url.startsWith('/admin/analytics/daily')) {
                return Promise.resolve({ data: mockDaily });
            } else if (url.startsWith('/admin/analytics/regions')) {
                return Promise.resolve({ data: mockRegions });
            }
            return Promise.reject(new Error('Unknown endpoint'));
        });

        render(<AnalyticsPage />);

        // Wait for data to load
        await waitFor(() => {
            expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument();
        });

        // Check KPI tiles
        expect(screen.getByTestId('kpi-scans')).toBeInTheDocument(); // Scans/Day
        expect(screen.getByTestId('kpi-active-masons')).toBeInTheDocument(); // Active Masons
        expect(screen.getByTestId('kpi-redemption-rate')).toBeInTheDocument(); // Redemption Rate
        expect(screen.getByTestId('kpi-pending-payouts')).toBeInTheDocument(); // Pending Payouts
    });

    it('should render charts', async () => {
        const mockOverview = {
            scans_per_day: 150,
            active_masons: 60,
            redemption_rate: 0.8,
            pending_payouts_count: 5,
            top_regions: [],
            date: '2023-11-23',
        };

        const mockDaily = {
            daily: [
                {
                    date: '2023-11-23',
                    scans: 150,
                    active_masons: 60,
                    redemptions: 120,
                    redemption_rate: 0.8,
                },
            ],
        };

        const mockRegions = {
            regions: [{ region: 'North', count: 150 }],
        };

        (api.get as jest.Mock).mockImplementation((url: string) => {
            if (url === '/admin/analytics/overview') {
                return Promise.resolve({ data: mockOverview });
            } else if (url.startsWith('/admin/analytics/daily')) {
                return Promise.resolve({ data: mockDaily });
            } else if (url.startsWith('/admin/analytics/regions')) {
                return Promise.resolve({ data: mockRegions });
            }
            return Promise.reject(new Error('Unknown endpoint'));
        });

        render(<AnalyticsPage />);

        await waitFor(() => {
            expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument();
        });

        // Check that chart components are rendered
        expect(screen.getByText('Scans Over Time')).toBeInTheDocument();
        expect(screen.getByText('Active Masons Over Time')).toBeInTheDocument();
        expect(screen.getByText('Redemption Rate Trend')).toBeInTheDocument();
        expect(screen.getByText('Top Regions')).toBeInTheDocument();
    });

    it('should render daily summary table', async () => {
        const mockOverview = {
            scans_per_day: 150,
            active_masons: 60,
            redemption_rate: 0.8,
            pending_payouts_count: 5,
            top_regions: [],
            date: '2023-11-23',
        };

        const mockDaily = {
            daily: [
                {
                    date: '2023-11-20',
                    scans: 120,
                    active_masons: 50,
                    redemptions: 96,
                    redemption_rate: 0.8,
                },
                {
                    date: '2023-11-21',
                    scans: 135,
                    active_masons: 55,
                    redemptions: 108,
                    redemption_rate: 0.8,
                },
            ],
        };

        const mockRegions = {
            regions: [],
        };

        (api.get as jest.Mock).mockImplementation((url: string) => {
            if (url === '/admin/analytics/overview') {
                return Promise.resolve({ data: mockOverview });
            } else if (url.startsWith('/admin/analytics/daily')) {
                return Promise.resolve({ data: mockDaily });
            } else if (url.startsWith('/admin/analytics/regions')) {
                return Promise.resolve({ data: mockRegions });
            }
            return Promise.reject(new Error('Unknown endpoint'));
        });

        render(<AnalyticsPage />);

        await waitFor(() => {
            expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument();
        });

        // Check table headers
        expect(screen.getByText('Daily Summary')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Scans')).toBeInTheDocument();
        expect(screen.getAllByText('Active Masons').length).toBeGreaterThan(0);
        expect(screen.getByText('Redemptions')).toBeInTheDocument();
        expect(screen.getByText('Rate')).toBeInTheDocument();

        // Check table data
        expect(screen.getByText('2023-11-20')).toBeInTheDocument();
        expect(screen.getByText('2023-11-21')).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
        expect(screen.getByText('135')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
        (api.get as jest.Mock).mockRejectedValue(new Error('API Error'));

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        render(<AnalyticsPage />);

        await waitFor(() => {
            expect(screen.queryByText('Loading analytics...')).not.toBeInTheDocument();
        });

        // Page should still render even with API errors
        expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();

        consoleErrorSpy.mockRestore();
    });
});
