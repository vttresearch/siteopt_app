import os
import subprocess
import json
from django.shortcuts import render
from django.http import HttpResponse, JsonResponse
import openpyxl

SITEOPTDATA = os.path.join("C:\\", "data", "GIT", "SITEOPT-DATA")


def health_check(request):
    """For polling the backend."""
    return JsonResponse({"status": "ok"})


def fetch_input_data(request):
    data = {
        "title": "Input Files",
        "children": [
            {"name": "modelspec.xlsx"},
            {"name": "output_recipe.json"},
            {"name": "scenarios.xlsx"},
            {"name": "connections",
             "children": [
                 {"name": "connections-input.xlsx"},
                 {"name": "ts_price_dayahead.csv"},
                 {"name": "ts_price_dheat.csv"},
             ]
             },
            {"name": "demand",
             "children": [
                 {"name": "tscr_cooldemand.csv"},
                 {"name": "tscr_elecdemand.csv"},
                 {"name": "tscr_heatdemand.csv"},
             ]
             },
            {"name": "nodes",
             "children": [
                 {"name": "nodes.xlsx"},
                 {"name": "ts_load_oldtrafo.csv"},
                 {"name": "ts_load_shore.csv"},
             ]
             },
            {"name": "other_units",
             "children": [
                 {"name": "divertingunits.xlsx"},
             ]
             },
            {"name": "production",
             "children": [
                 {"name": "hp-input.xlsx"},
                 {"name": "pv-input.xlsx"},
                 {"name": "ts_cop1.csv"},
                 {"name": "ts_pvroof.csv"},
                 {"name": "ts_pvwall.csv"},
                 {"name": "ts_tubecollector.csv"},
             ]
             },
            {"name": "representative_periods",
             "children": [
                 {"name": "repr_settings_elexia.json"},
                 {"name": "representative_periods_template.json"},
             ]
             },
            {"name": "storages",
             "children": [
                 {"name": "storages-input.xlsx"},
                 {"name": "ts_demand_carpark.csv"},
                 {"name": "ts_nodestatecap_carpark.csv"},
             ]
             }
        ]
    }
    return HttpResponse(json.dumps(data), content_type="application/json")


def fetch_data(request, folder, fname):
    if folder == "root":
        p = os.path.join(SITEOPTDATA, fname)
    else:
        p = os.path.join(SITEOPTDATA, folder, fname)
    if not os.path.exists(p):
        return HttpResponse(json.dumps({}), content_type="application/json")
    if p.endswith(".xlsx"):
        wb = openpyxl.load_workbook(p)
        json_data = read_excel_as_json(wb)
        return HttpResponse(json_data, content_type="application/json")
    else:
        return HttpResponse(json.dumps({"error": f"Sending file {p} not implemented"}), content_type="application/json")


def read_excel_as_json(wb):
    """Reads all sheets, rows, and columns from an Excel workbook object and returns the data in JSON format."""
    data = {}
    for sheet in wb:
        data[sheet.title] = []
        rows = sheet.max_row
        columns = sheet.max_column
        for i in range(1, columns+1):
            column_data = []
            column_name = sheet.cell(row=1, column=i)
            for j in range(1, rows):
                row_data = sheet.cell(row=j+1, column=i)
                column_data.append(row_data.value)
            data[sheet.title].append({column_name.value: column_data})
    return json.dumps(data)


def debug_open_excel(request, excel_fpath):
    print(f"Got request to open {excel_fpath}")
    fpath = os.path.join("C:\\", "Users", "ttepsa", "temp", "ms-excel-command-test.xlsx")
    # C:\Users\ttepsa\temp\ms-excel-command-test.xlsx
    args = ("cmd.exe", "/C", "start excel", fpath)
    completed = subprocess.run(args)
    print(f"completed:{completed}")
    context = {"openFileStatus": "Allrighty_then"}
    return render(request, "debug.html", context=context)


def download_excel_file(request):
    fpath = os.path.join("C:\\", "Users", "ttepsa", "temp", "ms-excel-command-test.xlsx")
    wb = openpyxl.load_workbook(fpath)
    response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheeml.sheet")
    response["Content-Disposition"] = 'attachment; filename="ms-excel-file.xlsx"'
    # Save the workbook to the response
    wb.save(response)
    return response
