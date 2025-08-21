# Governance Service

The Governance Service is a comprehensive platform that implements all governance-related activities (A061-A068) for the CogniSync platform. It provides workflow management, user access control, document management, notifications, data processing, dashboards, reporting, and predictive analytics.

## Features

### A061: Governance Workflow Engine
- **Configurable Workflow Engine**: Build and manage complex approval workflows
- **Process Automation**: Automated task assignment and escalation
- **Real-time Monitoring**: Track workflow progress and performance

### A062: User Management and Access Control
- **User Management System**: Complete user lifecycle management
- **Role-Based Access Control (RBAC)**: Granular permission system
- **Security Features**: JWT authentication, password policies, audit logging

### A063: Document and Policy Management
- **Document Management**: Upload, version, and organize documents
- **Version Control**: Track document changes and history
- **Approval Workflows**: Automated document approval processes

### A064: Notification and Communication
- **Real-time Notifications**: WebSocket-based instant notifications
- **Email Integration**: Automated email notifications
- **Escalation Mechanisms**: Automatic escalation for overdue items

### A065: Data Collection and Processing
- **Data Sources**: Connect to multiple data sources
- **Processing Pipelines**: Automated data collection and processing
- **Analytics Capabilities**: Built-in data analysis features

### A066: Dashboard and Visualization
- **Executive Dashboards**: High-level overview dashboards
- **Operational Dashboards**: Detailed operational metrics
- **Interactive Visualizations**: Drill-down capabilities

### A067: Reporting Functions
- **Standard Reports**: Pre-built governance reports
- **Custom Report Builder**: Create custom reports with drag-and-drop
- **Scheduled Reports**: Automated report generation and distribution

### A068: Predictive Analytics and Insights
- **Predictive Models**: Machine learning-based predictions
- **Trend Analysis**: Identify patterns and trends
- **Automated Insights**: AI-generated insights and recommendations

## Architecture

The service follows a modular microservices architecture with:

- **Express.js** server with TypeScript
- **Prisma ORM** for database operations
- **PostgreSQL** database
- **WebSocket** support for real-time features
- **JWT** authentication and authorization
- **Multi-tenant** architecture with tenant isolation

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - User logout

### Workflows (A061)
- `GET /api/v1/workflows` - List workflows
- `POST /api/v1/workflows` - Create workflow
- `GET /api/v1/workflows/:id` - Get workflow details
- `PUT /api/v1/workflows/:id` - Update workflow
- `DELETE /api/v1/workflows/:id` - Delete workflow
- `POST /api/v1/workflows/:id/instances` - Start workflow instance
- `GET /api/v1/workflows/tasks/assigned` - Get user tasks
- `POST /api/v1/workflows/tasks/:taskId/complete` - Complete task

### Users (A062)
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/:id` - Get user details
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user
- `GET /api/v1/users/roles` - List roles
- `POST /api/v1/users/roles` - Create role

### Documents (A063)
- `GET /api/v1/documents` - List documents
- `POST /api/v1/documents` - Create document
- `GET /api/v1/documents/:id` - Get document details
- `PUT /api/v1/documents/:id` - Update document
- `DELETE /api/v1/documents/:id` - Delete document
- `POST /api/v1/documents/:id/approve` - Approve document
- `GET /api/v1/documents/:id/versions` - Get document versions

### Notifications (A064)
- `GET /api/v1/notifications` - List notifications
- `POST /api/v1/notifications` - Send notification
- `PUT /api/v1/notifications/:id/read` - Mark as read
- `PUT /api/v1/notifications/read-all` - Mark all as read
- `GET /api/v1/notifications/templates` - List templates

### Data (A065)
- `GET /api/v1/data/sources` - List data sources
- `POST /api/v1/data/sources` - Create data source
- `GET /api/v1/data/collections` - List data collections
- `POST /api/v1/data/collections` - Create data collection
- `POST /api/v1/data/collections/:id/run` - Run data collection

### Dashboards (A066)
- `GET /api/v1/dashboards` - List dashboards
- `POST /api/v1/dashboards` - Create dashboard
- `GET /api/v1/dashboards/:id` - Get dashboard details
- `PUT /api/v1/dashboards/:id` - Update dashboard
- `DELETE /api/v1/dashboards/:id` - Delete dashboard

### Reports (A067)
- `GET /api/v1/reports` - List reports
- `POST /api/v1/reports` - Create report
- `GET /api/v1/reports/:id` - Get report details
- `POST /api/v1/reports/:id/generate` - Generate report
- `GET /api/v1/reports/:id/executions` - List report executions
- `GET /api/v1/reports/standard` - Get standard reports

### Analytics (A068)
- `GET /api/v1/analytics/models` - List analytics models
- `POST /api/v1/analytics/models` - Create analytics model
- `POST /api/v1/analytics/predict` - Make prediction
- `GET /api/v1/analytics/insights` - Get insights
- `POST /api/v1/analytics/trends` - Analyze trends
- `POST /api/v1/analytics/anomalies` - Detect anomalies

### Health
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /health/metrics` - Service metrics

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Seed database** (optional):
   ```bash
   npx prisma db seed
   ```

## Development

1. **Start development server**:
   ```bash
   npm run dev
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

4. **Start production server**:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3004` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Required |
| `EMAIL_HOST` | SMTP host | Optional |
| `EMAIL_PORT` | SMTP port | Optional |
| `REDIS_URL` | Redis connection string | Optional |
| `UPLOAD_PATH` | File upload directory | `./uploads` |
| `REPORTS_PATH` | Report output directory | `./reports` |

### Database Schema

The service uses Prisma ORM with PostgreSQL. Key entities include:

- **Users & Roles**: User management and RBAC
- **Workflows**: Workflow definitions and instances
- **Tasks**: Workflow tasks and assignments
- **Documents**: Document management and versioning
- **Notifications**: Notification system
- **Reports**: Report definitions and executions
- **Analytics**: Models, predictions, and insights

## Security

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Tenant Isolation**: Multi-tenant data isolation
- **Input Validation**: Joi schema validation
- **Rate Limiting**: Request rate limiting
- **Security Headers**: Helmet.js security headers
- **Audit Logging**: Comprehensive audit trails

## Monitoring

- **Health Checks**: Multiple health check endpoints
- **Metrics**: Performance and usage metrics
- **Logging**: Structured logging with Winston
- **Error Handling**: Comprehensive error handling
- **Performance Monitoring**: Request timing and performance tracking

## Integration

The Governance Service integrates with other CogniSync services:

- **Atlassian Sync Service**: Workflow triggers from Atlassian events
- **Knowledge Graph Service**: Document and workflow metadata
- **LLM-RAG Service**: AI-powered insights and recommendations

## WebSocket Events

Real-time features are supported via WebSocket connections:

- **Workflow Updates**: Real-time workflow status changes
- **Notifications**: Instant notification delivery
- **Analytics Updates**: Live dashboard updates
- **Task Assignments**: Real-time task notifications

## Deployment

### Docker

```bash
# Build image
docker build -t governance-service .

# Run container
docker run -p 3004:3004 governance-service
```

### Kubernetes

Use the provided Kubernetes manifests in the `/kubernetes` directory.

### Environment-specific Configurations

- **Development**: Full logging, debug features enabled
- **Staging**: Production-like with additional monitoring
- **Production**: Optimized performance, security hardened

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Follow the commit message conventions

## License

This project is licensed under the MIT License.