# MinIO Storage Service

Lightweight S3-compatible object storage for Lend a Hand media files.

## Overview

MinIO provides a self-hosted S3-compatible object storage solution. Media files (campaign images, news images) are stored separately from the Django application server.

## Development Setup

MinIO starts automatically with `./start-dev.sh`. The service runs on:
- **API Endpoint**: `http://localhost:9000`
- **Console**: `http://localhost:9001`
- **Default Credentials**:
  - Access Key: `minioadmin`
  - Secret Key: `minioadmin`

⚠️ **Security Note**: Change default credentials in production!

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MINIO_ROOT_USER` | Admin username | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | Admin password | `minioadmin` |
| `MINIO_API_PORT` | API port | `9000` |
| `MINIO_CONSOLE_PORT` | Web console port | `9001` |

## Using Docker Compose

```bash
cd storage
docker-compose up -d
```

## Kubernetes Deployment

See `devops/lendahand/values.yaml` for MinIO configuration in Kubernetes.

## Accessing MinIO Console

1. Navigate to `http://localhost:9001` (development)
2. Login with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
3. Create bucket: `lendahand-media`
4. Set bucket policy to allow public read access if needed

## Bucket Configuration

The Django application expects a bucket named `lendahand-media`. Create it via:
- MinIO Console (Web UI)
- `mc` CLI tool
- Django management command (if implemented)

## Backup

MinIO data is stored in Docker volume `minio_data`. To backup:
```bash
docker run --rm -v lendahand-minio_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data
```

## Troubleshooting

- **Connection refused**: Ensure MinIO is running (`docker ps`)
- **Bucket not found**: Create `lendahand-media` bucket via console
- **Access denied**: Check credentials in Django settings
