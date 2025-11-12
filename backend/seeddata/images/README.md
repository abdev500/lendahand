# Seed Images

This folder contains sample images used by the `seeddata/seed.py` script to populate news articles with realistic media via REST API.

## Image Categories

- **humanitarian_*.jpg**: General humanitarian aid and community support images
- **refugee_*.jpg**: Refugee relief and displacement-related images
- **medical_*.jpg**: Healthcare, medical equipment, and hospital-related images
- **education_*.jpg**: Education, school, and learning-related images
- **food_*.jpg**: Food distribution, charity meals, and food aid images
- **support_*.jpg**: General support, helping hands, and community assistance images

## Usage

The `seeddata/seed.py` script assigns images from the appropriate category to each news article based on the image list specified in `news.json`.

## Image Sources

Images are sourced from:
- Unsplash (https://unsplash.com) - Free high-quality photos
- Programmatically generated images with themes

All images are 800x600 pixels and optimized for web use.
