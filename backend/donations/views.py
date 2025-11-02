import logging

import stripe
from django.conf import settings
from django.contrib.auth import logout
from django.db.models import Q
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from .models import Campaign, Donation, News, User
from .serializers import (
    CampaignCreateSerializer,
    CampaignSerializer,
    DonationCreateSerializer,
    DonationSerializer,
    LoginSerializer,
    NewsCreateSerializer,
    NewsSerializer,
    PasswordChangeSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)

stripe.api_key = settings.STRIPE_SECRET_KEY


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_moderator or self.request.user.is_staff:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

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
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.action == "create" or self.action == "update":
            return CampaignCreateSerializer
        return CampaignSerializer

    def get_queryset(self):
        queryset = Campaign.objects.all()
        status_filter = self.request.query_params.get("status", None)

        # Public can only see approved campaigns
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(status="approved")
        elif not (self.request.user.is_moderator or self.request.user.is_staff):
            # Regular users see approved + their own campaigns
            queryset = queryset.filter(Q(status="approved") | Q(created_by=self.request.user))

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.select_related("created_by").prefetch_related("media", "donations")

    def perform_create(self, serializer):
        # Don't pass created_by and status here - let the serializer handle it
        # This avoids duplicate keyword arguments when the serializer's create() method
        # also tries to set created_by
        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        # Ensure user owns the campaign or is moderator/staff
        if instance.created_by != self.request.user and not (
            self.request.user.is_moderator or self.request.user.is_staff
        ):
            raise PermissionDenied("You can only edit your own campaigns.")
        # Reset moderation when editing approved/rejected campaigns
        if instance.status in ["approved", "rejected"]:
            serializer.save(status="pending", moderation_notes="")
        else:
            serializer.save()

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        campaign = self.get_object()
        if campaign.created_by != request.user:
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
    def approve(self, request, pk=None):
        """Approve a pending campaign. Only moderators/staff can approve."""
        if not (request.user.is_moderator or request.user.is_staff):
            raise PermissionDenied("Only moderators and staff can approve campaigns.")

        campaign = self.get_object()
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

        # Create Stripe Checkout session
        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price_data": {
                            "currency": "usd",
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
                },
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
            session = stripe.checkout.Session.retrieve(session_id)

            if session.payment_status == "paid":
                metadata = session.metadata
                campaign_id = int(metadata["campaign_id"])
                amount = session.amount_total / 100  # Convert from cents
                payment_intent = session.payment_intent

                from decimal import Decimal

                campaign = Campaign.objects.get(id=campaign_id)

                # Check if donation already exists (prevent duplicates)
                if payment_intent and Donation.objects.filter(stripe_payment_intent_id=payment_intent).exists():
                    logger.info(f"Donation already exists for payment_intent {payment_intent}")
                    # Return existing donation, but ensure campaign amount is updated
                    existing_donation = Donation.objects.get(stripe_payment_intent_id=payment_intent)
                    # Update campaign amount if it doesn't reflect this donation
                    # Recalculate from all donations to ensure consistency
                    all_donations = Donation.objects.filter(campaign=campaign)
                    total_donated = sum(Decimal(str(d.amount)) for d in all_donations)
                    if campaign.current_amount != total_donated:
                        campaign.current_amount = total_donated
                        campaign.save()
                        logger.info(f"Updated campaign {campaign_id} current_amount to {total_donated}")
                    return Response({"status": "success", "donation": DonationSerializer(existing_donation).data})

                # Create donation record (all donations are anonymous)
                donation = Donation.objects.create(
                    campaign=campaign,
                    amount=Decimal(str(amount)),
                    donor_name="",
                    donor_email="",
                    is_anonymous=True,
                    stripe_payment_intent_id=payment_intent,
                )

                # Update campaign amount
                campaign.current_amount = (campaign.current_amount or Decimal("0")) + Decimal(str(amount))
                campaign.save()
                logger.info(f"Updated campaign {campaign_id} current_amount by {amount}")

                return Response({"status": "success", "donation": DonationSerializer(donation).data})
            else:
                return Response(
                    {"error": "Payment not completed"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
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
            amount = session["amount_total"] / 100
            payment_intent = session.get("payment_intent", "")

            # Check if donation already exists (prevent duplicates)
            if payment_intent and Donation.objects.filter(stripe_payment_intent_id=payment_intent).exists():
                logger.info(f"Donation already exists for payment_intent {payment_intent}")
                return Response({"status": "already_processed"}, status=200)

            campaign = Campaign.objects.get(id=campaign_id)

            from decimal import Decimal

            # Create donation record (all donations are anonymous)
            Donation.objects.create(
                campaign=campaign,
                amount=Decimal(str(amount)),
                donor_name="",
                donor_email="",
                is_anonymous=True,
                stripe_payment_intent_id=payment_intent,
            )

            # Update campaign amount
            campaign.current_amount = (campaign.current_amount or Decimal("0")) + Decimal(str(amount))
            campaign.save()
            logger.info(f"Webhook: Donation for campaign {campaign_id} confirmed. Updated amount by {amount}")

        except Exception as e:
            logger.error(f"Webhook error processing checkout.session.completed: {e}")
            return Response({"error": str(e)}, status=500)

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
    from django.conf import settings
    from django.http import StreamingHttpResponse, Http404
    import boto3
    from botocore.exceptions import ClientError

    # Only serve media if S3 storage is enabled
    if not settings.USE_S3_STORAGE:
        raise Http404("Media storage not configured")

    try:
        # Connect to MinIO
        s3_client = boto3.client(
            's3',
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )

        bucket_name = settings.AWS_STORAGE_BUCKET_NAME

        # Get object from MinIO
        try:
            obj = s3_client.get_object(Bucket=bucket_name, Key=file_path)
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'NoSuchKey':
                raise Http404("File not found")
            logger.error(f"Error accessing file {file_path}: {e}")
            raise Http404("Error accessing file")

        # Determine content type
        content_type = obj.get('ContentType', 'application/octet-stream')

        # Stream the file content
        def file_iterator():
            for chunk in obj['Body'].iter_chunks(chunk_size=8192):
                yield chunk

        # Create streaming response
        response = StreamingHttpResponse(file_iterator(), content_type=content_type)

        # Set cache headers
        response['Cache-Control'] = 'public, max-age=86400'  # Cache for 1 day

        # Set content length if available
        if 'ContentLength' in obj:
            response['Content-Length'] = str(obj['ContentLength'])

        return response

    except Http404:
        raise
    except Exception as e:
        logger.error(f"Error serving media file {file_path}: {e}")
        raise Http404("Error serving file")
