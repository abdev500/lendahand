from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Campaign, CampaignMedia, Donation, ModerationHistory, News, NewsMedia, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        "email",
        "username",
        "phone",
        "is_moderator",
        "is_staff",
        "is_active",
    ]
    list_filter = ["is_moderator", "is_staff", "is_active"]
    fieldsets = BaseUserAdmin.fieldsets + (("Additional Info", {"fields": ("phone", "address", "is_moderator")}),)


class CampaignMediaInline(admin.TabularInline):
    model = CampaignMedia
    extra = 1


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "created_by",
        "status",
        "target_amount",
        "current_amount",
        "created_at",
    ]
    list_filter = ["status", "created_at"]
    search_fields = ["title", "description"]
    readonly_fields = ["current_amount", "created_at", "updated_at"]
    inlines = [CampaignMediaInline]


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ["campaign", "amount", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["campaign__title"]
    readonly_fields = ["created_at"]
    # All donations are anonymous - no donor information is stored or displayed


@admin.register(ModerationHistory)
class ModerationHistoryAdmin(admin.ModelAdmin):
    list_display = ["campaign", "moderator", "action", "created_at"]
    list_filter = ["action", "created_at"]
    readonly_fields = ["created_at"]


class NewsMediaInline(admin.TabularInline):
    model = NewsMedia
    extra = 1


@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = ["title", "published", "created_at"]
    list_filter = ["published", "created_at"]
    inlines = [NewsMediaInline]
