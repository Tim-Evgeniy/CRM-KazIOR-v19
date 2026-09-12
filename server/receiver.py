"""GREEN-API transport and normalization. Imported by v15; not a standalone receiver."""
import json
import re
import time
from urllib.error import HTTPError,URLError
from urllib.parse import quote,urlsplit
from urllib.request import Request,build_opener,HTTPRedirectHandler

def text(value, limit=16000):
    return value[:limit] if isinstance(value, str) else ''


def safe_url(value):
    try:
        url = urlsplit(value or '')
        return value if url.scheme == 'https' and url.hostname and not url.username and not url.password else ''
    except (TypeError, ValueError):
        return ''


def normalize(payload):
    if not isinstance(payload, dict):
        raise ValueError('Invalid notification')
    b = payload.get('body', payload)
    if not isinstance(b, dict) or b.get('typeWebhook') != 'incomingMessageReceived':
        return None
    sender, instance = b.get('senderData') or {}, b.get('instanceData') or {}
    chat, mid = text(sender.get('chatId'), 200), text(b.get('idMessage'), 200)
    if not chat or chat.endswith('@g.us') or chat == 'status@broadcast' or chat == instance.get('wid'):
        return None
    if not mid:
        raise ValueError('Incoming message has no idMessage')
    data = b.get('messageData') or {}
    file = data.get('fileMessageData') or {}
    kind = text(data.get('typeMessage'), 80)
    body = text((data.get('textMessageData') or {}).get('textMessage')) or text((data.get('extendedTextMessageData') or {}).get('text')) or text(file.get('caption'))
    if kind == 'locationMessage':
        loc = data.get('locationMessageData') or {}
        body = '\n'.join(filter(None, [text(loc.get('nameLocation')), text(loc.get('address')), f"Координаты: {loc.get('latitude', 0)}, {loc.get('longitude', 0)}"]))
    if kind == 'contactMessage':
        body = text((data.get('contactMessageData') or {}).get('displayName')) or 'Контакт WhatsApp'
    labels = {'imageMessage': 'Фото', 'videoMessage': 'Видео', 'audioMessage': 'Голосовое сообщение', 'documentMessage': 'Документ', 'stickerMessage': 'Стикер'}
    url = safe_url(file.get('downloadUrl'))
    files = [{'name': text(file.get('fileName'), 250) or labels.get(kind, 'Вложение WhatsApp'), 'type': text(file.get('mimeType'), 100), 'url': url}] if url else []
    phone = ''
    for value in [sender.get('sender'), chat]:
        if isinstance(value, str) and re.fullmatch(r'\d+@(c\.us|s\.whatsapp\.net)', value):
            phone = '+' + value.split('@')[0]
            break
    stamp = b.get('timestamp')
    if not isinstance(stamp, (int, float)) or stamp <= 0 or stamp > 253402214400:
        stamp = int(time.time())
    instance_id = str(instance.get('idInstance') or '')
    return {'key': json.dumps([instance_id, chat, mid], ensure_ascii=False, separators=(',', ':')),
            'instance': instance_id, 'idMessage': mid, 'chatId': chat,
            'name': text(sender.get('senderContactName'), 160) or text(sender.get('senderName'), 160) or phone or 'Отправитель WhatsApp',
            'phone': phone, 'text': body or labels.get(kind, 'Сообщение WhatsApp'),
            'files': files, 'type': kind, 'timestamp': stamp}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Unexpected GREEN-API redirect')


class GreenAPI:
    def __init__(self, config):
        self.config = config
        url = urlsplit(config['api_url'])
        if url.scheme != 'https' or not re.fullmatch(r'(?:[a-z0-9-]+\.)*(?:green-api\.com|greenapi\.com)', url.hostname or '') or url.username or url.password or url.port or url.path not in ('', '/') or url.query or url.fragment:
            raise ValueError('Use the HTTPS apiUrl supplied by GREEN-API')
        if not re.fullmatch(r'\d+', str(config['id_instance'])) or not config.get('api_token'):
            raise ValueError('Set id_instance and api_token in the private config')
        self.opener = build_opener(NoRedirect())

    def request(self, name, method='GET', body=None, suffix=''):
        url = (self.config['api_url'].rstrip('/') + '/waInstance' + quote(str(self.config['id_instance']), safe='') +
               '/' + name + '/' + quote(self.config['api_token'], safe='') + suffix)
        data = json.dumps(body).encode() if body is not None else None
        req = Request(url, data=data, method=method, headers={'Content-Type': 'application/json'} if data else {})
        try:
            with self.opener.open(req, timeout=20) as response:
                raw = response.read(5 * 1024 * 1024)
                result = json.loads(raw) if raw.strip() else None
        except HTTPError as error:
            raise RuntimeError(f'GREEN-API HTTP {error.code}; check connection settings') from None
        except (URLError, TimeoutError, OSError):
            raise RuntimeError('GREEN-API network unavailable; retrying') from None
        if isinstance(result, dict) and result.get('status') == 'error':
            raise RuntimeError('GREEN-API rejected the request; check instance settings')
        return result


