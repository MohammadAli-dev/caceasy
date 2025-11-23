// __mocks__/axios.js
// Mock for axios that supports both axios.create() and direct method calls

const createAxiosInstance = () => {
    let mockImplementation = {};

    const instance = {
        get: jest.fn((url, config) => {
            if (mockImplementation.get) {
                return mockImplementation.get(url, config);
            }
            return Promise.reject(new Error(`No mock for GET ${url}`));
        }),
        post: jest.fn((url, data, config) => {
            if (mockImplementation.post) {
                return mockImplementation.post(url, data, config);
            }
            return Promise.reject(new Error(`No mock for POST ${url}`));
        }),
        put: jest.fn((url, data, config) => {
            if (mockImplementation.put) {
                return mockImplementation.put(url, data, config);
            }
            return Promise.reject(new Error(`No mock for PUT ${url}`));
        }),
        delete: jest.fn((url, config) => {
            if (mockImplementation.delete) {
                return mockImplementation.delete(url, config);
            }
            return Promise.reject(new Error(`No mock for DELETE ${url}`));
        }),
        interceptors: {
            request: { use: jest.fn(), eject: jest.fn() },
            response: { use: jest.fn(), eject: jest.fn() },
        },
        // Helper methods
        __setMockImplementation: (method, fn) => {
            mockImplementation[method] = fn;
        },
        __resetMocks: () => {
            instance.get.mockClear();
            instance.post.mockClear();
            instance.put.mockClear();
            instance.delete.mockClear();
            mockImplementation = {};
        },
    };

    return instance;
};

const mockAxios = {
    create: jest.fn(() => createAxiosInstance()),
    ...createAxiosInstance(),
};

export default mockAxios;
