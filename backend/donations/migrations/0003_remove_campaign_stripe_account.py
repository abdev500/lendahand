from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("donations", "0002_campaign_stripe_ready_userstripeaccount_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="campaign",
            name="stripe_account",
        ),
    ]
