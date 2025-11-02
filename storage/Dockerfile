# MinIO Server Dockerfile
# Lightweight S3-compatible object storage for media files

FROM minio/minio:latest

# Create data directory
RUN mkdir -p /data

# Expose MinIO API port (default 9000) and Console port (9001)
EXPOSE 9000 9001

# Health check
HEALTHCHECK --interval=30s --timeout=20s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:9000/minio/health/live || exit 1

# MinIO server command
# Default root user and password should be set via environment variables
CMD ["server", "/data", "--console-address", ":9001"]
