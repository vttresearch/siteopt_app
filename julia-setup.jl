ENV["PYTHON"] = "/opt/venv/bin/python"

import Pkg

# Activate the default environment, e.g., ~/.julia/environments/v1.11
Pkg.activate()
# Install everyting into the default environment
Pkg.add("PyCall")
Pkg.build("PyCall")
Pkg.add(url="https://github.com/spine-tools/SpineOpt.jl.git", rev="elexia")
Pkg.add(name="SpineInterface", version="0.15.2")
Pkg.add(url="https://github.com/spine-tools/SpinePeriods.jl.git", rev="clustering")
Pkg.develop(path="/app/siteopt_toolbox/code/")
# Force install Sines_additional package dependencies (These are in Sines_additional Project.toml)
Pkg.add("ArgParse")
Pkg.add("CSV")
Pkg.add("DataFrames")
Pkg.add("Dates")
Pkg.add("Infiltrator")
Pkg.add("JSON")
Pkg.add("TimeZones")
Pkg.add("XLSX")

Pkg.resolve()
Pkg.instantiate()

# Optional IJulia and kernel installation. Doesn't quite work yet.
try
    Pkg.add("IJulia")
    IJulia.installkernel("julia")
catch err
    @warn "IJulia add failed or skipped (continuing)" err
end
try
    Pkg.precompile()
catch err
    @warn("Pkg.precompile failed (continuing)", err)
end
