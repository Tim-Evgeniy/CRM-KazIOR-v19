#!/usr/bin/env python3
from crm_server import main
if __name__ == '__main__':
    try: main()
    except (ValueError,OSError,RuntimeError) as e:
        print('Ошибка запуска: '+str(e));raise SystemExit(1)
