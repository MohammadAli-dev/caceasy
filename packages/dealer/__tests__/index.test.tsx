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
jest.mock('axios');

describe('Dealer Frontend', () => {
    it('renders login page', () => {
        render(<Login />);
        expect(screen.getByText('Dealer Portal')).toBeInTheDocument();
    });
});
