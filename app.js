(() => {
"use strict";
const KEY = "its24_crm_kazior_v13";
const LEGACY_KEYS = ["its24_crm_kazior_v12","its24_crm_kazior_v11","its24_crm_kazior_v10","its24_crm_kazior_v9","its24_crm_kazior_v8","its24_crm_kazior_v7"];
const SESSION = "its24_crm_session";
const categories = ["Компьютер","Принтер","Сеть","Wi-Fi","Видеонаблюдение","Сервер","ПО / МИС","Телефония","СКС","Другое"];
const statuses = [
  {id:"new",name:"Новая"},{id:"working",name:"В работе"},{id:"waiting",name:"Ожидание"},{id:"done",name:"Выполнено"},{id:"closed",name:"Закрыта"}
];
const roleNames = {superadmin:"Супер-администратор",admin:"Администратор",engineer:"Инженер",employee:"Сотрудник организации"};
const permissionDefaults = {
  superadmin:{viewAllTickets:true,viewAllChats:true,manageTickets:true,assignTickets:true,manageUsers:true,manageTasks:true,manageDepartments:true,viewReports:true,manageIntegrations:true},
  admin:{viewAllTickets:true,viewAllChats:false,manageTickets:true,assignTickets:true,manageUsers:true,manageTasks:true,manageDepartments:false,viewReports:true,manageIntegrations:true},
  engineer:{viewAllTickets:false,viewAllChats:false,manageTickets:true,assignTickets:false,manageUsers:false,manageTasks:false,manageDepartments:false,viewReports:false,manageIntegrations:false},
  employee:{viewAllTickets:false,viewAllChats:false,manageTickets:false,assignTickets:false,manageUsers:false,manageTasks:false,manageDepartments:false,viewReports:false,manageIntegrations:false}
};
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const now = () => new Date().toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
const initials = n => (n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();

const seed = {
  "settings": {
    "organizationName": "АО “Казахский научно-исследовательский институт онкологии и радиологии”",
    "organizationShort": "КазНИИОиР",
    "departmentName": "Отдел Цифровизации",
    "soundEnabled": true,
    "slaCheckMinutes": 1,
    "loginHeroImage": "assets/kazior-logo.png",
    "loginLogoSize": 320,
    "loginLogoHeight": 240,
    "loginLogoOffsetY": 0,
    "loginLeftWidth": 58
  },
  "users": [
    {
      "id": "u1",
      "login": "superadmin",
      "name": "Тимченко Евгений Юрьевич",
      "email": "demo@example.invalid",
      "phone": "+7 700 000 00 01",
      "org": "КазНИИОиР",
      "dept": "Отдел Цифровизации",
      "deptId": "dept-digital",
      "position": "Системный администратор",
      "role": "superadmin",
      "status": "active",
      "workStatus": "available",
      "photo": "",
      "about": "Системное администрирование, инфраструктура, сети и автоматизация.",
      "interests": [
        "сети",
        "инфраструктура",
        "автоматизация",
        "AI"
      ],
      "theme": "light",
      "registeredAt": "01.09.2026 08:30"
    },
    {
      "id": "u4",
      "login": "amuratova",
      "name": "Инженер Сети",
      "email": "amuratova@onco.local",
      "phone": "+7 700 000 00 02",
      "org": "КазНИИОиР",
      "dept": "Отдел Цифровизации",
      "deptId": "dept-digital",
      "position": "Инженер-программист",
      "role": "engineer",
      "status": "active",
      "workStatus": "available",
      "photo": "",
      "about": "",
      "interests": [
        "программирование",
        "поддержка"
      ],
      "theme": "light",
      "registeredAt": "01.09.2026 09:05"
    },
    {
      "id": "u5",
      "login": "elnur",
      "name": "Инженер Программирования",
      "email": "elnur@onco.local",
      "phone": "+7 700 000 00 03",
      "org": "КазНИИОиР",
      "dept": "Отдел Цифровизации",
      "deptId": "dept-digital",
      "position": "Инженер-программист",
      "role": "engineer",
      "status": "active",
      "workStatus": "available",
      "photo": "",
      "about": "",
      "interests": [
        "программирование"
      ],
      "theme": "light",
      "registeredAt": "01.09.2026 09:10"
    },
    {
      "id": "u6",
      "login": "altair",
      "name": "Инженер Поддержки",
      "email": "altair@onco.local",
      "phone": "+7 700 000 00 04",
      "org": "КазНИИОиР",
      "dept": "Отдел Цифровизации",
      "deptId": "dept-digital",
      "position": "Инженер-программист",
      "role": "engineer",
      "status": "active",
      "workStatus": "available",
      "photo": "",
      "about": "",
      "interests": [
        "веб",
        "автоматизация"
      ],
      "theme": "light",
      "registeredAt": "01.09.2026 09:15"
    },
    {
      "id": "u8",
      "login": "kuanysh",
      "name": "Инженер Резерв",
      "email": "kuanysh@onco.local",
      "phone": "+7 700 000 00 06",
      "org": "КазНИИОиР",
      "dept": "Отдел Цифровизации",
      "deptId": "dept-digital",
      "position": "Инженер-программист",
      "role": "engineer",
      "status": "active",
      "workStatus": "available",
      "photo": "",
      "about": "",
      "interests": [
        "программирование",
        "инфраструктура"
      ],
      "theme": "light",
      "registeredAt": "01.09.2026 09:25"
    }
  ],
  "departments": [
    {
      "id": "dept-digital",
      "name": "Отдел Цифровизации",
      "headId": "u1"
    },
    {
      "id": "dept-clinic",
      "name": "Поликлиника",
      "headId": ""
    },
    {
      "id": "dept-admin",
      "name": "Административный корпус",
      "headId": ""
    },
    {
      "id": "dept-lab",
      "name": "Лаборатория",
      "headId": ""
    }
  ],
  "tickets": [],
  "lastNo": 0,
  "tasks": [],
  "notifications": [],
  "directChats": [],
  "chatAccessAudit": [],
  "mailMessages": [],
  "integrations": {
    "whatsapp": {
      "incomingEnabled": false,
      "receiveMode": "shared",
      "notifyNew": true,
      "notifyReply": true,
      "notifyStatus": true
    },
    "mail": {
      "google": {
        "email": "",
        "clientId": ""
      },
      "yandex": {
        "email": "",
        "clientId": ""
      },
      "mailru": {
        "email": "",
        "clientId": ""
      },
      "outlook": {
        "email": "",
        "clientId": ""
      }
    },
    "log": []
  },
  "theme": "light"
};

// Public GitHub Pages demo data. No production database, passwords, API keys or staff contacts are shipped.
seed.users = [
  {id:'u1',login:'demo-admin',password:'demo1234',name:'Демо Администратор',email:'admin@example.invalid',phone:'+7 700 000 00 01',org:'КазНИИОиР',dept:'Отдел Цифровизации',deptId:'dept-digital',position:'Системный администратор',role:'superadmin',status:'active',workStatus:'available',photo:'',about:'Демонстрационный профиль администратора.',interests:['сети','инфраструктура','AI'],theme:'light',registeredAt:'12.09.2026 09:00'},
  {id:'u4',login:'demo-network',password:'demo1234',name:'Инженер Сети',email:'network@example.invalid',phone:'+7 700 000 00 02',org:'КазНИИОиР',dept:'Отдел Цифровизации',deptId:'dept-digital',position:'Сетевой инженер',role:'engineer',status:'active',workStatus:'available',photo:'',about:'Демонстрационный профиль.',interests:['сеть','Wi-Fi'],theme:'light',registeredAt:'12.09.2026 09:05'},
  {id:'u5',login:'demo-software',password:'demo1234',name:'Инженер Программирования',email:'software@example.invalid',phone:'+7 700 000 00 03',org:'КазНИИОиР',dept:'Отдел Цифровизации',deptId:'dept-digital',position:'Инженер-программист',role:'engineer',status:'active',workStatus:'busy',photo:'',about:'Демонстрационный профиль.',interests:['ПО','МИС'],theme:'light',registeredAt:'12.09.2026 09:10'},
  {id:'u6',login:'demo-support',password:'demo1234',name:'Инженер Поддержки',email:'support@example.invalid',phone:'+7 700 000 00 04',org:'КазНИИОиР',dept:'Отдел Цифровизации',deptId:'dept-digital',position:'Инженер технической поддержки',role:'engineer',status:'active',workStatus:'available',photo:'',about:'Демонстрационный профиль.',interests:['поддержка','оборудование'],theme:'light',registeredAt:'12.09.2026 09:15'},
  {id:'u9',login:'demo-employee',password:'demo1234',name:'Иванова Анна Сергеевна',email:'employee@example.invalid',phone:'+7 700 000 00 05',org:'КазНИИОиР',dept:'Поликлиника',deptId:'dept-clinic',position:'Сотрудник',role:'employee',status:'active',workStatus:'available',photo:'',about:'Демонстрационный сотрудник.',interests:[],theme:'light',registeredAt:'12.09.2026 09:20'}
];
seed.users.forEach(u=>u.permissions={...permissionDefaults[u.role]});
seed.lastNo=4;
seed.tickets=[
  {id:'KZ-000004',ownerId:'u9',ownerName:'Иванова Анна Сергеевна',org:'КазНИИОиР',dept:'Поликлиника',room:'315',location:'Корпус 2 / 3 этаж',phone:'+7 700 000 00 05',source:'Web',category:'Принтер',priority:'P2',subject:'Не печатает сетевой принтер',description:'Документ уходит в очередь, но печать не начинается.',status:'new',engineerId:'',engineerName:'Не назначен',created:'13.09.2026 08:40',slaDue:'2026-09-13T12:40',files:[],messages:[],history:[{date:'13.09.2026 08:40',actor:'Иванова Анна Сергеевна',text:'Заявка создана'}]},
  {id:'KZ-000003',ownerId:'u9',ownerName:'Иванова Анна Сергеевна',org:'КазНИИОиР',dept:'Поликлиника',room:'212',location:'Корпус 3 / 2 этаж',phone:'+7 700 000 00 05',source:'Web',category:'Сеть',priority:'P2',subject:'Нет доступа к внутреннему ресурсу',description:'Интернет работает, внутренний ресурс не открывается.',status:'working',engineerId:'u4',engineerName:'Инженер Сети',created:'13.09.2026 08:10',acceptedAt:'13.09.2026 08:20',slaDue:'2026-09-13T12:10',files:[],messages:[{author:'Инженер Сети',authorId:'u4',text:'Заявка принята. Проверяю сетевой доступ.',date:'13.09.2026 08:22',files:[],readBy:['u4']}],history:[{date:'13.09.2026 08:10',actor:'Иванова Анна Сергеевна',text:'Заявка создана'},{date:'13.09.2026 08:20',actor:'Инженер Сети',text:'Заявка принята в работу'}]},
  {id:'KZ-000002',ownerId:'u9',ownerName:'Иванова Анна Сергеевна',org:'КазНИИОиР',dept:'Поликлиника',room:'118',location:'Корпус 1',phone:'+7 700 000 00 05',source:'Web',category:'ПО / МИС',priority:'P3',subject:'Ошибка при запуске рабочей программы',description:'После обновления появляется сообщение об ошибке.',status:'waiting',engineerId:'u5',engineerName:'Инженер Программирования',created:'12.09.2026 16:30',slaDue:'2026-09-13T00:30',files:[],messages:[{author:'Инженер Программирования',authorId:'u5',text:'Нужен скриншот текста ошибки.',date:'12.09.2026 16:45',files:[],readBy:['u5','u9']}],history:[{date:'12.09.2026 16:30',actor:'Иванова Анна Сергеевна',text:'Заявка создана'}]},
  {id:'KZ-000001',ownerId:'u9',ownerName:'Иванова Анна Сергеевна',org:'КазНИИОиР',dept:'Поликлиника',room:'101',location:'Корпус 1',phone:'+7 700 000 00 05',source:'Web',category:'Wi-Fi',priority:'P3',subject:'Слабый сигнал Wi-Fi',description:'В кабинете периодически пропадает соединение.',status:'done',engineerId:'u6',engineerName:'Инженер Поддержки',created:'12.09.2026 10:10',doneAt:'12.09.2026 11:05',slaDue:'2026-09-12T18:10',files:[],messages:[{author:'Инженер Поддержки',authorId:'u6',text:'Проверено. Подключение восстановлено.',date:'12.09.2026 11:05',files:[],readBy:['u6','u9']}],history:[{date:'12.09.2026 10:10',actor:'Иванова Анна Сергеевна',text:'Заявка создана'},{date:'12.09.2026 11:05',actor:'Инженер Поддержки',text:'Заявка выполнена'}]}
];
seed.tasks=[
  {id:'task-demo-1',title:'Проверить точки Wi-Fi на 3 этаже',description:'Демонстрационная задача отдела.',status:'progress',due:'2026-09-14T15:00',creatorId:'u1',creator:'Демо Администратор',assigneeId:'u4',assignee:'Инженер Сети',readBy:['u1','u4']},
  {id:'task-demo-2',title:'Проверить резервное копирование CRM',description:'Проверить наличие ежедневной копии.',status:'todo',due:'2026-09-15T10:00',creatorId:'u1',creator:'Демо Администратор',assigneeId:'u6',assignee:'Инженер Поддержки',readBy:['u1']}
];

let db = loadDb();
let currentUser = null;
const crmChannel=null;
let globalSearch = "";
let currentTicketId = null;
let activeChatTicketId = null;
let activeDirectChatId = null;
let chatMode = 'people';
let chatSending=false;

function loadDb(){
  try{
    let raw=localStorage.getItem(KEY);
    if(!raw){
      for(const legacy of LEGACY_KEYS){raw=localStorage.getItem(legacy);if(raw)break}
    }
    if(raw){
      const d=JSON.parse(raw);
      if(d&&d.users&&d.tickets){
        d.settings={...seed.settings,...(d.settings||{})};
        d.tasks=d.tasks||[];
        d.departments=d.departments||JSON.parse(JSON.stringify(seed.departments));
        d.notifications=d.notifications||[];
        d.directChats=d.directChats||[];
        d.chatAccessAudit=d.chatAccessAudit||[];
        d.mailMessages=d.mailMessages||JSON.parse(JSON.stringify(seed.mailMessages));
        const seededById=Object.fromEntries(seed.users.map(u=>[u.id,u]));
        d.users.forEach(u=>{
          u.workStatus=u.workStatus||'available';
          u.position=u.position||'';
          u.about=u.about||'';
          u.interests=u.interests||[];
          u.theme=u.theme||'dark';
          u.registeredAt=u.registeredAt||now();
          u.permissions={...permissionDefaults[u.role],...(u.permissions||{})};
          const seedUser=seededById[u.id];
          if(seedUser?.photo && (!u.photo || /^https:\/\/onco\.kz/i.test(u.photo)))u.photo=seedUser.photo;
        });
        // Add newly seeded team accounts if an older database did not contain them.
        seed.users.forEach(su=>{if(!d.users.some(u=>u.id===su.id||u.login===su.login))d.users.push(JSON.parse(JSON.stringify(su)))});
        d.tickets.forEach(t=>{t.history=t.history||[];t.files=t.files||[];t.messages=t.messages||[]});
        d.integrations=d.integrations||JSON.parse(JSON.stringify(seed.integrations));
        d.integrations.whatsapp={...seed.integrations.whatsapp,...(d.integrations.whatsapp||{})};
        d.integrations.mail={...seed.integrations.mail,...(d.integrations.mail||{})};
        d.integrations.log=d.integrations.log||[];
        localStorage.setItem(KEY,JSON.stringify(d));
        return d;
      }
    }
  }catch(e){console.warn('DB migration error',e)}
  const fresh=JSON.parse(JSON.stringify(seed));
  fresh.users.forEach(u=>u.permissions={...permissionDefaults[u.role],...(u.permissions||{})});
  localStorage.setItem(KEY,JSON.stringify(fresh));
  return fresh;
}
function save(){localStorage.setItem(KEY,JSON.stringify(db));return true;}
function toast(msg){const el=document.createElement("div");el.className="toast";el.textContent=msg;$("#toastHost").appendChild(el);setTimeout(()=>el.remove(),2600)}
function userPermissions(u=currentUser){if(!u)return permissionDefaults.employee;return {...permissionDefaults[u.role],...(u.permissions||{})}}
function hasPerm(name,u=currentUser){return !!(u&&(u.role==='superadmin'||userPermissions(u)[name]))}
function roleAtLeastAdmin(){return currentUser && ["superadmin","admin"].includes(currentUser.role)}
function canManageTicket(t){return currentUser && (hasPerm('manageTickets') && (hasPerm('viewAllTickets') || t.ownerId===currentUser.id || !t.engineerId || t.engineerId===currentUser.id))}
function visibleTickets(){
  if(!currentUser)return[];
  if(hasPerm('viewAllTickets'))return db.tickets;
  if(currentUser.role==="employee")return db.tickets.filter(t=>t.ownerId===currentUser.id);
  if(currentUser.role==="engineer")return db.tickets.filter(t=>t.engineerId===currentUser.id||!t.engineerId||t.ownerId===currentUser.id);
  return db.tickets.filter(t=>t.ownerId===currentUser.id||t.engineerId===currentUser.id);
}
function canViewConversation(t,u=currentUser){
  if(!u||!t)return false;
  if(u.role==='superadmin'||hasPerm('viewAllChats',u))return true;
  return t.ownerId===u.id||t.engineerId===u.id||(!t.engineerId&&hasPerm('manageTickets',u));
}
function visibleChatTickets(){
  if(!currentUser)return[];
  if(currentUser.role==='superadmin'||hasPerm('viewAllChats'))return db.tickets;
  return db.tickets.filter(t=>canViewConversation(t));
}
function nextTicketId(){db.lastNo=(db.lastNo||20)+1;return "KZ-"+String(db.lastNo).padStart(6,"0")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function statusName(s){return statuses.find(x=>x.id===s)?.name||s}
function priorityTag(p){return `<span class="tag ${String(p).toLowerCase()}">${esc(p)}</span>`}
function statusTag(s){const cls=s==="done"||s==="closed"?"ok":s==="new"?"warn":"neutral";return `<span class="tag ${cls}">${esc(statusName(s))}</span>`}

function workStatusName(s){return ({available:'Доступен',busy:'Занят',away:'Отошел',dnd:'Не беспокоить',offline:'Не в сети'})[s]||'Доступен'}
function parseLocalDateTime(v){if(!v)return null;if(/^\d{4}-\d{2}-\d{2}T/.test(v))return new Date(v);const m=String(v).match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);return m?new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]):null}
function isTicketOverdue(t){if(!t||['done','closed'].includes(t.status)||!t.slaDue)return false;const d=parseLocalDateTime(t.slaDue);return d&&d.getTime()<Date.now()}
function formatDue(v){const d=parseLocalDateTime(v);return d?d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Не задан'}
function visibleTasks(){
  if(!currentUser)return[];
  if(currentUser.role==='superadmin')return db.tasks;
  if(hasPerm('manageTasks'))return db.tasks.filter(t=>t.assigneeId===currentUser.id||t.creatorId===currentUser.id);
  return db.tasks.filter(t=>t.assigneeId===currentUser.id);
}
function techStaff(){return db.users.filter(u=>u.status==='active'&&['engineer','superadmin'].includes(u.role)).sort((a,b)=>a.name.localeCompare(b.name,'ru',{sensitivity:'base'}))}
function engineers(){return techStaff()}
function canManageDepartments(){return !!(currentUser&&(currentUser.role==='superadmin'||hasPerm('manageDepartments')))}
function taskCanEdit(t){return !!(currentUser&&t&&(currentUser.role==='superadmin'||t.creatorId===currentUser.id))}
function taskCanChangeStatus(t){return !!(currentUser&&t&&(currentUser.role==='superadmin'||t.creatorId===currentUser.id||t.assigneeId===currentUser.id))}
function autoGrowChatComposer(){const ta=$('#chatText');if(!ta)return;ta.style.height='auto';ta.style.height=Math.min(Math.max(48,ta.scrollHeight),150)+'px'}
function readByContains(item,userId){return Array.isArray(item?.readBy)&&item.readBy.includes(userId)}
function markReadBy(item,userId){if(!item)return false;item.readBy=Array.isArray(item.readBy)?item.readBy:[];if(item.readBy.includes(userId))return false;item.readBy.push(userId);return true}
function directUnreadCount(chat,userId=currentUser?.id){if(!chat||!userId||!chat.participants?.includes(userId))return 0;return (chat.messages||[]).filter(m=>m.authorId!==userId&&Array.isArray(m.readBy)&&!m.readBy.includes(userId)).length}
function ticketUnreadCount(t,userId=currentUser?.id){if(!t||!userId)return 0;const u=db.users.find(x=>x.id===userId)||currentUser;if(!canViewConversation(t,u))return 0;return (t.messages||[]).filter(m=>m.authorId!==userId&&Array.isArray(m.readBy)&&!m.readBy.includes(userId)).length}
function taskUnread(t,userId=currentUser?.id){return !!(t&&userId&&t.assigneeId===userId&&Array.isArray(t.readBy)&&!t.readBy.includes(userId))}
function markNotificationsByRefRead(ref){let changed=false;(db.notifications||[]).forEach(n=>{if(n.recipientId===currentUser?.id&&n.ticketId===ref&&!n.read){n.read=true;changed=true}});return changed}
function markDirectChatRead(chat){if(!chat||!currentUser||!chat.participants?.includes(currentUser.id))return;let changed=false;(chat.messages||[]).forEach(m=>{if(m.authorId!==currentUser.id)changed=markReadBy(m,currentUser.id)||changed});changed=markNotificationsByRefRead(`dm:${chat.id}`)||changed;if(changed){save();renderBadges();renderNotifications()}}
function markTicketChatRead(t){if(!t||!currentUser||!canViewConversation(t))return;let changed=false;(t.messages||[]).forEach(m=>{if(m.authorId!==currentUser.id)changed=markReadBy(m,currentUser.id)||changed});changed=markNotificationsByRefRead(t.id)||changed;if(changed){save();renderBadges();renderNotifications()}}
function markTaskRead(t){if(!t||!currentUser)return;let changed=markReadBy(t,currentUser.id);changed=markNotificationsByRefRead(`task:${t.id}`)||changed;if(changed){save();renderBadges();renderNotifications();renderTasks()}}
function addNotification(recipientId,title,text,ticketId=''){
  db.notifications=db.notifications||[];
  db.notifications.unshift({id:'n'+Date.now()+Math.random().toString(16).slice(2),recipientId,title,text,ticketId,date:now(),read:false});
  save();
  if(currentUser?.id===recipientId){playNotificationSound();showSystemNotification(title,text);if(navigator.vibrate)navigator.vibrate([80,45,80]);renderNotifications()}
  crmChannel?.postMessage({type:'notification',recipientId,title,text,ticketId});
}
function notifyRole(role,title,text,ticketId=''){db.users.filter(u=>u.status==='active'&&u.role===role).forEach(u=>addNotification(u.id,title,text,ticketId))}
function notifyNewTicketTeam(ticket){
  const recipients=new Set([
    ...db.users.filter(u=>u.status==='active'&&['superadmin','admin'].includes(u.role)).map(u=>u.id),
    ...techStaff().map(u=>u.id)
  ]);
  const phone=ticket.phone||'не указан';
  const text=`Заявитель/врач: ${ticket.ownerName} · Телефон: ${phone} · ${ticket.dept||'—'}, каб. ${ticket.room||'—'} · ${ticket.subject}`;
  recipients.forEach(id=>addNotification(id,`Новая заявка ${ticket.id}`,text,ticket.id));
}
function playNotificationSound(){if(!db.settings?.soundEnabled)return;try{const C=window.AudioContext||window.webkitAudioContext;const ctx=new C();const gain=ctx.createGain();gain.connect(ctx.destination);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.08,ctx.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.42);[660,880].forEach((f,i)=>{const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;o.connect(gain);o.start(ctx.currentTime+i*.16);o.stop(ctx.currentTime+.20+i*.16)});setTimeout(()=>ctx.close(),700)}catch(e){}}
function applyUserTheme(u){
  document.body.classList.remove('light','theme-ocean','theme-aurora','theme-custom','has-user-background');
  document.body.style.removeProperty('--user-bg-image');
  const theme=u?.theme||db.theme||'dark';
  if(theme==='light')document.body.classList.add('light');
  else if(theme==='ocean')document.body.classList.add('theme-ocean');
  else if(theme==='aurora')document.body.classList.add('theme-aurora');
  else if(theme==='custom')document.body.classList.add('theme-custom');
  if(u?.backgroundImage){
    document.body.classList.add('has-user-background');
    document.body.style.setProperty('--user-bg-image',`url("${u.backgroundImage}")`);
  }
  db.theme=theme;
  const b=$('#themeBtn');if(b)b.textContent=theme==='light'?'☀':'☾';
}
function renderBranding(){
  const s=db.settings||seed.settings;
  ['#authTenantName'].forEach(sel=>{const e=$(sel);if(e)e.textContent=s.organizationName});
  ['#authTenantShort','#authTenantMobile','#sideTenantShort'].forEach(sel=>{const e=$(sel);if(e)e.textContent=s.organizationShort});
  const reg=$('#regOrg');if(reg)reg.value=s.organizationShort;
  const src=s.loginHeroImage||'assets/kazior-logo.png';
  if($('#authHeroImage'))$('#authHeroImage').src=src;if($('#loginDesignerPreview'))$('#loginDesignerPreview').src=src;
  document.documentElement.style.setProperty('--auth-hero-logo-width',`${Number(s.loginLogoSize||320)}px`);
  document.documentElement.style.setProperty('--auth-hero-logo-height',`${Number(s.loginLogoHeight||240)}px`);
  document.documentElement.style.setProperty('--auth-hero-logo-offset-y',`${Number(s.loginLogoOffsetY||0)}px`);
  document.documentElement.style.setProperty('--auth-left-percent',`${Number(s.loginLeftWidth||58)}%`);
  document.documentElement.style.setProperty('--auth-right-percent',`${100-Number(s.loginLeftWidth||58)}%`);
  if($('#loginLiveImage'))$('#loginLiveImage').src=src;
  if($('#loginLiveOrg'))$('#loginLiveOrg').textContent=s.organizationName;
  document.title=`${s.organizationShort} · IT-System-Solution CRM`;
}
function readImageFile(file,cb){if(!file)return;const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(file)}

const ATTACH_DB_NAME='its24_crm_attachments_v1',ATTACH_STORE='files';
function openAttachmentDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(ATTACH_DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(ATTACH_STORE))db.createObjectStore(ATTACH_STORE,{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function storeSelectedFiles(fileList){
  const files=[...(fileList||[])];if(!files.length)return[];
  const dbi=await openAttachmentDb();const out=[];
  for(const file of files){
    const id='att-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
    await new Promise((resolve,reject)=>{const tx=dbi.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).put({id,name:file.name,type:file.type||'application/octet-stream',size:file.size,blob:file,created:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    out.push({id,name:file.name,type:file.type||'application/octet-stream',size:file.size});
  }
  dbi.close();return out;
}
async function getStoredAttachment(id){
  const dbi=await openAttachmentDb();
  const item=await new Promise((resolve,reject)=>{const tx=dbi.transaction(ATTACH_STORE,'readonly');const r=tx.objectStore(ATTACH_STORE).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  dbi.close();return item;
}
function attachmentMarkup(files){
  return (files||[]).map(f=>{
    if(typeof f==='string')return `<span class="attachment legacy-attachment">📎 ${esc(f)}</span>`;
    if(f.url && window.WhatsAppCore.safeUrl(f.url))return `<a class="attachment external-attachment" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">📎 ${esc(f.name||'Вложение WhatsApp')} · внешняя ссылка</a>`;
    const image=String(f.type||'').startsWith('image/');
    return `<div class="attachment-file ${image?'is-image':''}" data-attachment-id="${esc(f.id)}">
      <div class="attachment-preview">${image?'🖼️':'📄'}</div>
      <div class="attachment-info"><b>${esc(f.name)}</b><small>${formatBytes(f.size||0)}</small></div>
      <button class="attachment-download mini-btn" type="button" data-download-attachment="${esc(f.id)}">Скачать</button>
    </div>`;
  }).join('');
}
function formatBytes(n){if(!n)return'';const u=['Б','КБ','МБ','ГБ'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++}return `${v.toFixed(i?1:0)} ${u[i]}`}
async function hydrateAttachments(root=document){
  const nodes=[...root.querySelectorAll('[data-attachment-id]')];
  for(const node of nodes){
    const id=node.dataset.attachmentId;
    try{
      const rec=await getStoredAttachment(id);if(!rec?.blob)continue;
      const box=node.querySelector('.attachment-preview');
      if(String(rec.type||'').startsWith('image/')){
        const url=URL.createObjectURL(rec.blob);
        box.innerHTML=`<img src="${url}" alt="${esc(rec.name)}">`;
      }
      if(box)box.onclick=()=>openAttachmentViewer(id);
    }catch(e){console.warn('Attachment preview',e)}
  }
}
async function downloadStoredAttachment(id){
  try{
    const rec=await getStoredAttachment(id);if(!rec?.blob)return toast('Файл не найден на этом устройстве');
    const url=URL.createObjectURL(rec.blob),a=document.createElement('a');a.href=url;a.download=rec.name||'attachment';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(e){toast('Не удалось скачать файл')}
}

let currentViewerAttachmentId='';
async function openAttachmentViewer(id){
  try{
    const rec=await getStoredAttachment(id);if(!rec?.blob)return toast('Файл не найден на этом устройстве');
    currentViewerAttachmentId=id;
    $('#attachmentViewerTitle').textContent=rec.name||'Вложение';
    const body=$('#attachmentViewerBody');
    const url=URL.createObjectURL(rec.blob);
    if(String(rec.type||'').startsWith('image/')){
      body.innerHTML=`<img src="${url}" alt="${esc(rec.name)}">`;
    }else{
      body.innerHTML=`<div class="attachment-viewer-file"><div class="big-file-icon">📄</div><h3>${esc(rec.name)}</h3><p>${esc(rec.type||'Файл')} · ${formatBytes(rec.size||0)}</p><p class="muted">Предпросмотр этого формата недоступен. Файл можно скачать.</p></div>`;
    }
    $('#attachmentViewerDownload').onclick=()=>downloadStoredAttachment(id);
    $('#attachmentViewerModal').classList.remove('hidden');
  }catch(e){toast('Не удалось открыть вложение')}
}
function renderPendingFilePreviews(input,container){
  const host=typeof container==='string'?$(container):container;if(!host)return;
  host.innerHTML='';
  [...(input?.files||[])].forEach(file=>{
    const row=document.createElement('div');row.className='pending-file';
    if(String(file.type||'').startsWith('image/')){
      const url=URL.createObjectURL(file);row.innerHTML=`<img src="${url}" alt=""><span>${esc(file.name)}</span>`;
    }else row.innerHTML=`<span class="pending-icon">📄</span><span>${esc(file.name)}</span>`;
    host.appendChild(row);
  });
}

let activeRecognition=null;
function startVoiceInput(targetId,button){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition)return toast('Голосовой ввод не поддерживается этим браузером. Используйте Chrome / Яндекс.Браузер на HTTPS или localhost.');
  if(activeRecognition){try{activeRecognition.stop()}catch(e){}activeRecognition=null;$$('.voice-btn,.voice-compose-btn').forEach(b=>b.classList.remove('listening'))}
  const target=$('#'+targetId);if(!target)return;
  const rec=new SpeechRecognition();activeRecognition=rec;rec.lang='ru-RU';rec.interimResults=true;rec.continuous=false;
  const original=target.value||'';let finalText='';
  button?.classList.add('listening');
  rec.onresult=e=>{
    let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const txt=e.results[i][0].transcript;if(e.results[i].isFinal)finalText+=txt;else interim+=txt}
    const sep=original&&!(original.endsWith(' ')||original.endsWith('\\n'))?' ':'';
    target.value=original+sep+finalText+interim;
    target.dispatchEvent(new Event('input',{bubbles:true}));
  };
  rec.onerror=e=>toast(e.error==='not-allowed'?'Разрешите доступ к микрофону в браузере.':`Голосовой ввод: ${e.error}`);
  rec.onend=()=>{button?.classList.remove('listening');activeRecognition=null};
  try{rec.start()}catch(e){toast('Не удалось запустить микрофон')}
}
function showSystemNotification(title,body=''){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{
    if(navigator.serviceWorker?.controller && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg=>reg.showNotification(title,{body,icon:'assets/logo.jpeg',badge:'assets/logo.jpeg',tag:'its24-'+Date.now()})).catch(()=>new Notification(title,{body}));
    }else new Notification(title,{body});
  }catch(e){}
}
async function requestSystemNotifications(){
  if(!('Notification' in window))return toast('Системные уведомления не поддерживаются браузером');
  const p=await Notification.requestPermission();toast(p==='granted'?'Системные уведомления разрешены':'Уведомления не разрешены');
}

function applyAuthTheme(){
  let theme='dark';try{theme=localStorage.getItem('kazior_auth_theme')||'dark'}catch{}
  document.body.classList.remove('theme-ocean','theme-aurora','theme-custom','has-user-background');
  document.body.classList.toggle('light',theme==='light');
  const button=$('#authThemeBtn');if(button){button.textContent=theme==='light'?'☾ Тёмная тема':'☀ Светлая тема';button.setAttribute('aria-pressed',String(theme==='light'))}
}
function showAuth(){
  applyAuthTheme();
  $("#authScreen").classList.remove("hidden");
  $("#app").classList.add("hidden");
  activeDirectChatId=null;activeChatTicketId=null;currentTicketId=null;
  if($("#chatText"))$("#chatText").value="";
  if($("#chatFiles"))$("#chatFiles").value="";
  if($("#chatPendingPreview"))$("#chatPendingPreview").innerHTML="";
  renderLoginEmployees();
  setLoginMethod(false);
  stopWhatsAppReceiving(false);
}
function enterApp(user){
  currentUser=user;
  const globalSearchInput=$('#globalSearch');if(globalSearchInput){globalSearchInput.value='';globalSearchInput.readOnly=true;delete globalSearchInput.dataset.userTyped;globalSearch='';}
  sessionStorage.setItem(SESSION,user.id);
  $("#authScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#sideUserName").textContent=user.name;
  $("#sideUserRole").textContent=roleNames[user.role];
  const sideAv=$("#sideAvatar");sideAv.textContent=user.photo?'':initials(user.name);sideAv.style.backgroundImage=user.photo?`url('${user.photo}')`:'';
  renderBranding();applyUserTheme(user);applyRoleVisibility();
  const requested=(location.hash||'').replace('#','');const allowedRequested=['dashboard','tickets','create','profile','chats','tasks','engineers','reports','assistant','accounts','directory','departments'].includes(requested)?requested:'dashboard';
  setView(allowedRequested);renderAll();renderNotifications();
  if(getWaSettings().incomingEnabled && hasPerm("manageIntegrations")) startWhatsAppReceiving(false);
  const unreadItems=(db.notifications||[]).filter(n=>n.recipientId===user.id&&!n.read);const unread=unreadItems.length;
  if(unread)setTimeout(()=>{playNotificationSound();showSystemNotification(`Новых уведомлений: ${unread}`,unreadItems[0]?.title||'Откройте CRM')},250);
}
function applyRoleVisibility(){
  document.body.classList.toggle('employee-mode',currentUser.role==='employee');
  $$('.admin-only').forEach(el=>el.classList.toggle('hidden',!['superadmin','admin'].includes(currentUser.role)));
  $$('.super-only').forEach(el=>el.classList.toggle('hidden',currentUser.role!=='superadmin'));

  const allowView=(view,allowed)=>{
    $$(`[data-view="${view}"],[data-workspace-view="${view}"]`).forEach(el=>el.classList.toggle('hidden',!allowed));
  };
  allowView('accounts',currentUser.role==='superadmin');
  allowView('directory',true);
  allowView('analytics',hasPerm('viewReports'));
  allowView('reports',hasPerm('viewReports'));
  allowView('contactcenter',hasPerm('manageIntegrations'));
  allowView('integrations',hasPerm('manageIntegrations'));
  allowView('mailbox',hasPerm('manageIntegrations'));
  allowView('engineers',['superadmin','admin','engineer'].includes(currentUser.role));
  allowView('departments',currentUser.role!=='employee');
  for(const v of ['tasks','assistant'])allowView(v,currentUser.role!=='employee');
  $$('.department-manage-only').forEach(el=>el.classList.toggle('hidden',!canManageDepartments()));
  const loadPanel=$('#engineerLoadPanel');if(loadPanel)loadPanel.classList.toggle('hidden',currentUser.role==='employee');
}
function setView(name){
  if(currentUser?.role==='employee' && !['dashboard','create','tickets','chats','profile','directory'].includes(name))name='dashboard';
  // Справочник и список учетных записей доступны всем авторизованным пользователям.
  if(["analytics","reports"].includes(name)&&!hasPerm('viewReports'))name="dashboard";
  if(["contactcenter","integrations","mailbox"].includes(name)&&!hasPerm('manageIntegrations'))name="dashboard";
  if(name==="engineers"&&!["superadmin","admin","engineer"].includes(currentUser.role))name="dashboard";
  if(["security","settings"].includes(name)&&currentUser.role!=="superadmin")name="dashboard";
    $$(".view").forEach(v=>v.classList.remove("active"));
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $$(".workspace-tab").forEach(b=>b.classList.toggle("active",b.dataset.workspaceView===name || (b.dataset.workspaceView==="tickets" && name==="create")));
  const view=$("#"+name+"View"); if(view) view.classList.add("active");
  const meta={
    dashboard:["Обзор","Сводка по заявкам и работе службы поддержки"],
    tickets:["Заявки","Kanban, статусы, принятие и перенаправление"],
    create:["Создать заявку","Новое обращение в Service Desk"],
    profile:["Мой профиль","Контакты, статус, фото и персональная тема"],
    chats:["Чаты","CRM-мессенджер и обратная связь по заявкам"],
    tasks:["Задачи","Планирование и контроль работы команды"],
    contactcenter:["Контакт-центр","Каналы обращений и омниканальные коммуникации"],
    integrations:["Интеграции","WhatsApp, Telegram, AI и ЭЦП"],
    mailbox:["Почта","Единое окно корпоративной переписки"],
    accounts:["Учетные записи","Роли, подтверждение и разграничение доступа"],
    directory:["Списки / сотрудники","Контакты и взаимодействия внутри организации"],
    engineers:["Инженеры","Загрузка, доступность и перенаправление заявок"],
    departments:["Подразделения","Руководители и структура организации"],
    analytics:["Аналитика","SLA, просрочки, категории и загрузка инженеров"],
    reports:["Отчеты","Печать PDF и экспорт в Excel"],
    security:["Безопасность","Политика информационной безопасности CRM"],
    assistant:["AI ассистент","Быстрая помощь по заявкам, ответам и диагностике"],
    settings:["Настройки","Интеграции и локальный режим"]
  };
  $("#pageTitle").textContent=meta[name]?.[0]||"CRM";
  $("#pageSub").textContent=meta[name]?.[1]||"";
  try{history.replaceState(null,'','#'+name)}catch(e){}
  $("#sidebar").classList.remove("open");
  if(name==="chats")requestAnimationFrame(fitChatWorkspace);
  if(name==="reports") renderReports();if(name==="profile")renderProfile();if(name==="mailbox")renderMailbox();if(name==="security")renderSecurityPolicy();
}

function renderAll(){
  applyRoleVisibility();
  renderMetrics();renderRecent();renderLoads();renderKanban();renderAccounts();renderEngineers();renderAiTicketSelect();fillCreateDefaults();
  renderChats();renderTasks();renderContactCenter();renderBadges();renderIntegrations();renderProfile();renderDirectory();renderDepartments();renderAnalytics();renderMailbox();renderNotifications();renderSettings();renderDashboardRole();
}
function renderMetrics(target='#metricGrid'){
  const ts=visibleTickets();
  let vals=[["Новые",ts.filter(t=>t.status==='new').length,'Ожидают обработки'],["В работе",ts.filter(t=>t.status==='working').length,'Приняты инженерами'],["Ожидание",ts.filter(t=>t.status==='waiting').length,'Требуют обратной связи'],["Выполнено",ts.filter(t=>['done','closed'].includes(t.status)).length,'Завершенные обращения']];
  if(currentUser&&currentUser.role!=='employee')vals.push(['Просрочено',ts.filter(isTicketOverdue).length,'Нарушение установленного SLA']);
  const el=$(target);if(!el)return;el.innerHTML=vals.map(v=>`<div class="metric ${v[0]==='Просрочено'&&v[1]?'metric-danger':''}"><span>${v[0]}</span><strong>${v[1]}</strong><small>${v[2]}</small></div>`).join('');
}
function renderDashboardRole(){if(!currentUser)return;const title=$('#heroTitle'),text=$('#heroText'),eye=$('#heroEyebrow');if(currentUser.role==='employee'){eye.textContent='ЛИЧНЫЙ КАБИНЕТ СОТРУДНИКА';title.textContent='Нужна помощь? Подайте заявку за минуту';text.textContent='Опишите проблему, укажите кабинет и при необходимости прикрепите фото. Здесь вы увидите, кто принял заявку, ответы инженера и текущий статус.'}else{eye.textContent=`SERVICE DESK · ${db.settings.organizationShort}`;title.textContent='Единая CRM для заявок, врачей и обратной связи с инженерами';text.textContent='Создание, принятие в работу, перенаправление, SLA, задачи, чаты, уведомления и аналитика.'}}
function renderRecent(){
  const list=[...visibleTickets()].sort((a,b)=>b.id.localeCompare(a.id)).slice(0,6);
  $("#recentList").innerHTML=list.length?list.map(t=>`<div class="recent-row">
    <div class="ticket-id">${esc(t.id)}</div><div><div class="recent-title">${esc(t.subject)}</div><div class="recent-meta">${esc(t.org)} · ${esc(t.category)}</div></div>
    <div>${statusTag(t.status)}</div><div>${priorityTag(t.priority)}</div>
  </div>`).join(""):`<p class="muted">Заявок пока нет.</p>`;
}
function renderLoads(){
  const eng=engineers();
  if(!eng.length){$("#loadList").innerHTML=`<p class="muted">Инженеры не созданы.</p>`;return}
  const max=Math.max(1,...eng.map(e=>db.tickets.filter(t=>t.engineerId===e.id&&["working","waiting"].includes(t.status)).length));
  $("#loadList").innerHTML=eng.map(e=>{
    const c=db.tickets.filter(t=>t.engineerId===e.id&&["working","waiting"].includes(t.status)).length;
    return `<div class="load-row"><div class="load-head"><span>${esc(e.name)}</span><b>${c} заяв.</b></div><div class="progress"><i style="width:${Math.round(c/max*100)}%"></i></div></div>`;
  }).join("");
}
function filteredTickets(){
  let ts=visibleTickets();
  const sf=$("#statusFilter")?.value||"", pf=$("#priorityFilter")?.value||"", ef=$("#engineerFilter")?.value||"";
  if(sf) ts=ts.filter(t=>t.status===sf); if(pf) ts=ts.filter(t=>t.priority===pf); if(ef) ts=ts.filter(t=>t.engineerId===ef);
  if(globalSearch){const q=globalSearch.toLowerCase();ts=ts.filter(t=>Object.values(t).join(" ").toLowerCase().includes(q))}
  return ts;
}
function renderEngineerFilter(){
  const sel=$("#engineerFilter"); if(!sel) return;
  const cur=sel.value;
  sel.innerHTML=`<option value="">Все инженеры</option>`+engineers().map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join("");
  sel.value=cur;
}
function renderKanban(){
  renderEngineerFilter();
  const ts=filteredTickets(); $("#ticketCounter").textContent=`${ts.length} заявок`;
  $("#kanban").innerHTML=statuses.map(s=>{
    const list=ts.filter(t=>t.status===s.id);
    return `<div class="kanban-col" data-status="${s.id}"><div class="kanban-head"><span>${s.name}</span><span>${list.length}</span></div>
    ${list.map(t=>`<article class="ticket-card" data-ticket="${t.id}" draggable="${canManageTicket(t)}">
      <div style="display:flex;justify-content:space-between;gap:8px"><span class="ticket-id">${esc(t.id)}</span>${priorityTag(t.priority)}</div>
      <h4>${esc(t.subject)}</h4><p>${esc(t.org)} · ${esc(t.dept)} · каб. ${esc(t.room||"—")}</p>
      <div class="sla-line">⏱ SLA: ${esc(formatDue(t.slaDue))} ${isTicketOverdue(t)?'<span class="tag overdue-badge">ПРОСРОЧЕНО</span>':''}</div>
      <div class="ticket-card-foot"><span class="muted" style="font-size:10px">${esc(t.engineerName||"Не назначен")}</span>${statusTag(t.status)}</div>
    </article>`).join("")}</div>`;
  }).join("");
  $$("[data-ticket]").forEach(card=>{
    card.addEventListener("click",()=>openTicket(card.dataset.ticket));
    if(card.getAttribute("draggable")==="true") card.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",card.dataset.ticket));
  });
  $$(".kanban-col").forEach(col=>{
    col.addEventListener("dragover",e=>e.preventDefault());
    col.addEventListener("drop",e=>{
      e.preventDefault(); const id=e.dataTransfer.getData("text/plain"); const t=db.tickets.find(x=>x.id===id);
      if(t&&canManageTicket(t)){t.status=col.dataset.status;save();renderAll();toast(`${id}: ${statusName(t.status)}`)}
    });
  });
}
function resetUserPassword(uid){
  if(currentUser?.role!=='superadmin')return toast('Сбрасывать пароли может только супер-администратор');
  const user=db.users.find(u=>u.id===uid);if(!user||document.querySelector('#passwordResetDialog'))return;
  const overlay=document.createElement('div');overlay.id='passwordResetDialog';overlay.className='ai-dialog';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Сброс пароля');
  overlay.innerHTML=`<article><h2>Сброс пароля</h2><p>${esc(user.name)}</p><p>Логин: <b>${esc(user.login)}</b></p><form><label>Новый пароль<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label><label>Повторите пароль<input name="repeat" type="password" autocomplete="new-password" required></label><p role="status"></p><div class="form-actions"><button class="btn primary" type="submit">Сохранить пароль</button><button class="btn soft" type="button" data-close>Отмена</button></div></form></article>`;
  document.body.appendChild(overlay);const form=overlay.querySelector('form'),status=overlay.querySelector('[role=status]');
  overlay.querySelector('[data-close]').onclick=()=>overlay.remove();
  form.onsubmit=async e=>{e.preventDefault();const password=form.elements.password.value;
    if(password!==form.elements.repeat.value){status.textContent='Пароли не совпадают';return}
    const button=form.querySelector('[type=submit]');button.disabled=true;
    try{await api('/api/password',{uid,password});form.reset();overlay.remove();toast('Пароль обновлён. Прежние сеансы завершены.')}catch(err){status.textContent=err.message}finally{button.disabled=false}
  };form.elements.password.focus();
}
function renderAccounts(){
  const body=$("#accountsBody");if(!body)return;let users=[...db.users];
  const qv=($('#accountsSearch')?.value||'').trim().toLowerCase(),rf=$('#accountsRoleFilter')?.value||'';
  if(qv)users=users.filter(u=>`${u.name} ${u.login} ${u.org} ${u.dept} ${u.position} ${u.email} ${u.phone}`.toLowerCase().includes(qv));if(rf)users=users.filter(u=>u.role===rf);users.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  body.innerHTML=users.map(u=>{const photo=u.photo?`style="background-image:url('${u.photo}')"`:'';const canAdminAction=currentUser.role==='superadmin';const rights=Object.values(userPermissions(u)).filter(Boolean).length;return `<tr>
    <td><div class="account-person" data-account-person="${u.id}"><div class="account-avatar" ${photo}>${u.photo?'':initials(u.name)}</div><div><b>${esc(u.name)}</b><br><span class="muted">@${esc(u.login)}</span></div></div></td>
    <td>${esc(u.org||'—')}<br><span class="muted">${esc(u.dept||'—')}</span><br><span class="muted">${esc(u.position||'')}</span></td><td>${esc(roleNames[u.role])}${currentUser.role==='superadmin'?`<br><span class="rights-count-v13">Права: ${rights}</span>`:''}</td><td>${u.status==='active'?'<span class="tag ok">Активен</span>':u.status==='blocked'?'<span class="tag p1">Заблокирован</span>':'<span class="tag warn">Ожидает</span>'}</td><td>${esc(u.email||'—')}<br>${esc(u.phone||'')}</td>
    <td><div class="table-actions"><button class="mini-btn" data-account-person="${u.id}">Карточка</button>${u.id!==currentUser.id?`<button class="mini-btn" data-account-chat="${u.id}">Написать</button>`:''}${currentUser.role==='superadmin'?`<button class="mini-btn" data-edit-user="${u.id}">Редактировать / права</button>`:''}${canAdminAction&&u.id!==currentUser.id?`<button class="mini-btn" data-toggle-user="${u.id}">${u.status==='active'?'Заблокировать':'Активировать'}</button><button class="mini-btn" data-reset-password="${u.id}">Сбросить пароль</button>`:''}</div></td></tr>`}).join('');
  $$('[data-toggle-user]').forEach(b=>b.onclick=()=>{const u=db.users.find(x=>x.id===b.dataset.toggleUser);if(!u)return;if(currentUser.role!=='superadmin'&&u.role==='superadmin')return toast('Недостаточно прав');u.status=u.status==='active'?'blocked':'active';save();renderAll();toast('Статус учетной записи изменен')});
  $$('[data-edit-user]').forEach(b=>b.onclick=()=>openAccountEdit(b.dataset.editUser));$$('[data-reset-password]').forEach(b=>b.onclick=e=>{e.stopPropagation();resetUserPassword(b.dataset.resetPassword)});$$('[data-account-person]').forEach(b=>b.onclick=e=>{e.stopPropagation();openPersonCard(b.dataset.accountPerson)});$$('[data-account-chat]').forEach(b=>b.onclick=e=>{e.stopPropagation();openChatWithUser(b.dataset.accountChat)});
}
function setPermissionUiForRole(role,applyDefaults=false){
  const p=permissionDefaults[role]||permissionDefaults.employee;
  const keys=['ViewAllTickets','ViewAllChats','ManageTickets','AssignTickets','ManageUsers','ManageTasks','ManageDepartments','ViewReports','ManageIntegrations'];
  keys.forEach(k=>{const key=k[0].toLowerCase()+k.slice(1),el=$("#perm"+k);if(!el)return;if(applyDefaults)el.checked=!!p[key];el.disabled=role==='superadmin'});
}
function openAccountEdit(id){
  if(currentUser?.role!=='superadmin')return toast('Назначать роли и права может только супер-администратор');
  const u=db.users.find(x=>x.id===id);if(!u)return;
  $("#editAccountId").value=u.id;$("#editAccountName").value=u.name||'';$("#editAccountLogin").value=u.login||'';$("#editAccountEmail").value=u.email||'';$("#editAccountPhone").value=u.phone||'';$("#editAccountDept").value=u.dept||'';$("#editAccountPosition").value=u.position||'';$("#editAccountRole").value=u.role;$("#editAccountStatus").value=u.status||'active';
  const p=userPermissions(u);
  ['ViewAllTickets','ViewAllChats','ManageTickets','AssignTickets','ManageUsers','ManageTasks','ManageDepartments','ViewReports','ManageIntegrations'].forEach(k=>{const key=k[0].toLowerCase()+k.slice(1),el=$("#perm"+k);if(el)el.checked=!!p[key]});
  setPermissionUiForRole(u.role,false);
  $("#accountEditModal").classList.remove("hidden");
}
async function saveAccountEdit(){
  if(currentUser?.role!=='superadmin')return toast('Только супер-администратор может изменять роли и права');
  const id=$("#editAccountId").value,u=db.users.find(x=>x.id===id);if(!u)return;
  const nextRole=$("#editAccountRole").value;
  if(u.id===currentUser.id&&currentUser.role==='superadmin'&&(nextRole!=='superadmin'||$("#editAccountStatus").value!=='active'))return toast('Нельзя отключить или понизить текущего супер-администратора');
  if(currentUser.role!=='superadmin'&&['admin','superadmin'].includes(nextRole))return toast('Только супер-администратор может назначать эту роль');
  const login=$("#editAccountLogin").value.trim(),email=$("#editAccountEmail").value.trim();
  if(db.users.some(x=>x.id!==id&&(x.login===login||(email&&x.email===email))))return toast('Логин или e-mail уже занят');
  Object.assign(u,{name:$("#editAccountName").value.trim(),login,email,phone:$("#editAccountPhone").value.trim(),dept:$("#editAccountDept").value.trim(),position:$("#editAccountPosition").value.trim(),role:nextRole,status:$("#editAccountStatus").value});
  if(nextRole==='superadmin')u.permissions={...permissionDefaults.superadmin};
  else u.permissions={
    viewAllTickets:$("#permViewAllTickets").checked,viewAllChats:$("#permViewAllChats").checked,manageTickets:$("#permManageTickets").checked,assignTickets:$("#permAssignTickets").checked,
    manageUsers:$("#permManageUsers").checked,manageTasks:$("#permManageTasks").checked,manageDepartments:$("#permManageDepartments").checked,viewReports:$("#permViewReports").checked,manageIntegrations:$("#permManageIntegrations").checked
  };
  if(!await save())return;closeModal('accountEditModal');renderAll();toast('Учетная запись и права сохранены');
}
function renderEngineers(){
  const el=$('#engineerCards');if(!el)return;el.onclick=event=>{const edit=event.target.closest('[data-engineer-edit]'),reset=event.target.closest('[data-engineer-reset]');if(edit)openAccountEdit(edit.dataset.engineerEdit);if(reset)resetUserPassword(reset.dataset.engineerReset)};const staff=[...techStaff()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru',{sensitivity:'base'}));el.innerHTML=staff.map(e=>{const work=db.tickets.filter(t=>t.engineerId===e.id&&!['done','closed'].includes(t.status)).length;const overdue=db.tickets.filter(t=>t.engineerId===e.id&&isTicketOverdue(t)).length;const photo=e.photo?`style="background-image:url('${e.photo}')"`:'';return `<div class="profile-card" data-person-card="${e.id}"><div class="engineer-card-photo" data-person-card="${e.id}" ${photo}>${!e.photo?`<div class="chat-empty" style="height:100%"><div class="avatar">${initials(e.name)}</div></div>`:''}</div><div class="profile-top"><div><b>${esc(e.name)}</b><div class="muted" style="font-size:10px">${esc(e.position||roleNames[e.role])}</div></div></div>${e.education?`<p class="engineer-education">${esc(e.education)}</p>`:''}${e.degree?`<p>${esc(e.degree)}</p>`:''}<div class="profile-meta"><div><span>Статус</span><b><i class="st ${e.workStatus}"></i> ${workStatusName(e.workStatus)}</b></div><div><span>Открыто</span><b>${work}</b></div><div><span>Просрочено</span><b>${overdue}</b></div></div><div class="engineer-card-actions">${currentUser.role==='superadmin'?`<button class="mini-btn" data-engineer-edit="${e.id}">Редактировать</button><button class="mini-btn" data-engineer-reset="${e.id}">Сбросить пароль</button>`:''}${currentUser.id===e.id?`<select class="engineer-status-select" data-own-status="${e.id}"><option value="available">Доступен</option><option value="busy">Занят</option><option value="away">Отошел</option><option value="dnd">Не беспокоить</option></select>`:''}${['superadmin','admin'].includes(currentUser.role)?`<button class="mini-btn" data-filter-engineer="${e.id}">Его заявки</button>`:''}</div></div>`}).join('');
  $$('[data-own-status]').forEach(s=>{s.value=currentUser.workStatus||'available';s.onclick=e=>e.stopPropagation();s.onchange=()=>setOwnStatus(s.value)});
  $$('[data-filter-engineer]').forEach(b=>b.onclick=e=>{e.stopPropagation();setView('tickets');$('#engineerFilter').value=b.dataset.filterEngineer;renderKanban()});
  $$('#engineerCards [data-person-card]').forEach(el=>el.onclick=e=>{if(e.target.closest('button,select,a,input'))return;openPersonCard(el.dataset.personCard)});
}
function fillCreateDefaults(){
  if(!currentUser) return;
  $("#ticketDept").value=$("#ticketDept").value||currentUser.dept||"";
  $("#ticketPhone").value=$("#ticketPhone").value||currentUser.phone||"";
  if($("#ticketRequesterName"))$("#ticketRequesterName").value=$("#ticketRequesterName").value||currentUser.name||"";
}
function fileNames(input){return [...input.files].map(f=>f.name)}
function classify(text){
  const s=text.toLowerCase();
  let category="Другое",priority="P3",tip="Уточните симптомы, время возникновения и место.";
  const rules=[
    [["принтер","печата","картридж"],"Принтер","Проверить очередь печати, доступность по IP, службу печати, драйвер и физическое состояние принтера."],
    [["интернет","сеть","ip","пинг","кабель"],"Сеть","Проверить линк, IP/DHCP, ping шлюза, порт коммутатора и кабельную линию."],
    [["wifi","wi-fi","вайфай"],"Wi-Fi","Проверить уровень сигнала, подключение к SSID, получение IP и доступность шлюза."],
    [["камера","ivms","видеонаблю"],"Видеонаблюдение","Проверить питание/PoE, ping камеры, VLAN, NVR и учетные данные."],
    [["сервер","esxi","ad","домен"],"Сервер","Проверить доступность сервера, журнал событий, дисковое пространство и состояние сервисов."],
    [["мис","программа","ошибка","приложение"],"ПО / МИС","Зафиксировать текст ошибки, пользователя, рабочее место, версию приложения и последнее изменение."],
    [["телефон","sip","звон"],"Телефония","Проверить регистрацию SIP, сеть, питание телефона и доступность АТС."],
    [["компьютер","windows","медленно","не включ"],"Компьютер","Проверить загрузку CPU/RAM/Disk, SMART, автозагрузку и системный журнал."]
  ];
  for(const [keys,cat,t] of rules){if(keys.some(k=>s.includes(k))){category=cat;tip=t;break}}
  if(["не работает","нет доступа","не открывается","критич","срочно"].some(k=>s.includes(k))) priority="P2";
  if(["весь отдел","все пользователи","сервер недоступен","полностью"].some(k=>s.includes(k))) priority="P1";
  return {category,priority,tip};
}
function renderAiTicketSelect(){
  const sel=$("#aiTicketSelect");if(!sel)return;
  sel.innerHTML=`<option value="">— выберите заявку —</option>`+visibleTickets().map(t=>`<option value="${t.id}">${esc(t.id)} · ${esc(t.subject)}</option>`).join("");
}
function aiAnswerFor(ticket,question){
  const base=classify(`${ticket?.subject||""} ${ticket?.description||""} ${question||""}`);
  let ans=`Рекомендуемая категория: ${base.category}\nПриоритет: ${base.priority}\n\nДиагностика:\n${base.tip}\n\n`;
  if(ticket) ans+=`По заявке ${ticket.id}: сначала подтвердите пользователю принятие обращения, затем зафиксируйте результат диагностики в комментарии.\n\n`;
  ans+=`Пример ответа клиенту:\n«Здравствуйте. Заявка принята в работу. Выполняем диагностику. После проверки сообщим результат в CRM и по согласованному каналу связи.»`;
  return ans;
}
function legacyOpenTicket(id){
  const t=db.tickets.find(x=>x.id===id);if(!t)return;currentTicketId=id;
  $("#ticketModalTitle").textContent=`${t.id} · ${t.subject}`;
  const engOptions=engineers().map(e=>`<option value="${e.id}" ${t.engineerId===e.id?"selected":""}>${esc(e.name)}</option>`).join("");
  const canManage=canManageTicket(t)||roleAtLeastAdmin();
  const canAssign=hasPerm('assignTickets');
  const canConversation=canViewConversation(t);
  $("#ticketModalContent").innerHTML=`
    <div class="ticket-detail-grid">
      <div class="ticket-block"><h4>Карточка обращения</h4><div class="kv">
        <span>Заявитель</span><b>${esc(t.ownerName)}</b><span>Организация</span><b>${esc(t.org)}</b><span>Отдел</span><b>${esc(t.dept)}</b>
        <span>Кабинет</span><b>${esc(t.room||"—")}</b><span>Локация</span><b>${esc(t.location||"—")}</b><span>Телефон</span><b>${esc(t.phone||"—")}</b>
        <span>Источник</span><b>${esc(t.source)}</b><span>Категория</span><b>${esc(t.category)}</b><span>Приоритет</span><b>${esc(t.priority)}</b>
        <span>Статус</span><b>${esc(statusName(t.status))}</b><span>Инженер</span><b>${esc(t.engineerName||"Не назначен")}</b>
      </div><hr style="border:0;border-top:1px solid var(--line);margin:12px 0"><b>${esc(t.description||"")}</b>
      <div class="attachments attachment-grid">${attachmentMarkup(t.files||[])}</div></div>

      <div class="ticket-block"><h4>Управление</h4>
        ${canAssign?`<label>Перенаправить инженеру<select id="assignEngineer"><option value="">— не назначено —</option>${engOptions}</select></label><button class="btn soft" id="assignBtn">Назначить / перенаправить</button>`:""}
        ${currentUser.role==='superadmin'?`<label>Срок выполнения (SLA)<input id="ticketSlaDue" type="datetime-local" value="${esc(t.slaDue||'')}"></label><button class="btn soft" id="saveSlaBtn">Сохранить SLA</button>`:''}
        ${canManage?`<div class="form-actions" style="justify-content:flex-start">
          <button class="btn primary" id="takeBtn">Принять в работу</button>
          <select id="modalStatus" style="width:auto">${statuses.map(s=>`<option value="${s.id}" ${t.status===s.id?"selected":""}>${s.name}</option>`).join("")}</select>
          <button class="btn soft" id="statusBtn">Изменить статус</button>
        </div>`:""}
        ${t.phone?`<div class="form-actions" style="justify-content:flex-start"><a class="btn soft" target="_blank" href="https://wa.me/${t.phone.replace(/\D/g,"")}">Ответить в WhatsApp</a><a class="btn soft" href="tel:${esc(t.phone)}">Позвонить</a></div>`:""}
      </div>
    </div>

    <div class="ticket-detail-grid" style="margin-top:14px">
${canConversation?`      <div class="ticket-block"><h4>Переписка</h4><div class="messages">${(t.messages||[]).map(m=>`<div class="msg"><div class="msg-head"><b>${esc(m.author)}</b><span>${esc(m.date)}</span></div><div>${esc(m.text)}</div><div class="attachments attachment-grid">${attachmentMarkup(m.files||[])}</div></div>`).join("")||`<span class="muted">Сообщений пока нет.</span>`}</div></div>
      <div class="ticket-block"><h4>Ответить сотруднику</h4>
        <div class="voice-field voice-field-textarea"><textarea id="replyText" rows="5" placeholder="Напишите ответ или результат диагностики"></textarea><button class="voice-btn" type="button" data-voice-target="replyText" title="Надиктовать ответ">🎙</button></div>
        <label>Фото / файл<input id="replyFiles" type="file" multiple></label>
        <div id="replyFilesPreview" class="pending-attachments"></div>
        <div class="form-actions"><button class="btn soft" id="replyAiBtn">✦ AI ответ</button><button class="btn primary" id="replySendBtn">Отправить ответ</button></div>
      </div>
`:`<div class="ticket-block conversation-locked"><h4>Переписка ограничена</h4><p class="muted">Доступ к чужой переписке закрыт. Разрешение может выдать только супер-администратор.</p></div>`}    </div>`;
  $("#ticketModal").classList.remove("hidden");
  hydrateAttachments($("#ticketModalContent"));
  $("#replyFiles")?.addEventListener("change",e=>renderPendingFilePreviews(e.target,$("#replyFilesPreview")));

  $("#assignBtn")?.addEventListener("click",()=>{const eid=$("#assignEngineer").value;const e=db.users.find(u=>u.id===eid);t.engineerId=eid;t.engineerName=e?e.name:"Не назначен";t.history.push({date:now(),actor:currentUser.name,text:`Назначен инженер: ${t.engineerName}`});if(eid)addNotification(eid,`Вам назначена заявка ${t.id}`,t.subject,t.id);addNotification(t.ownerId,`По заявке ${t.id} назначен инженер`,t.engineerName,t.id);save();closeModal("ticketModal");renderAll();toast("Инженер назначен");playNotificationSound()});
  $("#saveSlaBtn")?.addEventListener("click",()=>{t.slaDue=$("#ticketSlaDue").value;t.history.push({date:now(),actor:currentUser.name,text:`SLA установлен: ${formatDue(t.slaDue)}`});save();openTicket(t.id);renderAll();toast("Срок SLA сохранен")});
  $("#takeBtn")?.addEventListener("click",()=>{if(currentUser.role==="engineer"||currentUser.role==='superadmin'){t.engineerId=currentUser.id;t.engineerName=currentUser.name}else if(!t.engineerId){const first=engineers()[0];if(first){t.engineerId=first.id;t.engineerName=first.name}}t.status="working";t.acceptedAt=now();t.history.push({date:now(),actor:currentUser.name,text:'Заявка принята в работу'});addNotification(t.ownerId,`Заявка ${t.id} принята в работу`,`${t.engineerName}`,t.id);save();closeModal("ticketModal");renderAll();toast("Заявка принята в работу");playNotificationSound()});
  $("#statusBtn")?.addEventListener("click",async()=>{t.status=$("#modalStatus").value;if(['done','closed'].includes(t.status))t.doneAt=now();t.history.push({date:now(),actor:currentUser.name,text:`Статус: ${statusName(t.status)}`});addNotification(t.ownerId,`Статус заявки ${t.id} изменен`,statusName(t.status),t.id);save();closeModal("ticketModal");renderAll();toast("Статус изменен");playNotificationSound();await notifyStatusWhatsApp(t)});
  if($("#replyAiBtn"))$("#replyAiBtn").onclick=()=>{$("#replyText").value=aiAnswerFor(t,"").split("Пример ответа клиенту:\n")[1]?.replace(/[«»]/g,"")||"Заявка принята в работу."};
  if($("#replySendBtn"))$("#replySendBtn").onclick=async()=>{const text=$("#replyText").value.trim();const stored=await storeSelectedFiles($("#replyFiles").files);if(!text&&!stored.length)return toast("Введите текст или прикрепите файл");t.messages=t.messages||[];t.messages.push({author:currentUser.name,authorId:currentUser.id,text,date:now(),files:stored,readBy:[currentUser.id]});t.history.push({date:now(),actor:currentUser.name,text:'Добавлен комментарий / вложение'});if(currentUser.id!==t.ownerId)addNotification(t.ownerId,`Новый ответ по ${t.id}`,`${currentUser.name}: ${(text||'Вложение').slice(0,90)}`,t.id);else if(t.engineerId)addNotification(t.engineerId,`Ответ пользователя по ${t.id}`,(text||'Вложение').slice(0,100),t.id);save();openTicket(t.id);renderAll();toast("Ответ сохранен в CRM");playNotificationSound();if(text&&currentUser.id!==t.ownerId) await notifyReplyWhatsApp(t,text)};
}
function closeModal(id){$("#"+id).classList.add("hidden")}


function renderBadges(){const ts=visibleTickets(),fresh=ts.filter(t=>t.status==='new').length,side=$('#sideTicketBadge'),note=$('#notificationBadge');if(side){side.textContent=fresh;side.classList.toggle('hidden',fresh===0)}if(note){note.textContent=fresh;note.classList.toggle('hidden',fresh===0)}const cb=$('#sideChatBadge');if(cb){const d=(db.directChats||[]).filter(c=>c.participants?.includes(currentUser.id)&&directUnreadCount(c)>0).length,tc=visibleChatTickets().filter(t=>ticketUnreadCount(t)>0).length,u=d+tc;cb.textContent=u||'';cb.classList.toggle('hidden',u===0)}const tb=$('#sideTaskBadge');if(tb){const u=(db.tasks||[]).filter(t=>taskUnread(t)).length;tb.textContent=u||'';tb.classList.toggle('hidden',u===0)}}

function chatPreview(t){
  const msgs=t.messages||[];
  if(msgs.length)return msgs[msgs.length-1].text||'Вложение';
  return t.description||t.subject;
}
function directChatKey(a,b){return [String(a),String(b)].sort().join(':')}
function directChatForUsers(a,b,create=false){
  db.directChats=db.directChats||[];
  const key=directChatKey(a,b);
  let chat=db.directChats.find(c=>directChatKey(c.participants?.[0],c.participants?.[1])===key);
  if(!chat&&create){
    chat={id:'dm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),participants:[a,b],created:now(),updatedAt:now(),messages:[]};
    db.directChats.unshift(chat);save();
  }
  return chat||null;
}
function directChatLastTime(chat){
  const d=parseLocalDateTime(chat?.updatedAt||chat?.created);
  return d?d.getTime():0;
}
function visibleDirectChats(){
  const chats=db.directChats||[];
  if(currentUser?.role==='superadmin'||hasPerm('viewAllChats'))return chats;
  return chats.filter(c=>c.participants?.includes(currentUser.id));
}
function recordChatAccess(kind,refId,participants=[]){
  if(!currentUser||currentUser.role!=='superadmin'||participants.includes(currentUser.id))return;
  db.chatAccessAudit=db.chatAccessAudit||[];
  db.chatAccessAudit.unshift({id:'audit-'+Date.now()+Math.random().toString(16).slice(2),date:now(),adminId:currentUser.id,adminName:currentUser.name,kind,refId,participants:[...participants]});
  db.chatAccessAudit=db.chatAccessAudit.slice(0,200);save();
}
function populateChatFilters(){
  const dep=$('#chatDepartmentFilter');if(!dep)return;
  const current=dep.value;
  const values=[...new Set(db.users.map(u=>u.dept).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
  dep.innerHTML='<option value="">Все отделы</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if(values.includes(current))dep.value=current;
}
function chatListTimestamp(value){const d=parseLocalDateTime(value);return d?d.getTime():0}
function setChatMode(mode){
  chatMode=mode==='tickets'?'tickets':'people';
  $$('#chatsView [data-chat-mode]').forEach(b=>b.classList.toggle('active',b.dataset.chatMode===chatMode));
  if(chatMode==='people')activeChatTicketId=null;else activeDirectChatId=null;
  resetChatHistoryFilters(false);renderChats();renderActiveChat();
}
function renderChats(){
  const listEl=$("#chatList");if(!listEl||!currentUser)return;
  populateChatFilters();
  const qv=($("#chatSearch")?.value||"").trim().toLowerCase();
  const dept=$("#chatDepartmentFilter")?.value||'',role=$("#chatRoleFilter")?.value||'',ws=$("#chatWorkStatusFilter")?.value||'',sort=$("#chatListSort")?.value||'recent';
  const auditMode=currentUser.role==='superadmin'&&$("#chatAdminScope")?.value==='audit';

  if(chatMode==='tickets'){
    let ts=[...visibleChatTickets()];
    if(qv)ts=ts.filter(t=>`${t.ownerName} ${t.subject} ${t.id} ${t.org} ${t.dept} ${t.phone} ${chatPreview(t)}`.toLowerCase().includes(qv));
    if(dept)ts=ts.filter(t=>t.dept===dept);
    ts.sort((a,b)=>sort==='name'?a.ownerName.localeCompare(b.ownerName,'ru'):(sort==='old'?chatListTimestamp(a.created)-chatListTimestamp(b.created):chatListTimestamp(b.created)-chatListTimestamp(a.created)));
    listEl.innerHTML=ts.length?ts.map(t=>{const ou=db.users.find(u=>u.id===t.ownerId);return `<div class="chat-list-item ${activeChatTicketId===t.id?"active":""}" data-chat-ticket="${t.id}">
      <div class="chat-avatar" ${ou?.photo?`style="background-image:url('${ou.photo}')"`:''}>${ou?.photo?'':initials(t.ownerName)}</div>
      <div class="chat-list-body"><div class="chat-list-row"><span class="chat-list-name">${esc(t.ownerName)}</span><span class="chat-list-time">${esc(t.created||'')}</span></div><div class="chat-preview"><b>${esc(t.id)}</b> · ${esc(t.subject)} · ${esc(chatPreview(t))}</div></div>${ticketUnreadCount(t)?`<em class="chat-item-unread">${ticketUnreadCount(t)}</em>`:''}
    </div>`}).join(""):`<div class="chat-info-empty">Чаты по заявкам не найдены.</div>`;
    $$("[data-chat-ticket]").forEach(el=>el.onclick=()=>selectChat(el.dataset.chatTicket));
    if(activeChatTicketId&&!visibleChatTickets().some(t=>t.id===activeChatTicketId))activeChatTicketId=null;
    return;
  }

  if(auditMode){
    let chats=[...visibleDirectChats()];
    if(qv)chats=chats.filter(c=>{const users=c.participants.map(id=>db.users.find(u=>u.id===id)).filter(Boolean);return (users.map(u=>`${u.name} ${u.position} ${u.phone} ${u.dept} ${u.email}`).join(' ')+' '+(c.messages||[]).map(m=>m.text).join(' ')).toLowerCase().includes(qv)});
    if(dept)chats=chats.filter(c=>c.participants.map(id=>db.users.find(u=>u.id===id)).some(u=>u?.dept===dept));
    if(role)chats=chats.filter(c=>c.participants.map(id=>db.users.find(u=>u.id===id)).some(u=>u?.role===role));
    if(ws)chats=chats.filter(c=>c.participants.map(id=>db.users.find(u=>u.id===id)).some(u=>u?.workStatus===ws));
    chats.sort((a,b)=>sort==='old'?directChatLastTime(a)-directChatLastTime(b):directChatLastTime(b)-directChatLastTime(a));
    listEl.innerHTML=chats.length?chats.map(c=>{const us=c.participants.map(id=>db.users.find(u=>u.id===id)).filter(Boolean),last=(c.messages||[]).slice(-1)[0];return `<div class="chat-list-item ${activeDirectChatId===c.id?"active":""}" data-direct-chat="${c.id}">
      <div class="chat-avatar audit-avatar">A</div><div class="chat-list-body"><div class="chat-list-row"><span class="chat-list-name">${esc(us.map(u=>u.name).join(' ↔ '))}</span><span class="chat-list-time">${esc(c.updatedAt||c.created||'')}</span></div><div class="chat-preview">Аудит · ${esc(last?.text||'Нет сообщений')}</div></div>
    </div>`}).join(''):'<div class="chat-info-empty">Служебные переписки для аудита не найдены.</div>';
    $$("[data-direct-chat]").forEach(el=>el.onclick=()=>selectDirectChat(el.dataset.directChat,true));return;
  }

  let users=db.users.filter(u=>u.status==='active'&&u.id!==currentUser.id);
  if(qv)users=users.filter(u=>`${u.name} ${u.position} ${u.phone} ${u.dept} ${u.email} ${u.login}`.toLowerCase().includes(qv));
  if(dept)users=users.filter(u=>u.dept===dept);if(role)users=users.filter(u=>u.role===role);if(ws)users=users.filter(u=>(u.workStatus||'available')===ws);
  const list=users.map(u=>({u,chat:directChatForUsers(currentUser.id,u.id,false)}));
  list.sort((a,b)=>sort==='name'?a.u.name.localeCompare(b.u.name,'ru'):(sort==='old'?directChatLastTime(a.chat)-directChatLastTime(b.chat):directChatLastTime(b.chat)-directChatLastTime(a.chat)));
  listEl.innerHTML=list.length?list.map(({u,chat})=>{const last=chat?.messages?.slice(-1)[0];return `<div class="chat-list-item ${activeDirectChatId===chat?.id?"active":""}" data-chat-user="${u.id}">
    <div class="chat-avatar" ${u.photo?`style="background-image:url('${u.photo}')"`:''}>${u.photo?'':initials(u.name)}</div>
    <div class="chat-list-body"><div class="chat-list-row"><span class="chat-list-name">${esc(u.name)}</span><span class="chat-list-time">${esc(chat?.updatedAt||'')}</span></div><div class="chat-preview">${esc(u.position||roleNames[u.role])} · ${esc(u.dept||'—')}${last?` · ${esc(last.text||'Вложение')}`:' · Начать чат'}</div></div>${directUnreadCount(chat)?`<em class="chat-item-unread">${directUnreadCount(chat)}</em>`:''}
    <span class="work-dot ${u.workStatus||'available'}" title="${esc(workStatusName(u.workStatus))}"></span>
  </div>`}).join(''):'<div class="chat-info-empty">Сотрудники не найдены.</div>';
  $$("[data-chat-user]").forEach(el=>el.onclick=()=>startDirectChat(el.dataset.chatUser));
}
function startDirectChat(userId){
  const user=db.users.find(u=>u.id===userId);if(!user)return;
  const chat=directChatForUsers(currentUser.id,userId,true);activeDirectChatId=chat.id;activeChatTicketId=null;currentTicketId=null;resetChatHistoryFilters(false);markDirectChatRead(chat);renderChats();renderActiveChat();
}
function selectDirectChat(id,audit=false){
  const chat=(db.directChats||[]).find(c=>c.id===id);if(!chat)return;
  if(!chat.participants.includes(currentUser.id)&&!(currentUser.role==='superadmin'||hasPerm('viewAllChats')))return toast('Нет доступа к этой переписке');
  activeDirectChatId=id;activeChatTicketId=null;currentTicketId=null;if(audit||!chat.participants.includes(currentUser.id))recordChatAccess('direct',id,chat.participants||[]);else markDirectChatRead(chat);renderChats();renderActiveChat();
}
function selectChat(id){
  const t=db.tickets.find(x=>x.id===id);if(!t||!canViewConversation(t))return toast('Нет доступа к переписке заявки');
  activeChatTicketId=id;activeDirectChatId=null;currentTicketId=id;if(currentUser.role==='superadmin'&&![t.ownerId,t.engineerId].includes(currentUser.id))recordChatAccess('ticket',id,[t.ownerId,t.engineerId].filter(Boolean));else markTicketChatRead(t);renderChats();renderActiveChat();
}
function chatHistoryCriteria(){return {q:($("#chatMessageSearch")?.value||'').trim().toLowerCase(),date:$("#chatDateFilter")?.value||'',month:$("#chatMonthFilter")?.value||'',sort:$("#chatMessageSort")?.value||'asc'}}
function filterChatMessages(messages){
  const f=chatHistoryCriteria();let list=[...(messages||[])];
  if(f.q)list=list.filter(m=>`${m.author||''} ${m.text||''} ${(m.files||[]).map(x=>typeof x==='string'?x:x.name).join(' ')}`.toLowerCase().includes(f.q));
  if(f.date)list=list.filter(m=>{const d=parseLocalDateTime(m.date);if(!d)return false;return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===f.date});
  if(f.month)list=list.filter(m=>{const d=parseLocalDateTime(m.date);if(!d)return false;return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===f.month});
  list.sort((a,b)=>f.sort==='desc'?chatListTimestamp(b.date)-chatListTimestamp(a.date):chatListTimestamp(a.date)-chatListTimestamp(b.date));return list;
}
function resetChatHistoryFilters(render=true){if($("#chatMessageSearch"))$("#chatMessageSearch").value='';if($("#chatDateFilter"))$("#chatDateFilter").value='';if($("#chatMonthFilter"))$("#chatMonthFilter").value='';if($("#chatMessageSort"))$("#chatMessageSort").value='asc';if(render)renderActiveChat()}
function renderActiveChat(){
  const selected=!!(activeDirectChatId||activeChatTicketId);
  document.querySelector('.messenger-v11')?.classList.toggle('chat-has-selection',selected);
  requestAnimationFrame(()=>{fitChatWorkspace();autoGrowChatComposer()});
  const tools=$("#chatHistoryTools");if(tools)tools.classList.toggle('hidden',!(activeDirectChatId||activeChatTicketId));

  if(activeDirectChatId){
    const chat=(db.directChats||[]).find(c=>c.id===activeDirectChatId);if(!chat)return;
    const users=chat.participants.map(id=>db.users.find(u=>u.id===id)).filter(Boolean),other=chat.participants.includes(currentUser.id)?users.find(u=>u.id!==currentUser.id):null;
    const title=other?.name||users.map(u=>u.name).join(' ↔ '),sub=other?`${other.position||roleNames[other.role]} · ${other.dept||'—'} · ${workStatusName(other.workStatus)}`:'Служебная переписка для аудита';
    $("#chatThreadHeader").innerHTML=`<div class="chat-thread-person">${other?`<div class="chat-message-avatar large" ${other.photo?`style="background-image:url('${other.photo}')"`:''}>${other.photo?'':initials(other.name)}</div>`:''}<div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div></div><div class="form-actions" style="margin:0">${other?`<button class="btn soft" id="chatOpenProfileBtn">Профиль</button>`:''}<button class="btn soft" id="chatAiBtn">✦ AI ответ</button></div>`;
    if($("#chatOpenProfileBtn"))$("#chatOpenProfileBtn").onclick=()=>openPersonCard(other.id);
    $("#chatAiBtn").onclick=()=>{$("#chatText").value='Здравствуйте. Получил ваше сообщение. Уточните, пожалуйста, детали, чтобы я мог помочь быстрее.'};
    const messages=filterChatMessages(chat.messages||[]);
    $("#chatMessages").innerHTML=messages.length?messages.map(m=>{const mu=db.users.find(u=>u.id===m.authorId)||db.users.find(u=>u.name===m.author);return `<div class="chat-message-row ${m.authorId===currentUser.id?"mine":""}">
      <div class="chat-message-avatar" ${mu?.photo?`style="background-image:url('${mu.photo}')"`:''}>${mu?.photo?'':initials(m.author)}</div><div class="chat-bubble ${m.authorId===currentUser.id?"mine":""}"><div class="chat-bubble-head"><b>${esc(m.author)}</b><span>${esc(m.date||'')}</span></div><div class="chat-bubble-text">${esc(m.text||'')}</div><div class="attachments attachment-grid">${attachmentMarkup(m.files||[])}</div></div>
    </div>`}).join(''):`<div class="chat-empty chat-empty-small"><div class="chat-empty-art">💬</div><h3>${(chat.messages||[]).length?"Сообщения не найдены":"Начните переписку"}</h3><p>${(chat.messages||[]).length?"Измените дату, месяц или текст поиска.":"Напишите сообщение в поле ниже или прикрепите файл."}</p></div>`;
    hydrateAttachments($("#chatMessages"));$("#chatComposer").classList.toggle("disabled",!chat.participants.includes(currentUser.id));if(chatHistoryCriteria().sort==='asc')$("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;
    $("#chatInfo").innerHTML=other?`<div class="chat-info-card employee-chat-info"><div class="chat-info-photo" ${other.photo?`style="background-image:url('${other.photo}')"`:''}>${other.photo?'':initials(other.name)}</div><h4>${esc(other.name)}</h4><div class="info-line"><span>Должность</span><b>${esc(other.position||roleNames[other.role])}</b></div><div class="info-line"><span>Отдел</span><b>${esc(other.dept||'—')}</b></div><div class="info-line"><span>Статус</span><b>${esc(workStatusName(other.workStatus))}</b></div><div class="info-line"><span>Телефон</span><b>${esc(other.phone||'—')}</b></div><div class="info-line"><span>E-mail</span><b>${esc(other.email||'—')}</b></div><button class="btn soft wide" id="chatInfoProfileBtn" style="margin-top:12px">Открыть карточку</button></div>`:`<div class="chat-info-card"><h4>Служебный аудит</h4><p class="muted">Участники: ${esc(users.map(u=>u.name).join(' ↔ '))}</p><p class="muted">Просмотр фиксируется в локальном журнале доступа.</p></div>`;
    if($("#chatInfoProfileBtn"))$("#chatInfoProfileBtn").onclick=()=>openPersonCard(other.id);return;
  }

  if(activeChatTicketId){
    const t=db.tickets.find(x=>x.id===activeChatTicketId);if(!t||!canViewConversation(t))return;
    $("#chatThreadHeader").innerHTML=`<div><h3>${esc(t.ownerName)}</h3><p>${esc(t.id)} · ${esc(t.subject)} · ${esc(statusName(t.status))}</p></div><div class="form-actions" style="margin:0"><button class="btn soft" id="chatAiBtn">✦ AI ответ</button><button class="btn soft" id="openChatTicketBtn">Открыть заявку</button></div>`;
    $("#openChatTicketBtn").onclick=()=>openTicket(t.id);$("#chatAiBtn").onclick=()=>{$("#chatText").value=aiAnswerFor(t,'').split('Пример ответа клиенту:\n')[1]?.replace(/[«»]/g,'')||'Заявка принята в работу.'};
    const all=[{author:t.ownerName,authorId:t.ownerId,text:`Заявка: ${t.subject}\n${t.description||""}`,date:t.created,files:t.files||[],owner:true},...(t.messages||[])],messages=filterChatMessages(all);
    $("#chatMessages").innerHTML=messages.length?messages.map(m=>{const mu=db.users.find(u=>u.id===m.authorId)||db.users.find(u=>u.name===m.author);return `<div class="chat-message-row ${m.authorId===currentUser.id?"mine":""}"><div class="chat-message-avatar" ${mu?.photo?`style="background-image:url('${mu.photo}')"`:''}>${mu?.photo?'':initials(m.author)}</div><div class="chat-bubble ${m.authorId===currentUser.id?"mine":""}"><div class="chat-bubble-head"><b>${esc(m.author)}</b><span>${esc(m.date||'')}</span></div><div class="chat-bubble-text">${esc(m.text||'')}</div><div class="attachments attachment-grid">${attachmentMarkup(m.files||[])}</div></div></div>`}).join(''):`<div class="chat-empty chat-empty-small"><h3>Сообщений не найдено</h3><p>Проверьте дату, месяц или поиск.</p></div>`;
    hydrateAttachments($("#chatMessages"));$("#chatComposer").classList.remove("disabled");if(chatHistoryCriteria().sort==='asc')$("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;
    $("#chatInfo").innerHTML=`<div class="chat-info-card"><h4>${esc(t.id)}</h4><div class="info-line"><span>Организация</span><b>${esc(t.org)}</b></div><div class="info-line"><span>Отдел / кабинет</span><b>${esc(t.dept)} · ${esc(t.room||"—")}</b></div><div class="info-line"><span>Категория</span><b>${esc(t.category)}</b></div><div class="info-line"><span>Приоритет</span><b>${esc(t.priority)}</b></div><div class="info-line"><span>Инженер</span><b>${esc(t.engineerName||"Не назначен")}</b></div><div class="info-line"><span>Телефон</span><b>${esc(t.phone||"—")}</b></div>${t.phone?`<a class="btn soft wide" target="_blank" href="https://wa.me/${t.phone.replace(/\D/g,"")}" style="margin-top:12px">Открыть WhatsApp</a>`:""}</div>`;return;
  }

  $("#chatThreadHeader").innerHTML='<div><h3>Выберите сотрудника или заявку</h3><p>Для личной переписки откройте вкладку «Сотрудники».</p></div>';$("#chatMessages").innerHTML='<div class="chat-empty"><div class="chat-empty-art">💬</div><h3>CRM-мессенджер</h3><p>Доступны поиск сотрудников, фото и документы, фильтрация переписки по дате и месяцу.</p></div>';$("#chatComposer").classList.add('disabled');$("#chatInfo").innerHTML='<div class="chat-info-empty">Информация появится после выбора чата.</div>';
}
async function sendChatMessage(){
  if(!currentUser || chatSending)return;
  const targetDirect=activeDirectChatId,targetTicket=activeChatTicketId;
  if(!targetDirect&&!targetTicket)return toast('Сначала выберите сотрудника или заявку');
  chatSending=true;
  try {
  const text=$("#chatText").value.trim(),stored=await storeSelectedFiles($("#chatFiles").files);if(targetDirect!==activeDirectChatId||targetTicket!==activeChatTicketId)return toast("Чат изменился. Проверьте получателя и отправьте сообщение ещё раз.");if(!text&&!stored.length)return toast("Введите сообщение или прикрепите файл");
  if(activeDirectChatId){
    const chat=(db.directChats||[]).find(c=>c.id===activeDirectChatId);if(!chat)return;if(!chat.participants.includes(currentUser.id))return toast('В режиме аудита отправка сообщений недоступна');
    const recipientId=chat.participants.find(id=>id!==currentUser.id);chat.messages=chat.messages||[];chat.messages.push({author:currentUser.name,authorId:currentUser.id,text,date:now(),files:stored,readBy:[currentUser.id]});chat.updatedAt=now();$("#chatText").value="";$("#chatFiles").value="";$("#chatPendingPreview").innerHTML="";if(recipientId)addNotification(recipientId,`Новое сообщение от ${currentUser.name}`,(text||'Вложение').slice(0,120),`dm:${chat.id}`);save();renderAll();selectDirectChat(chat.id,false);toast("Сообщение отправлено");playNotificationSound();return;
  }
  if(activeChatTicketId){
    const t=db.tickets.find(x=>x.id===activeChatTicketId);if(!t||!canViewConversation(t))return toast('Нет доступа к чату заявки');t.messages=t.messages||[];t.messages.push({author:currentUser.name,authorId:currentUser.id,text,date:now(),files:stored,readBy:[currentUser.id]});$("#chatText").value="";$("#chatFiles").value="";$("#chatPendingPreview").innerHTML="";if(currentUser.id!==t.ownerId)addNotification(t.ownerId,`Новый ответ по ${t.id}`,`${currentUser.name}: ${(text||'Вложение').slice(0,90)}`,t.id);else if(t.engineerId)addNotification(t.engineerId,`Ответ пользователя по ${t.id}`,(text||'Вложение').slice(0,100),t.id);save();renderAll();selectChat(t.id);toast("Сообщение отправлено в CRM");playNotificationSound();if(text&&currentUser.id!==t.ownerId)await notifyReplyWhatsApp(t,text);return;
  }
  toast('Сначала выберите чат');
  } catch(e){toast('Не удалось сохранить сообщение. Текст оставлен в поле ввода.')}
  finally{chatSending=false;autoGrowChatComposer()}
}

function renderTasks(){
  const board=$('#taskBoard');if(!board)return;const tasks=visibleTasks(),cols=[['todo','Новые'],['progress','В работе'],['done','Выполнено']];
  board.innerHTML=cols.map(([id,name])=>{const list=tasks.filter(t=>t.status===id);return `<div class="task-column"><div class="task-column-head"><span>${name}</span><span>${list.length}</span></div>${list.map(t=>{const due=parseLocalDateTime(t.due),od=due&&due<Date.now()&&t.status!=='done',unread=taskUnread(t),canChange=taskCanChangeStatus(t),canEdit=taskCanEdit(t);return `<div class="task-card ${od?'overdue':''} ${unread?'task-unread':''}" data-task-open="${t.id}"><div class="task-card-title-row"><h4>${esc(t.title)}</h4>${unread?'<span class="tag warn">НОВАЯ</span>':''}</div><div class="task-description">${esc(t.description||'')}</div><div class="task-meta"><span>Исполнитель: ${esc(t.assignee||'Не назначено')}</span><span>${esc(formatDue(t.due))}</span></div><div class="task-card-footer-v13"><span class="tag neutral">${t.creatorId===currentUser.id?'Создано мной':t.assigneeId===currentUser.id?'Назначено мне':'Контроль команды'}</span>${canEdit?'<span class="task-edit-hint">Открыть / редактировать</span>':'<span class="task-edit-hint">Открыть</span>'}</div><div class="task-card-controls"><span class="muted">Статус</span><select data-task-status="${t.id}" ${canChange?'':'disabled'}><option value="todo" ${t.status==='todo'?'selected':''}>Новые</option><option value="progress" ${t.status==='progress'?'selected':''}>В работе</option><option value="done" ${t.status==='done'?'selected':''}>Выполнено</option></select></div></div>`}).join('')}</div>`}).join('');
  $$('[data-task-open]').forEach(el=>el.onclick=e=>{if(e.target.closest('select,option,button,a'))return;openTaskModal(el.dataset.taskOpen)});
  $$('[data-task-status]').forEach(sel=>sel.onchange=e=>{e.stopPropagation();const t=db.tasks.find(x=>x.id===sel.dataset.taskStatus);if(!t)return;if(!taskCanChangeStatus(t))return renderTasks();markReadBy(t,currentUser.id);t.status=sel.value;if(t.creatorId&&t.creatorId!==currentUser.id)addNotification(t.creatorId,'Статус задачи изменен',`${t.title} · ${sel.options[sel.selectedIndex].text}`,`task:${t.id}`);save();renderTasks();renderBadges();toast('Статус задачи изменен')});
}
function addTask(){openTaskModal()}
function taskAssignableUsers(){
  if(hasPerm('manageTasks'))return db.users.filter(u=>u.status==='active');
  return db.users.filter(u=>u.id===currentUser.id);
}
function renderTaskAssigneeOptions(selectedId=''){
  const sel=$('#taskAssignee');if(!sel)return;const qv=($('#taskAssigneeSearch')?.value||'').trim().toLowerCase();const users=taskAssignableUsers().filter(u=>!qv||`${u.name} ${u.dept} ${u.position} ${u.phone} ${u.email}`.toLowerCase().includes(qv));const current=selectedId||sel.value;sel.innerHTML=users.map(u=>`<option value="${u.id}">${esc(u.name)} · ${esc(u.dept||'')} · ${esc(u.position||roleNames[u.role])}</option>`).join('');if(users.some(u=>u.id===current))sel.value=current;
}
function openTaskModal(taskId=''){
  const task=taskId?db.tasks.find(t=>t.id===taskId):null;const isEdit=!!task;const canEdit=!task||taskCanEdit(task);const canDelegate=hasPerm('manageTasks')&&(currentUser.role==='superadmin'||!task||task.creatorId===currentUser.id);const canStatus=!task||taskCanChangeStatus(task);
  $('#taskForm').reset();$('#taskEditId').value=task?.id||'';$('#taskModalTitle').textContent=task?'Задача '+task.id:'Новая задача';$('#taskModalMeta').textContent=task?`Создал: ${db.users.find(u=>u.id===task.creatorId)?.name||'—'} · Исполнитель: ${task.assignee||'—'} · ${formatDue(task.due)}`:'Создание персональной или служебной задачи';
  renderTaskAssigneeOptions(task?.assigneeId||currentUser.id);$('#taskAssignee').value=task?.assigneeId||(canDelegate?(taskAssignableUsers()[0]?.id||currentUser.id):currentUser.id);$('#taskAssigneeSearch').classList.toggle('hidden',!canDelegate);$('#taskAssignee').disabled=!canDelegate;$('#taskAssigneeWrap').classList.toggle('readonly-task-assignee',!canDelegate);
  $('#taskTitle').value=task?.title||'';$('#taskDescription').value=task?.description||'';$('#taskDue').value=task?.due||'';$('#taskStatus').value=task?.status||'todo';
  ['taskTitle','taskDescription','taskDue'].forEach(id=>{$('#'+id).disabled=!canEdit});$('#taskStatus').disabled=!canStatus;
  $('#taskSaveBtn').textContent=task?(canEdit?'Сохранить изменения':'Сохранить статус'):'Создать задачу';$('#taskSaveBtn').classList.toggle('hidden',!(canEdit||canStatus));$('#taskDeleteBtn').classList.toggle('hidden',!(task&&canEdit));
  $('#taskPermissionHint').innerHTML=task?(canEdit?'<b>Редактирование разрешено.</b> Вы создали эту задачу или вошли как супер-администратор.':'<b>Просмотр задачи.</b> Вы можете менять только статус, если задача назначена вам.'):(canDelegate?'<b>Можно назначить задачу другому сотруднику.</b>':'<b>Личная задача.</b> Она будет назначена вам.');
  if(task)markTaskRead(task);$('#taskModal').classList.remove('hidden');
}
function saveTaskForm(){
  const id=$('#taskEditId').value,task=id?db.tasks.find(t=>t.id===id):null;
  if(task){
    const canEdit=taskCanEdit(task),canStatus=taskCanChangeStatus(task);if(!canEdit&&!canStatus)return toast('Нет прав на изменение задачи');
    if(canEdit){const aid=hasPerm('manageTasks')?$('#taskAssignee').value:task.assigneeId;const a=db.users.find(u=>u.id===aid)||db.users.find(u=>u.id===task.assigneeId)||currentUser;Object.assign(task,{title:$('#taskTitle').value.trim(),description:$('#taskDescription').value.trim(),due:$('#taskDue').value,assigneeId:a.id,assignee:a.name});}
    if(canStatus)task.status=$('#taskStatus').value;markReadBy(task,currentUser.id);save();closeModal('taskModal');renderAll();toast('Задача сохранена');return;
  }
  const canDelegate=hasPerm('manageTasks'),aid=canDelegate?$('#taskAssignee').value:currentUser.id,a=db.users.find(u=>u.id===aid)||currentUser;const newTask={id:'T-'+String(Date.now()).slice(-6),title:$('#taskTitle').value.trim(),description:$('#taskDescription').value.trim(),status:$('#taskStatus').value||'todo',assigneeId:a.id,assignee:a.name,creatorId:currentUser.id,due:$('#taskDue').value,readBy:[currentUser.id]};db.tasks.unshift(newTask);if(a.id!==currentUser.id)addNotification(a.id,'Новая задача от '+currentUser.name,`${newTask.title}${newTask.due?' · срок '+formatDue(newTask.due):''}`,`task:${newTask.id}`);save();closeModal('taskModal');renderAll();toast('Задача создана');playNotificationSound();
}
function deleteCurrentTask(){const id=$('#taskEditId').value,task=db.tasks.find(t=>t.id===id);if(!task||!taskCanEdit(task))return;if(!confirm(`Удалить задачу ${task.id}?`))return;db.tasks=db.tasks.filter(t=>t.id!==id);save();closeModal('taskModal');renderAll();toast('Задача удалена')}

function renderContactCenter(){
  const grid=$("#channelGrid"); if(!grid) return;
  const channels=[
    {icon:"🌐",name:"Web CRM",desc:"Заявки из формы внутри CRM.",state:"Подключено",ok:true,action:"Создать заявку"},
    {icon:"🟢",name:"WhatsApp",desc:"Ответ клиенту через WhatsApp и будущая автоматическая маршрутизация.",state:"Требуется Business API",ok:false,action:"Открыть WhatsApp"},
    {icon:"✈️",name:"Telegram",desc:"Уведомления инженерам и ответы сотруднику через Telegram Bot.",state:"Требуется Bot API",ok:false,action:"Настроить"},
    {icon:"✉️",name:"E-mail",desc:"Google / Яндекс / Mail.ru / Microsoft Outlook через OAuth и почтовый шлюз.",state:"Настройка доступна",ok:false,action:"Открыть настройки"},
    {icon:"☎️",name:"Телефон",desc:"Карточка звонка и быстрый переход к контакту пользователя.",state:"Ручной режим",ok:false,action:"Контакты"},
    {icon:"🤖",name:"AI маршрутизация",desc:"Классификация категории, приоритета и подсказки инженеру.",state:"Локально активно",ok:true,action:"Открыть AI"}
  ];
  grid.innerHTML=channels.map((c,i)=>`<div class="channel-card">
    <div class="channel-card-top"><div class="channel-icon">${c.icon}</div><div><h4>${c.name}</h4><span class="tag ${c.ok?"ok":"warn"}">${c.state}</span></div></div>
    <p>${c.desc}</p><div class="channel-actions"><button class="btn soft" data-channel-action="${i}">${c.action}</button></div>
  </div>`).join("");
  $$("[data-channel-action]").forEach(btn=>btn.onclick=()=>{
    const i=Number(btn.dataset.channelAction);
    if(i===0) setView("create");
    else if(i===1) window.open("https://wa.me/77779712555","_blank");
    else if(i===3) setView("integrations");
    else if(i===5) setView("assistant");
    else toast("Для реального канала потребуется серверная интеграция API.");
  });
}



async function setOwnStatus(status){if(!['available','busy','away','dnd'].includes(status))return;currentUser.workStatus=status;const u=db.users.find(x=>x.id===currentUser.id);u.workStatus=status;if(!await save())return;renderAll();toast(`Статус: ${workStatusName(status)}`)}
function cycleOwnStatus(){
  if(!currentUser||$('#workStatusChooser'))return;
  const overlay=document.createElement('div');overlay.id='workStatusChooser';overlay.className='ai-dialog';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','Мой статус');overlay.setAttribute('aria-modal','true');
  overlay.innerHTML='<article><h2>Мой статус</h2><p>Выберите, доступны ли вы сейчас.</p><div class="status-choices">'+['available','busy','away','dnd'].map(s=>`<button type="button" class="btn ${currentUser.workStatus===s?'primary':'soft'}" data-status-choice="${s}">${workStatusName(s)}</button>`).join('')+'</div><button type="button" class="btn soft" data-close>Закрыть</button></article>';
  document.body.appendChild(overlay);overlay.querySelector('[data-close]').onclick=()=>overlay.remove();overlay.querySelectorAll('[data-status-choice]').forEach(b=>b.onclick=()=>{setOwnStatus(b.dataset.statusChoice);overlay.remove()});
}
function renderNotifications(){if(!currentUser)return;const items=(db.notifications||[]).filter(n=>n.recipientId===currentUser.id),unread=items.filter(n=>!n.read).length,badge=$('#notificationBadge');if(badge){badge.textContent=unread;badge.classList.toggle('hidden',unread===0)}const list=$('#notificationList');if(list)list.innerHTML=items.length?items.slice(0,30).map(n=>`<div class="notification-item ${n.read?'':'unread'}" data-notification="${n.id}" data-ticket-ref="${n.ticketId||''}"><b>${esc(n.title)}</b><p>${esc(n.text)}</p><time>${esc(n.date)}</time></div>`).join(''):'<div class="chat-info-empty">Новых уведомлений нет.</div>';$$('[data-notification]').forEach(el=>el.onclick=()=>{const n=db.notifications.find(x=>x.id===el.dataset.notification);if(!n)return;n.read=true;save();renderNotifications();const ref=el.dataset.ticketRef||'';if(ref.startsWith('dm:')){setView('chats');setChatMode('people');selectDirectChat(ref.slice(3),false)}else if(ref.startsWith('task:')){const t=db.tasks.find(x=>x.id===ref.slice(5));setView('tasks');if(t)markTaskRead(t)}else if(ref)openTicket(ref);renderBadges()});const st=$('#workspaceStatusText'),dot=$('#workspaceStatusDot');if(st)st.textContent=workStatusName(currentUser.workStatus);if(dot)dot.className=`st ${currentUser.workStatus||'available'}`}
function markAllNotificationsRead(){(db.notifications||[]).filter(n=>n.recipientId===currentUser.id).forEach(n=>n.read=true);save();renderNotifications()}

function renderProfile(){if(!currentUser)return;const u=db.users.find(x=>x.id===currentUser.id)||currentUser;currentUser=u;$('#profileName').textContent=u.name;$('#profilePosition').textContent=u.position||roleNames[u.role];$('#profileDeptBadge').textContent=u.dept||'Без подразделения';const av=$('#profileAvatarLarge');av.textContent=u.photo?'':initials(u.name);av.style.backgroundImage=u.photo?`url('${u.photo}')`:'';const cover=$('#profileCover');cover.style.backgroundImage=u.backgroundImage?`linear-gradient(0deg,rgba(1,12,23,.55),rgba(1,12,23,.08)),url('${u.backgroundImage}')`:'';$('#profileInfo').innerHTML=`<div class="profile-info-grid"><span>ФИО</span><b>${esc(u.name)}</b><span>Роль</span><b>${esc(roleNames[u.role])}</b><span>Должность</span><b>${esc(u.position||'—')}</b><span>E-mail</span><b>${esc(u.email||'—')}</b><span>Телефон</span><b>${esc(u.phone||'—')}</b><span>Подразделение</span><b>${esc(u.dept||'—')}</b><span>Локация</span><b>${esc(u.location||'—')}</b></div>`;$('#profileAbout').textContent=[u.about,u.degree,u.education?'Образование: '+u.education:''].filter(Boolean).join('\n\n')||'Информация пока не заполнена.';$('#profileInterests').innerHTML=(u.interests||[]).length?u.interests.map(x=>`<span>#${esc(x)}</span>`).join(''):'<span>Добавьте навыки и интересы</span>';const ps=$('#profileStatusBtn');ps.innerHTML=`<i class="st ${u.workStatus||'available'}"></i><span>${workStatusName(u.workStatus)}</span>`;$('#profileThemeSelect').value=u.theme||'dark'}
function openProfileEdit(){const u=currentUser;$('#editProfileName').value=u.name||'';$('#editProfilePosition').value=u.position||'';$('#editProfileEmail').value=u.email||'';$('#editProfilePhone').value=u.phone||'';$('#editProfileDept').value=u.dept||'';$('#editProfileLocation').value=u.location||'';$('#editProfileAbout').value=u.about||'';$('#editProfileInterests').value=(u.interests||[]).join(', ');$('#profileEditModal').classList.remove('hidden')}
async function saveProfileForm(){const u=db.users.find(x=>x.id===currentUser.id);u.name=$('#editProfileName').value.trim();u.position=$('#editProfilePosition').value.trim();u.email=$('#editProfileEmail').value.trim();u.phone=$('#editProfilePhone').value.trim();u.dept=$('#editProfileDept').value.trim();u.location=$('#editProfileLocation').value.trim();u.about=$('#editProfileAbout').value.trim();u.interests=$('#editProfileInterests').value.split(',').map(x=>x.trim()).filter(Boolean);currentUser=u;if(!await save())return;closeModal('profileEditModal');renderProfile();toast('Профиль обновлен')}

function openChatWithUser(userId){if(!currentUser||userId===currentUser.id){setView('profile');return}closeModal('personCardModal');setView('chats');setChatMode('people');startDirectChat(userId)}
function openPersonCard(userId){
  const u=db.users.find(x=>x.id===userId);if(!u)return;const photo=u.photo?`<img src="${u.photo}" alt="${esc(u.name)}">`:`<div class="profile-avatar-large">${initials(u.name)}</div>`;
  const openTickets=db.tickets.filter(t=>t.engineerId===u.id&&!['done','closed'].includes(t.status)).length,overdue=db.tickets.filter(t=>t.engineerId===u.id&&isTicketOverdue(t)).length,ownTasks=db.tasks.filter(t=>t.assigneeId===u.id&&t.status!=='done').length;const showWorkStats=['superadmin','admin','engineer'].includes(currentUser.role)&&['engineer','superadmin'].includes(u.role);
  $('#personCardTitle').textContent=u.name;$('#personCardContent').innerHTML=`<div class="person-card-layout"><div class="person-card-photo">${photo}</div><div class="person-card-details"><div><h2>${esc(u.name)}</h2><p class="person-position">${esc(u.position||roleNames[u.role])}</p></div><div class="person-links person-card-actions">${u.id!==currentUser.id?`<button class="btn primary" id="personStartChatBtn">💬 Написать в чат</button>`:`<button class="btn primary" id="personOwnProfileBtn">Мой профиль</button>`}${u.phone?`<a class="btn soft" href="tel:${esc(u.phone)}">☎ Позвонить</a><a class="btn soft" target="_blank" rel="noopener" href="https://wa.me/${normalizePhone(u.phone)}">WhatsApp</a>`:''}${u.email?`<a class="btn soft" href="mailto:${esc(u.email)}">✉ E-mail</a>`:''}</div><div class="person-contact-list"><div><span>Должность</span><b>${esc(u.position||roleNames[u.role])}</b></div><div><span>Подразделение</span><b>${esc(u.dept||'—')}</b></div><div><span>Рабочий статус</span><b><i class="st ${u.workStatus||'available'}"></i> ${esc(workStatusName(u.workStatus))}</b></div><div><span>Телефон</span><b>${esc(u.phone||'—')}</b></div><div><span>E-mail</span><b>${esc(u.email||'—')}</b></div><div><span>Локация</span><b>${esc(u.location||'—')}</b></div></div>${u.education?`<div class="panel-like"><b>Образование</b><p>${esc(u.education)}</p>${u.degree?`<p><b>${esc(u.degree)}</b></p>`:''}</div>`:''}${showWorkStats?`<div class="person-card-stats"><div class="person-stat"><span>Открытые заявки</span><b>${openTickets}</b></div><div class="person-stat"><span>Просрочено</span><b>${overdue}</b></div><div class="person-stat"><span>Задачи</span><b>${ownTasks}</b></div></div>`:''}${u.about?`<div class="panel-like"><b>О сотруднике</b><p class="muted">${esc(u.about)}</p></div>`:''}${(u.interests||[]).length?`<div class="profile-interests">${u.interests.map(x=>`<span>#${esc(x)}</span>`).join('')}</div>`:''}</div></div>`;$('#personCardModal').classList.remove('hidden');if($('#personStartChatBtn'))$('#personStartChatBtn').onclick=()=>openChatWithUser(u.id);if($('#personOwnProfileBtn'))$('#personOwnProfileBtn').onclick=()=>{closeModal('personCardModal');setView('profile')}
}
function renderDirectory(){
  const grid=$('#directoryGrid');if(!grid)return;let users=[...db.users];const qv=($('#directorySearch')?.value||'').trim().toLowerCase(),sf=$('#directoryStatusFilter')?.value||'',rf=$('#directoryRoleFilter')?.value||'';if(qv)users=users.filter(u=>`${u.name} ${u.login} ${u.dept} ${u.position} ${u.email} ${u.phone}`.toLowerCase().includes(qv));if(sf)users=users.filter(u=>u.status===sf);if(rf)users=users.filter(u=>u.role===rf);users.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ru',{sensitivity:'base'}));const summary=$('#directorySummary');if(summary){const engineerCount=techStaff().length;summary.innerHTML=`<span>Всего: <b>${db.users.length}</b></span><span>Активных: <b>${db.users.filter(u=>u.status==='active').length}</b></span><span>Новые регистрации: <b>${db.users.filter(u=>u.status==='pending').length}</b></span><span>Инженеры: <b>${engineerCount}</b></span>`;}
  grid.innerHTML=users.map(u=>{const photo=u.photo?`style="background-image:url('${u.photo}')"`:'';const status=u.status==='active'?`<span class="tag ok">Активен</span>`:u.status==='blocked'?`<span class="tag p1">Заблокирован</span>`:`<span class="tag warn">Новый</span>`;return `<div class="directory-card ${u.status==='pending'?'directory-new':''}" data-person-card="${u.id}"><div class="person-photo" data-person-card="${u.id}" ${photo}>${u.photo?'':initials(u.name)}</div><div class="person-meta"><div class="directory-name-line"><h4>${esc(u.name)}</h4>${status}</div><p><b>${esc(u.position||roleNames[u.role])}</b> · ${esc(roleNames[u.role])}</p><p>🏢 ${esc(u.dept||'Без подразделения')}</p><p>✉ ${esc(u.email||'—')}</p><p>☎ ${esc(u.phone||'Номер пока не указан')}</p>${u.education?`<p class="engineer-education"><b>Образование:</b> ${esc(u.education)}</p>`:''}${u.degree?`<p>${esc(u.degree)}</p>`:''}<div class="person-links"><span class="tag neutral"><i class="st ${u.workStatus||'available'}"></i>&nbsp;${workStatusName(u.workStatus)}</span>${u.id!==currentUser.id&&(currentUser.role!=='employee'||u.role!=='employee')?`<button class="mini-btn" data-directory-chat="${u.id}">💬 Чат</button>`:''}${u.phone?`<a class="mini-btn" href="tel:${esc(u.phone)}">Позвонить</a><a class="mini-btn" target="_blank" rel="noopener" href="https://wa.me/${normalizePhone(u.phone)}">WhatsApp</a>`:''}${u.email?`<a class="mini-btn" href="mailto:${esc(u.email)}">E-mail</a>`:''}${currentUser?.role==='superadmin'?`<button class="mini-btn" data-directory-edit="${u.id}">Редактировать</button><button class="mini-btn" data-directory-reset="${u.id}">Сбросить пароль</button>`:''}</div></div></div>`}).join('')||'<div class="chat-info-empty">Сотрудники не найдены.</div>';
  $$('[data-directory-reset]').forEach(b=>b.onclick=e=>{e.stopPropagation();resetUserPassword(b.dataset.directoryReset)});$$('[data-directory-edit]').forEach(b=>b.onclick=e=>{e.stopPropagation();openAccountEdit(b.dataset.directoryEdit)});$$('[data-directory-chat]').forEach(b=>b.onclick=e=>{e.stopPropagation();openChatWithUser(b.dataset.directoryChat)});$$('#directoryGrid [data-person-card]').forEach(el=>el.onclick=e=>{if(e.target.closest('button,a,input,select'))return;openPersonCard(el.dataset.personCard)});
}
function renderDepartments(){
  const grid=$('#departmentGrid');if(!grid)return;const canManage=canManageDepartments();
  grid.innerHTML=(db.departments||[]).map(d=>{const head=db.users.find(u=>u.id===d.headId);let members=db.users.filter(u=>u.deptId===d.id||u.dept===d.name);if(!members.length&&d.id==='dept-digital')members=db.users.filter(u=>u.deptId==='dept-digital'||u.dept===db.settings.departmentName);members=members.sort((a,b)=>a.name.localeCompare(b.name,'ru'));const outsiders=db.users.filter(u=>u.status==='active'&&!members.some(m=>m.id===u.id));return `<div class="department-card department-card-v13"><div class="department-title-row"><div><h4>${esc(d.name)}</h4><p class="muted">Сотрудников: ${members.length}</p></div><div class="department-title-actions">${head?`<span class="tag ok">Руководитель: ${esc(head.name)}</span>`:''}${canManage?`<button class="mini-btn" data-dept-edit="${d.id}">Редактировать</button><button class="mini-btn danger-mini" data-dept-delete="${d.id}">Удалить</button>`:''}</div></div>${canManage?`<div class="department-admin-grid"><label>Руководитель<select data-dept-head="${d.id}"><option value="">— не назначен —</option>${db.users.filter(u=>u.status==='active').map(u=>`<option value="${u.id}" ${u.id===d.headId?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label><label>Добавить сотрудника<select data-dept-add="${d.id}"><option value="">— выбрать сотрудника —</option>${outsiders.map(u=>`<option value="${u.id}">${esc(u.name)} · ${esc(u.dept||'Без отдела')}</option>`).join('')}</select></label></div>`:''}<div class="department-members">${members.map(u=>`<div class="department-member-row"><button class="department-member" type="button" data-dept-person="${u.id}"><span class="department-member-avatar" ${u.photo?`style="background-image:url('${u.photo}')"`:''}>${u.photo?'':initials(u.name)}</span><span><b>${esc(u.name)}</b><small>${esc(u.position||roleNames[u.role])}</small></span></button>${canManage?`<select class="department-move-select" data-dept-move-user="${u.id}"><option value="${d.id}">${esc(d.name)}</option>${db.departments.filter(x=>x.id!==d.id).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}<option value="">Без подразделения</option></select>`:''}</div>`).join('')||'<span class="muted">Сотрудники не добавлены.</span>'}</div></div>`}).join('');
  $$('[data-dept-head]').forEach(s=>s.onchange=()=>{if(!canManageDepartments())return;const d=db.departments.find(x=>x.id===s.dataset.deptHead);d.headId=s.value;save();renderDepartments();toast('Руководитель подразделения назначен')});
  $$('[data-dept-person]').forEach(b=>b.onclick=()=>openPersonCard(b.dataset.deptPerson));
  $$('[data-dept-add]').forEach(s=>s.onchange=()=>{if(!s.value)return;moveUserToDepartment(s.value,s.dataset.deptAdd)});
  $$('[data-dept-move-user]').forEach(s=>s.onchange=()=>moveUserToDepartment(s.dataset.deptMoveUser,s.value));
  $$('[data-dept-edit]').forEach(b=>b.onclick=()=>editDepartment(b.dataset.deptEdit));$$('[data-dept-delete]').forEach(b=>b.onclick=()=>deleteDepartment(b.dataset.deptDelete));
}
function addDepartment(){if(!canManageDepartments())return toast('Нет права управления подразделениями');const name=prompt('Название подразделения:');if(!name?.trim())return;db.departments.push({id:'dept-'+Date.now(),name:name.trim(),headId:''});save();renderDepartments();toast('Подразделение создано')}
function editDepartment(id){if(!canManageDepartments())return;const d=db.departments.find(x=>x.id===id);if(!d)return;const old=d.name,name=prompt('Новое название подразделения:',d.name);if(!name?.trim()||name.trim()===old)return;d.name=name.trim();db.users.filter(u=>u.deptId===d.id||u.dept===old).forEach(u=>{u.deptId=d.id;u.dept=d.name});if(db.settings.departmentName===old)db.settings.departmentName=d.name;save();renderAll();toast('Подразделение переименовано')}
function deleteDepartment(id){if(!canManageDepartments())return;const d=db.departments.find(x=>x.id===id);if(!d)return;if(!confirm(`Удалить подразделение «${d.name}»? Сотрудники останутся без подразделения.`))return;db.users.filter(u=>u.deptId===id||u.dept===d.name).forEach(u=>{u.deptId='';u.dept=''});db.departments=db.departments.filter(x=>x.id!==id);save();renderAll();toast('Подразделение удалено')}
function moveUserToDepartment(userId,deptId){if(!canManageDepartments())return toast('Нет права перемещения сотрудников');const u=db.users.find(x=>x.id===userId);if(!u)return;const d=db.departments.find(x=>x.id===deptId);u.deptId=d?.id||'';u.dept=d?.name||'';save();renderAll();toast(`${u.name}: ${d?.name||'без подразделения'}`)}

function renderAnalytics(){const ts=db.tickets;const metrics=$('#analyticsMetrics');if(!metrics)return;const overdue=ts.filter(isTicketOverdue).length,open=ts.filter(t=>!['done','closed'].includes(t.status)).length,done=ts.filter(t=>['done','closed'].includes(t.status)).length;metrics.innerHTML=[[open,'Открыто'],[overdue,'Просрочено'],[done,'Выполнено'],[techStaff().filter(u=>u.workStatus==='available').length,'Инженеров доступно']].map(([v,l])=>`<div class="metric"><span>${l}</span><strong>${v}</strong></div>`).join('');const eng=$('#analyticsEngineerBars');const max=Math.max(1,...techStaff().map(e=>ts.filter(t=>t.engineerId===e.id&&!['done','closed'].includes(t.status)).length));eng.innerHTML=techStaff().map(e=>{const c=ts.filter(t=>t.engineerId===e.id&&!['done','closed'].includes(t.status)).length;const od=ts.filter(t=>t.engineerId===e.id&&isTicketOverdue(t)).length;return `<div class="analytics-bar"><div class="analytics-bar-head"><span>${esc(e.name)}</span><b>${c} / проср. ${od}</b></div><div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${c/max*100}%"></div></div></div>`}).join('');const cats=categories.map(c=>[c,ts.filter(t=>t.category===c).length]).filter(x=>x[1]);const cm=Math.max(1,...cats.map(x=>x[1]));$('#analyticsCategoryBars').innerHTML=cats.map(([c,n])=>`<div class="analytics-bar"><div class="analytics-bar-head"><span>${esc(c)}</span><b>${n}</b></div><div class="analytics-bar-track"><div class="analytics-bar-fill" style="width:${n/cm*100}%"></div></div></div>`).join('')}
function renderMailbox(){const list=$('#mailList');if(!list)return;let msgs=db.mailMessages||[];const qv=($('#mailSearch')?.value||'').trim().toLowerCase();if(qv)msgs=msgs.filter(m=>`${m.from} ${m.subject} ${m.body}`.toLowerCase().includes(qv));list.innerHTML=msgs.map(m=>`<div class="mail-row" data-mail="${m.id}"><h4>${esc(m.subject)}</h4><p>${esc(m.from)} · ${esc(m.preview)}</p><p>${esc(m.date)}</p></div>`).join('');$('#mailInboxCount').textContent=msgs.length;const ma=db.integrations?.mail||{};$('#mailAccountsMini').innerHTML=['google','yandex','mailru','outlook'].map(p=>`<div class="mail-account-mini">${p.toUpperCase()}: ${esc(ma[p]?.email||'не подключено')}</div>`).join('');$$('[data-mail]').forEach(r=>r.onclick=()=>{const m=db.mailMessages.find(x=>x.id===r.dataset.mail);$('#mailReader').innerHTML=`<div class="mail-reader-head"><span class="tag neutral">${esc(m.provider)}</span><h2>${esc(m.subject)}</h2><p class="muted">От: ${esc(m.from)} · ${esc(m.date)}</p></div><div class="mail-reader-body">${esc(m.body)}</div><div class="form-actions" style="justify-content:flex-start"><a class="btn primary" href="mailto:${encodeURIComponent(m.from)}?subject=${encodeURIComponent('Re: '+m.subject)}">Ответить</a><button class="btn soft" data-jump="create">Создать заявку</button></div>`;$('#mailReader [data-jump]').onclick=()=>setView('create')})}
function renderSecurityPolicy(){const e=$('#securityPolicyContent');if(!e)return;const cards=[['1. Управление доступом',['Роли: супер-администратор, администратор, инженер, сотрудник.','Пользователь видит только собственные заявки и личные задачи.','Супер-администратор управляет учетными записями, назначениями и сроками SLA.']],['2. Аутентификация',['Сервер хранит хеши паролей инженеров; первичные пароли доступны администратору в закрытом файле.','Используются серверные сессии. Для работы в сети настройте HTTPS; MFA в этой версии нет.','Неактивные учетные записи блокируются.']],['3. API и секреты',['Токены GREEN-API хранятся только в конфигурации сервера.','При входе только по ФИО личность не подтверждается: этот режим предназначен для доверенной внутренней сети.','Постоянный приём выполняется сервером; права проверяются для каждой сессии.']],['4. Журналирование',['Фиксировать входы, создание и изменение заявок, назначение инженера, смену SLA и ролей.','Логи защищаются от изменения и хранятся согласно внутреннему регламенту.']],['5. Защита данных',['Не размещать медицинские данные пациента в заявках без служебной необходимости.','Ограничить вложения, проверять тип и размер файлов.','Резервное копирование БД и вложений — по регламенту организации.']],['6. SLA и контроль',['Срок заявки устанавливается ответственным лицом.','Просрочки отображаются в аналитике и отчетах.','Руководителю может формироваться уведомление о нарушении SLA.']],['7. Рабочие устройства',['Автоблокировка экрана, обновления ОС и браузера, антивирус/EDR.','Доступ извне только через защищенный VPN/Zero Trust по политике организации.']],['8. Конфиденциальность служебных чатов',['Сотрудники переписываются напрямую и в чатах заявок.','Доступ уполномоченного администратора к чужой служебной переписке должен быть предусмотрен внутренней политикой организации и журналироваться.','Скрытый или незафиксированный просмотр переписки не используется.']],['9. Производственное внедрение',['HTML LocalStorage версия является демонстрационной.','Для реальной эксплуатации: централизованная БД, backend API, HTTPS, RBAC на сервере, резервирование и мониторинг.']]];e.innerHTML=`<div class="policy-grid">${cards.map(([h,a])=>`<div class="policy-card"><h4>${h}</h4><ul>${a.map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>`}
function renderSettings(){
  if(!$('#settingOrgName'))return;const s=db.settings||seed.settings;
  $('#settingOrgName').value=s.organizationName;$('#settingOrgShort').value=s.organizationShort;$('#settingDepartmentName').value=s.departmentName;
  $('#settingSoundEnabled').checked=s.soundEnabled!==false;$('#settingSlaCheck').value=String(s.slaCheckMinutes||1);
  if($('#settingLoginLogoSize'))$('#settingLoginLogoSize').value=Number(s.loginLogoSize||320);
  if($('#settingLoginLogoHeight'))$('#settingLoginLogoHeight').value=Number(s.loginLogoHeight||240);
  if($('#settingLoginLogoOffsetY'))$('#settingLoginLogoOffsetY').value=Number(s.loginLogoOffsetY||0);
  if($('#settingLoginLeftWidth'))$('#settingLoginLeftWidth').value=Number(s.loginLeftWidth||58);
  if($('#loginLogoSizeValue'))$('#loginLogoSizeValue').textContent=`${Number(s.loginLogoSize||320)} px`;
  if($('#loginLogoHeightValue'))$('#loginLogoHeightValue').textContent=`${Number(s.loginLogoHeight||240)} px`;
  if($('#loginLogoOffsetYValue'))$('#loginLogoOffsetYValue').textContent=`${Number(s.loginLogoOffsetY||0)} px`;
  if($('#loginLeftWidthValue'))$('#loginLeftWidthValue').textContent=`${Number(s.loginLeftWidth||58)}%`;
  if($('#loginLiveImage'))$('#loginLiveImage').src=s.loginHeroImage||'assets/kazior-logo.png';
  if($('#loginLiveOrg'))$('#loginLiveOrg').textContent=s.organizationName;
  renderDbStats()
}
function saveLoginDesign(){if(currentUser?.role!=='superadmin')return toast('Только супер-администратор может менять страницу входа');db.settings.loginLogoSize=Number($('#settingLoginLogoSize').value||320);db.settings.loginLogoHeight=Number($('#settingLoginLogoHeight').value||240);db.settings.loginLogoOffsetY=Number($('#settingLoginLogoOffsetY').value||0);db.settings.loginLeftWidth=Number($('#settingLoginLeftWidth').value||58);save();renderBranding();renderSettings();toast('Оформление страницы входа сохранено')}
function resetLoginDesign(){if(currentUser?.role!=='superadmin')return;db.settings.loginHeroImage='assets/kazior-logo.png';db.settings.loginLogoSize=320;db.settings.loginLogoHeight=240;db.settings.loginLogoOffsetY=0;db.settings.loginLeftWidth=58;save();renderBranding();renderSettings();toast('Возвращено стандартное оформление КазНИИОиР')}
function setLoginHeroImage(file){if(currentUser?.role!=='superadmin'||!file)return;if(!String(file.type||'').startsWith('image/'))return toast('Выберите изображение');if(file.size>2.5*1024*1024)return toast('Максимальный размер изображения 2,5 МБ');readImageFile(file,data=>{db.settings.loginHeroImage=data;save();renderBranding();renderSettings();toast('Изображение страницы входа обновлено')})}
function saveBranding(){db.settings.organizationName=$('#settingOrgName').value.trim()||seed.settings.organizationName;db.settings.organizationShort=$('#settingOrgShort').value.trim()||'КазНИИОиР';db.settings.departmentName=$('#settingDepartmentName').value.trim()||'Отдел Цифровизации';save();renderBranding();renderDashboardRole();toast('Название организации обновлено')}
function saveSoundSettings(){db.settings.soundEnabled=$('#settingSoundEnabled').checked;db.settings.slaCheckMinutes=Number($('#settingSlaCheck').value||1);save()}

const WA_TOKEN_SESSION_KEY="its24_green_api_token";
const WA_DEFAULT_API_TOKEN="";

function getWaSettings(){
  db.integrations=db.integrations||JSON.parse(JSON.stringify(seed.integrations));
  db.integrations.whatsapp=db.integrations.whatsapp||JSON.parse(JSON.stringify(seed.integrations.whatsapp));
  return db.integrations.whatsapp;
}
function getWaToken(){return sessionStorage.getItem(WA_TOKEN_SESSION_KEY)||WA_DEFAULT_API_TOKEN}
function normalizePhone(phone){return String(phone||"").replace(/\D/g,"")}
function waChatId(phone){const n=normalizePhone(phone);return n?`${n}@c.us`:""}
function priorityText(p){return ({P1:"Критический",P2:"Высокий",P3:"Средний",P4:"Низкий"})[p]||p}
function addIntegrationLog(kind,text,ok=true){
  db.integrations=db.integrations||JSON.parse(JSON.stringify(seed.integrations));
  db.integrations.log=db.integrations.log||[];
  db.integrations.log.unshift({id:Date.now(),kind,text,ok,date:now()});
  db.integrations.log=db.integrations.log.slice(0,50);
  save();
  renderIntegrationLog();
}
function renderIntegrationLog(){
  const el=$("#integrationLog");if(!el)return;
  const log=(db.integrations?.log||[]);
  el.innerHTML=log.length?log.map(item=>`<div class="integration-log-item">
    <div class="integration-log-item-head"><b>${esc(item.kind)}</b><span>${esc(item.date)}</span></div>
    <p>${esc(item.text)}</p>
    <div style="margin-top:6px"><span class="tag ${item.ok?"ok":"warn"}">${item.ok?"Успешно":"Ошибка"}</span></div>
  </div>`).join(""):`<div class="chat-info-empty">Журнал пока пуст.</div>`;
}
function renderIntegrations(){
  const s=getWaSettings();
  renderIncomingSettings();
  const map=[
    ["#waApiUrl",s.apiUrl],["#waIdInstance",s.idInstance],["#waNotifyNumber",s.notifyNumber],["#waTestNumber",s.testNumber],
    ["#mailGoogleEmail",db.integrations?.mail?.google?.email||""],["#mailGoogleClientId",db.integrations?.mail?.google?.clientId||""],
    ["#mailYandexEmail",db.integrations?.mail?.yandex?.email||""],["#mailYandexClientId",db.integrations?.mail?.yandex?.clientId||""],
    ["#mailMailruEmail",db.integrations?.mail?.mailru?.email||""],["#mailMailruClientId",db.integrations?.mail?.mailru?.clientId||""],
    ["#mailOutlookEmail",db.integrations?.mail?.outlook?.email||""],["#mailOutlookClientId",db.integrations?.mail?.outlook?.clientId||""]
  ];
  map.forEach(([sel,val])=>{const el=$(sel);if(el&&document.activeElement!==el)el.value=val||""});
  if($("#waApiToken")&&document.activeElement!==$("#waApiToken")) $("#waApiToken").value=getWaToken();
  if($("#waNotifyNew"))$("#waNotifyNew").checked=s.notifyNew!==false;
  if($("#waNotifyReply"))$("#waNotifyReply").checked=s.notifyReply!==false;
  if($("#waNotifyStatus"))$("#waNotifyStatus").checked=s.notifyStatus!==false;
  const configured=s.receiveMode==='server'?!!(s.bridgeUrl&&getBridgeKey()):!!(s.idInstance&&getWaToken());
  const hero=$("#waHeroStatus");
  if(hero){hero.textContent=configured?"WhatsApp настроен":"WhatsApp требует токен";hero.className=`tag ${configured?"ok":"warn"}`}
  const badge=$("#integrationBadge");if(badge){badge.classList.toggle("hidden",configured);badge.textContent="!"}
  renderIntegrationLog();
}
function saveWaSettings(){
  const s=getWaSettings();
  s.apiUrl=($("#waApiUrl").value.trim()||"https://api.green-api.com").replace(/\/+$/,"");
  s.idInstance=$("#waIdInstance").value.trim();
  s.notifyNumber=$("#waNotifyNumber").value.trim();
  s.testNumber=$("#waTestNumber").value.trim();
  s.notifyNew=$("#waNotifyNew").checked;
  s.notifyReply=$("#waNotifyReply").checked;
  s.notifyStatus=$("#waNotifyStatus").checked;
  s.receiveMode=$('#waReceiveMode').value;
  s.bridgeUrl=$('#waBridgeUrl').value.trim().replace(/\/+$/,'');
  const bridgeKey=$('#waBridgeKey').value.trim();
  if(bridgeKey)sessionStorage.setItem('its24_wa_bridge_key',bridgeKey);else sessionStorage.removeItem('its24_wa_bridge_key');
  const token=$("#waApiToken").value.trim();
  if(token) sessionStorage.setItem(WA_TOKEN_SESSION_KEY,token);
  else sessionStorage.removeItem(WA_TOKEN_SESSION_KEY);
  stopWhatsAppReceiving(false);
  s.incomingEnabled=false;
  save();
  renderIntegrations();
  addIntegrationLog("WhatsApp","Настройки GREEN-API сохранены для текущей сессии.",true);
  toast("Настройки WhatsApp сохранены");
}
async function greenApiRequest(methodName,method="GET",body=null,suffix=""){
  // GitHub Pages demo: never sends credentials or messages to a real provider.
  await new Promise(r=>setTimeout(r,180));
  if(methodName==='getStateInstance')return {stateInstance:'authorized'};
  if(methodName==='sendMessage')return {idMessage:'DEMO-'+Date.now()};
  if(methodName==='setSettings')return {saveSettings:true};
  if(methodName==='receiveNotification')return null;
  return {ok:true,demo:true};
}
async function checkWhatsAppConnection(){
  try{
    saveWaSettings();
    $("#waConnectionStatus").textContent="Проверка…";$("#waConnectionStatus").className="tag neutral";
    const data=await greenApiRequest("getStateInstance","GET");
    const state=data.stateInstance||"unknown";
    const ok=state==="authorized";
    $("#waConnectionStatus").textContent=ok?"Авторизован":state;
    $("#waConnectionStatus").className=`tag ${ok?"ok":"warn"}`;
    addIntegrationLog("WhatsApp",`Состояние инстанса: ${state}.`,ok);
    toast(ok?"WhatsApp подключен":"Инстанс не авторизован");
  }catch(err){
    $("#waConnectionStatus").textContent="Ошибка";$("#waConnectionStatus").className="tag warn";
    addIntegrationLog("WhatsApp",`Ошибка проверки: ${err.message}`,false);
    toast(`WhatsApp: ${err.message}`);
  }
}
async function sendGreenApiMessage(phone,message,logKind="WhatsApp"){
  const chatId=waChatId(phone);
  if(!chatId) throw new Error("Не указан номер WhatsApp");
  const data=await greenApiRequest("sendMessage","POST",{chatId,message});
  addIntegrationLog(logKind,`Сообщение отправлено на ${normalizePhone(phone)}${data?.idMessage?` · ${data.idMessage}`:""}`,true);
  return data;
}
function formatNewTicketWhatsApp(t){
  return `🔔 Новая заявка CRM

№ ${t.id}
Заявитель/врач: ${t.ownerName||"—"}
Источник: ${t.source||"Web"}
Категория: ${t.category||"Другое"}
Приоритет: ${priorityText(t.priority)}
Отдел: ${t.dept||"—"}
Кабинет: ${t.room||"—"}
Телефон: ${normalizePhone(t.phone)?`+${normalizePhone(t.phone)}`:"—"}

Тема: ${t.subject||"—"}

Описание:
${t.description||"—"}`;
}
function formatReplyWhatsApp(t,text){
  return `💬 Ответ по заявке ${t.id}

Тема: ${t.subject}

${text}

Статус: ${statusName(t.status)}
IT-System-Solution
www.its24.kz`;
}
function formatStatusWhatsApp(t){
  return `🔔 Статус заявки изменен

№ ${t.id}
Тема: ${t.subject}
Новый статус: ${statusName(t.status)}
Инженер: ${t.engineerName||"Не назначен"}

IT-System-Solution`;
}
async function notifyNewTicketWhatsApp(t){
  const s=getWaSettings();
  if(!s.notifyNew||!waCanSend()||!s.notifyNumber)return;
  try{await sendGreenApiMessage(s.notifyNumber,formatNewTicketWhatsApp(t),"Новая заявка")}
  catch(err){addIntegrationLog("Новая заявка",`Не отправлено: ${err.message}`,false);toast(`WhatsApp не отправлен: ${err.message}`)}
}
async function notifyReplyWhatsApp(t,text){
  const s=getWaSettings();
  if(!s.notifyReply||!waCanSend()||!t.phone)return;
  try{await sendGreenApiMessage(t.phone,formatReplyWhatsApp(t,text),"Ответ сотруднику")}
  catch(err){addIntegrationLog("Ответ сотруднику",`Не отправлено: ${err.message}`,false)}
}
async function notifyStatusWhatsApp(t){
  const s=getWaSettings();
  if(!s.notifyStatus||!waCanSend()||!t.phone)return;
  try{await sendGreenApiMessage(t.phone,formatStatusWhatsApp(t),"Статус заявки")}
  catch(err){addIntegrationLog("Статус заявки",`Не отправлено: ${err.message}`,false)}
}
async function sendWhatsAppTest(){
  try{
    saveWaSettings();
    const number=$("#waTestNumber").value.trim()||getWaSettings().notifyNumber;
    const msg=`✅ Тест IT-System-Solution CRM

GREEN-API подключен.
Дата: ${now()}

Автоматические уведомления CRM готовы к работе.`;
    await sendGreenApiMessage(number,msg,"Тест WhatsApp");
    toast("Тестовое сообщение отправлено");
  }catch(err){
    addIntegrationLog("Тест WhatsApp",`Ошибка: ${err.message}`,false);
    toast(`Ошибка: ${err.message}`);
  }
}
function saveMailSettings(){
  db.integrations=db.integrations||JSON.parse(JSON.stringify(seed.integrations));
  db.integrations.mail={
    google:{email:$("#mailGoogleEmail").value.trim(),clientId:$("#mailGoogleClientId").value.trim()},
    yandex:{email:$("#mailYandexEmail").value.trim(),clientId:$("#mailYandexClientId").value.trim()},
    mailru:{email:$("#mailMailruEmail").value.trim(),clientId:$("#mailMailruClientId").value.trim()},
    outlook:{email:$("#mailOutlookEmail").value.trim(),clientId:$("#mailOutlookClientId").value.trim()}
  };
  save();
  ["google","yandex","mailru","outlook"].forEach(p=>{
    const val=db.integrations.mail[p];
    const id=p==="google"?"mailGoogleStatus":p==="yandex"?"mailYandexStatus":p==="mailru"?"mailMailruStatus":"mailOutlookStatus";
    const el=$("#"+id);if(el){el.textContent=(val.email&&val.clientId)?"Параметры сохранены":"Не подключено";el.className=`tag ${(val.email&&val.clientId)?"neutral":"warn"}`}
  });
  addIntegrationLog("Почта","Параметры почтовых OAuth-клиентов сохранены локально.",true);
  toast("Параметры почты сохранены");
}
function mailOAuthHelp(provider){
  const messages={
    google:"Google / Gmail: создайте OAuth Client ID для Web Application. Для полноценной синхронизации Gmail CRM должна работать с HTTPS/localhost и серверным обработчиком токенов.",
    yandex:"Яндекс: создайте OAuth-приложение с правами mail:imap_ro/mail:imap_full и mail:smtp. Для чтения/отправки через IMAP/SMTP нужен серверный шлюз.",
    mailru:"Mail.ru: создайте OAuth-приложение Mail. Для работы почтового ящика из CRM потребуется серверная обработка OAuth и почтовых протоколов.",
    outlook:"Microsoft Outlook / 365: зарегистрируйте приложение в Microsoft Entra ID и используйте Microsoft Graph Mail permissions. Для безопасного refresh-токена нужен HTTPS и серверный backend."
  };
  alert(messages[provider]||"Требуется OAuth-приложение.");
}


async function listStoredAttachments(){
  try{
    const dbi=await openAttachmentDb();
    const items=await new Promise((resolve,reject)=>{const tx=dbi.transaction(ATTACH_STORE,'readonly');const r=tx.objectStore(ATTACH_STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});
    dbi.close();return items;
  }catch(e){return[]}
}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
function dataUrlToBlob(dataUrl){
  const [head,b64]=String(dataUrl).split(','),mime=(head.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';
  const bin=atob(b64||''),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime});
}
async function exportAttachmentBackup(){
  const items=await listStoredAttachments(),out=[];
  for(const rec of items){try{out.push({id:rec.id,name:rec.name,type:rec.type,size:rec.size,created:rec.created,dataUrl:await blobToDataUrl(rec.blob)})}catch(e){}}
  return out;
}
async function restoreAttachmentBackup(items){
  if(!Array.isArray(items)||!items.length)return;
  const dbi=await openAttachmentDb();
  for(const item of items){
    if(!item?.id||!item.dataUrl)continue;
    const blob=dataUrlToBlob(item.dataUrl);
    await new Promise((resolve,reject)=>{const tx=dbi.transaction(ATTACH_STORE,'readwrite');tx.objectStore(ATTACH_STORE).put({id:item.id,name:item.name||'attachment',type:item.type||blob.type,size:item.size||blob.size,created:item.created||Date.now(),blob});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  }
  dbi.close();
}
function renderDbStats(){
  const el=$("#dbStats");if(!el)return;
  el.innerHTML=`<span>Пользователей: <b>${db.users.length}</b></span><span>Заявок: <b>${db.tickets.length}</b></span><span>Задач: <b>${db.tasks.length}</b></span><span>Уведомлений: <b>${db.notifications.length}</b></span>`;
}
async function exportDatabase(){
  toast("Подготовка резервной копии…");
  const attachments=await exportAttachmentBackup();
  const payload={format:"IT-System-Solution CRM Database",version:"8",exportedAt:new Date().toISOString(),data:db,attachments};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`KazIOR-CRM-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast(`Резервная копия выгружена · вложений: ${attachments.length}`);
}
async function importDatabaseFile(file){
  if(!file)return;
  try{
    const text=await file.text(),parsed=JSON.parse(text),incoming=parsed?.data||parsed;
    if(!incoming||!Array.isArray(incoming.users)||!Array.isArray(incoming.tickets))throw new Error("Неверный формат резервной копии");
    if(!confirm(`Загрузить базу? Пользователей: ${incoming.users.length}, заявок: ${incoming.tickets.length}. Текущая база будет заменена.`))return;
    incoming.settings={...seed.settings,...(incoming.settings||{})};incoming.tasks=incoming.tasks||[];incoming.notifications=incoming.notifications||[];incoming.departments=incoming.departments||[];incoming.mailMessages=incoming.mailMessages||[];
    incoming.integrations=incoming.integrations||JSON.parse(JSON.stringify(seed.integrations));incoming.integrations.mail={...seed.integrations.mail,...(incoming.integrations.mail||{})};
    incoming.users.forEach(u=>{u.permissions={...permissionDefaults[u.role],...(u.permissions||{})};u.registeredAt=u.registeredAt||now()});
    await restoreAttachmentBackup(parsed.attachments||[]);
    db=incoming;save();sessionStorage.removeItem(SESSION);toast("База и вложения загружены. Выполняется выход.");setTimeout(()=>location.reload(),900);
  }catch(e){toast(`Ошибка импорта: ${e.message}`)}
}
function clearWorkingDatabase(){
  if(!confirm("Очистить ВСЕ заявки, задачи, уведомления и журнал писем? Учетные записи, подразделения и настройки останутся."))return;
  db.tickets=[];db.tasks=[];db.notifications=[];db.mailMessages=[];db.lastNo=0;if(db.integrations?.log)db.integrations.log=[];save();renderAll();toast("Рабочие данные очищены");
}
function reportFilteredTickets(){
  let all=visibleTickets(),ts=[...all];const only=$('#reportOverdueOnly')?.checked;
  const qv=($('#reportEmployeeSearch')?.value||'').trim().toLowerCase();
  if(only)ts=ts.filter(isTicketOverdue);
  if(qv)ts=ts.filter(t=>`${t.ownerName} ${t.phone} ${t.dept} ${t.engineerName} ${t.subject} ${t.id}`.toLowerCase().includes(qv));
  return {all,ts};
}
function renderReports(){
  const {all,ts}=reportFilteredTickets();const metrics=$('#reportMetrics');
  if(metrics)metrics.innerHTML=[[all.length,'Всего заявок'],[all.filter(t=>!['done','closed'].includes(t.status)).length,'Открыто'],[all.filter(isTicketOverdue).length,'Просрочено'],[all.filter(t=>['done','closed'].includes(t.status)).length,'Выполнено']].map(([v,l])=>`<div class="metric"><span>${l}</span><strong>${v}</strong></div>`).join('');
  const actionHead=currentUser?.role==='superadmin'?'<th>Управление</th>':'';
  $('#reportTable').innerHTML=`<table><thead><tr><th>№</th><th>Дата</th><th>Заявитель / телефон</th><th>Тема</th><th>Приоритет</th><th>Статус</th><th>Инженер</th><th>SLA</th><th>Просрочка</th>${actionHead}</tr></thead><tbody>${ts.map(t=>`<tr class="${isTicketOverdue(t)?'report-overdue-row':''}"><td>${esc(t.id)}</td><td>${esc(t.created)}</td><td>${esc(t.ownerName)}<br><span class="muted">${esc(t.phone||'—')}</span></td><td>${esc(t.subject)}</td><td>${esc(t.priority)}</td><td>${esc(statusName(t.status))}</td><td>${esc(t.engineerName||'')}</td><td>${esc(formatDue(t.slaDue))}</td><td>${isTicketOverdue(t)?'ДА':'—'}</td>${currentUser?.role==='superadmin'?`<td class="report-actions-cell"><button class="mini-btn" data-report-open="${t.id}">Открыть</button>${isTicketOverdue(t)?`<button class="mini-btn" data-report-extend="${t.id}">+1 день</button>`:''}</td>`:''}</tr>`).join('')}</tbody></table>`;
  $$('[data-report-open]').forEach(b=>b.onclick=()=>openTicket(b.dataset.reportOpen));
  $$('[data-report-extend]').forEach(b=>b.onclick=()=>extendTicketSla(b.dataset.reportExtend,24));
}
function extendTicketSla(id,hours=24){
  if(currentUser?.role!=='superadmin')return toast('Только супер-администратор может менять срок из отчета');
  const t=db.tickets.find(x=>x.id===id);if(!t)return;
  const base=parseLocalDateTime(t.slaDue)||Date.now();const next=new Date(base+hours*3600000);
  t.slaDue=new Date(next.getTime()-next.getTimezoneOffset()*60000).toISOString().slice(0,16);
  t.history=t.history||[];t.history.push({date:now(),actor:currentUser.name,text:`SLA перенесен на ${hours} ч.`});
  save();renderReports();renderKanban();toast(`Срок ${id} перенесен`);
}
function buildReportDocument(){
  const {all,ts}=reportFilteredTickets();
  const generated=now();
  const rows=ts.map(t=>`<tr class="${isTicketOverdue(t)?'overdue-row':''}"><td>${esc(t.id)}</td><td>${esc(t.created)}</td><td>${esc(t.ownerName)}<br>${esc(t.phone||'—')}</td><td>${esc(t.dept)}<br>каб. ${esc(t.room||'—')}</td><td>${esc(t.subject)}</td><td>${esc(t.priority)}</td><td>${esc(statusName(t.status))}</td><td>${esc(t.engineerName||'—')}</td><td>${esc(formatDue(t.slaDue))}</td><td>${isTicketOverdue(t)?'ДА':'—'}</td></tr>`).join('');
  return `<div class="report-doc-header"><img src="assets/kazior-logo.png" alt="КазНИИОиР"><div class="report-doc-title"><p>${esc(db.settings.organizationName)}</p><h2>Отчет по заявкам IT ServiceDesk</h2><p>Сформировано: ${esc(generated)} · Разработано IT-System-Solution</p></div></div>
    <div class="report-doc-metrics"><b>Всего:</b> ${all.length} &nbsp; <b>Открыто:</b> ${all.filter(t=>!['done','closed'].includes(t.status)).length} &nbsp; <b>Просрочено:</b> ${all.filter(isTicketOverdue).length} &nbsp; <b>Выполнено:</b> ${all.filter(t=>['done','closed'].includes(t.status)).length}</div>
    <table id="reportPreviewData"><thead><tr><th>№</th><th>Создано</th><th>Заявитель / телефон</th><th>Отдел / каб.</th><th>Тема</th><th>Приоритет</th><th>Статус</th><th>Инженер</th><th>SLA</th><th>Просрочка</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="report-copyright"><div><b>© ${new Date().getFullYear()} Тимченко Евгений Юрьевич</b><br>Разработано <b>IT-System-Solution</b><br>demo@example.invalid · www.its24.kz · +7 700 000 00 01</div><img class="report-signature-small" src="assets/author-signature.png" alt="Подпись"></div>`;
}
function openReportPreview(preferred='pdf'){
  $('#reportPreviewContent').innerHTML=buildReportDocument();
  $('#reportPreviewModal').classList.remove('hidden');
  if(preferred==='excel')setTimeout(()=>toast('Проверьте отчет и нажмите «Скачать Excel (.xls)»'),80);
}
function printPreparedReport(){
  document.body.classList.add('printing-report');
  setTimeout(()=>{window.print();setTimeout(()=>document.body.classList.remove('printing-report'),500)},60);
}
function exportExcelPreview(){
  const table=$('#reportPreviewData');if(!table)return toast('Сначала откройте отчет');
  const html=`<!doctype html><html><head><meta charset="utf-8"></head><body><h2>Отчет по заявкам IT ServiceDesk</h2><p>${esc(db.settings.organizationName)}</p>${table.outerHTML}<p>© ${new Date().getFullYear()} Тимченко Евгений Юрьевич · Разработано IT-System-Solution</p></body></html>`;
  const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`KazNIIOiR-IT-ServiceDesk-${new Date().toISOString().slice(0,10)}.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportCsv(){
  const rows=[["№","Дата","Заявитель","Организация","Тема","Категория","Приоритет","Статус","Инженер","SLA","Просрочено"]];
  visibleTickets().forEach(t=>rows.push([t.id,t.created,t.ownerName,t.org,t.subject,t.category,t.priority,statusName(t.status),t.engineerName||"",formatDue(t.slaDue),isTicketOverdue(t)?"ДА":"НЕТ"]));
  const csv="\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`IT-System-Solution-CRM-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function showSocial(provider){toast(`${provider}: параметры подключения доступны в разделе «Почта и WhatsApp». Для промышленного OAuth нужен HTTPS и безопасный серверный обмен токенами.`)}

// v14: name sign-in, responsive messenger and durable WhatsApp import.
function renderLoginEmployees(){
  const list=$('#loginEmployees');if(!list)return;
  list.innerHTML=db.users.filter(u=>u.status==='active').sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(u=>`<option value="${esc(WhatsAppCore.loginLabel(u))}"></option>`).join('');
}
function setLoginMethod(password){
  $('#loginFullNameLabel').classList.toggle('hidden',password);
  $('#loginNameLabel').classList.toggle('hidden',!password);
  $('#loginPasswordLabel').classList.toggle('hidden',!password);
  $('#loginFullName').disabled=password;$('#loginFullName').required=!password;
  for(const id of ['loginName','loginPassword']){$('#'+id).disabled=!password;$('#'+id).required=password}
  $('#loginByNameBtn').className='btn '+(password?'soft':'primary');
  $('#loginByPasswordBtn').className='btn '+(password?'primary':'soft');
  $('#loginByNameBtn').setAttribute('aria-pressed',String(!password));
  $('#loginByPasswordBtn').setAttribute('aria-pressed',String(password));
  $('#loginForm .auth-form-title p').textContent=password?'Напишите ФИО или логин инженера и введите пароль.':'Напишите своё ФИО и нажмите «Войти». Пароль сотруднику не нужен.';
}
function submitLogin(e){
  e.preventDefault();
  db=loadDb();
  if(!$('#loginFullName').disabled){
    const result=WhatsAppCore.resolveName(db.users,$('#loginFullName').value);
    if(result.error)return toast(result.error);
    return enterApp(result.user);
  }
  const value=$('#loginName').value.trim().toLocaleLowerCase('ru'),password=$('#loginPassword').value;
  const user=db.users.find(u=>[u.login,u.email].some(v=>String(v||'').toLocaleLowerCase('ru')===value)&&u.password===password);
  if(!user)return toast('Неверный логин или пароль');
  if(user.status!=='active')return toast('Учётная запись не активна. Обратитесь к администратору.');
  enterApp(user);
}
function fitChatWorkspace(){
  const shell=document.querySelector('.messenger-v11');
  if(!shell||!$('#chatsView').classList.contains('active'))return;
  const top=shell.getBoundingClientRect().top+window.scrollY;
  shell.style.setProperty('--chat-top',Math.max(0,top)+'px');
  shell.style.setProperty('--chat-viewport',(window.visualViewport?.height||window.innerHeight)+'px');
}

let waReceiverGeneration=0,waReceiverTimer=null,waReceiverBusy=false,waLastError='';
function getBridgeKey(){return sessionStorage.getItem('its24_wa_bridge_key')||''}
function waCanSend(){return getWaSettings().receiveMode==='server'?!!getBridgeKey():!!getWaToken()}
function setReceiveStatus(text,error=false){
  const el=$('#waReceiveStatus');if(el){el.textContent=text;el.classList.toggle('receive-error',error)}
}
function renderIncomingModeHelp(){
  const server=$('#waReceiveMode').value==='server';
  $('#waBridgeFields').classList.toggle('hidden',!server);
  $('#waReceiveHelp').textContent=server?'Приёмник сохраняет заявки, даже если CRM закрыта. Здесь включается загрузка этих заявок в CRM. Настройка — в инструкции из архива.':'Приём работает, пока вкладка открыта и выполнен вход с правом управления интеграциями. В GREEN-API поле webhookUrl должно быть пустым.';
}
function renderIncomingSettings(){
  const s=getWaSettings();
  if(document.activeElement!==$('#waReceiveMode'))$('#waReceiveMode').value=s.receiveMode||'browser';
  if(document.activeElement!==$('#waBridgeUrl'))$('#waBridgeUrl').value=s.bridgeUrl||(location.protocol.startsWith('http')?location.origin:'http://127.0.0.1:8787');
  if(document.activeElement!==$('#waBridgeKey'))$('#waBridgeKey').value=getBridgeKey();
  renderIncomingModeHelp();
}
async function bridgeRequest(path,method='GET',body=null){
  await new Promise(r=>setTimeout(r,120));
  if(path.includes('health'))return {ok:true,demo:true};
  if(path.includes('inbox'))return {items:[],cursor:0};
  return {ok:true,demo:true,message:'DEMO: серверный мост не вызывается'};
}
function importWhatsAppItem(item,ticketId=''){
  if(!item||db.tickets.some(t=>t.waMessageKey===item.key))return null;
  const matches=item.phone?db.users.filter(u=>u.status==='active'&&normalizePhone(u.phone)===normalizePhone(item.phone)):[];
  const owner=matches.length===1?matches[0]:null;
  const classification=classify(item.text),stamp=new Date(item.timestamp*1000);
  const created=stamp.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const id=/^WA-\d{6,}$/.test(ticketId)&&!db.tickets.some(t=>t.id===ticketId)?ticketId:nextTicketId();
  const ticket={id,ownerId:owner?.id||'wa:'+item.chatId,ownerName:owner?.name||item.name,
    org:db.settings.organizationShort,dept:owner?.dept||'Уточнить у заявителя',room:'',location:'',phone:item.phone,
    source:'WhatsApp',category:classification.category,priority:classification.priority,subject:item.text.replace(/\s+/g,' ').slice(0,110),
    description:item.text,status:'new',engineerId:'',engineerName:'Не назначен',created,slaDue:'',
    files:item.files||[],messages:[],history:[{date:created,actor:'WhatsApp',text:'Заявка получена из входящего сообщения'}],
    waMessageKey:item.key,waMessageId:item.idMessage,waChatId:item.chatId};
  db.tickets.unshift(ticket);
  const recipients=new Set([...db.users.filter(u=>u.status==='active'&&['superadmin','admin','engineer'].includes(u.role)).map(u=>u.id),...(owner?[owner.id]:[])]);
  for(const recipientId of recipients)db.notifications.unshift({id:`wa:${id}:${recipientId}`,recipientId,title:`WhatsApp · новая заявка ${id}`,text:`${ticket.ownerName}: ${ticket.subject}`,ticketId:id,date:created,read:false});
  return ticket;
}
function announceWhatsAppTickets(tickets){
  if(!tickets.length||!currentUser)return;
  renderMetrics();renderRecent();renderKanban();renderBadges();renderNotifications();renderChats();
  if($('#chatsView').classList.contains('active'))renderActiveChat();
  const first=tickets[0];
  toast(`WhatsApp: новых заявок — ${tickets.length}`);
  playNotificationSound();showSystemNotification('WhatsApp · новая заявка',`${first.id}: ${first.subject}`);
  crmChannel?.postMessage({type:'notification',recipientId:currentUser.id,title:'Новые заявки WhatsApp',text:first.subject});
}
async function receiveWhatsAppOnce(generation){
  if(generation!==waReceiverGeneration||!currentUser||!hasPerm('manageIntegrations'))return;
  if(getWaSettings().receiveMode==='server'){
    const base=getWaSettings().bridgeUrl;
    const sync=db.waInboxSync||{},cursor=sync.base===base?sync.cursor||0:0;
    const result=await bridgeRequest('/api/whatsapp/events?after='+encodeURIComponent(cursor));
    if(generation!==waReceiverGeneration)return;
    // Re-read after the network await so edits in another tab are not overwritten.
    db=loadDb();
    const tickets=[];
    for(const row of result.events||[]){const t=importWhatsAppItem(row.item,row.ticketId);if(t)tickets.push(t)}
    db.waInboxSync={base,cursor:result.cursor??cursor};
    try{save()}catch(e){db=loadDb();throw new Error('Не удалось сохранить заявки в CRM. Освободите место; сообщения остаются на сервере.')}
    announceWhatsAppTickets(tickets);
    setReceiveStatus((result.receiver?.ok?'Сервер принимает WhatsApp':'CRM подключена. '+(result.receiver?.message||'Ожидание приёмника'))+` · проверено ${now()}`,!result.receiver?.ok);
    return;
  }
  const notification=await greenApiRequest('receiveNotification','GET',null,'?receiveTimeout=5');
  if(generation!==waReceiverGeneration)return;
  if(!notification?.receiptId){setReceiveStatus('Приём включён · ожидание сообщений');return}
  const item=WhatsAppCore.normalize(notification);
  db=loadDb();
  let ticket=null;
  if(item){
    ticket=importWhatsAppItem(item);
    try{save()}catch(e){db=loadDb();throw new Error('Не удалось сохранить заявку. Сообщение оставлено в очереди WhatsApp.')}
  }
  // Acknowledge only after the ticket AND notifications were durably committed.
  if(ticket)announceWhatsAppTickets([ticket]);
  const acknowledged=await greenApiRequest('deleteNotification','DELETE',null,'/'+encodeURIComponent(notification.receiptId));
  if(!acknowledged?.result)throw new Error('Заявка сохранена, но GREEN-API не подтвердил удаление из очереди');
  setReceiveStatus(ticket?`Получена заявка ${ticket.id} · ${now()}`:'Приём включён · ожидание сообщений');
}
async function receiverTick(generation){
  if(generation!==waReceiverGeneration||!currentUser||!getWaSettings().incomingEnabled)return;
  if(!waReceiverBusy){
    waReceiverBusy=true;
    try{
      const run=()=>receiveWhatsAppOnce(generation);
      if(navigator.locks)await navigator.locks.request('kazior-whatsapp-incoming',{ifAvailable:true},lock=>lock?run():undefined);
      else await run();
      waLastError='';
    }catch(err){
      if(generation===waReceiverGeneration){
        setReceiveStatus('Приём: '+err.message+' Повтор через 10 секунд.',true);
        if(waLastError!==err.message){waLastError=err.message;try{addIntegrationLog('Входящий WhatsApp',err.message,false)}catch(e){}}
      }
    }finally{waReceiverBusy=false}
  }
  if(generation===waReceiverGeneration)waReceiverTimer=setTimeout(()=>receiverTick(generation),waLastError?10000:2000);
}
async function startWhatsAppReceiving(fromButton=false){
  if(!hasPerm('manageIntegrations'))return;
  if(fromButton)saveWaSettings();
  stopWhatsAppReceiving(false);
  const generation=waReceiverGeneration;
  setReceiveStatus('Проверка приёма…');
  try{
    if(getWaSettings().receiveMode==='server')await bridgeRequest('/api/whatsapp/health');
    else{
      const state=await greenApiRequest('getStateInstance');
      if(state.stateInstance!=='authorized')throw new Error('Свяжите номер WhatsApp с GREEN-API по QR-коду');
      const settings=await greenApiRequest('getSettings');
      if(settings.webhookUrl)throw new Error('У инстанса указан webhookUrl. Для этого режима выберите отдельный инстанс или очистите webhookUrl в GREEN-API');
      if(settings.incomingWebhook!=='yes'){
        if(!fromButton)throw new Error('Нажмите «Включить приём» для настройки входящих сообщений');
        const result=await greenApiRequest('setSettings','POST',{incomingWebhook:'yes'});
        if(!result.saveSettings)throw new Error('GREEN-API не подтвердил настройку входящих сообщений');
      }
    }
    if(generation!==waReceiverGeneration)return;
    getWaSettings().incomingEnabled=true;save();
    receiverTick(generation);
  }catch(err){if(generation===waReceiverGeneration){setReceiveStatus(err.message,true);if(fromButton)toast(err.message)}}
}
function stopWhatsAppReceiving(persist=false){
  waReceiverGeneration++;clearTimeout(waReceiverTimer);waReceiverTimer=null;
  if(persist){getWaSettings().incomingEnabled=false;save()}
  setReceiveStatus(getWaSettings().receiveMode==='server'?'Загрузка в CRM остановлена. Сервер продолжает сохранять заявки.':'Приём в браузере остановлен');
}

function applyLocalLauncherSetup(){
  const raw=sessionStorage.getItem('its24_wa_local_setup');
  if(!raw)return;
  try{
    const setup=JSON.parse(raw);
    if(!['127.0.0.1','localhost'].includes(location.hostname)||typeof setup.crmKey!=='string'||setup.crmKey.length<32)return;
    sessionStorage.setItem('its24_wa_bridge_key',setup.crmKey);
    const settings=getWaSettings();
    settings.receiveMode='server';settings.bridgeUrl=location.origin;settings.incomingEnabled=true;
    save();
  }catch(e){toast('Не удалось применить настройки приёмника. Повторите запуск START_WHATSAPP.bat.')}
  finally{sessionStorage.removeItem('its24_wa_local_setup')}
}
function init(){
  applyLocalLauncherSetup();
  crmChannel&& (crmChannel.onmessage=e=>{const m=e.data||{};if(m.type==='notification'&&currentUser?.id===m.recipientId){db=loadDb();renderAll();playNotificationSound();showSystemNotification(m.title,m.text);if(navigator.vibrate)navigator.vibrate([80,45,80])}});

  $$(".currentYear").forEach(e=>e.textContent=new Date().getFullYear());
  $("#ticketCategory").innerHTML=categories.map(c=>`<option>${c}</option>`).join("");

  $$(".auth-tab").forEach(b=>b.onclick=()=>{$$(".auth-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#loginForm").classList.toggle("hidden",b.dataset.auth!=="login");$("#registerForm").classList.toggle("hidden",b.dataset.auth!=="register")});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-download-attachment]");if(b){e.preventDefault();downloadStoredAttachment(b.dataset.downloadAttachment)}});
  $("#loginForm").onsubmit=submitLogin;
  $("#loginByNameBtn").onclick=()=>setLoginMethod(false);
  $("#loginByPasswordBtn").onclick=()=>setLoginMethod(true);
  $("#registerForm").onsubmit=e=>{e.preventDefault();const login=$("#regLogin").value.trim(),email=$("#regEmail").value.trim();if(db.users.some(u=>u.login===login||u.email===email))return toast("Логин или e-mail уже используется");const u={id:"u"+Date.now(),login,password:$("#regPassword").value,name:$("#regFullName").value.trim(),email,phone:$("#regPhone").value.trim(),org:db.settings.organizationShort,dept:$("#regDept").value.trim(),position:"Сотрудник",role:"employee",status:"pending",workStatus:"available",photo:"",about:"",interests:[],theme:"light",registeredAt:now(),permissions:{...permissionDefaults.employee}};db.users.push(u);save();toast("Регистрация выполнена. Ожидайте подтверждения администратора.");$$(".auth-tab")[0].click()};
  renderBranding();$$("[data-social]").forEach(b=>b.onclick=()=>showSocial(b.dataset.social));

  $$(".nav-btn").forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $$(".workspace-tab").forEach(b=>b.onclick=()=>setView(b.dataset.workspaceView));
  $$("[data-jump]").forEach(b=>b.onclick=()=>setView(b.dataset.jump));
  $("#logoutBtn").onclick=()=>{sessionStorage.removeItem(SESSION);currentUser=null;showAuth()};
  $("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
  $("#collapseBtn").onclick=()=>document.body.classList.toggle("sidebar-collapsed");
  $("#quickTopCreate").onclick=()=>setView("create");
  $("#floatingCreateBtn").onclick=()=>setView("create");
  $("#notificationBtn").onclick=()=>{$("#notificationPanel").classList.toggle("hidden");renderNotifications()};$("#notificationBtn").ondblclick=requestSystemNotifications;$("#requestSystemNotificationsBtn").onclick=requestSystemNotifications;$("#markAllReadBtn").onclick=markAllNotificationsRead;$("#userStatusBtn").onclick=cycleOwnStatus;$("#profileQuickBtn").onclick=()=>setView('profile');
  $("#themeBtn").onclick=()=>{currentUser.theme=currentUser.theme==='light'?'dark':'light';const u=db.users.find(x=>x.id===currentUser.id);u.theme=currentUser.theme;save();applyUserTheme(currentUser);renderProfile()};

  $("#statusFilter").onchange=renderKanban;$("#priorityFilter").onchange=renderKanban;$("#engineerFilter").onchange=renderKanban;
  $("#chatSearch").oninput=renderChats;$("#chatDepartmentFilter").onchange=renderChats;$("#chatRoleFilter").onchange=renderChats;$("#chatWorkStatusFilter").onchange=renderChats;$("#chatListSort").onchange=renderChats;$("#chatAdminScope").onchange=()=>{activeDirectChatId=null;renderChats();renderActiveChat()};$("#chatModePeople").onclick=()=>setChatMode("people");$("#chatModeTickets").onclick=()=>setChatMode("tickets");$("#newDirectChatBtn").onclick=()=>{setChatMode("people");$("#chatSearch").focus()};$("#chatMessageSearch").oninput=renderActiveChat;$("#chatDateFilter").onchange=renderActiveChat;$("#chatMonthFilter").onchange=renderActiveChat;$("#chatMessageSort").onchange=renderActiveChat;$("#chatClearHistoryFilters").onclick=()=>resetChatHistoryFilters(true);
  $("#chatSendBtn").onclick=sendChatMessage;
  $('#chatBackToPeople').onclick=()=>{activeDirectChatId=null;activeChatTicketId=null;renderActiveChat()};
  window.addEventListener('resize',fitChatWorkspace);
  window.visualViewport?.addEventListener('resize',fitChatWorkspace);
  $("#chatText").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendChatMessage()}});$("#chatText").addEventListener("input",autoGrowChatComposer);
  $("#addTaskBtn").onclick=addTask;$("#taskDeleteBtn").onclick=deleteCurrentTask;
  $("#taskForm").onsubmit=e=>{e.preventDefault();saveTaskForm()};
  $("#profileStatusBtn").onclick=cycleOwnStatus;$("#profileNotificationBtn").onclick=requestSystemNotifications;$("#profilePhotoBtn").onclick=()=>$("#profilePhotoInput").click();$("#profilePhotoInput").onchange=e=>readImageFile(e.target.files[0],data=>{currentUser.photo=data;db.users.find(u=>u.id===currentUser.id).photo=data;save();renderProfile();toast('Фото профиля обновлено')});$("#editProfileBtn").onclick=openProfileEdit;$("#profileEditForm").onsubmit=e=>{e.preventDefault();saveProfileForm()};$("#profileThemeSelect").onchange=e=>{currentUser.theme=e.target.value;db.users.find(u=>u.id===currentUser.id).theme=e.target.value;save();applyUserTheme(currentUser)};$("#profileBackgroundBtn").onclick=()=>$("#profileBackgroundInput").click();$("#profileBackgroundInput").onchange=e=>readImageFile(e.target.files[0],data=>{currentUser.backgroundImage=data;const u=db.users.find(x=>x.id===currentUser.id);u.backgroundImage=data;save();applyUserTheme(u);renderProfile();toast('Фоновая картинка применена к текущей теме')});
  $("#directorySearch").oninput=renderDirectory;$("#directoryStatusFilter").onchange=renderDirectory;$("#directoryRoleFilter").onchange=renderDirectory;$("#accountsSearch").oninput=renderAccounts;$("#accountsRoleFilter").onchange=renderAccounts;$("#addDepartmentBtn").onclick=addDepartment;$("#mailSearch").oninput=renderMailbox;$("#composeMailBtn").onclick=()=>location.href='mailto:';$("#reportOverdueOnly").onchange=renderReports;$("#reportEmployeeSearch").oninput=renderReports;$("#saveBrandingBtn").onclick=saveBranding;$("#saveLoginDesignBtn").onclick=saveLoginDesign;$("#resetLoginDesignBtn").onclick=resetLoginDesign;$("#settingLoginImageInput").onchange=e=>setLoginHeroImage(e.target.files[0]);$("#settingLoginLogoSize").oninput=e=>{$("#loginLogoSizeValue").textContent=`${e.target.value} px`;document.documentElement.style.setProperty("--auth-hero-logo-width",`${e.target.value}px`)};$("#settingLoginLogoHeight").oninput=e=>{$("#loginLogoHeightValue").textContent=`${e.target.value} px`;document.documentElement.style.setProperty("--auth-hero-logo-height",`${e.target.value}px`)};$("#settingLoginLogoOffsetY").oninput=e=>{$("#loginLogoOffsetYValue").textContent=`${e.target.value} px`;document.documentElement.style.setProperty("--auth-hero-logo-offset-y",`${e.target.value}px`)};$("#settingLoginLeftWidth").oninput=e=>{$("#loginLeftWidthValue").textContent=`${e.target.value}%`;document.documentElement.style.setProperty("--auth-left-percent",`${e.target.value}%`);document.documentElement.style.setProperty("--auth-right-percent",`${100-Number(e.target.value)}%`)};$("#settingSoundEnabled").onchange=saveSoundSettings;$("#settingSlaCheck").onchange=saveSoundSettings;
  $("#waToggleToken").onclick=()=>{const i=$("#waApiToken");i.type=i.type==="password"?"text":"password";$("#waToggleToken").textContent=i.type==="password"?"Показать":"Скрыть"};
  $("#waSaveBtn").onclick=saveWaSettings;
  $('#waReceiveMode').onchange=renderIncomingModeHelp;
  $('#waStartReceiving').onclick=()=>startWhatsAppReceiving(true);
  $('#waStopReceiving').onclick=()=>stopWhatsAppReceiving(true);
  $("#waCheckBtn").onclick=checkWhatsAppConnection;
  $("#waTestBtn").onclick=sendWhatsAppTest;
  $("#clearIntegrationLogBtn").onclick=()=>{db.integrations.log=[];save();renderIntegrationLog();toast("Журнал очищен")};
  $("#saveMailSettingsBtn").onclick=saveMailSettings;
  $$("[data-mail-help]").forEach(b=>b.onclick=()=>mailOAuthHelp(b.dataset.mailHelp));
  const searchInput=$('#globalSearch');
  searchInput.addEventListener('focus',()=>{searchInput.readOnly=false});
  searchInput.addEventListener('blur',()=>{searchInput.readOnly=true});
  searchInput.oninput=e=>{
    if(e.target.readOnly){e.target.value=globalSearch;return}
    e.target.dataset.userTyped='1';globalSearch=e.target.value.trim();renderKanban();
  };

  $("#ticketFiles").onchange=e=>{$("#ticketFilesInfo").textContent=e.target.files.length?fileNames(e.target).join(", "):"Файлы не выбраны";renderPendingFilePreviews(e.target,$("#ticketFilesPreview"))};
  $("#chatFiles").onchange=e=>renderPendingFilePreviews(e.target,$("#chatPendingPreview"));
  document.addEventListener('click',e=>{const b=e.target.closest('[data-voice-target]');if(b){e.preventDefault();startVoiceInput(b.dataset.voiceTarget,b)}});
  $("#taskAssigneeSearch").oninput=renderTaskAssigneeOptions;
  $("#aiClassifyBtn").onclick=()=>{const r=classify(`${$("#ticketSubject").value} ${$("#ticketDescription").value}`);$("#ticketCategory").value=r.category;$("#ticketPriority").value=r.priority;$("#createAiResult").textContent=`Категория: ${r.category}\nПриоритет: ${r.priority}\n\nРекомендация:\n${r.tip}`};
  $("#createTicketForm").onsubmit=async e=>{e.preventDefault();const id=nextTicketId();const u=currentUser,p=$("#ticketPriority").value;const hours={P1:2,P2:4,P3:8,P4:24}[p]||8;const due=new Date(Date.now()+hours*3600000);const localIso=new Date(due.getTime()-due.getTimezoneOffset()*60000).toISOString().slice(0,16);const stored=await storeSelectedFiles($("#ticketFiles").files);const requesterName=$("#ticketRequesterName").value.trim()||u.name;const ticket={id,ownerId:u.id,ownerName:requesterName,org:db.settings.organizationShort,dept:$("#ticketDept").value.trim()||u.dept,room:$("#ticketRoom").value.trim(),location:$("#ticketLocation").value.trim(),phone:$("#ticketPhone").value.trim()||u.phone,source:$("#ticketSource").value,category:$("#ticketCategory").value,priority:p,subject:$("#ticketSubject").value.trim(),description:$("#ticketDescription").value.trim(),status:"new",engineerId:"",engineerName:"Не назначен",created:now(),slaDue:localIso,files:stored,messages:[],history:[{date:now(),actor:u.name,text:'Заявка создана'}]};db.tickets.unshift(ticket);notifyNewTicketTeam(ticket);save();e.target.reset();$("#ticketCategory").innerHTML=categories.map(c=>`<option>${c}</option>`).join("");$("#ticketFilesInfo").textContent="Файлы не выбраны";$("#ticketFilesPreview").innerHTML="";renderAll();setView("tickets");toast(`Заявка ${id} создана`);playNotificationSound();await notifyNewTicketWhatsApp(ticket)};

  $("#addAccountBtn").onclick=()=>$("#accountModal").classList.remove("hidden");
  $("#accountForm").onsubmit=async e=>{e.preventDefault();if(currentUser?.role!=='superadmin')return toast('Только супер-администратор может создавать учётные записи');const login=$("#accLogin").value.trim(),email=$("#accEmail").value.trim(),role=$("#accRole").value;if(db.users.some(u=>u.login===login||u.email===email))return toast("Логин или e-mail уже используется");db.users.push({id:"u"+Date.now(),login,password:$("#accPassword").value,name:$("#accName").value.trim(),email,phone:$("#accPhone").value.trim(),org:db.settings.organizationShort,dept:$("#accDept").value.trim(),position:role==="engineer"?"Инженер-программист":"Сотрудник",role,status:"active",workStatus:"available",photo:"",about:"",interests:[],theme:"dark",registeredAt:now(),permissions:{...permissionDefaults[role]}});if(!await save())return;closeModal("accountModal");e.target.reset();renderAll();toast("Учетная запись создана")};
  $("#accountEditForm").onsubmit=e=>{e.preventDefault();saveAccountEdit()};$("#editAccountRole").onchange=e=>setPermissionUiForRole(e.target.value,true);

  $$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
  $$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));

  $("#printPdfBtn").onclick=()=>{renderReports();openReportPreview('pdf')};
  $("#exportCsvBtn").onclick=()=>{renderReports();openReportPreview('excel')};
  $("#reportPreviewPrintBtn").onclick=printPreparedReport;
  $("#reportPreviewExcelBtn").onclick=exportExcelPreview;

  $("#aiAnswerBtn").onclick=()=>{const t=db.tickets.find(x=>x.id===$("#aiTicketSelect").value);$("#aiAnswer").textContent=aiAnswerFor(t,$("#aiQuestion").value)};
  $("#aiUseCurrentBtn").onclick=()=>{if(currentTicketId){$("#aiTicketSelect").value=currentTicketId;toast("Текущая заявка выбрана")}else toast("Сначала откройте заявку")};

  $("#exportDbBtn").onclick=exportDatabase;
  $("#importDbBtn").onclick=()=>$("#importDbInput").click();
  $("#importDbInput").onchange=e=>importDatabaseFile(e.target.files[0]);
  $("#clearWorkDbBtn").onclick=clearWorkingDatabase;
  $("#resetDemoBtn").onclick=()=>{if(confirm("Полностью сбросить локальную CRM до исходной базы v9? Все текущие локальные данные будут удалены.")){localStorage.removeItem(KEY);LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));sessionStorage.removeItem(SESSION);sessionStorage.removeItem(WA_TOKEN_SESSION_KEY);location.reload()}};

  let deferredInstallPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e});const install=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null}else toast(location.protocol==='file:'?'Для установки PWA разместите CRM на HTTPS или localhost.':'Браузер пока не предлагает установку.')};$("#installPwaBtn").onclick=install;$("#settingsInstallPwaBtn").onclick=install;
  const tickClock=()=>{const el=$("#workspaceClock");if(el)el.textContent=new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})};tickClock();setInterval(tickClock,30000);setInterval(()=>{if(currentUser){renderBadges();renderNotifications();renderAnalytics()}},60000);
  if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  $('#authThemeBtn').onclick=()=>{try{localStorage.setItem('kazior_auth_theme',document.body.classList.contains('light')?'dark':'light')}catch{}applyAuthTheme()};showAuth();const demoBar=$('#sharedSyncText');if(demoBar)demoBar.textContent='DEMO GitHub Pages · данные хранятся только в этом браузере';const sid=sessionStorage.getItem(SESSION);const saved=db.users.find(u=>u.id===sid&&u.status==='active');if(saved)enterApp(saved);
}

// GitHub Pages compatibility API used by v16-v19 UI modules.
async function demoApi(path,body){
  await new Promise(r=>setTimeout(r,90));
  if(path==='/api/ai/draft'){
    const text=String(body?.draft||body?.subject||'');const result=classify(text);
    if(body?.mode==='consult')return {label:'Локальный демо-помощник',text:`${result.tip}\n\n1. Зафиксируйте точный симптом.\n2. Выполните только безопасную перезагрузку проблемной программы/устройства.\n3. Если не помогло — создайте заявку и приложите текст ошибки.\n\nЧто изменилось после проверки?`};
    return {label:'Локальный демо-помощник',text:body?.mode==='create'?`Проблема: ${body?.subject||'не указана'}.\nМесто: ${body?.location||body?.room||'уточнить'}.\nЧто уже проверено: базовая диагностика выполнена.\nРекомендация: ${result.tip}`:`Здравствуйте. Заявка принята в работу. ${result.tip} Сообщим результат после проверки.`};
  }
  if(path==='/api/integrations/status')return {restartRequired:false,telegram:{message:'Демо-режим · реальный бот не подключён',linked:0,recent:[]},ai:{enabled:true,model:'Локальный demo'},eds:{enabled:false,provider:'ncanode',verifierUrl:''}};
  if(path==='/api/integrations/configure')return {ok:true,restartRequired:false,demo:true};
  if(path==='/api/whatsapp/status')return {channels:techStaff().map(u=>({id:u.login,engineerId:u.id,phone:u.phone,idInstance:'DEMO',apiUrl:'',hasToken:false,enabled:true,routing:'engineer',defaultEngineerId:u.id,incomingMode:'commands',ok:true,message:'Демо'})),notifications:{notify_new:true,notify_reply:true,notify_status:true},recent:[]};
  if(path==='/api/whatsapp/check')return {enabled:true,checks:[{ok:true,name:'Демо-канал создан'},{ok:true,name:'Внешняя отправка отключена'}]};
  if(path==='/api/whatsapp/apply')return {ok:true,message:'Демо-настройки применены локально. Реальные сообщения не отправляются.'};
  if(path==='/api/whatsapp/test')return {ok:true,message:'Демо: тест показан в интерфейсе, реальное сообщение не отправлялось.'};
  if(path==='/api/telegram/link')return {url:'#',code:'DEMO-2026'};
  if(path==='/api/telegram/unlink'||path==='/api/telegram/retry'||path==='/api/oauth/unlink')return {ok:true};
  if(path==='/api/oauth/providers')return {links:[],publicOrigin:location.origin+location.pathname.replace(/[^/]*$/,''),providers:['google','yandex','mailru','microsoft'].map(id=>({id,ready:false,redirectUri:(location.origin+location.pathname.replace(/[^/]*$/,''))+'index.html?oauth=complete&provider='+id,clientId:''}))};
  if(path==='/api/eds/challenge')return {id:'demo-challenge',challenge:'DEMO',purpose:body?.purpose||'login'};
  if(path==='/api/eds/complete')return {demoUserId:'u9',user:db.users.find(u=>u.id==='u9')};
  return {ok:true,demo:true,message:'Демо-операция выполнена локально.'};
}
function demoLogin(kind='employee'){
  const id=kind==='admin'?'u1':kind==='engineer'?'u4':'u9';const user=db.users.find(u=>u.id===id);if(user){enterApp(user);toast('Демо-вход: '+user.name)}
}
window.KaziorCRM={
  api:demoApi,
  people:()=>[...db.users].sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(u=>({id:u.id,name:u.name,role:u.role,phone:u.phone,login:u.login,dept:u.dept})),
  setView,
  currentUser:()=>currentUser?{id:currentUser.id,name:currentUser.name,role:currentUser.role,phone:currentUser.phone}:null,
  aiContext:()=>({ticketId:!$('#ticketModal').classList.contains('hidden')?currentTicketId:activeChatTicketId,chatId:activeDirectChatId}),
  acceptLogin:result=>{const user=db.users.find(u=>u.id===(result?.demoUserId||result?.user?.id))||db.users.find(u=>u.id==='u9');enterApp(user);toast('Демо-вход с ЭЦП выполнен без реальной подписи.')},
  demoLogin,
  toast,
  openDocuments:()=>{window.open('documents.html','kazior-documents')}
};
document.addEventListener('DOMContentLoaded',init);
})();
