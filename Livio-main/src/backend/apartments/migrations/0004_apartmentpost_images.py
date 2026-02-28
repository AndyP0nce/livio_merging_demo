from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('apartments', '0003_remove_favoriteapartment_notes'),
    ]

    operations = [
        migrations.AddField(
            model_name='apartmentpost',
            name='images',
            field=models.JSONField(blank=True, default=list, help_text='List of S3 image URLs (up to 10)'),
        ),
    ]
