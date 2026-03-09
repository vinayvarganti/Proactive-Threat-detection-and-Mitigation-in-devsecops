# Deployment Guide

This guide covers deploying the DevSecOps Platform to production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Production Build](#production-build)
3. [Deployment Options](#deployment-options)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Platform Deployment](#cloud-platform-deployment)
6. [Post-Deployment](#post-deployment)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Pre-Deployment Checklist

Before deploying to production, ensure:

### Code Quality
- [ ] All tests pass (`npm test`)
- [ ] Test coverage meets minimum 80%
- [ ] No TypeScript compilation errors
- [ ] No linting errors
- [ ] Security audit passes (`npm audit`)

### Configuration
- [ ] Production environment variables configured
- [ ] Different secrets from development
- [ ] MongoDB production instance ready
- [ ] GitHub OAuth app configured for production URLs
- [ ] Gemini API key has sufficient quota
- [ ] SSL certificates obtained
- [ ] Domain names configured

### Security
- [ ] All secrets stored securely (not in code)
- [ ] HTTPS enabled for all endpoints
- [ ] CORS configured for production domains only
- [ ] Rate limiting configured appropriately
- [ ] Security headers enabled (Helmet)
- [ ] Session cookies set to secure mode

### Infrastructure
- [ ] Server/hosting platform ready
- [ ] MongoDB backup strategy in place
- [ ] Monitoring tools configured
- [ ] Log aggregation set up
- [ ] CDN configured (optional)

---

## Production Build

### Backend Build

```bash
cd backend

# Install production dependencies only
npm ci --production

# Build TypeScript to JavaScript
npm run build

# Verify build
ls -la dist/
```

**Build Output**:
- Compiled JavaScript in `dist/` directory
- Source maps for debugging
- All dependencies in `node_modules/`

### Frontend Build

```bash
cd frontend

# Install dependencies
npm ci

# Build optimized production bundle
npm run build

# Verify build
ls -la dist/
```

**Build Output**:
- Optimized HTML, CSS, JS in `dist/` directory
- Assets with content hashes for cache busting
- Minified and tree-shaken code
- Source maps (optional, for debugging)

**Build Optimization**:
- Code splitting for faster initial load
- Asset optimization (images, fonts)
- CSS minification
- JavaScript minification and tree-shaking

---

## Deployment Options

### Option 1: Traditional Server (VPS, EC2, Dedicated Server)

#### Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+ installed
- MongoDB installed or connection to MongoDB Atlas
- Nginx or Apache for reverse proxy
- SSL certificates (Let's Encrypt recommended)

#### Backend Deployment

1. **Transfer files to server**:
```bash
# Using rsync
rsync -avz --exclude 'node_modules' backend/ user@server:/var/www/devsecops-backend/

# Or using git
ssh user@server
cd /var/www/devsecops-backend
git pull origin main
```

2. **Install dependencies and build**:
```bash
cd /var/www/devsecops-backend
npm ci --production
npm run build
```

3. **Configure environment**:
```bash
# Create .env file with production values
nano .env
```

4. **Set up process manager (PM2)**:
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start dist/index.js --name devsecops-backend

# Configure auto-restart on server reboot
pm2 startup
pm2 save

# Monitor
pm2 status
pm2 logs devsecops-backend
```

5. **Alternative: Systemd service**:
```bash
# Create service file
sudo nano /etc/systemd/system/devsecops-backend.service
```

```ini
[Unit]
Description=DevSecOps Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/devsecops-backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable devsecops-backend
sudo systemctl start devsecops-backend
sudo systemctl status devsecops-backend
```

#### Frontend Deployment

1. **Transfer build files**:
```bash
# Copy dist/ contents to web server
rsync -avz frontend/dist/ user@server:/var/www/devsecops-frontend/
```

2. **Configure Nginx**:
```bash
sudo nano /etc/nginx/sites-available/devsecops-frontend
```

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    root /var/www/devsecops-frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

3. **Enable site and reload Nginx**:
```bash
sudo ln -s /etc/nginx/sites-available/devsecops-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Backend Reverse Proxy (Nginx)

```bash
sudo nano /etc/nginx/sites-available/devsecops-backend
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/devsecops-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### SSL Configuration (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

---

### Option 2: Docker Deployment

#### Create Dockerfiles

**Backend Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]
```

**Frontend Dockerfile** (`frontend/Dockerfile`):
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Frontend Nginx Config** (`frontend/nginx.conf`):
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Docker Compose

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    container_name: devsecops-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
      MONGO_INITDB_DATABASE: devsecops-platform
    volumes:
      - mongodb_data:/data/db
    networks:
      - devsecops-network
    ports:
      - "27017:27017"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: devsecops-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      MONGODB_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/devsecops-platform?authSource=admin
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      GITHUB_CALLBACK_URL: ${GITHUB_CALLBACK_URL}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      TOKEN_ENCRYPTION_KEY: ${TOKEN_ENCRYPTION_KEY}
      SESSION_SECRET: ${SESSION_SECRET}
      FRONTEND_URL: ${FRONTEND_URL}
      SCAN_RATE_LIMIT: 10
      SCAN_RATE_WINDOW_HOURS: 1
    depends_on:
      - mongodb
    networks:
      - devsecops-network
    ports:
      - "3000:3000"
    volumes:
      - ./backend/logs:/app/logs

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: devsecops-frontend
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - devsecops-network
    ports:
      - "80:80"

volumes:
  mongodb_data:

networks:
  devsecops-network:
    driver: bridge
```

**.env file for Docker Compose**:
```env
MONGO_PASSWORD=your_secure_mongo_password
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://api.yourdomain.com/api/auth/github/callback
GEMINI_API_KEY=your_gemini_api_key
TOKEN_ENCRYPTION_KEY=your_64_char_encryption_key
SESSION_SECRET=your_128_char_session_secret
FRONTEND_URL=https://app.yourdomain.com
```

#### Deploy with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

---

### Option 3: Cloud Platform Deployment

#### AWS Deployment

**Backend (EC2 + RDS/DocumentDB)**:
1. Launch EC2 instance (t3.medium or larger)
2. Set up MongoDB on DocumentDB or MongoDB Atlas
3. Configure security groups (allow 3000, 443)
4. Deploy using traditional server method
5. Use Application Load Balancer for scaling
6. Configure Auto Scaling Group

**Frontend (S3 + CloudFront)**:
1. Build frontend: `npm run build`
2. Create S3 bucket
3. Upload `dist/` contents to S3
4. Configure bucket for static website hosting
5. Create CloudFront distribution
6. Configure custom domain and SSL

**Alternative: Elastic Beanstalk**:
- Deploy both frontend and backend as separate applications
- Automatic scaling and load balancing
- Integrated monitoring

#### Heroku Deployment

**Backend**:
1. Create `Procfile`:
```
web: node dist/index.js
```

2. Deploy:
```bash
heroku create devsecops-backend
heroku addons:create mongolab
heroku config:set GITHUB_CLIENT_ID=xxx
heroku config:set GITHUB_CLIENT_SECRET=xxx
# ... set other env vars
git push heroku main
```

**Frontend**:
1. Create `static.json`:
```json
{
  "root": "dist/",
  "clean_urls": true,
  "routes": {
    "/**": "index.html"
  }
}
```

2. Deploy:
```bash
heroku create devsecops-frontend
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-static
git push heroku main
```

#### Vercel Deployment

**Frontend**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

**Backend**:
- Convert to serverless functions
- Or deploy to separate platform (Railway, Render)

#### Google Cloud Platform

**Backend (Cloud Run)**:
```bash
# Build and push Docker image
gcloud builds submit --tag gcr.io/PROJECT_ID/devsecops-backend

# Deploy to Cloud Run
gcloud run deploy devsecops-backend \
  --image gcr.io/PROJECT_ID/devsecops-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

**Frontend (Cloud Storage + Cloud CDN)**:
```bash
# Create bucket
gsutil mb gs://devsecops-frontend

# Upload files
gsutil -m cp -r dist/* gs://devsecops-frontend

# Make public
gsutil iam ch allUsers:objectViewer gs://devsecops-frontend
```

---

## Post-Deployment

### Verification Checklist

- [ ] Health check endpoint responds: `curl https://api.yourdomain.com/health`
- [ ] Frontend loads: Visit `https://app.yourdomain.com`
- [ ] GitHub OAuth works: Test login flow
- [ ] Repository listing works
- [ ] Scan functionality works
- [ ] AI fix functionality works
- [ ] Commit functionality works
- [ ] All API endpoints respond correctly
- [ ] HTTPS is enforced
- [ ] Security headers are present
- [ ] Rate limiting works
- [ ] Error logging works

### Smoke Tests

```bash
# Health check
curl https://api.yourdomain.com/health

# Auth status (should return 401 or auth status)
curl https://api.yourdomain.com/api/auth/status

# Test CORS
curl -H "Origin: https://app.yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS \
  https://api.yourdomain.com/api/auth/status
```

### Database Backup

**MongoDB Atlas**:
- Automatic backups enabled by default
- Configure backup schedule
- Test restore procedure

**Self-hosted MongoDB**:
```bash
# Backup
mongodump --uri="mongodb://localhost:27017/devsecops-platform" --out=/backup/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/devsecops-platform" /backup/20240101

# Automated backup script
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

---

## Monitoring and Maintenance

### Application Monitoring

**Backend Monitoring**:
- Use PM2 monitoring: `pm2 monit`
- Set up application performance monitoring (New Relic, Datadog)
- Monitor API response times
- Track error rates

**Frontend Monitoring**:
- Browser error tracking (Sentry)
- Core Web Vitals monitoring
- User analytics

### Log Management

**Backend Logs**:
```bash
# View logs with PM2
pm2 logs devsecops-backend

# View logs with systemd
sudo journalctl -u devsecops-backend -f

# Log rotation
sudo nano /etc/logrotate.d/devsecops-backend
```

**Log Aggregation**:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- CloudWatch Logs (AWS)
- Google Cloud Logging
- Papertrail, Loggly

### Alerts

Set up alerts for:
- Application downtime
- High error rates
- Database connection failures
- High memory/CPU usage
- Disk space low
- SSL certificate expiration
- API rate limit exceeded

### Updates and Maintenance

**Regular Tasks**:
- Update dependencies: `npm update`
- Security audits: `npm audit`
- Rotate secrets quarterly
- Review and clean logs
- Database optimization
- Performance testing

**Zero-Downtime Deployment**:
1. Deploy new version to staging
2. Run smoke tests
3. Deploy to production with rolling update
4. Monitor for errors
5. Rollback if issues detected

**Rollback Procedure**:
```bash
# PM2
pm2 reload devsecops-backend

# Docker
docker-compose down
docker-compose up -d --build

# Git-based
git checkout previous-version
npm run build
pm2 restart devsecops-backend
```

---

## Troubleshooting

### Common Issues

**"Cannot connect to MongoDB"**:
- Check MONGODB_URI
- Verify network connectivity
- Check MongoDB service status
- Verify credentials

**"GitHub OAuth fails"**:
- Verify callback URL matches exactly
- Check client ID and secret
- Ensure OAuth app is active

**"High memory usage"**:
- Check for memory leaks
- Increase server resources
- Optimize database queries
- Enable connection pooling

**"Slow response times"**:
- Enable caching
- Optimize database indexes
- Use CDN for static assets
- Scale horizontally

### Support Resources

- Application logs: `backend/logs/`
- System logs: `/var/log/`
- MongoDB logs: `/var/log/mongodb/`
- Nginx logs: `/var/log/nginx/`

---

## Security Hardening

### Production Security Checklist

- [ ] HTTPS enforced everywhere
- [ ] Security headers configured (Helmet)
- [ ] CORS restricted to production domains
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using Mongoose)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secrets stored securely
- [ ] Regular security audits
- [ ] Dependency vulnerability scanning
- [ ] Firewall configured
- [ ] SSH key-based authentication only
- [ ] Fail2ban or similar intrusion prevention
- [ ] Regular backups tested

### Compliance

If handling sensitive data:
- GDPR compliance (EU)
- CCPA compliance (California)
- SOC 2 compliance
- Regular penetration testing
- Security incident response plan

---

## Cost Optimization

### Infrastructure Costs

**Development**:
- Local MongoDB: Free
- GitHub OAuth: Free
- Gemini API: Free tier available

**Production**:
- MongoDB Atlas: $0-$57+/month (M0-M10 clusters)
- AWS EC2: $10-$100+/month (t3.medium-t3.xlarge)
- Heroku: $7-$50+/month per dyno
- Vercel: Free-$20+/month
- Domain + SSL: $10-$20/year

### Optimization Tips

- Use MongoDB Atlas free tier for small deployments
- Use serverless for variable traffic
- Enable caching to reduce API calls
- Use CDN for static assets
- Monitor and optimize Gemini API usage
- Use spot instances for non-critical workloads

---

## Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Let's Encrypt](https://letsencrypt.org/)
- [AWS Documentation](https://docs.aws.amazon.com/)
