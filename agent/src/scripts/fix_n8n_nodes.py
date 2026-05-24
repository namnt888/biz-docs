#!/usr/bin/env python3
"""Fix n8n v2.2 nodes: ensure GSheets node expressions use correct __rl format."""
import json, sqlite3, sys

DB = "/Users/rei/.n8n/database.sqlite"
VERSION_ID = "5b75edb0-04d6-4759-9d8a-631b78784343"

conn = sqlite3.connect(DB)
nodes_raw = conn.execute("SELECT nodes FROM workflow_history WHERE versionId = ?", (VERSION_ID,)).fetchone()

if not nodes_raw:
    print(f"Version {VERSION_ID} not found")
    sys.exit(1)

nodes = json.loads(nodes_raw[0])

for n in nodes:
    if n['type'] == 'n8n-nodes-base.googleSheets':
        # Ensure __rl wrapper for documentId and sheetName
        n['parameters']['documentId'] = {
            '__rl': True,
            'value': '={{ $json._spreadsheetId }}',
            'mode': 'id'
        }
        n['parameters']['sheetName'] = {
            '__rl': True,
            'value': '={{ $json._sheetName }}',
            'mode': 'name'
        }
        n['parameters']['operation'] = 'append'
        print(f"Fixed: {n['name']}")
        print(f"  documentId: {n['parameters']['documentId']}")
        print(f"  sheetName: {n['parameters']['sheetName']}")

new_json = json.dumps(nodes)
conn.execute("UPDATE workflow_history SET nodes = ? WHERE versionId = ?", (new_json, VERSION_ID))
conn.commit()

# Also update published_version
conn.execute("UPDATE workflow_published_version SET publishedVersionId = ? WHERE workflowId = 'JIfwZP5txIaEsyvZ'", (VERSION_ID,))
conn.commit()

# Also ensure workflow is active
conn.execute("UPDATE workflow_entity SET active = 1 WHERE id = 'JIfwZP5txIaEsyvZ'")
conn.commit()

print("\nUpdated. Checking nodes:")
for n in nodes:
    print(f"  {n['name']} | {n['type'].split('.')[-1]}")

conn.close()
print("Done!")
