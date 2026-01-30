from django.contrib import admin
from .models import (
    ClientConfig,
    Project,
    DockerModel,
    ProjectExecutionSettings,
    InputFile,
    InputData,
    ExecutionOutputData,
)
# Register your models here.
admin.site.register(ClientConfig)
admin.site.register(Project)
admin.site.register(DockerModel)
admin.site.register(ProjectExecutionSettings)
admin.site.register(InputFile)
admin.site.register(InputData)
admin.site.register(ExecutionOutputData)
