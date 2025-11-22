from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Person, Family, Journey, ModuleCoordinator


class PersonAdmin(UserAdmin):
    model = Person

    # Remove the password field here
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "username",
                    "email",
                    "first_name",
                    "middle_name",
                    "last_name",
                    "suffix",
                    "nickname",
                    "gender",
                    "facebook_name",
                    "photo",
                    "role",
                    "phone",
                    "address",
                    "country",
                    "date_of_birth",
                    "date_first_attended",
                    "has_finished_lessons",
                    "inviter",
                    "member_id",
                    "status",
                )
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    # Also customize the add form to hide the password field
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "username",
                    "email",
                    "first_name",
                    "middle_name",
                    "last_name",
                    "suffix",
                    "nickname",
                    "gender",
                    "facebook_name",
                    "photo",
                    "role",
                    "phone",
                    "address",
                    "country",
                    "date_of_birth",
                    "date_first_attended",
                    "has_finished_lessons",
                    "inviter",
                    "member_id",
                    "status",
                ),
            },
        ),
    )

    list_display = ("username", "email", "first_name", "last_name", "role", "status")
    search_fields = ("username", "email", "first_name", "last_name", "member_id")
    ordering = ("username",)


class ModuleCoordinatorAdmin(admin.ModelAdmin):
    list_display = (
        "person",
        "module",
        "level",
        "resource_type",
        "resource_id",
        "created_at",
    )
    list_filter = ("module", "level", "created_at")
    search_fields = (
        "person__username",
        "person__first_name",
        "person__last_name",
        "person__email",
    )
    raw_id_fields = ("person",)
    ordering = ("person", "module", "level")
    date_hierarchy = "created_at"
    
    fieldsets = (
        (
            "Assignment",
            {
                "fields": ("person", "module", "level"),
            },
        ),
        (
            "Resource Assignment (Optional)",
            {
                "fields": ("resource_type", "resource_id"),
                "description": "For resource-specific assignments (e.g., specific cluster, evangelism group). Leave blank for module-wide access.",
            },
        ),
        (
            "Metadata",
            {
                "fields": ("created_at",),
            },
        ),
    )
    
    readonly_fields = ("created_at",)


# Register with custom admin
admin.site.register(Person, PersonAdmin)
admin.site.register(Family)
admin.site.register(Journey)
admin.site.register(ModuleCoordinator, ModuleCoordinatorAdmin)
