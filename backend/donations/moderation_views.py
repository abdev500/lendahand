from django.contrib import messages
from django.contrib.auth.decorators import user_passes_test
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render

from .models import Campaign, ModerationHistory, User


def is_moderator(user):
    return user.is_authenticated and (user.is_moderator or user.is_staff)


@user_passes_test(is_moderator)
def moderation_dashboard(request):
    """Moderation dashboard for reviewing campaigns."""
    pending_campaigns = Campaign.objects.filter(status="pending").order_by("-created_at")
    approved_campaigns = Campaign.objects.filter(status="approved").order_by("-created_at")[:10]
    rejected_campaigns = Campaign.objects.filter(status="rejected").order_by("-created_at")[:10]

    context = {
        "pending_campaigns": pending_campaigns,
        "approved_campaigns": approved_campaigns,
        "rejected_campaigns": rejected_campaigns,
    }
    return render(request, "moderation/dashboard.html", context)


@user_passes_test(is_moderator)
def moderate_campaign(request, campaign_id, action):
    """Approve or reject a campaign."""
    campaign = get_object_or_404(Campaign, id=campaign_id)

    if campaign.status != "pending":
        messages.error(request, "This campaign is not pending moderation.")
        return redirect("moderation:dashboard")

    notes = request.POST.get("notes", "")

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

    return redirect("moderation:dashboard")


@user_passes_test(is_moderator)
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
