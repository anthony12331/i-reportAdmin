import paramiko
import json

ssh=paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('api.ireportsystem.com', username='root', password='iReport@1system')
cmd = "sqlite3 /root/pb_data/logs.db 'SELECT data FROM _logs WHERE data LIKE \"%backup_requests%\" ORDER BY created DESC LIMIT 5;'"
stdin, stdout, stderr = ssh.exec_command(cmd)

lines = stdout.read().decode().split('\n')
for line in lines:
    if line.strip():
        try:
            data = json.loads(line)
            print(json.dumps(data, indent=2))
        except:
            print(line)
