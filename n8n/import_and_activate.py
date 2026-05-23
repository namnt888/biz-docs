import sqlite3
import json
import uuid
import datetime

db_path = '/Users/rei/.n8n/database.sqlite'
workflow_file = '/Users/rei/Github/biz-docs/n8n/google_sheets_sync_workflow.json'

with open(workflow_file, 'r', encoding='utf-8') as f:
    wf = json.load(f)

# Rename the Webhook node to eliminate space encoding issues in n8n paths
for node in wf.get('nodes', []):
    if node.get('type') == 'n8n-nodes-base.webhook':
        node['name'] = 'Webhook'
    if node.get('type') == 'n8n-nodes-base.googleSheets':
        node['credentials'] = {'googleSheetsOAuth2Api': {'id': 'qi7b3ugwTvV969Ar', 'name': 'Google Sheets account'}}

# Update connections accordingly
connections_dict = wf.get('connections', {})
if 'Webhook (Supabase Trigger)' in connections_dict:
    connections_dict['Webhook'] = connections_dict.pop('Webhook (Supabase Trigger)')

# Save updated JSON back to file
with open(workflow_file, 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

nodes = json.dumps(wf.get('nodes', []))
connections = json.dumps(wf.get('connections', {}))
settings = json.dumps(wf.get('settings', {}))
name = wf.get('name', 'Supabase to GSheets (Dynamic Cycle & Multi-User) v1.5.1')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get the user ID (Nam)
cursor.execute("SELECT id FROM user LIMIT 1;")
row = cursor.fetchone()
user_id = row[0] if row else 'b92f6682-4fb2-48bb-8f72-57504d9cdf31'

# Generate UUID for versionId
version_id = str(uuid.uuid4())
now_str = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

# Insert into workflow_history
cursor.execute("""
INSERT INTO workflow_history (versionId, workflowId, authors, createdAt, updatedAt, nodes, connections, name, autosaved)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);
""", (version_id, 'JIfwZP5txIaEsyvZ', user_id, now_str, now_str, nodes, connections, name))

# Update workflow_entity
cursor.execute("""
UPDATE workflow_entity
SET active = 1, nodes = ?, connections = ?, settings = ?, activeVersionId = ?, updatedAt = ?
WHERE id = 'JIfwZP5txIaEsyvZ';
""", (nodes, connections, settings, version_id, now_str))

# Delete old webhooks to clear cache/conflict
cursor.execute("DELETE FROM webhook_entity;")
cursor.execute("DELETE FROM workflow_dependency WHERE workflowId = 'JIfwZP5txIaEsyvZ';")

conn.commit()
conn.close()

print(f"Successfully imported and activated version {version_id} of the workflow.")
print("Webhook and dependency cache cleared.")
