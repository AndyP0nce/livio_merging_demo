from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('apartments', '0002_university'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='favoriteapartment',
            name='notes',
        ),
    ]
