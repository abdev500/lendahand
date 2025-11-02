# MinIO Storage Implementation

This document describes the MinIO (S3-compatible) storage implementation for Lend a Hand media files.

## Overview

Media files (campaign images, news images) are now stored separately from the Django application server using MinIO, a lightweight S3-compatible object storage solution.

## Architecture

### Development Environment
- MinIO runs in Docker via `storage/docker-compose.yml`
- Started automatically with `./start-dev.sh`
- Accessible at:
  - **API**: `http://localhost:9000`
  - **Console**: `http://localhost:9001`
  - **Credentials**: `minioadmin/minioadmin`

### Production (Kubernetes)
- MinIO runs as a separate Kubernetes deployment
- Configured via Helm chart (`devops/lendahand/templates/storage/`)
- Uses PersistentVolumeClaim for data persistence
- Accessible via Kubernetes Service: `lendahand-minio:9000`

## Configuration

### Django Settings

The Django application automatically detects and uses MinIO when:
- `USE_S3_STORAGE=True` environment variable is set
- `AWS_S3_ENDPOINT_URL` points to MinIO server
- Credentials are provided via `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

If MinIO is not available, Django falls back to local file storage.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_S3_STORAGE` | Enable MinIO/S3 storage | `False` |
| `AWS_S3_ENDPOINT_URL` | MinIO server URL | `http://localhost:9000` |
| `AWS_ACCESS_KEY_ID` | MinIO root user | `minioadmin` |
| `AWS_SECRET_ACCESS_KEY` | MinIO root password | `minioadmin` |
| `AWS_STORAGE_BUCKET_NAME` | Bucket name | `lendahand-media` |
| `AWS_S3_USE_SSL` | Enable HTTPS | `False` |
| `AWS_S3_CUSTOM_DOMAIN` | Custom domain for media URLs | `None` |

## Bucket Setup

The bucket `lendahand-media` can be created:

1. **Automatically** - Created on first file upload (via `django-storages`)
2. **Manually** - Via MinIO Console at `http://localhost:9001`
3. **Via CLI** - Using `mc` (MinIO Client)

### Manual Bucket Creation (MinIO Console)

1. Open MinIO Console: `http://localhost:9001`
2. Login with credentials
3. Click "Create Bucket"
4. Name: `lendahand-media`
5. Set access policy:
   - For public read access: Set bucket policy to "Public" or "Download Only"
   - For private: Leave as "Private"

### Bucket Policy (Public Read)

To allow public read access to media files:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::lendahand-media/*"]
    }
  ]
}
```

## File Migration

### From Local to MinIO

If you have existing local media files:

```bash
# 1. Start MinIO
cd storage && docker-compose up -d

# 2. Create bucket (or let it auto-create)

# 3. Use MinIO Client to sync files
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/lendahand-media
mc mirror backend/media/campaigns local/lendahand-media/campaigns/
mc mirror backend/media/news local/lendahand-media/news/

# 4. Update Django settings to use MinIO
export USE_S3_STORAGE=True
```

### From MinIO to Local

```bash
mc mirror local/lendahand-media backend/media/
```

## Troubleshooting

### Connection Issues

- **MinIO not reachable**: Check if MinIO container/service is running
- **Connection refused**: Verify `AWS_S3_ENDPOINT_URL` is correct
- **Access denied**: Check credentials in environment variables

### Bucket Issues

- **Bucket not found**: Create `lendahand-media` bucket via console
- **Permission denied**: Check bucket policy allows read/write

### Django Issues

- **No module named 'storages'**: Install `django-storages` and `boto3`
- **Storage not switching**: Verify `USE_S3_STORAGE=True` is set
- **Media URLs incorrect**: Check `MEDIA_URL` setting matches MinIO endpoint

## Backup

### Backup MinIO Data

```bash
# Using docker volume
docker run --rm \
  -v storage_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data

# Using mc (MinIO Client)
mc mirror local/lendahand-media /backup/lendahand-media/
```

### Restore MinIO Data

```bash
# Using docker volume
docker run --rm \
  -v storage_minio_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/minio-backup-YYYYMMDD.tar.gz -C /

# Using mc
mc mirror /backup/lendahand-media/ local/lendahand-media/
```

## Performance Considerations

- MinIO is lightweight (~50MB RAM minimum)
- For high-traffic: Consider multiple MinIO servers in distributed mode
- Use custom domain with CDN for better performance
- Enable caching headers in Django settings (`AWS_S3_OBJECT_PARAMETERS`)

## Security Notes

⚠️ **IMPORTANT**: Change default credentials in production!

1. Update `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` in production
2. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Django settings
3. Use Kubernetes Secrets for credentials (already configured)
4. Enable SSL/TLS in production (`AWS_S3_USE_SSL=True`)
5. Configure bucket policies to restrict access as needed
