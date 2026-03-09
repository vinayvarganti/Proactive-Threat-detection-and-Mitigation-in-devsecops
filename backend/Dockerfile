FROM node:18-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    python3 \
    python3-pip \
    gnupg \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Gitleaks
RUN wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz && \
    tar -xzf gitleaks_8.18.0_linux_x64.tar.gz && \
    mv gitleaks /usr/local/bin/ && \
    chmod +x /usr/local/bin/gitleaks && \
    rm gitleaks_8.18.0_linux_x64.tar.gz

# Install Semgrep
RUN pip3 install semgrep

# Install Trivy
RUN wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /usr/share/keyrings/trivy.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee -a /etc/apt/sources.list.d/trivy.list && \
    apt-get update && \
    apt-get install -y trivy && \
    rm -rf /var/lib/apt/lists/*

# Copy only backend package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend code
COPY . .

# Build TypeScript with production config
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
