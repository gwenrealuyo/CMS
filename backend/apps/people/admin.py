from django.contrib import admin
from .models import Person, Family, Cluster, Milestone

admin.site.register(Person)
admin.site.register(Family)
admin.site.register(Cluster)
admin.site.register(Milestone)
