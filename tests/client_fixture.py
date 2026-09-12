import json
from pathlib import Path
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from crm_store import Store,password_hash
from crm_server import App,Server,handler_factory
with tempfile.TemporaryDirectory() as folder:
    store=Store(Path(folder)/'crm.sqlite3')
    with store.db(True) as c:c.execute('UPDATE accounts SET hash=? WHERE uid=?',(password_hash('OnlyForLocalTests-15'),'u1'))
    app=App(store,{'channels':[],'backup_dir':str(Path(folder)/'backups')})
    server=Server(('127.0.0.1',0),handler_factory(app))
    print(json.dumps({'port':server.server_port}),flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
