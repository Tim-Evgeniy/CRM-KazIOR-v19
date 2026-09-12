"""NCANode v3 CMS verification using documented /cms/verify and /cms/extract."""
import base64,datetime as dt,json,re
from urllib.parse import urlsplit
from urllib.request import Request,build_opener
from crm_store import Fault,js,clean_text
from receiver import NoRedirect

def verify(config,cms,payload,purpose):
 root=config.get('verifier_url','').rstrip('/');p=urlsplit(root)
 if p.username or p.password or p.query or p.fragment or (p.scheme!='https' and not(p.scheme=='http' and p.hostname in ('localhost','127.0.0.1','::1'))):raise Fault('Проверьте адрес NCANode',503)
 def call(path,body):
  headers={'Content-Type':'application/json'}
  if config.get('verifier_token'):headers['Authorization']='Bearer '+config['verifier_token']
  try:
   with build_opener(NoRedirect()).open(Request(root+path,data=js(body).encode(),headers=headers),timeout=20) as r:result=json.loads(r.read(3*1024*1024))
   if result.get('status')!=200:raise ValueError()
   return result
  except Exception:raise Fault('NCANode не подтвердил подпись. Запустите сервер проверки и проверьте доступ к службам НУЦ РК.',503) from None
 info=call('/cms/verify',{'cms':cms,'revocationCheck':['OCSP']})
 if info.get('valid') is not True:raise Fault('ЭЦП не прошла проверку подписи и цепочки доверия',403)
 signers=info.get('signers',[])
 if len(signers)!=1 or signers[0].get('status','VALID')!='VALID':raise Fault('Нужна одна действительная подпись владельца ключа',403)
 certs=signers[0].get('certificates',[])
 if not certs or any(c.get('valid') is not True for c in certs):raise Fault('Цепочка сертификатов недействительна',403)
 candidates=[c for c in certs if re.fullmatch(r'\d{12}',str(c.get('subject',{}).get('iin','')))]
 if len(candidates)!=1:raise Fault('Не удалось определить владельца сертификата',403)
 cert=candidates[0];subject=cert['subject']
 if cert.get('keyUsage') not in (('SIGN',) if purpose=='document' else ('AUTH','SIGN')):raise Fault('Назначение ключа не подходит для операции',403)
 ocsp=[r for r in cert.get('revocations',[]) if r.get('by')=='OCSP']
 if not ocsp or any(r.get('revoked') is not False for r in ocsp):raise Fault('Не подтверждено, что сертификат не отозван',403)
 try:
  before=dt.datetime.fromisoformat(cert['notBefore'].replace('Z','+00:00'));after=dt.datetime.fromisoformat(cert['notAfter'].replace('Z','+00:00'))
  valid=before<=dt.datetime.now(dt.timezone.utc)<=after
 except Exception:valid=False
 if not valid:raise Fault('Срок действия сертификата не подтверждён',403)
 extracted=call('/cms/extract',{'cms':cms})
 try:exact=base64.b64decode(extracted['data'],validate=True)==payload.encode()
 except Exception:exact=False
 if not exact:raise Fault('ЭЦП подписывает другие данные. Повторите операцию.',403)
 return {'iin':subject['iin'],'name':clean_text(subject.get('commonName'),160),'certificateSerial':clean_text(cert.get('serialNumber'),160)}
