import logging
from datetime import datetime
from datetime import timezone as dt_timezone

import stripe
from django.conf import settings
from django.contrib.auth import logout
from django.db.models import Q
from django.utils import timezone
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from .models import Campaign, Donation, News, User, UserStripeAccount
from .serializers import (
    CampaignCreateSerializer,
    CampaignSerializer,
    DonationCreateSerializer,
    DonationSerializer,
    LoginSerializer,
    NewsCreateSerializer,
    NewsSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)

stripe.api_key = settings.STRIPE_SECRET_KEY


def extract_payment_intent_from_session(session, session_id=None):
    """Extract payment_intent from a Stripe session object, with fallback to session-based ID."""
    payment_intent = getattr(session, "payment_intent", None) or getattr(session, "payment_intent_id", None)
    if isinstance(session, dict):
        payment_intent = session.get("payment_intent") or session.get("payment_intent_id") or None

    if not payment_intent:
        session_id = session_id or (getattr(session, "id", None) or session.get("id", "unknown") if isinstance(session, dict) else "unknown")
        payment_intent = f"session_{session_id}"
        logger.warning(f"No payment_intent found, using session-based ID: {payment_intent}")

    return payment_intent


def create_or_update_donation(campaign, payment_intent_id, amount, log_prefix=""):
    """
    Create or update a donation record. Returns (donation, created, updated).

    Args:
        campaign: Campaign instance
        payment_intent_id: Stripe payment intent ID or session-based ID
        amount: Decimal amount
        log_prefix: Optional prefix for log messages

    Returns:
        tuple: (donation, created, updated)
    """
    from decimal import Decimal

    if not isinstance(amount, Decimal):
        amount = Decimal(str(amount))

    donation, created = Donation.objects.get_or_create(
        stripe_payment_intent_id=payment_intent_id,
        defaults={
            "campaign": campaign,
            "amount": amount,
            "is_anonymous": True,
        }
    )

    updated = False
    if created:
        logger.info(f"{log_prefix}Created donation {donation.id} for campaign {campaign.id}. Payment Intent: {payment_intent_id}, Amount: {amount}")
    elif donation.amount != amount:
        donation.amount = amount
        donation.save()
        updated = True
        logger.info(f"{log_prefix}Updated donation {donation.id} amount to {amount}")

    return donation, created, updated


def recalculate_campaign_amount(campaign):
    """Recalculate campaign.current_amount from all donations and update if needed."""
    from decimal import Decimal

    all_donations = Donation.objects.filter(campaign=campaign)
    total_donated = sum(Decimal(str(d.amount)) for d in all_donations)

    if campaign.current_amount != total_donated:
        campaign.current_amount = total_donated
        campaign.save()
        logger.info(f"Updated campaign {campaign.id} current_amount to {total_donated}")
        return True
    return False


def list_stripe_payment_intents_for_campaign(stripe_account_id, campaign_id):
    """List all payment intents for a campaign from a connected Stripe account."""
    payment_intents = []
    has_more = True
    starting_after = None

    while has_more:
        list_params = {"limit": 100}
        if starting_after:
            list_params["starting_after"] = starting_after

        try:
            pi_list = stripe.PaymentIntent.list(
                stripe_account=stripe_account_id,
                **list_params
            )

            for pi in pi_list.data:
                metadata = pi.metadata or {}
                if str(metadata.get("campaign_id")) == str(campaign_id):
                    if pi.status == "succeeded":
                        payment_intents.append(pi)

            has_more = pi_list.has_more
            if pi_list.data:
                starting_after = pi_list.data[-1].id
        except stripe.error.StripeError as e:
            logger.warning(f"Error listing payment intents for campaign {campaign_id}: {e}")
            break

    return payment_intents


def list_stripe_checkout_sessions_for_campaign(stripe_account_id, campaign_id):
    """List all checkout sessions for a campaign from a connected Stripe account."""
    checkout_sessions = []
    has_more = True
    starting_after = None

    while has_more:
        list_params = {"limit": 100}
        if starting_after:
            list_params["starting_after"] = starting_after

        try:
            sessions_list = stripe.checkout.Session.list(
                stripe_account=stripe_account_id,
                **list_params
            )

            for session in sessions_list.data:
                metadata = session.metadata or {}
                if str(metadata.get("campaign_id")) == str(campaign_id):
                    if session.payment_status == "paid":
                        checkout_sessions.append(session)

            has_more = sessions_list.has_more
            if sessions_list.data:
                starting_after = sessions_list.data[-1].id
        except stripe.error.StripeError as e:
            logger.warning(f"Error listing checkout sessions for campaign {campaign_id}: {e}")
            break

    return checkout_sessions


def process_payment_intents_for_donations(campaign, payment_intents, log_prefix=""):
    """
    Process payment intents and create/update donations.
    Returns (created_count, updated_count).
    """
    from decimal import Decimal

    created_count = 0
    updated_count = 0

    for pi in payment_intents:
        payment_intent_id = pi.id
        amount = Decimal(str(pi.amount / 100))  # Convert from cents

        _, created, updated = create_or_update_donation(
            campaign, payment_intent_id, amount, log_prefix=log_prefix
        )

        if created:
            created_count += 1
        elif updated:
            updated_count += 1

    return created_count, updated_count


def process_checkout_sessions_for_donations(campaign, checkout_sessions, log_prefix=""):
    """
    Process checkout sessions and create/update donations.
    Returns (created_count, updated_count).
    """
    from decimal import Decimal

    created_count = 0
    updated_count = 0

    for session in checkout_sessions:
        payment_intent_id = extract_payment_intent_from_session(session)
        amount = Decimal(str(session.get("amount_total", 0) / 100))

        if amount <= 0:
            continue

        _, created, updated = create_or_update_donation(
            campaign, payment_intent_id, amount, log_prefix=log_prefix
        )

        if created:
            created_count += 1
        elif updated:
            updated_count += 1

    return created_count, updated_count


def get_user_stripe_account(user):
    try:
        return user.stripe_account
    except UserStripeAccount.DoesNotExist:
        return None


def create_stripe_account_for_user(user):
    """Create a new Stripe Express account for the given user."""
    account = stripe.Account.create(
        type="express",
        email=user.email or None,
        capabilities={
            "card_payments": {"requested": True},
            "transfers": {"requested": True},
        },
        business_type="individual",
        metadata={
            "platform_user_id": str(user.id),
        },
    )
    return account


def ensure_user_stripe_account(user):
    """Ensure the user has a Stripe account record and return it."""
    account = get_user_stripe_account(user)
    if account:
        return account

    if not settings.STRIPE_SECRET_KEY:
        logger.error("Attempted to create Stripe account but STRIPE_SECRET_KEY is not configured.")
        raise RuntimeError("Stripe configuration is not available. Please contact support.")

    stripe_account = create_stripe_account_for_user(user)
    logger.info("Created Stripe account %s for user %s", stripe_account.id, user.email)
    account = UserStripeAccount.objects.create(
        user=user,
        stripe_account_id=stripe_account.id,
        charges_enabled=stripe_account.get("charges_enabled", False),
        payouts_enabled=stripe_account.get("payouts_enabled", False),
        details_submitted=stripe_account.get("details_submitted", False),
        requirements_due=stripe_account.get("requirements", {}).get("currently_due", []),
    )
    return account


def sync_user_stripe_account(user_account):
    """Refresh Stripe account status from Stripe API."""
    stripe_account = stripe.Account.retrieve(user_account.stripe_account_id)
    user_account.update_from_stripe_account(stripe_account)
    if user_account.is_ready and (user_account.onboarding_url or user_account.onboarding_expires_at):
        user_account.onboarding_url = ""
        user_account.onboarding_expires_at = None
        user_account.save(update_fields=["onboarding_url", "onboarding_expires_at", "updated_at"])
    return user_account


class UserActivationSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_moderator or self.request.user.is_staff:
            return User.objects.all().order_by("-date_joined")
        return User.objects.filter(id=self.request.user.id)

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="set-active")
    def set_active(self, request, pk=None):
        if not (request.user.is_moderator or request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can modify user activation status.")

        serializer = UserActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_user = self.get_object()
        if target_user == request.user:
            raise ValidationError({"is_active": "You cannot change your own activation status."})

        new_status = serializer.validated_data["is_active"]
        if target_user.is_active != new_status:
            target_user.is_active = new_status
            target_user.save(update_fields=["is_active"])

        return Response(self.get_serializer(target_user).data)

    @action(detail=False, methods=["post"])
    def change_password(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"user": request.user})
        if serializer.is_valid():
            if not request.user.check_password(serializer.validated_data["old_password"]):
                return Response(
                    {"old_password": ["Wrong password."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            request.user.set_password(serializer.validated_data["new_password"])
            request.user.save()
            return Response({"status": "password changed"})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="stripe/onboard")
    def stripe_onboard(self, request):
        if not settings.STRIPE_SECRET_KEY:
            raise ValidationError({"stripe": "Stripe is not configured."})

        try:
            account = ensure_user_stripe_account(request.user)
        except RuntimeError as exc:
            raise ValidationError({"stripe": str(exc)})
        except stripe.error.StripeError as exc:
            logger.error("Stripe error creating account for user %s: %s", request.user.id, exc)
            raise ValidationError({"stripe": str(exc)})

        try:
            account = sync_user_stripe_account(account)
        except stripe.error.StripeError as exc:
            logger.warning("Unable to sync Stripe account %s: %s", account.stripe_account_id, exc)

        if account.is_ready:
            return Response(
                {
                    "has_account": True,
                    "stripe_ready": True,
                    "stripe_account_id": account.stripe_account_id,
                    "charges_enabled": account.charges_enabled,
                    "payouts_enabled": account.payouts_enabled,
                    "details_submitted": account.details_submitted,
                    "requirements_due": account.requirements_due,
                }
            )

        try:
            account_link = stripe.AccountLink.create(
                account=account.stripe_account_id,
                refresh_url=settings.STRIPE_ONBOARDING_REFRESH_URL,
                return_url=settings.STRIPE_ONBOARDING_RETURN_URL,
                type="account_onboarding",
            )
        except stripe.error.StripeError as exc:
            logger.error("Stripe error creating onboarding link for account %s: %s", account.stripe_account_id, exc)
            raise ValidationError({"stripe": str(exc)})

        expires_at = None
        if getattr(account_link, "expires_at", None):
            expires_at = datetime.fromtimestamp(account_link.expires_at, tz=dt_timezone.utc)

        account.onboarding_url = account_link.url
        account.onboarding_expires_at = expires_at
        account.save(update_fields=["onboarding_url", "onboarding_expires_at", "updated_at"])

        return Response(
            {
                "has_account": True,
                "stripe_ready": False,
                "stripe_account_id": account.stripe_account_id,
                "onboarding_url": account_link.url,
                "expires_at": getattr(account_link, "expires_at", None),
            }
        )

    @action(detail=False, methods=["get"], url_path="stripe/status")
    def stripe_status(self, request):
        account = get_user_stripe_account(request.user)
        if not account:
            return Response({"has_account": False, "stripe_ready": False})

        try:
            account = sync_user_stripe_account(account)
        except stripe.error.StripeError as exc:
            logger.warning("Unable to sync Stripe account %s during status check: %s", account.stripe_account_id, exc)

        Campaign.objects.filter(created_by=request.user).update(stripe_ready=account.is_ready)

        dashboard_url = account.dashboard_url or ""
        if account.stripe_account_id:
            try:
                login_link = stripe.Account.create_login_link(account.stripe_account_id)
                dashboard_url = login_link.get("url", "") or dashboard_url
            except stripe.error.StripeError as exc:
                logger.warning(
                    "Unable to generate dashboard link for account %s: %s",
                    account.stripe_account_id,
                    exc,
                )
            else:
                if dashboard_url and dashboard_url != account.dashboard_url:
                    account.dashboard_url = dashboard_url
                    account.save(update_fields=["dashboard_url", "updated_at"])

        return Response(
            {
                "has_account": True,
                "stripe_ready": account.is_ready,
                "stripe_account_id": account.stripe_account_id,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "details_submitted": account.details_submitted,
                "requirements_due": account.requirements_due,
                "onboarding_url": account.onboarding_url,
                "onboarding_expires_at": (
                    account.onboarding_expires_at.isoformat() if account.onboarding_expires_at else None
                ),
                "dashboard_url": dashboard_url or None,
            }
        )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register(request):
    """User registration endpoint."""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, created = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """User login endpoint."""
    serializer = LoginSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        user = serializer.validated_data["user"]
        # Only create/get token, don't use session login for API
        token, created = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})
    # Return a more consistent error format
    errors = serializer.errors
    error_msg = None

    # Check for error field
    if "error" in errors:
        error_data = errors["error"]
        if isinstance(error_data, list) and len(error_data) > 0:
            error_msg = str(error_data[0])
        else:
            error_msg = str(error_data)

    # Check for non_field_errors
    if not error_msg and "non_field_errors" in errors:
        non_field_errors = errors["non_field_errors"]
        if isinstance(non_field_errors, list) and len(non_field_errors) > 0:
            error_msg = str(non_field_errors[0])

    # Fallback: get first error from any field
    if not error_msg:
        for field, field_errors in errors.items():
            if isinstance(field_errors, list) and len(field_errors) > 0:
                error_msg = str(field_errors[0])
                break
            elif field_errors:
                error_msg = str(field_errors)
                break

    # Final fallback
    if not error_msg:
        error_msg = "Invalid credentials"

    return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """User logout endpoint."""
    logout(request)
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({"status": "logged out"})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def password_reset_request(request):
    """
    Request password reset - sends email with reset link.
    """
    from django.conf import settings
    from django.contrib.auth.tokens import default_token_generator
    from django.core.mail import send_mail
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode

    serializer = PasswordResetRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data["email"]

    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        # Don't reveal if email exists for security
        return Response(
            {"message": "If this email exists, a password reset link has been sent."},
            status=status.HTTP_200_OK,
        )

    # Generate password reset token
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    # Build reset URL
    reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

    # Send email
    try:
        send_mail(
            subject="Password Reset Request - Lend a Hand",
            message=f"""
Hello,

You requested to reset your password for your Lend a Hand account.

Click the link below to reset your password:
{reset_url}

This link will expire in 24 hours.

If you didn't request this password reset, please ignore this email.

Best regards,
Lend a Hand Team
            """.strip(),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Password reset email sent to {email}")
    except Exception as e:
        logger.error(f"Error sending password reset email: {e}")
        return Response(
            {"error": "Failed to send password reset email. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {"message": "If this email exists, a password reset link has been sent."},
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request):
    """
    Confirm password reset with token.
    """
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_str
    from django.utils.http import urlsafe_base64_decode

    serializer = PasswordResetConfirmSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    uid = serializer.validated_data["uid"]
    token = serializer.validated_data["token"]
    new_password = serializer.validated_data["new_password"]

    try:
        # Decode user ID
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {"error": "Invalid reset link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify token
    if not default_token_generator.check_token(user, token):
        return Response(
            {"error": "Invalid or expired reset link. Please request a new one."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Set new password
    user.set_password(new_password)
    user.save()

    logger.info(f"Password reset successful for user {user.email}")

    return Response(
        {"message": "Password has been reset successfully."},
        status=status.HTTP_200_OK,
    )


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.action == "create" or self.action == "update":
            return CampaignCreateSerializer
        return CampaignSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        include_history = (
            self.request.query_params.get("include_history", "").lower() == "true"
            if hasattr(self.request, "query_params")
            else False
        )
        context["include_history"] = include_history
        return context

    def get_queryset(self):
        queryset = Campaign.objects.all()
        status_filter = self.request.query_params.get("status", None)

        # Public can only see approved campaigns
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(status="approved", stripe_ready=True)
        elif not (self.request.user.is_moderator or self.request.user.is_staff):
            # Regular users see approved, Stripe-ready campaigns plus their own
            queryset = queryset.filter(Q(status="approved", stripe_ready=True) | Q(created_by=self.request.user))

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        queryset = queryset.select_related("created_by").prefetch_related("media", "donations")

        if self.request.query_params.get("include_history", "").lower() == "true":
            queryset = queryset.prefetch_related("moderation_history__moderator")

        return queryset

    def perform_create(self, serializer):
        campaign = serializer.save()

        if not settings.STRIPE_SECRET_KEY:
            logger.error("Campaign creation attempted without Stripe configuration.")
            raise ValidationError({"stripe": "Stripe configuration is missing. Please contact support."})

        try:
            stripe_account = ensure_user_stripe_account(self.request.user)
        except RuntimeError as exc:
            raise ValidationError({"stripe": str(exc)})
        except stripe.error.StripeError as exc:
            logger.error(
                "Stripe error ensuring account for user %s during campaign creation: %s",
                self.request.user.id,
                exc,
            )
            raise ValidationError({"stripe": "Unable to create Stripe account. Please try again later."})

        try:
            stripe_account = sync_user_stripe_account(stripe_account)
        except stripe.error.StripeError as exc:
            logger.warning(
                "Unable to sync Stripe account %s during campaign creation: %s",
                stripe_account.stripe_account_id,
                exc,
            )

        campaign.stripe_ready = stripe_account.is_ready

        update_fields = ["stripe_ready", "updated_at"]
        if not stripe_account.is_ready and campaign.status != "draft":
            campaign.status = "draft"
            update_fields.append("status")

        campaign.save(update_fields=update_fields)

    def perform_update(self, serializer):
        instance = serializer.instance
        # Ensure user owns the campaign or is moderator/staff
        if instance.created_by != self.request.user and not (
            self.request.user.is_moderator or self.request.user.is_staff
        ):
            raise PermissionDenied("You can only edit your own campaigns.")
        new_status = serializer.validated_data.get("status", instance.status)
        if new_status in ["pending", "approved"] and not instance.stripe_ready:
            raise ValidationError(
                {"status": "Complete Stripe onboarding before submitting this campaign for moderation."}
            )
        # Reset moderation when editing approved/rejected campaigns
        if instance.status in ["approved", "rejected"]:
            serializer.save(status="pending", moderation_notes="")
        else:
            serializer.save()

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        campaign = self.get_object()
        if campaign.created_by != request.user and not (request.user.is_moderator or request.user.is_staff):
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        campaign.status = "suspended"
        campaign.save()
        return Response({"status": "campaign suspended"})

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        campaign = self.get_object()
        if campaign.created_by != request.user:
            return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
        campaign.status = "cancelled"
        campaign.save()
        return Response({"status": "campaign cancelled"})

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        if not (request.user.is_moderator or request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can resume campaigns.")

        campaign = self.get_object()

        if campaign.status not in ["suspended", "cancelled"]:
            return Response(
                {"error": "Campaign is not suspended or cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not campaign.stripe_ready:
            return Response(
                {"error": "Campaign cannot be resumed until Stripe onboarding is complete."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        moderation_notes = request.data.get("moderation_notes")
        campaign.status = "approved"
        update_fields = ["status", "updated_at"]
        if moderation_notes is not None:
            campaign.moderation_notes = moderation_notes
            update_fields.append("moderation_notes")
        campaign.save(update_fields=update_fields)

        from .models import ModerationHistory

        ModerationHistory.objects.create(
            campaign=campaign,
            moderator=request.user,
            action="resume",
            notes=moderation_notes if moderation_notes is not None else campaign.moderation_notes,
        )

        return Response(
            {
                "status": "campaign resumed",
                "campaign": CampaignSerializer(campaign).data,
            }
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve a pending campaign. Only moderators/staff can approve."""
        if not (request.user.is_moderator or request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can approve campaigns.")

        campaign = self.get_object()
        if not campaign.stripe_ready:
            return Response(
                {"error": "Campaign cannot be approved until Stripe onboarding is complete."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if campaign.status != "pending":
            return Response(
                {"error": "Campaign is not pending moderation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        moderation_notes = request.data.get("moderation_notes", "")
        campaign.status = "approved"
        campaign.moderation_notes = moderation_notes
        campaign.save()

        # Create moderation history
        from .models import ModerationHistory

        ModerationHistory.objects.create(
            campaign=campaign,
            moderator=request.user,
            action="approve",
            notes=moderation_notes,
        )

        return Response(
            {
                "status": "campaign approved",
                "campaign": CampaignSerializer(campaign).data,
            }
        )

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject a pending campaign. Only moderators/staff can reject."""
        if not (request.user.is_moderator or request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can reject campaigns.")

        campaign = self.get_object()
        if campaign.status != "pending":
            return Response(
                {"error": "Campaign is not pending moderation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        moderation_notes = request.data.get("moderation_notes", "")
        if not moderation_notes:
            return Response(
                {"error": "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        campaign.status = "rejected"
        campaign.moderation_notes = moderation_notes
        campaign.save()

        # Create moderation history
        from .models import ModerationHistory

        ModerationHistory.objects.create(
            campaign=campaign,
            moderator=request.user,
            action="reject",
            notes=moderation_notes,
        )

        return Response(
            {
                "status": "campaign rejected",
                "campaign": CampaignSerializer(campaign).data,
            }
        )

    @swagger_auto_schema(
        responses={200: openapi.Response("Sync result")},
    )
    @action(detail=True, methods=["post"])
    def sync_payments(self, request, pk=None):
        """Sync payments for a campaign from Stripe."""
        campaign = self.get_object()

        # Only campaign owner, moderators, or staff can sync payments
        if not (request.user == campaign.created_by or request.user.is_moderator or request.user.is_staff):
            raise PermissionDenied("Only campaign owner, moderators, or staff can sync payments.")

        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {"error": "Stripe is not configured"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        user_account = get_user_stripe_account(campaign.created_by)
        if not user_account:
            return Response(
                {"error": "Campaign owner has no Stripe account"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stripe_account_id = user_account.stripe_account_id

        try:
            # List all payment intents and checkout sessions for this campaign
            payment_intents = list_stripe_payment_intents_for_campaign(stripe_account_id, campaign.id)
            checkout_sessions = list_stripe_checkout_sessions_for_campaign(stripe_account_id, campaign.id)

            # Process payment intents and checkout sessions
            created_pi, updated_pi = process_payment_intents_for_donations(
                campaign, payment_intents, log_prefix="Sync: "
            )
            created_sessions, updated_sessions = process_checkout_sessions_for_donations(
                campaign, checkout_sessions, log_prefix="Sync: "
            )

            created_count = created_pi + created_sessions
            updated_count = updated_pi + updated_sessions

            # Recalculate campaign amount from all donations
            recalculate_campaign_amount(campaign)
            from decimal import Decimal
            all_donations = Donation.objects.filter(campaign=campaign)
            total_donated = sum(Decimal(str(d.amount)) for d in all_donations)

            return Response({
                "status": "success",
                "campaign_id": campaign.id,
                "payment_intents_found": len(payment_intents),
                "sessions_found": len(checkout_sessions),
                "donations_created": created_count,
                "donations_updated": updated_count,
                "total_donations": all_donations.count(),
                "total_amount": str(total_donated),
                "campaign": CampaignSerializer(campaign, context={"request": request}).data,
            })

        except stripe.error.StripeError as e:
            logger.error(f"Sync payments: Stripe error for campaign {campaign.id}: {e}")
            return Response(
                {"error": f"Stripe error: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            import traceback
            logger.error(f"Sync payments: Unexpected error for campaign {campaign.id}: {e}\n{traceback.format_exc()}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @swagger_auto_schema(
        responses={200: openapi.Response("Bulk sync result")},
    )
    @action(detail=False, methods=["post"])
    def sync_all_payments(self, request):
        """Sync payments for all campaigns from Stripe. Only moderators/staff can use this."""
        if not (request.user.is_moderator or request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can sync all campaigns.")

        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {"error": "Stripe is not configured"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Get all approved campaigns with Stripe accounts
        campaigns = Campaign.objects.filter(
            status="approved",
            stripe_ready=True
        ).select_related("created_by").prefetch_related("created_by__stripe_account")

        results = {
            "total_campaigns": campaigns.count(),
            "synced": 0,
            "failed": 0,
            "skipped": 0,
            "total_donations_created": 0,
            "total_donations_updated": 0,
            "campaigns": [],
            "errors": [],
        }

        from decimal import Decimal

        for campaign in campaigns:
            try:
                user_account = get_user_stripe_account(campaign.created_by)
                if not user_account:
                    results["skipped"] += 1
                    results["campaigns"].append({
                        "campaign_id": campaign.id,
                        "campaign_title": campaign.title,
                        "status": "skipped",
                        "reason": "No Stripe account",
                    })
                    continue

                stripe_account_id = user_account.stripe_account_id

                # List payment intents and checkout sessions
                payment_intents = list_stripe_payment_intents_for_campaign(stripe_account_id, campaign.id)
                checkout_sessions = list_stripe_checkout_sessions_for_campaign(stripe_account_id, campaign.id)

                # Process payment intents and checkout sessions
                created_pi, updated_pi = process_payment_intents_for_donations(
                    campaign, payment_intents, log_prefix="Bulk sync: "
                )
                created_sessions, updated_sessions = process_checkout_sessions_for_donations(
                    campaign, checkout_sessions, log_prefix="Bulk sync: "
                )

                created_count = created_pi + created_sessions
                updated_count = updated_pi + updated_sessions

                # Recalculate campaign amount
                recalculate_campaign_amount(campaign)
                from decimal import Decimal
                all_donations = Donation.objects.filter(campaign=campaign)
                total_donated = sum(Decimal(str(d.amount)) for d in all_donations)

                results["synced"] += 1
                results["total_donations_created"] += created_count
                results["total_donations_updated"] += updated_count
                results["campaigns"].append({
                    "campaign_id": campaign.id,
                    "campaign_title": campaign.title,
                    "status": "success",
                    "payment_intents_found": len(payment_intents),
                    "sessions_found": len(checkout_sessions),
                    "donations_created": created_count,
                    "donations_updated": updated_count,
                })

            except Exception as e:
                import traceback
                logger.error(f"Bulk sync: Error syncing campaign {campaign.id}: {e}\n{traceback.format_exc()}")
                results["failed"] += 1
                results["errors"].append({
                    "campaign_id": campaign.id,
                    "campaign_title": campaign.title,
                    "error": str(e),
                })
                results["campaigns"].append({
                    "campaign_id": campaign.id,
                    "campaign_title": campaign.title,
                    "status": "failed",
                    "error": str(e),
                })

        return Response({
            "status": "completed",
            **results,
        })


class DonationViewSet(viewsets.ModelViewSet):
    queryset = Donation.objects.all()
    serializer_class = DonationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = Donation.objects.select_related("campaign")
        campaign_id = self.request.query_params.get("campaign", None)
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
        return queryset

    @swagger_auto_schema(
        request_body=DonationCreateSerializer,
        responses={200: openapi.Response("Stripe checkout session")},
    )
    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def create_checkout_session(self, request):
        """Create Stripe Checkout session for donation."""
        # Check if Stripe is configured
        if not settings.STRIPE_SECRET_KEY:
            logger.error("STRIPE_SECRET_KEY is not configured")
            return Response(
                {"error": "Payment processing is not configured. Please contact support."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = DonationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        campaign_id = serializer.validated_data["campaign_id"]
        amount = serializer.validated_data["amount"]

        # Validate amount
        if amount <= 0:
            return Response(
                {"error": "Donation amount must be greater than 0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            campaign = Campaign.objects.get(id=campaign_id, status="approved")
        except Campaign.DoesNotExist:
            return Response({"error": "Campaign not found or not approved"}, status=status.HTTP_404_NOT_FOUND)

        user_account = get_user_stripe_account(campaign.created_by)
        if not user_account:
            logger.error("Campaign %s has no associated Stripe account via creator", campaign.id)
            return Response(
                {"error": "Campaign is not ready to accept donations. Please try again later."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            stripe_account = sync_user_stripe_account(user_account)
        except stripe.error.StripeError as exc:
            logger.error("Stripe error syncing account %s: %s", user_account.stripe_account_id, exc)
            return Response(
                {"error": "Unable to prepare payment at this time. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not stripe_account.is_ready:
            campaign.stripe_ready = False
            campaign.save(update_fields=["stripe_ready", "updated_at"])
            return Response(
                {"error": "Campaign is not ready to accept donations. Please try again later."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not campaign.stripe_ready:
            campaign.stripe_ready = True
            campaign.save(update_fields=["stripe_ready", "updated_at"])

        # Create Stripe Checkout session
        # Create session on connected account to enable Google Pay and Apple Pay
        # Payments go directly to the connected account (no transfer_data needed)
        # Note: Omitting payment_method_types allows Stripe to automatically show all
        # enabled payment methods (cards, Google Pay, Apple Pay, Link, etc.) based on
        # customer location, device, and Dashboard settings
        try:
            checkout_session = stripe.checkout.Session.create(
                line_items=[
                    {
                        "price_data": {
                            "currency": "eur",
                            "product_data": {
                                "name": f"Donation to {campaign.title}",
                            },
                            "unit_amount": int(amount * 100),  # Convert to cents
                        },
                        "quantity": 1,
                    }
                ],
                mode="payment",
                success_url=f"{settings.FRONTEND_URL}/campaign/{campaign_id}?success=true&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{settings.FRONTEND_URL}/campaign/{campaign_id}?canceled=true",
                metadata={
                    "campaign_id": campaign_id,
                    "stripe_account_id": stripe_account.stripe_account_id,
                },
                payment_intent_data={
                    "metadata": {
                        "campaign_id": campaign_id,
                    },
                },
                # Configure payment method options to prioritize Google Pay and Apple Pay
                # These will appear as prominent express payment buttons at the top of checkout
                payment_method_options={
                    "card": {
                        "request_three_d_secure": "automatic",
                    },
                },
                # Create checkout session on connected account to enable Google Pay/Apple Pay
                # This allows the connected account's payment methods (including Google Pay) to be available
                # Google Pay and Apple Pay will automatically appear as primary payment methods
                # when enabled in Dashboard and supported by customer's device/browser
                stripe_account=stripe_account.stripe_account_id,
            )

            return Response({"session_id": checkout_session.id, "url": checkout_session.url})
        except stripe.error.StripeError as e:
            return Response({"error": f"Stripe error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback

            logger.error(f"Error creating checkout session: {traceback.format_exc()}")
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "session_id": openapi.Schema(type=openapi.TYPE_STRING),
            },
        )
    )
    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def confirm_payment(self, request):
        """Confirm payment after Stripe webhook or manual confirmation."""
        session_id = request.data.get("session_id")
        if not session_id:
            return Response({"error": "session_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Try to get campaign_id from request if provided (helps with connected account sessions)
            campaign_id = request.data.get("campaign_id")
            # Convert to int if it's a string
            if campaign_id and isinstance(campaign_id, str):
                try:
                    campaign_id = int(campaign_id)
                except ValueError:
                    campaign_id = None
            session = None
            metadata = {}
            campaign = None

            # If campaign_id is provided, use it to get the connected account and retrieve session directly
            if campaign_id:
                try:
                    campaign = Campaign.objects.get(id=campaign_id)
                    user_account = get_user_stripe_account(campaign.created_by)
                    stripe_account_id = user_account.stripe_account_id if user_account else None

                    if stripe_account_id:
                        try:
                            session = stripe.checkout.Session.retrieve(session_id, stripe_account=stripe_account_id)
                            metadata = session.metadata or {}
                            logger.info(f"Retrieved session {session_id} with connected account {stripe_account_id}")
                        except stripe.error.StripeError as e:
                            logger.warning(
                                f"Failed to retrieve session {session_id} with account {stripe_account_id}: {e}"
                            )
                            # Fall through to try platform account
                    else:
                        # No connected account, try platform account
                        try:
                            session = stripe.checkout.Session.retrieve(session_id)
                            metadata = session.metadata or {}
                        except stripe.error.StripeError as e:
                            logger.error(f"Failed to retrieve session {session_id} from platform account: {e}")
                            raise
                except Campaign.DoesNotExist:
                    return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)
            else:
                # No campaign_id provided, try platform account first
                try:
                    session = stripe.checkout.Session.retrieve(session_id)
                    metadata = session.metadata or {}
                    campaign_id = int(metadata.get("campaign_id", 0))

                    if not campaign_id:
                        return Response(
                            {"error": "Invalid session: missing campaign_id. Please provide campaign_id in request."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                except stripe.error.StripeError as e:
                    # If session doesn't exist on platform account, it's likely on a connected account
                    if "No such checkout.session" in str(e):
                        logger.warning(
                            f"Session {session_id} not found on platform account, likely on connected account"
                        )
                        return Response(
                            {
                                "error": "Session not found. This session was created on a connected account. Please provide campaign_id in the request.",
                                "requires_campaign_id": True,
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    else:
                        raise

            # If we still don't have campaign_id, try to get it from metadata
            if not campaign_id:
                campaign_id = int(metadata.get("campaign_id", 0))
                if not campaign_id:
                    return Response(
                        {"error": "Invalid session: missing campaign_id"}, status=status.HTTP_400_BAD_REQUEST
                    )

            # Ensure we have the campaign object (it may have been set in the if block above)
            if campaign is None:
                try:
                    campaign = Campaign.objects.get(id=campaign_id)
                except Campaign.DoesNotExist:
                    return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)

            if session.payment_status == "paid":
                amount = session.amount_total / 100  # Convert from cents
                payment_intent = extract_payment_intent_from_session(session, session_id)

                # Campaign was already retrieved above, reuse it
                # Use helper function to prevent duplicates and handle race conditions
                donation, created, updated = create_or_update_donation(
                    campaign, payment_intent, amount, log_prefix="Confirm payment: "
                )

                if created:
                    # New donation created - update campaign amount incrementally
                    from decimal import Decimal
                    campaign.current_amount = (campaign.current_amount or Decimal("0")) + Decimal(str(amount))
                    campaign.save()
                    logger.info(f"Confirm payment: Updated campaign {campaign_id} current_amount by {amount}")
                else:
                    # Donation already exists - recalculate from all donations to ensure consistency
                    recalculate_campaign_amount(campaign)

                return Response({"status": "success", "donation": DonationSerializer(donation).data})
            else:
                logger.warning(
                    f"Confirm payment: Session {session_id} payment_status is '{session.payment_status}', not 'paid'"
                )
                return Response(
                    {"error": f"Payment not completed. Status: {session.payment_status}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except stripe.error.StripeError as e:
            logger.error(f"Confirm payment: Stripe error for session {session_id}: {e}")
            return Response({"error": f"Stripe error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Campaign.DoesNotExist:
            logger.error(f"Confirm payment: Campaign {campaign_id} not found")
            return Response({"error": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            import traceback

            logger.error(f"Confirm payment: Unexpected error for session {session_id}: {e}\n{traceback.format_exc()}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NewsViewSet(viewsets.ModelViewSet):
    queryset = News.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.action == "create" or self.action == "update":
            return NewsCreateSerializer
        return NewsSerializer

    def get_queryset(self):
        queryset = News.objects.all()
        # Public users can only see published news
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(published=True)
        elif not (self.request.user.is_moderator or self.request.user.is_staff):
            queryset = queryset.filter(published=True)
        # Moderators/staff can see all news (including unpublished)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        # Only moderators and staff can create news
        if not (self.request.user.is_moderator or self.request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can create news.")
        serializer.save()

    def perform_update(self, serializer):
        # Only moderators and staff can update news
        if not (self.request.user.is_moderator or self.request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can update news.")
        serializer.save()

    def perform_destroy(self, instance):
        # Only moderators and staff can delete news
        if not (self.request.user.is_moderator or self.request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can delete news.")
        instance.delete()


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def stripe_webhook(request):
    """Handle Stripe webhook events."""
    payload = request.body
    sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
    endpoint_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", None)

    if not endpoint_secret:
        # In development, skip signature verification
        import json

        event = json.loads(payload)
    else:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except ValueError:
            return Response({"error": "Invalid payload"}, status=400)
        except stripe.error.SignatureVerificationError:
            return Response({"error": "Invalid signature"}, status=400)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})

        try:
            campaign_id = int(metadata.get("campaign_id"))
            if not campaign_id:
                logger.error("Webhook: Missing campaign_id in session metadata")
                return Response({"error": "Missing campaign_id"}, status=400)

            amount = session.get("amount_total", 0) / 100
            if amount <= 0:
                logger.error(f"Webhook: Invalid amount {amount} for session {session.get('id')}")
                return Response({"error": "Invalid amount"}, status=400)

            payment_intent = extract_payment_intent_from_session(session)

            campaign = Campaign.objects.get(id=campaign_id)

            # Use helper function to create or update donation (prevents duplicates)
            donation, created, updated = create_or_update_donation(
                campaign, payment_intent, amount, log_prefix="Webhook: "
            )

            if created:
                # New donation created - update campaign amount incrementally
                from decimal import Decimal
                campaign.current_amount = (campaign.current_amount or Decimal("0")) + Decimal(str(amount))
                campaign.save()
            else:
                # Donation already exists - recalculate from all donations to ensure consistency
                recalculate_campaign_amount(campaign)

            return Response({"status": "success" if created else "already_processed"}, status=200)

        except KeyError as e:
            logger.error(f"Webhook error: Missing required field {e} in session data: {session}")
            return Response({"error": f"Missing required field: {e}"}, status=400)
        except ValueError as e:
            logger.error(f"Webhook error: Invalid value {e} in session data")
            return Response({"error": f"Invalid value: {e}"}, status=400)
        except Campaign.DoesNotExist:
            logger.error(f"Webhook error: Campaign {campaign_id} not found")
            return Response({"error": "Campaign not found"}, status=404)
        except Exception as e:
            import traceback

            logger.error(f"Webhook error processing checkout.session.completed: {e}\n{traceback.format_exc()}")
            return Response({"error": str(e)}, status=500)
    elif event["type"] == "account.updated":
        account_data = event["data"]["object"]
        account_id = account_data.get("id")

        if not account_id:
            logger.warning("Received account.updated event without account id")
        else:
            try:
                user_account = UserStripeAccount.objects.get(stripe_account_id=account_id)
            except UserStripeAccount.DoesNotExist:
                logger.warning("Received account.updated for unknown account %s", account_id)
            else:
                user_account.update_from_stripe_account(account_data)
                Campaign.objects.filter(created_by=user_account.user).update(stripe_ready=user_account.is_ready)
    elif event["type"] == "capability.updated":
        capability_data = event["data"]["object"]
        account_id = capability_data.get("account")

        if not account_id:
            logger.warning("Received capability.updated event without account id")
        else:
            try:
                user_account = UserStripeAccount.objects.get(stripe_account_id=account_id)
            except UserStripeAccount.DoesNotExist:
                logger.warning("Received capability.updated for unknown account %s", account_id)
            else:
                try:
                    user_account = sync_user_stripe_account(user_account)
                except stripe.error.StripeError as exc:
                    logger.error("Unable to sync account %s after capability update: %s", account_id, exc)
                Campaign.objects.filter(created_by=user_account.user).update(stripe_ready=user_account.is_ready)

    return Response({"status": "success"})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    Kubernetes health check endpoint.
    Returns 200 OK if the service is healthy.
    Optionally checks database connectivity.
    """
    try:
        # Quick database connectivity check
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            db_healthy = cursor.fetchone() is not None
    except Exception as e:
        logger.warning(f"Health check database check failed: {e}")
        db_healthy = False

    if db_healthy:
        return Response({"status": "healthy", "database": "connected"}, status=status.HTTP_200_OK)
    else:
        # Return 200 even if DB check fails - allows for graceful degradation
        # Adjust based on your requirements (you might want 503 if DB is critical)
        return Response({"status": "healthy", "database": "unknown"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def serve_media(request, file_path):
    """
    Serve media files from MinIO storage through Django backend.

    This endpoint proxies requests to MinIO and serves the file,
    avoiding the need for public bucket access.

    URL format: /api/media/<file_path>
    Example: /api/media/campaigns/image.jpg
    """
    import boto3
    from botocore.exceptions import ClientError
    from django.conf import settings
    from django.http import Http404, StreamingHttpResponse

    # Only serve media if S3 storage is enabled
    if not settings.USE_S3_STORAGE:
        raise Http404("Media storage not configured")

    try:
        # Connect to MinIO
        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )

        bucket_name = settings.AWS_STORAGE_BUCKET_NAME

        # Get object from MinIO
        try:
            obj = s3_client.get_object(Bucket=bucket_name, Key=file_path)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "NoSuchKey":
                raise Http404("File not found")
            logger.error(f"Error accessing file {file_path}: {e}")
            raise Http404("Error accessing file")

        # Determine content type
        content_type = obj.get("ContentType", "application/octet-stream")

        # Stream the file content
        def file_iterator():
            for chunk in obj["Body"].iter_chunks(chunk_size=8192):
                yield chunk

        # Create streaming response
        response = StreamingHttpResponse(file_iterator(), content_type=content_type)

        # Set cache headers
        response["Cache-Control"] = "public, max-age=86400"  # Cache for 1 day

        # Set content length if available
        if "ContentLength" in obj:
            response["Content-Length"] = str(obj["ContentLength"])

        return response

    except Http404:
        raise
    except Exception as e:
        logger.error(f"Error serving media file {file_path}: {e}")
        raise Http404("Error serving file")
