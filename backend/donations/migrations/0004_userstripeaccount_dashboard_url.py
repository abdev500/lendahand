from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("donations", "0003_remove_campaign_stripe_account"),
    ]

    operations = [
        migrations.AddField(
            model_name="userstripeaccount",
            name="dashboard_url",
            field=models.URLField(blank=True),
        ),
    ]
