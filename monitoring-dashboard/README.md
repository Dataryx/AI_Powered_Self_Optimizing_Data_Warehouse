# Monitoring Dashboard

React-based monitoring dashboard for the AI-Powered Self-Optimizing Data Warehouse.

## Features

- Real-time metrics visualization
- Query performance monitoring
- Resource utilization tracking
- Optimization recommendations management
- Alert management
- Analytics and insights

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The dashboard will be available at http://localhost:3000

### Build

```bash
npm run build
```

### Environment Variables

Create a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_BASE_URL=ws://localhost:8000
```

## Project Structure

```
src/
├── components/          # React components
│   ├── common/         # Shared components
│   ├── dashboard/      # Dashboard components
│   ├── optimization/   # Optimization components
│   ├── analytics/      # Analytics components
│   └── alerts/         # Alert components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API services
├── store/              # Redux store
├── types/              # TypeScript types
└── utils/              # Utility functions
```

## Technologies

- React 18
- TypeScript
- Material-UI
- Redux Toolkit
- React Query
- Recharts
- Socket.IO Client
- Vite

## API Integration

The dashboard connects to the API Gateway at the configured base URL. Ensure the API Gateway is running before starting the dashboard.

## WebSocket

Real-time updates are provided via WebSocket connections. The dashboard automatically connects to the WebSocket endpoint and subscribes to relevant channels.

