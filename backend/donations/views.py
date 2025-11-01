from rest_framework import viewsets, status, generics, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import logout
from django.db.models import Q
from django.utils import translation
import stripe
from django.conf import settings
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from .models import User, Campaign, Donation, News
from .serializers import (
    UserSerializer, UserRegistrationSerializer, LoginSerializer,
    PasswordChangeSerializer, CampaignSerializer, CampaignCreateSerializer,
    DonationSerializer, DonationCreateSerializer, NewsSerializer
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
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'user': request.user})
        if serializer.is_valid():
            if not request.user.check_password(serializer.validated_data['old_password']):
                return Response({'old_password': ['Wrong password.']}, status=status.HTTP_400_BAD_REQUEST)
            request.user.set_password(serializer.validated_data['new_password'])
            request.user.save()
            return Response({'status': 'password changed'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """User registration endpoint."""
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """User login endpoint."""
    serializer = LoginSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        user = serializer.validated_data['user']
        # Only create/get token, don't use session login for API
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """User logout endpoint."""
    logout(request)
    try:
        request.user.auth_token.delete()
    except:
        pass
    return Response({'status': 'logged out'})


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_serializer_class(self):
        if self.action == 'create' or self.action == 'update':
            return CampaignCreateSerializer
        return CampaignSerializer
    
    def get_queryset(self):
        queryset = Campaign.objects.all()
        status_filter = self.request.query_params.get('status', None)
        
        # Public can only see approved campaigns
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(status='approved')
        elif not (self.request.user.is_moderator or self.request.user.is_staff):
            # Regular users see approved + their own campaigns
            queryset = queryset.filter(
                Q(status='approved') | Q(created_by=self.request.user)
            )
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.select_related('created_by').prefetch_related('media', 'donations')
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, status='pending')
    
    def perform_update(self, serializer):
        instance = serializer.instance
        # Ensure user owns the campaign or is moderator/staff
        if instance.created_by != self.request.user and not (self.request.user.is_moderator or self.request.user.is_staff):
            raise PermissionDenied("You can only edit your own campaigns.")
        # Reset moderation when editing approved/rejected campaigns
        if instance.status in ['approved', 'rejected']:
            serializer.save(status='pending', moderation_notes='')
        else:
            serializer.save()
    
    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        campaign = self.get_object()
        if campaign.created_by != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        campaign.status = 'suspended'
        campaign.save()
        return Response({'status': 'campaign suspended'})
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        campaign = self.get_object()
        if campaign.created_by != request.user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        campaign.status = 'cancelled'
        campaign.save()
        return Response({'status': 'campaign cancelled'})


class DonationViewSet(viewsets.ModelViewSet):
    queryset = Donation.objects.all()
    serializer_class = DonationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        queryset = Donation.objects.select_related('campaign')
        campaign_id = self.request.query_params.get('campaign', None)
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
        return queryset
    
    @swagger_auto_schema(
        request_body=DonationCreateSerializer,
        responses={200: openapi.Response('Stripe checkout session')}
    )
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def create_checkout_session(self, request):
        """Create Stripe Checkout session for donation."""
        serializer = DonationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        campaign_id = serializer.validated_data['campaign_id']
        amount = serializer.validated_data['amount']
        
        try:
            campaign = Campaign.objects.get(id=campaign_id, status='approved')
        except Campaign.DoesNotExist:
            return Response({'error': 'Campaign not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create Stripe Checkout session
        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f'Donation to {campaign.title}',
                        },
                        'unit_amount': int(amount * 100),  # Convert to cents
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=request.build_absolute_uri(f'/campaign/{campaign_id}?success=true&session_id={{CHECKOUT_SESSION_ID}}'),
                cancel_url=request.build_absolute_uri(f'/campaign/{campaign_id}?canceled=true'),
                metadata={
                    'campaign_id': campaign_id,
                }
            )
            
            return Response({
                'session_id': checkout_session.id,
                'url': checkout_session.url
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'session_id': openapi.Schema(type=openapi.TYPE_STRING),
            }
        )
    )
    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny])
    def confirm_payment(self, request):
        """Confirm payment after Stripe webhook or manual confirmation."""
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({'error': 'session_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            
            if session.payment_status == 'paid':
                metadata = session.metadata
                campaign_id = int(metadata['campaign_id'])
                amount = session.amount_total / 100  # Convert from cents
                
                campaign = Campaign.objects.get(id=campaign_id)
                
                # Create donation record (all donations are anonymous)
                donation = Donation.objects.create(
                    campaign=campaign,
                    amount=amount,
                    donor_name='',
                    donor_email='',
                    is_anonymous=True,
                    stripe_payment_intent_id=session.payment_intent
                )
                
                # Update campaign amount
                campaign.current_amount += amount
                campaign.save()
                
                return Response({
                    'status': 'success',
                    'donation': DonationSerializer(donation).data
                })
            else:
                return Response({'error': 'Payment not completed'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class NewsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = News.objects.filter(published=True)
    serializer_class = NewsSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = News.objects.filter(published=True)
        # Use current language for translations
        lang = translation.get_language()
        return queryset.translated(lang) if lang else queryset


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def stripe_webhook(request):
    """Handle Stripe webhook events."""
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    endpoint_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', None)
    
    if not endpoint_secret:
        # In development, skip signature verification
        import json
        event = json.loads(payload)
    else:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        except ValueError:
            return Response({'error': 'Invalid payload'}, status=400)
        except stripe.error.SignatureVerificationError:
            return Response({'error': 'Invalid signature'}, status=400)
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.get('metadata', {})
        
        try:
            campaign_id = int(metadata.get('campaign_id'))
            amount = session['amount_total'] / 100
            campaign = Campaign.objects.get(id=campaign_id)
            
            # Create donation record (all donations are anonymous)
            donation = Donation.objects.create(
                campaign=campaign,
                amount=amount,
                donor_name='',
                donor_email='',
                is_anonymous=True,
                stripe_payment_intent_id=session.get('payment_intent', '')
            )
            
            campaign.current_amount += amount
            campaign.save()
            
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    return Response({'status': 'success'})

