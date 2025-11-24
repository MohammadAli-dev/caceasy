import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from '../pages/index';

// Mock next/router
jest.mock('next/router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        pathname: '/',
        query: {},
        asPath: '/',
    }),
}));

// Mock axios
jest.mock('axios', () => ({
    create: jest.fn(() => ({
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
        get: jest.fn(() => Promise.resolve({ data: {} })),
        post: jest.fn(() => Promise.resolve({ data: {} })),
    })),
}));

describe('Dealer Frontend', () => {
    it('renders login page', () => {
        render(<Login />);
        expect(screen.getByText('Dealer Portal')).toBeInTheDocument();
    });
});
