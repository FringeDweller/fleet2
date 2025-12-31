#!/bin/bash
# Generate self-signed SSL certificates for development
# NOT for production use!

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
DAYS_VALID=365
KEY_SIZE=2048
COMMON_NAME="${COMMON_NAME:-localhost}"
SUBJECT="/C=US/ST=Development/L=Local/O=Fleet2/OU=Development/CN=${COMMON_NAME}"

echo "Generating self-signed SSL certificates for development..."
echo "Common Name: ${COMMON_NAME}"
echo "Valid for: ${DAYS_VALID} days"
echo ""

# Generate private key
openssl genrsa -out privkey.pem ${KEY_SIZE}

# Generate certificate signing request
openssl req -new -key privkey.pem -out csr.pem -subj "${SUBJECT}"

# Generate self-signed certificate
openssl x509 -req -days ${DAYS_VALID} -in csr.pem -signkey privkey.pem -out fullchain.pem \
    -extfile <(printf "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1")

# Clean up CSR
rm -f csr.pem

# Set proper permissions
chmod 600 privkey.pem
chmod 644 fullchain.pem

echo ""
echo "Certificates generated successfully!"
echo "  - fullchain.pem: SSL certificate"
echo "  - privkey.pem: Private key"
echo ""
echo "WARNING: These are self-signed certificates for DEVELOPMENT ONLY."
echo "For production, use certificates from a trusted CA."
