#!/bin/bash

# CogniSync Shared Security Module Installation Script
# This script sets up the shared security module for all services

set -e

echo "🔐 Installing CogniSync Shared Security Module..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the module
echo "🔨 Building the module..."
npm run build

# Create symlinks for services
echo "🔗 Creating symlinks for services..."

SERVICES=("atlassian-sync-service" "knowledge-graph-service" "llm-rag-service")

for service in "${SERVICES[@]}"; do
    if [ -d "../$service" ]; then
        echo "  Linking to $service..."
        
        # Create node_modules/@cognisync directory if it doesn't exist
        mkdir -p "../$service/node_modules/@cognisync"
        
        # Remove existing symlink if it exists
        if [ -L "../$service/node_modules/@cognisync/shared-security" ]; then
            rm "../$service/node_modules/@cognisync/shared-security"
        fi
        
        # Create symlink
        ln -sf "$(pwd)" "../$service/node_modules/@cognisync/shared-security"
        
        echo "  ✅ Linked to $service"
    else
        echo "  ⚠️  Service directory $service not found, skipping..."
    fi
done

# Copy environment template
echo "📋 Copying environment template..."
if [ ! -f "../.env.security" ]; then
    cp .env.security.example ../.env.security
    echo "  ✅ Created .env.security template"
    echo "  ⚠️  Please edit .env.security with your actual values"
else
    echo "  ℹ️  .env.security already exists, skipping..."
fi

# Generate secure secrets
echo "🔑 Generating secure secrets..."

# Check if openssl is available
if command -v openssl &> /dev/null; then
    echo "  Generating JWT secret..."
    JWT_SECRET=$(openssl rand -hex 64)
    echo "  JWT_SECRET=$JWT_SECRET"
    
    echo "  Generating API key salt..."
    API_KEY_SALT=$(openssl rand -hex 32)
    echo "  API_KEY_SALT=$API_KEY_SALT"
    
    echo "  Generating encryption key..."
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    echo "  ENCRYPTION_KEY=$ENCRYPTION_KEY"
    
    echo ""
    echo "  ⚠️  Please add these secrets to your .env.security file"
else
    echo "  ⚠️  OpenSSL not found. Please generate secrets manually:"
    echo "     node -e \"console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))\""
    echo "     node -e \"console.log('API_KEY_SALT=' + require('crypto').randomBytes(32).toString('hex'))\""
    echo "     node -e \"console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))\""
fi

# Create SSL directory structure
echo "🔒 Setting up SSL directory structure..."
mkdir -p ../ssl/certs
mkdir -p ../ssl/private
mkdir -p ../ssl/ca

echo "  ✅ SSL directories created"
echo "  ℹ️  Place your certificates in:"
echo "     - Server cert: ssl/certs/server.crt"
echo "     - Server key:  ssl/private/server.key"
echo "     - CA cert:     ssl/ca/ca.crt"

# Generate DH parameters for nginx (if openssl is available)
if command -v openssl &> /dev/null; then
    if [ ! -f "../ssl/dhparam.pem" ]; then
        echo "🔐 Generating DH parameters (this may take a while)..."
        openssl dhparam -out ../ssl/dhparam.pem 2048
        echo "  ✅ DH parameters generated"
    else
        echo "  ℹ️  DH parameters already exist, skipping..."
    fi
fi

# Set up git hooks (if in a git repository)
if [ -d "../.git" ]; then
    echo "🔧 Setting up git hooks..."
    
    # Create pre-commit hook to check for secrets
    cat > ../.git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Check for potential secrets in commits

echo "🔍 Checking for potential secrets..."

# Check for common secret patterns
if git diff --cached --name-only | xargs grep -l "JWT_SECRET\|API_KEY\|ENCRYPTION_KEY" 2>/dev/null; then
    echo "❌ Potential secrets found in staged files!"
    echo "Please remove secrets before committing."
    exit 1
fi

echo "✅ No secrets detected"
EOF
    
    chmod +x ../.git/hooks/pre-commit
    echo "  ✅ Pre-commit hook installed"
fi

echo ""
echo "🎉 CogniSync Shared Security Module installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.security with your actual configuration values"
echo "2. Place SSL certificates in the ssl/ directory"
echo "3. Update your service configurations to use the new middleware"
echo "4. Test the security implementation"
echo ""
echo "For detailed instructions, see SECURITY_IMPLEMENTATION_GUIDE.md"