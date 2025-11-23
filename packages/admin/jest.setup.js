import '@testing-library/jest-dom';

// Mock lucide-react
jest.mock('lucide-react', () => {
    return new Proxy({}, {
        get: (target, prop) => {
            // Return a component that renders the icon name
            const Icon = () => <div data-testid={`icon-${String(prop)}`} />;
            Icon.displayName = String(prop);
            return Icon;
        },
    });
});
