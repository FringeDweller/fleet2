# Fleet2 Production Dockerfile
# Optimized for pre-built deployments
# Run `bun run build` locally before building this image

FROM oven/bun:1.3-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxt

# Copy pre-built application (run `bun run build` before docker build)
COPY --chown=nuxt:nodejs .output ./.output
COPY --chown=nuxt:nodejs package.json ./package.json

# Install wget for health checks
RUN apk add --no-cache wget

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=47293

# Switch to non-root user
USER nuxt

# Expose port
EXPOSE 47293

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:47293/api/_health || exit 1

# Start the application
CMD ["bun", ".output/server/index.mjs"]
