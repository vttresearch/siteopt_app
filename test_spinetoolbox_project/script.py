from datetime import datetime
import time

print("hello from Spine Toolbox")
t = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
print("Sleeping for 5 seconds")
time.sleep(5)
with open("data.csv") as rfp:
	input_data = rfp.readlines()
header = t + ", etc, jne\n"
output_data = [header] + input_data
with open("results.csv", "w") as wfp:
	wfp.writelines(output_data)
print("Results written to results.csv")
