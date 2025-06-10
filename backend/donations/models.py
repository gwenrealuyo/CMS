from django.db import models
from members.models import User

class Donation(models.Model):
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    donor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    purpose = models.CharField(max_length=200)
    is_anonymous = models.BooleanField(default=False)
    payment_method = models.CharField(max_length=50, choices=[
        ('CASH', 'Cash'),
        ('CHECK', 'Check'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('ONLINE', 'Online Payment'),
    ])
    receipt_number = models.CharField(max_length=50, unique=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='recorded_donations')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Donation {self.receipt_number} - {self.amount}"
