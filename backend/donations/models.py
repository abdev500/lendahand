from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    """Custom User model with email, phone, and address."""

    email = models.EmailField(_("email address"), unique=True)
    phone = models.CharField(_("phone"), max_length=20, blank=True)
    address = models.TextField(_("address"), blank=True)
    is_moderator = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")


class UserStripeAccount(models.Model):
    """Stores Stripe Connect account information per user."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="stripe_account")
    stripe_account_id = models.CharField(max_length=255, unique=True)
    charges_enabled = models.BooleanField(default=False)
    payouts_enabled = models.BooleanField(default=False)
    details_submitted = models.BooleanField(default=False)
    requirements_due = models.JSONField(default=list, blank=True)
    onboarding_url = models.URLField(blank=True)
    onboarding_expires_at = models.DateTimeField(null=True, blank=True)
    dashboard_url = models.URLField(blank=True)
    last_synced_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("user stripe account")
        verbose_name_plural = _("user stripe accounts")

    def __str__(self):
        return f"{self.user.email} - {self.stripe_account_id}"

    @property
    def is_ready(self):
        return self.charges_enabled and self.payouts_enabled and self.details_submitted

    def update_from_stripe_account(self, account_data):
        """Update persisted fields from Stripe API response."""
        requirements = account_data.get("requirements", {})
        self.charges_enabled = account_data.get("charges_enabled", False)
        self.payouts_enabled = account_data.get("payouts_enabled", False)
        self.details_submitted = account_data.get("details_submitted", False)
        self.requirements_due = requirements.get("currently_due", [])
        update_fields = [
            "charges_enabled",
            "payouts_enabled",
            "details_submitted",
            "requirements_due",
            "dashboard_url",
            "updated_at",
        ]
        if self.is_ready and (self.onboarding_url or self.onboarding_expires_at):
            self.onboarding_url = ""
            self.onboarding_expires_at = None
            update_fields.extend(["onboarding_url", "onboarding_expires_at"])
        self.save(update_fields=update_fields)


class Campaign(models.Model):
    """Campaign model for fundraising."""

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("pending", "Pending Moderation"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("suspended", "Suspended"),
        ("cancelled", "Cancelled"),
    ]

    title = models.CharField(max_length=200)
    short_description = models.TextField()
    description = models.TextField()  # HTML from WYSIWYG
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="campaigns")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    moderation_notes = models.TextField(blank=True)
    stripe_ready = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    @property
    def progress_percentage(self):
        if self.target_amount == 0:
            return 0
        return min(100, int((self.current_amount / self.target_amount) * 100))

    @property
    def is_visible(self):
        return self.status == "approved"


class CampaignMedia(models.Model):
    """Media files for campaigns (images/videos)."""

    MEDIA_TYPE_CHOICES = [
        ("image", "Image"),
        ("video", "Video"),
    ]

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="media")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    file = models.FileField(upload_to="campaigns/")
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
        unique_together = ["campaign", "order"]

    def __str__(self):
        return f"{self.campaign.title} - {self.media_type}"


class Donation(models.Model):
    """Donation records."""

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="donations")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    is_anonymous = models.BooleanField(default=True)
    stripe_payment_intent_id = models.CharField(max_length=200, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"${self.amount} to {self.campaign.title}"


class ModerationHistory(models.Model):
    """History of moderation actions."""

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="moderation_history")
    moderator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=20)  # 'approve', 'reject'
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} - {self.campaign.title}"


class News(models.Model):
    """News entries without localization."""

    title = models.CharField(max_length=200, default="")
    content = models.TextField(default="")
    image = models.ImageField(upload_to="news/", blank=True)  # Legacy field, kept for backward compatibility
    published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title if self.title else f"News {self.id}"


class NewsMedia(models.Model):
    """Media files for news (images/videos)."""

    MEDIA_TYPE_CHOICES = [
        ("image", "Image"),
        ("video", "Video"),
    ]

    news = models.ForeignKey(News, on_delete=models.CASCADE, related_name="media")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    file = models.FileField(upload_to="news/")
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]
        unique_together = ["news", "order"]

    def __str__(self):
        news_title = self.news.title if self.news.title else f"News {self.news.id}"
        return f"{news_title} - {self.media_type}"
