#!/usr/bin/env python3
# pi_sim.py - Minimal Raspberry Pi Simulator

import requests, time, sys

API_KEY = "sk_mkwgisij_49f5f8367d4b061abc5a5bc644281eaba55d39a3920b4de9aaea2c05c03883ca"  # Replace with your API key
SERVER = "http://localhost:3000/api/devices"
HEADERS = {'x-api-key': API_KEY, 'Content-Type': 'application/json'}

print("Pi Simulator - Checking for commands every 5 seconds")
print("Press Ctrl+C to stop\n")

count = 0
try:
    while True:
        try:
            # Check for commands (this also acts as heartbeat)
            resp = requests.get(f"{SERVER}/commands", headers=HEADERS, timeout=30)
            
            if resp.status_code == 200:
                data = resp.json()
                commands = data.get('commands', [])
                
                if commands:
                    print(f"\n[{time.strftime('%H:%M:%S')}] Found {len(commands)} command(s)")
                    
                    for cmd in commands:
                        count += 1
                        command_id = cmd.get('id')
                        command_text = cmd.get('command', '')
                        print(f"  Command {count} [{command_id}]: {command_text[:50]}{'...' if len(command_text) > 50 else ''}")
                        
                        # Always return "command executed"
                        result = "command executed with success at "
                        
                        # Send result back
                        result_resp = requests.post(f"{SERVER}/command-result", headers=HEADERS,
                                    json={"commandId": command_id, "result": result})
                        
                        # Check if result was accepted
                        if result_resp.status_code == 200:
                            result_data = result_resp.json()
                            if result_data.get('success'):
                                # New structure: check command.status
                                command_data = result_data.get('command', {})
                                status = command_data.get('status', 'unknown')
                                print(f"    → Result submitted (status: {status})")
                            else:
                                print(f"    → Error: {result_data.get('message', 'Unknown error')}")
                        else:
                            print(f"    → Failed to submit result: {result_resp.status_code}")
                else:
                    # No commands, just show we're alive
                    print(".", end="", flush=True)
            else:
                print(f"! Error {resp.status_code}", end="", flush=True)
                
        except requests.exceptions.Timeout:
            print("T", end="", flush=True)  # Timeout indicator
        except requests.exceptions.RequestException as e:
            print(f"E", end="", flush=True)  # Error indicator
        
        time.sleep(5)
        
except KeyboardInterrupt:
    print(f"\n\nStopped. Total commands processed: {count}")