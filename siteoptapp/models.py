from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=512)
    project_dir = models.CharField(max_length=512)

    def __str__(self):
        return self.name


class DockerModel(models.Model):
    dockerfile = models.CharField(max_length=512)
    docker_run_cmd = models.CharField(max_length=512)

    def __str__(self):
        return f"DockerModel [id:{self.id}]"


class ProjectExecutionSettings(models.Model):
    n_scenarios = models.IntegerField(default=1)


class InputFile(models.Model):
    fpath = models.CharField(max_length=512)
    display_name = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.display_name} [id:{self.id}]"


class InputData(models.Model):
    dataset_name = models.CharField(max_length=50)
    nr_input_files = models.IntegerField(default=1)
    input_files = models.ManyToManyField(InputFile)

    def __str__(self):
        return f"{self.dataset_name} [id:{self.id}]"


class ExecutionOutputData(models.Model):
    execution_date = models.DateTimeField("date created")
    execution_name = models.CharField(max_length=200)
    # Path to output archive, which contains the timestamped folders
    output_archive_basepath = models.CharField(max_length=512)
    # Timestamped folder name for this run
    output_dir = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.execution_name} [{self.execution_date}] [id:{self.id}]"
