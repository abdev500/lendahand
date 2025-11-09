from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import (
    Campaign,
    CampaignMedia,
    Donation,
    ModerationHistory,
    News,
    NewsMedia,
    User,
    UserStripeAccount,
)


class UserSerializer(serializers.ModelSerializer):
    stripe = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "address",
            "is_moderator",
            "is_staff",
            "is_active",
            "date_joined",
            "last_login",
            "stripe",
        ]
        read_only_fields = [
            "id",
            "is_moderator",
            "is_staff",
            "is_active",
            "date_joined",
            "last_login",
        ]

    def get_stripe(self, obj):
        try:
            account = obj.stripe_account
        except UserStripeAccount.DoesNotExist:
            return {
                "has_account": False,
                "ready": False,
            }

        onboarding_expires_at = account.onboarding_expires_at
        if onboarding_expires_at:
            try:
                onboarding_expires_at = onboarding_expires_at.isoformat()
            except AttributeError:
                # Handle cases where the value is stored as a string or another non-datetime type
                onboarding_expires_at = str(onboarding_expires_at)
        else:
            onboarding_expires_at = None

        return {
            "has_account": True,
            "ready": account.is_ready,
            "stripe_account_id": account.stripe_account_id,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
            "details_submitted": account.details_submitted,
            "requirements_due": account.requirements_due,
            "onboarding_url": account.onboarding_url,
            "onboarding_expires_at": onboarding_expires_at,
        }


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ["email", "username", "password", "password2", "phone", "address"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if email and password:
            user = authenticate(request=self.context.get("request"), username=email, password=password)
            if not user:
                raise serializers.ValidationError({"error": "Invalid credentials"})
            if not user.is_active:
                raise serializers.ValidationError({"error": "User account is disabled"})
            attrs["user"] = user
        else:
            raise serializers.ValidationError({"error": "Must include email and password"})
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs


class CampaignMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignMedia
        fields = ["id", "media_type", "file", "order"]
        read_only_fields = ["id"]


class ModerationHistorySerializer(serializers.ModelSerializer):
    moderator = UserSerializer(read_only=True)

    class Meta:
        model = ModerationHistory
        fields = ["id", "action", "notes", "created_at", "moderator"]
        read_only_fields = ["id", "created_at", "moderator"]


class CampaignSerializer(serializers.ModelSerializer):
    media = CampaignMediaSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    progress_percentage = serializers.ReadOnlyField()
    stripe_ready = serializers.ReadOnlyField()
    stripe_account_id = serializers.SerializerMethodField()
    moderation_history = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "title",
            "short_description",
            "description",
            "target_amount",
            "current_amount",
            "status",
            "created_by",
            "created_at",
            "updated_at",
            "media",
            "progress_percentage",
            "moderation_notes",
            "stripe_ready",
            "stripe_account_id",
            "moderation_history",
        ]
        read_only_fields = [
            "id",
            "current_amount",
            "created_at",
            "updated_at",
            "created_by",
            "stripe_ready",
            "stripe_account_id",
        ]

    def get_stripe_account_id(self, obj):
        try:
            account = obj.created_by.stripe_account
        except UserStripeAccount.DoesNotExist:
            return None
        return account.stripe_account_id

    def get_moderation_history(self, obj):
        include_history = self.context.get("include_history", False)
        if not include_history:
            return []

        history_qs = getattr(obj, "moderation_history", None)
        if history_qs is None:
            return []

        serializer = ModerationHistorySerializer(
            history_qs.all(), many=True, context=self.context
        )
        return serializer.data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.context.get("include_history", False):
            self.fields.pop("moderation_history", None)


class CampaignCreateSerializer(serializers.ModelSerializer):
    media_files = serializers.ListField(child=serializers.FileField(), write_only=True, required=False)

    class Meta:
        model = Campaign
        fields = [
            "title",
            "short_description",
            "description",
            "target_amount",
            "status",
            "media_files",
        ]

    def create(self, validated_data):
        media_files = validated_data.pop("media_files", [])
        # Get created_by from context (the request user)
        # Get status from validated_data if provided, otherwise default to "pending"
        created_by = self.context["request"].user
        status = validated_data.pop("status", "pending")
        campaign = Campaign.objects.create(**validated_data, created_by=created_by, status=status)

        for idx, media_file in enumerate(media_files[:6]):  # Limit to 6 files
            media_type = (
                "video"
                if hasattr(media_file, "content_type") and media_file.content_type.startswith("video/")
                else "image"
            )
            CampaignMedia.objects.create(campaign=campaign, media_type=media_type, file=media_file, order=idx)

        return campaign

    def update(self, instance, validated_data):
        media_files = validated_data.pop("media_files", None)

        # Update campaign fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # If new media files provided, add them
        if media_files:
            existing_count = instance.media.count()
            for idx, media_file in enumerate(media_files[:6]):  # Limit to 6 files total
                if existing_count + idx >= 6:
                    break
                media_type = (
                    "video"
                    if hasattr(media_file, "content_type") and media_file.content_type.startswith("video/")
                    else "image"
                )
                CampaignMedia.objects.create(
                    campaign=instance,
                    media_type=media_type,
                    file=media_file,
                    order=existing_count + idx,
                )

        return instance


class DonationSerializer(serializers.ModelSerializer):
    campaign = CampaignSerializer(read_only=True)
    campaign_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Donation
        fields = ["id", "campaign", "campaign_id", "amount", "created_at"]
        read_only_fields = ["id", "created_at"]


class DonationCreateSerializer(serializers.ModelSerializer):
    campaign_id = serializers.IntegerField()

    class Meta:
        model = Donation
        fields = ["campaign_id", "amount"]

    def validate_campaign_id(self, value):
        try:
            campaign = Campaign.objects.get(id=value, status="approved")
        except Campaign.DoesNotExist:
            raise serializers.ValidationError("Campaign not found or not approved")
        if not campaign.stripe_ready:
            raise serializers.ValidationError("Campaign is not ready to accept donations")
        return value


class NewsMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsMedia
        fields = ["id", "media_type", "file", "order"]
        read_only_fields = ["id"]


class NewsSerializer(serializers.ModelSerializer):
    media = NewsMediaSerializer(many=True, read_only=True)

    class Meta:
        model = News
        fields = [
            "id",
            "title",
            "content",
            "image",
            "media",
            "published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class NewsCreateSerializer(serializers.ModelSerializer):
    media_files = serializers.ListField(child=serializers.FileField(), write_only=True, required=False)

    class Meta:
        model = News
        fields = ["title", "content", "published", "media_files"]

    def create(self, validated_data):
        media_files = validated_data.pop("media_files", [])
        news = News.objects.create(**validated_data)

        # Add media files
        for idx, media_file in enumerate(media_files[:6]):  # Limit to 6 files
            media_type = (
                "video"
                if hasattr(media_file, "content_type") and media_file.content_type.startswith("video/")
                else "image"
            )
            NewsMedia.objects.create(news=news, media_type=media_type, file=media_file, order=idx)

        return news

    def update(self, instance, validated_data):
        media_files = validated_data.pop("media_files", None)

        # Update news fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # If new media files provided, add them
        if media_files:
            existing_count = instance.media.count()
            for idx, media_file in enumerate(media_files[:6]):  # Limit to 6 files total
                if existing_count + idx >= 6:
                    break
                media_type = (
                    "video"
                    if hasattr(media_file, "content_type") and media_file.content_type.startswith("video/")
                    else "image"
                )
                NewsMedia.objects.create(
                    news=instance,
                    media_type=media_type,
                    file=media_file,
                    order=existing_count + idx,
                )

        return instance
