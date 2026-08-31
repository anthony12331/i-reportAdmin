import paramiko

ssh=paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('api.ireportsystem.com', username='root', password='iReport@1system')
cmd = "sqlite3 /root/pb_data/data.db 'SELECT schema FROM _collections WHERE name=\"backup_requests\";'"
stdin, stdout, stderr = ssh.exec_command(cmd)

print(stdout.read().decode())
