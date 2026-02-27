from spinedb_api import DatabaseMapping
from spinedb_api.filters.scenario_filter import SCENARIO_FILTER_TYPE

db_path = project.project_dir / ".spinetoolbox" / "items" / "input_with_repr_periods" / "input with repr periods.sqlite"
db_url = "sqlite:///" + str(db_path)
with DatabaseMapping(db_url) as db_map:
    active_scenarios = {{{scenarios}}}
    connection = project.find_connection("input with repr periods", "Optimize")
    available_scenarios = [r.name for r in db_map.query(db_map.scenario_sq)]
    for name in available_scenarios:
        enabled = name in active_scenarios
        connection.set_filter_enabled(
            "db_url@input with repr periods", SCENARIO_FILTER_TYPE, name, enabled
        )
