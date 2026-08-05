import threading
import time
import requests

URL = "https://motorcycle-readings-console-pounds.trycloudflare.com/"

def launch_flood_worker(worker_id):
    # Each worker fires 10 rapid requests
    for i in range(1, 11):
        try:
            response = requests.get(URL, timeout=5)
            if response.status_code == 200:
                print(f" [Worker {worker_id}] Req {i}: 200 OK")
            elif response.status_code == 429:
                print(f" [Worker {worker_id}] Req {i}: BANNED (429)")
                break
        except Exception:
            break

# Create 30 threads to dump traffic all at once
threads = []
for i in range(30):
    t = threading.Thread(target=launch_flood_worker, args=(i+1,))
    threads.append(t)

print("🚀 INITIATING HIGH-VOLUME FLOOD ATTACK...")
for t in threads:
    t.start()

for t in threads:
    t.join()
print("\n🏁 Simulation completed.")