from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Person, Family, Cluster, Milestone


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


# Register with custom admin
admin.site.register(Person, PersonAdmin)
admin.site.register(Family)
admin.site.register(Cluster)
admin.site.register(Milestone)
