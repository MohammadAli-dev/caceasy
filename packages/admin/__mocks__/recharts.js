// Minimal mock for recharts – exports chart components as simple React elements
const React = require('react');

const Mock = (props) => React.createElement('div', { ...props }, props.children);

module.exports = {
    ResponsiveContainer: Mock,
    AreaChart: Mock,
    LineChart: Mock,
    BarChart: Mock,
    Line: Mock,
    Area: Mock,
    Bar: Mock,
    XAxis: Mock,
    YAxis: Mock,
    CartesianGrid: Mock,
    Tooltip: Mock,
    Legend: Mock,
};
