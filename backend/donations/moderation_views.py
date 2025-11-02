from django.contrib import messages
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render

from .models import Campaign, ModerationHistory, News

User = get_user_model()


def is_moderator(user):
    return user.is_authenticated and (user.is_moderator or user.is_staff)


def moderation_login_required(view_func):
    """Decorator that supports both session and token authentication."""

    def wrapper(request, *args, **kwargs):
        # Check if user is authenticated and is moderator
        if not request.user.is_authenticated:
            messages.error(request, "You must be logged in to access this page.")
            return redirect("/login/")

        if not is_moderator(request.user):
            messages.error(request, "You must be a moderator or staff member to access this page.")
            return redirect("/login/")

        return view_func(request, *args, **kwargs)

    return wrapper


@moderation_login_required
def moderation_dashboard(request):
    """Moderation dashboard for reviewing campaigns."""
    # Force evaluation of queryset to ensure data is available
    pending_campaigns = list(Campaign.objects.filter(status="pending").order_by("-created_at"))
    approved_campaigns = list(Campaign.objects.filter(status="approved").order_by("-created_at")[:10])
    rejected_campaigns = list(Campaign.objects.filter(status="rejected").order_by("-created_at")[:10])

    # Debug: Log what we're passing to template
    import logging

    logger = logging.getLogger(__name__)
    logger.info(f"Pending campaigns count: {len(pending_campaigns)}")
    logger.info(f"User: {request.user.email if request.user.is_authenticated else 'Not authenticated'}")
    logger.info(f"Is moderator: {request.user.is_moderator if request.user.is_authenticated else False}")

    context = {
        "pending_campaigns": pending_campaigns,
        "approved_campaigns": approved_campaigns,
        "rejected_campaigns": rejected_campaigns,
    }
    return render(request, "moderation/dashboard.html", context)


@moderation_login_required
def moderate_campaign(request, campaign_id, action):
    """Approve or reject a campaign."""
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"moderate_campaign called: method={request.method}, campaign_id={campaign_id}, action={action}, user={request.user.email if request.user.is_authenticated else 'anonymous'}")

    if request.method != "POST":
        messages.error(request, "Invalid request method. Use POST.")
        logger.warning(f"Invalid method: {request.method}")
        return redirect("moderation:dashboard")

    campaign = get_object_or_404(Campaign, id=campaign_id)
    logger.info(f"Campaign found: {campaign.title}, status={campaign.status}")

    if campaign.status != "pending":
        messages.error(request, "This campaign is not pending moderation.")
        return redirect("moderation:dashboard")

    notes = request.POST.get("notes", "")
    logger.info(f"Processing {action} with notes: {notes[:50] if notes else 'None'}")

    if action == "approve":
        campaign.status = "approved"
        campaign.moderation_notes = notes
        campaign.save()
        ModerationHistory.objects.create(campaign=campaign, moderator=request.user, action="approve", notes=notes)
        messages.success(request, f'Campaign "{campaign.title}" has been approved.')
    elif action == "reject":
        campaign.status = "rejected"
        campaign.moderation_notes = notes
        campaign.save()
        ModerationHistory.objects.create(campaign=campaign, moderator=request.user, action="reject", notes=notes)
        messages.success(request, f'Campaign "{campaign.title}" has been rejected.')
    else:
        messages.error(request, f"Invalid action: {action}")
        return redirect("moderation:dashboard")

    return redirect("moderation:dashboard")


@moderation_login_required
def user_management(request):
    """User management page for moderators."""
    users = User.objects.all().order_by("-date_joined")
    search_query = request.GET.get("search", "")

    if search_query:
        users = users.filter(Q(email__icontains=search_query) | Q(username__icontains=search_query))

    context = {
        "users": users,
        "search_query": search_query,
    }
    return render(request, "moderation/users.html", context)


@moderation_login_required
def news_management(request):
    """News management page for moderators."""
    all_news = News.objects.all().order_by("-created_at")
    published_news = News.objects.filter(published=True).order_by("-created_at")[:10]
    unpublished_news = News.objects.filter(published=False).order_by("-created_at")[:10]

    context = {
        "all_news": all_news,
        "published_news": published_news,
        "unpublished_news": unpublished_news,
    }
    return render(request, "moderation/news.html", context)


@moderation_login_required
def toggle_news(request, news_id):
    """Toggle news published status."""
    news = get_object_or_404(News, id=news_id)
    if request.method == "POST":
        news.published = not news.published
        news.save()
        messages.success(
            request,
            f'News "{news.title}" has been {"published" if news.published else "unpublished"}.',
        )
    return redirect("moderation:news")
