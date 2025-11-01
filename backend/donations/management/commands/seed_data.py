import random
from io import BytesIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand
from PIL import Image

from donations.models import Campaign, CampaignMedia, News

User = get_user_model()

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent
SEED_IMAGES_DIR = BASE_DIR / "seed_images"


class Command(BaseCommand):
    help = "Seed database with sample data"

    def handle(self, *args, **options):
        # Create test users
        admin_user, _ = User.objects.get_or_create(
            email="admin@lendahand.me",
            defaults={
                "username": "admin",
                "is_staff": True,
                "is_superuser": True,
                "is_moderator": True,
            },
        )
        admin_user.set_password("admin")
        admin_user.save()

        regular_user, _ = User.objects.get_or_create(
            email="user@example.com",
            defaults={
                "username": "testuser",
                "is_staff": False,
                "is_moderator": False,
            },
        )
        regular_user.set_password("password")
        regular_user.save()

        moderator_user, _ = User.objects.get_or_create(
            email="moderator@lendahand.me",
            defaults={
                "username": "moderator",
                "is_staff": False,
                "is_moderator": True,
            },
        )
        moderator_user.set_password("moderator")
        moderator_user.save()

        # Sample campaign data
        campaigns_data = [
            {
                "title": "Support for Belarusian Families",
                "short_description": "Helping families affected by political unrest in Belarus",
                "description": "<p>This campaign aims to provide financial assistance to families who have been affected by the ongoing political situation in Belarus. Your donations will help cover basic needs such as food, housing, and medical expenses.</p><p>We work directly with local organizations to ensure that funds reach those who need it most.</p>",
                "target_amount": 50000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Ukrainian Refugee Relief Fund",
                "short_description": "Emergency support for Ukrainian refugees",
                "description": "<p>As the conflict continues, millions of Ukrainians have been displaced. This fund provides immediate relief for refugees including housing, food, and essential supplies.</p>",
                "target_amount": 100000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Medical Equipment for Hospitals",
                "short_description": "Supporting healthcare facilities with critical equipment",
                "description": "<p>Hospitals in affected regions are in urgent need of medical equipment. Your donation helps purchase vital supplies.</p>",
                "target_amount": 75000,
                "status": "pending",
                "created_by": regular_user,
            },
            {
                "title": "Education Support Program",
                "short_description": "Ensuring children continue their education",
                "description": "<p>Many children have been forced to leave their schools. This program provides educational materials and support for displaced students.</p>",
                "target_amount": 30000,
                "status": "approved",
                "created_by": moderator_user,
            },
            {
                "title": "Emergency Food Distribution",
                "short_description": "Providing meals to those in need",
                "description": "<p>Food security is critical. This campaign supports food distribution centers in affected areas.</p>",
                "target_amount": 40000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Mental Health Support",
                "short_description": "Counseling and psychological support services",
                "description": "<p>Trauma counseling is essential for those affected by conflict and displacement. This fund supports mental health professionals.</p>",
                "target_amount": 25000,
                "status": "rejected",
                "created_by": regular_user,
            },
            {
                "title": "Winter Clothing Drive",
                "short_description": "Warm clothing for those facing harsh winters",
                "description": "<p>Winter can be particularly difficult for displaced families. This campaign provides warm clothing and blankets.</p>",
                "target_amount": 20000,
                "status": "approved",
                "created_by": regular_user,
            },
            {
                "title": "Children's Safety Fund",
                "short_description": "Protecting the most vulnerable",
                "description": "<p>Children need safe spaces and protection. This fund supports child protection programs.</p>",
                "target_amount": 35000,
                "status": "draft",
                "created_by": regular_user,
            },
            {
                "title": "Legal Aid Services",
                "short_description": "Legal support for refugees",
                "description": "<p>Legal documentation and aid services are crucial for refugees navigating new systems.</p>",
                "target_amount": 28000,
                "status": "approved",
                "created_by": moderator_user,
            },
            {
                "title": "Transportation Assistance",
                "short_description": "Helping people reach safety",
                "description": "<p>Transportation costs can be a barrier to safety. This fund covers travel expenses for those in need.</p>",
                "target_amount": 15000,
                "status": "pending",
                "created_by": regular_user,
            },
        ]

        # Image mapping for different campaign types
        image_categories = {
            "Support for Belarusian Families": [
                "humanitarian_1.jpg",
                "humanitarian_2.jpg",
                "humanitarian_3.jpg",
                "humanitarian_4.jpg",
                "support_1.jpg",
                "support_2.jpg",
            ],
            "Ukrainian Refugee Relief Fund": ["refugee_1.jpg", "refugee_2.jpg", "refugee_3.jpg", "refugee_4.jpg"],
            "Medical Equipment for Hospitals": ["medical_1.jpg", "medical_2.jpg", "medical_3.jpg", "medical_4.jpg"],
            "Education Support Program": ["education_1.jpg", "education_2.jpg", "education_3.jpg", "education_4.jpg"],
            "Emergency Food Distribution": ["food_1.jpg", "food_2.jpg", "food_3.jpg", "food_4.jpg"],
            "Mental Health Support": ["support_1.jpg", "support_2.jpg", "support_3.jpg", "support_4.jpg"],
            "Winter Clothing Drive": ["humanitarian_3.jpg", "humanitarian_4.jpg", "support_3.jpg", "support_4.jpg"],
            "Children's Safety Fund": ["support_1.jpg", "support_2.jpg", "support_3.jpg", "humanitarian_1.jpg"],
            "Legal Aid Services": ["support_2.jpg", "support_3.jpg", "humanitarian_2.jpg", "humanitarian_3.jpg"],
            "Transportation Assistance": ["refugee_2.jpg", "refugee_3.jpg", "support_1.jpg", "support_4.jpg"],
        }

        # Create campaigns
        for idx, campaign_data in enumerate(campaigns_data):
            campaign, created = Campaign.objects.get_or_create(title=campaign_data["title"], defaults=campaign_data)

            # Get appropriate images for this campaign
            campaign_title = campaign_data["title"]
            image_list = image_categories.get(
                campaign_title, ["humanitarian_1.jpg", "humanitarian_2.jpg", "humanitarian_3.jpg", "support_1.jpg"]
            )

            # Check if campaign already has media, if not add some
            existing_media_count = campaign.media.count()

            if created or existing_media_count < 3:
                # Select 3-4 random images for this campaign
                num_images = random.randint(3, 4)
                # Ensure we have enough images available
                available_images = min(num_images, len(image_list))
                selected_images = random.sample(image_list, available_images)

                # Create media entries for each image
                # Start from existing media count to avoid duplicate orders
                start_order = existing_media_count
                for idx, image_filename in enumerate(selected_images):
                    order = start_order + idx
                    image_path = SEED_IMAGES_DIR / image_filename

                    if image_path.exists():
                        with open(image_path, "rb") as img_file:
                            media = CampaignMedia(
                                campaign=campaign,
                                media_type="image",
                                file=File(img_file, name=f"{campaign.id}_{order}_{image_filename}"),
                                order=order,
                            )
                            media.save()
                    else:
                        # Fallback: create a simple colored image if file doesn't exist
                        self.stdout.write(self.style.WARNING(f"Image not found: {image_filename}, using placeholder"))
                        img = Image.new("RGB", (800, 600), color=(214, 40, 40))
                        img_io = BytesIO()
                        img.save(img_io, format="JPEG")
                        img_io.seek(0)

                        media = CampaignMedia(
                            campaign=campaign,
                            media_type="image",
                            file=File(img_io, name=f"campaign_{campaign.id}_image_{order}.jpg"),
                            order=order,
                        )
                        media.save()

                action = "Created" if created else "Updated"
                self.stdout.write(
                    self.style.SUCCESS(f"{action} campaign: {campaign.title} with {len(selected_images)} images")
                )

        # Create sample news entries
        news_entries = [
            {
                "title_en": "New Campaign Launch",
                "content_en": "We are excited to announce the launch of our new donation platform.",
                "title_ru": "Запуск новой кампании",
                "content_ru": "Мы рады объявить о запуске нашей новой платформы для пожертвований.",
            },
            {
                "title_en": "Impact Report 2024",
                "content_en": "See how your donations are making a difference in our latest impact report.",
                "title_ru": "Отчет о влиянии 2024",
                "content_ru": "Посмотрите, как ваши пожертвования меняют ситуацию в нашем последнем отчете.",
            },
        ]

        for news_data in news_entries:
            news, created = News.objects.get_or_create(
                translations__title=news_data["title_en"], defaults={"published": True}
            )
            if created:
                news.set_current_language("en")
                news.title = news_data["title_en"]
                news.content = news_data["content_en"]
                news.save()

                news.set_current_language("ru")
                news.title = news_data["title_ru"]
                news.content = news_data["content_ru"]
                news.save()

                self.stdout.write(self.style.SUCCESS(f'Created news: {news_data["title_en"]}'))

        self.stdout.write(self.style.SUCCESS("Successfully seeded database!"))
