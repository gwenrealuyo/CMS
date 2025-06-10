from django.contrib import admin
from .models import User, Family, Cluster, Milestone

admin.site.register(User)
admin.site.register(Family)
admin.site.register(Cluster)
admin.site.register(Milestone)
