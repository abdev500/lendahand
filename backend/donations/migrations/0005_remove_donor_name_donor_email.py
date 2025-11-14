from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("donations", "0004_userstripeaccount_dashboard_url"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="donation",
            name="donor_name",
        ),
        migrations.RemoveField(
            model_name="donation",
            name="donor_email",
        ),
    ]
