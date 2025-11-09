.PHONY: lint format check test clean

PYTHON ?= python3

# Linting
lint:
	@echo "Running flake8..."
	$(PYTHON) -m flake8 --config=setup.cfg backend/
	@echo "Running black check..."
	$(PYTHON) -m black --check --line-length 120 backend/
	@echo "Running isort check..."
	$(PYTHON) -m isort --check --profile black --line-length 120 backend/
	@echo "✅ All lint checks passed!"

# Format code
format:
	@echo "Formatting with black..."
	$(PYTHON) -m black --line-length 120 backend/
	@echo "Sorting imports with isort..."
	$(PYTHON) -m isort --profile black --line-length 120 backend/
	@echo "✅ Code formatted!"

# Run all checks
check: lint
	@echo "✅ All checks passed!"

# Run tests
test:
	cd backend && python manage.py test

# Clean Python cache
clean:
	find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type d -name "*.egg-info" -exec rm -r {} + 2>/dev/null || true
	@echo "✅ Cleaned Python cache files!"
