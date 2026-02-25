# Generated migration — adds the University model for campus map markers

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('apartments', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='University',
            fields=[
                ('id',       models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name',     models.CharField(help_text='Short abbreviation, e.g. CSUN', max_length=20, unique=True)),
                ('fullName', models.CharField(help_text='Full official name', max_length=200)),
                ('lat',      models.DecimalField(decimal_places=6, max_digits=9)),
                ('lng',      models.DecimalField(decimal_places=6, max_digits=9)),
            ],
            options={
                'verbose_name_plural': 'Universities',
                'ordering': ['name'],
            },
        ),
    ]
