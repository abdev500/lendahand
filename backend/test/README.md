# Backend Test Container

This directory contains the assets required to build a single Docker image that
spins up the Django backend alongside PostgreSQL, MinIO, and stripe-mock and
executes the REST API smoke tests (registration and login flows) with `pytest`.

## Build

```bash
docker build -f backend/test/Dockerfile.backend-tests -t lendahand-backend-tests .
```

## Run

Running the container will provision PostgreSQL, MinIO, create the required S3
bucket, start stripe-mock, apply Django migrations, and then execute the pytest
suite:

```bash
docker run --rm lendahand-backend-tests
```

The container exits with the `pytest` exit code, so a non-zero status indicates
test failures.



