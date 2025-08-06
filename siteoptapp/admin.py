from django.contrib import admin
from .models import (
    Project,
    DockerModel,
    ProjectExecutionSettings,
    InputData,
    InputFile,
    ExecutionOutputData,
)
# Register your models here.
admin.site.register(Project)
admin.site.register(DockerModel)
admin.site.register(ProjectExecutionSettings)
admin.site.register(InputData)
admin.site.register(InputFile)
admin.site.register(ExecutionOutputData)
