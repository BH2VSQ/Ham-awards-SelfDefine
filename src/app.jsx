import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Award, Database, LogOut, CheckCircle, 
  Shield, Download, Settings, Server, Lock, QrCode, 
  User, Trash2, RotateCcw, Save, Menu, Globe, Key
} from 'lucide-react';

// --- 语言包 ---
const TRANSLATIONS = {
  zh: {
    loading: "系统加载中...",
    loginTitle: "无线电奖项中心登录",
    callsign: "呼号",
    password: "密码",
    code2fa: "2FA 验证码",
    loginBtn: "登录",
    regBtn: "注册",
    installTitle: "系统初始化安装",
    dbHost: "数据库地址",
    adminCall: "管理员呼号",
    adminPath: "管理面板路径",
    dashboard: "仪表盘",
    upload: "上传日志",
    awards: "奖状中心",
    profile: "个人信息",
    adminPanel: "管理控制台",
    logout: "注销",
    totalQso: "QSO 总数",
    dxccStats: "DXCC 实体数",
    claimCert: "领取奖状",
    processing: "正在处理 ADIF 文件...",
    processed: "处理完成",
    added: "新增记录",
    skipped: "跳过重复",
    adminTabs: { awards: "奖状管理", users: "用户管理", settings: "系统设置" },
    save: "保存更改",
    delete: "删除",
    confirmAction: "确认操作",
    need2fa: "为了您的账户安全，请输入 2FA 验证码以继续。",
    enable2fa: "开启两步验证",
    disable2fa: "关闭两步验证",
    clearLogs: "清空所有日志",
    deleteAccount: "注销账户 (永久)",
    langEn: "English",
    langZh: "中文"
  },
  en: {
    loading: "Loading System...",
    loginTitle: "Ham Awards Login",
    callsign: "Callsign",
    password: "Password",
    code2fa: "2FA Code",
    loginBtn: "Login",
    regBtn: "Register",
    installTitle: "System Installation",
    dbHost: "DB Host",
    adminCall: "Admin Callsign",
    adminPath: "Admin Path",
    dashboard: "Dashboard",
    upload: "Upload Log",
    awards: "Awards",
    profile: "Profile",
    adminPanel: "Admin Console",
    logout: "Logout",
    totalQso: "Total QSOs",
    dxccStats: "DXCC Confirmed",
    claimCert: "Claim Certificate",
    processing: "Processing ADIF...",
    processed: "Completed",
    added: "Added",
    skipped: "Skipped",
    adminTabs: { awards: "Awards", users: "Users", settings: "Settings" },
    save: "Save Changes",
    delete: "Delete",
    confirmAction: "Confirm Action",
    need2fa: "For security, please enter your 2FA code.",
    enable2fa: "Enable 2FA",
    disable2fa: "Disable 2FA",
    clearLogs: "Clear All Logs",
    deleteAccount: "Delete Account",
    langEn: "English",
    langZh: "中文"
  }
};

const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('ham_token');
  const headers = {
    'Content-Type': 'application/json',
    'x-timestamp': Date.now().toString(),
    ...options.headers
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
  return data;
};

// --- 安全验证模态框 (2FA) ---
const SecurityModal = ({ isOpen, onClose, onConfirm, has2FA }) => {
  const [code, setCode] = useState('');
  if (!isOpen) return null;

  const handleSubmit = () => {
    onConfirm(code);
    setCode('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-lg w-full max-w-sm">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          <Lock size={20} className="text-red-600"/> 安全验证
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {has2FA ? "此操作敏感，请输入您的 2FA 动态验证码。" : "确认执行此高风险操作吗？"}
        </p>
        {has2FA && (
          <input 
            className="w-full border p-2 rounded mb-4 text-center font-mono text-xl tracking-widest"
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value)}
          />
        )}
        <div className="flex gap-2">
          <button onClick={handleSubmit} className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 font-bold">
            确认
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300">
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 证书渲染 ---
const CertificateRenderer = ({ user, award, onClose }) => {
    const canvasRef = useRef(null);
  
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const bgImg = new Image();
      // 如果有自定义背景URL则加载，否则用默认渐变
      if (award.bg_url) {
          bgImg.crossOrigin = "anonymous";
          bgImg.src = award.bg_url;
          bgImg.onload = () => draw(ctx, bgImg);
          bgImg.onerror = () => draw(ctx, null); // Fallback
      } else {
          draw(ctx, null);
      }

      function draw(c, img) {
        if (img) {
            c.drawImage(img, 0, 0, 800, 600);
        } else {
            const grad = c.createLinearGradient(0, 0, 800, 600);
            grad.addColorStop(0, '#ebf8ff');
            grad.addColorStop(1, '#90cdf4');
            c.fillStyle = grad;
            c.fillRect(0, 0, 800, 600);
        }
        
        c.strokeStyle = '#2d3748';
        c.lineWidth = 10;
        c.strokeRect(20, 20, 760, 560);
        
        c.fillStyle = '#1a202c';
        c.textAlign = 'center';
        
        c.font = 'bold 48px serif';
        c.fillText(award.name, 400, 150);
        c.font = 'italic 24px sans-serif';
        c.fillText('This is to certify that', 400, 220);
        c.font = 'bold 64px monospace';
        c.fillStyle = '#c53030';
        c.fillText(user.callsign, 400, 300);
        c.fillStyle = '#2d3748';
        c.font = '20px sans-serif';
        c.fillText('Has achieved requirements for this award', 400, 360);
        c.font = '18px sans-serif';
        c.textAlign = 'left';
        c.fillText(`Date: ${new Date().toLocaleDateString()}`, 100, 500);
      }
    }, [user, award]);
  
    const downloadCert = () => {
      const link = document.createElement('a');
      link.download = `${user.callsign}_${award.name}.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    };
  
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-4 rounded-lg shadow-2xl max-w-4xl w-full flex flex-col items-center">
          <canvas ref={canvasRef} width={800} height={600} className="w-full h-auto shadow mb-4" />
          <div className="flex gap-4">
            <button onClick={downloadCert} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded">
              <Download size={20} /> Download PNG
            </button>
            <button onClick={onClose} className="bg-gray-500 text-white px-6 py-2 rounded">Close</button>
          </div>
        </div>
      </div>
    );
};

export default function App() {
  const [appState, setAppState] = useState('loading');
  const [user, setUser] = useState(null);
  const [sysConfig, setSysConfig] = useState({ installed: false, adminPath: 'admin' });
  
  const [view, setView] = useState('home');
  const [adminTab, setAdminTab] = useState('awards'); // awards, users, settings
  const [lang, setLang] = useState('zh'); // 默认中文

  const [msg, setMsg] = useState({ text: '', type: '' });
  const [stats, setStats] = useState({ qsos: 0, dxcc: 0, awards: [] });
  const [uploadText, setUploadText] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ processing: false, percent: 0, result: null });

  // Admin Data
  const [adminUsers, setAdminUsers] = useState([]);
  
  // Forms
  const [authForm, setAuthForm] = useState({ callsign: '', password: '', code: '' });
  const [installForm, setInstallForm] = useState({ dbHost: 'localhost', dbPort: 5432, dbUser: 'postgres', dbPass: '', dbName: 'ham_awards', adminCall: 'ADMIN', adminPass: 'admin123', adminPath: 'admin' });
  const [newAward, setNewAward] = useState({ name: '', description: '', band: '', mode: '', minDxcc: '1', bgUrl: '' });
  
  // Profile Forms
  const [profileForm, setProfileForm] = useState({ password: '' });

  // Security
  const [secModal, setSecModal] = useState({ open: false, action: null });
  const [twoFaSetup, setTwoFaSetup] = useState(null);

  const t = (key, nested) => {
    if (nested) return TRANSLATIONS[lang][key][nested] || nested;
    return TRANSLATIONS[lang][key] || key;
  };

  useEffect(() => { checkSystem(); }, []);
  useEffect(() => {
      // 监听 Hash 变化以进入 Admin
      const handleHashChange = () => {
        const hash = window.location.hash.replace('#/', '');
        if (user && user.role === 'admin' && hash === sysConfig.adminPath) {
           setView('admin');
        }
      };
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user, sysConfig]);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const checkSystem = async () => {
    try {
      const data = await apiFetch('/system-status');
      setSysConfig(data);
      if (!data.installed) {
        setAppState('install');
      } else {
        const storedUser = localStorage.getItem('ham_user');
        if (storedUser) {
           const u = JSON.parse(storedUser);
           setUser(u);
           setLang(u.language || 'zh'); // 加载用户语言偏好
           setAppState('dashboard');
           loadStats();
        } else {
           setAppState('login');
        }
      }
    } catch (e) { showMsg('Connection Failed', 'error'); }
  };

  // --- Actions ---

  const handleInstall = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/install', { method: 'POST', body: JSON.stringify(installForm) });
      showMsg('Success! Please Login.');
      checkSystem();
    } catch (err) { showMsg(err.message, 'error'); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(authForm) });
      if (data.error === '2FA_REQUIRED') {
        showMsg(t('need2fa'), 'info');
        return;
      }
      localStorage.setItem('ham_token', data.token);
      localStorage.setItem('ham_user', JSON.stringify(data.user));
      setUser(data.user);
      setLang(data.user.language || 'zh');
      setAppState('dashboard');
      loadStats();
    } catch (err) { showMsg(err.message, 'error'); }
  };

  const handleRegister = async () => {
    try {
      await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(authForm) });
      showMsg('Registered! Please login.');
    } catch (err) { showMsg(err.message, 'error'); }
  };

  const loadStats = async () => {
    if (!user) return;
    try { const data = await apiFetch('/dashboard/stats'); setStats(data); } catch (e) {}
  };

  const handleUpload = async () => {
      setUploadProgress({ processing: true, percent: 10, result: null });
      // 模拟进度条动画
      let p = 10;
      const interval = setInterval(() => {
          p += Math.random() * 10;
          if (p > 90) p = 90;
          setUploadProgress(prev => ({ ...prev, percent: p }));
      }, 200);

      try {
          const res = await apiFetch('/qsos/upload', { method: 'POST', body: JSON.stringify({ rawAdif: uploadText }) });
          clearInterval(interval);
          setUploadProgress({ processing: false, percent: 100, result: res });
          setUploadText('');
          loadStats();
      } catch (err) {
          clearInterval(interval);
          setUploadProgress({ processing: false, percent: 0, result: null });
          showMsg(err.message, 'error');
      }
  };

  // --- Security & Profile Actions ---

  const triggerSecAction = (actionFunction) => {
      setSecModal({ open: true, action: actionFunction });
  };

  const confirmSecAction = async (code) => {
      const action = secModal.action;
      setSecModal({ open: false, action: null });
      if (action) await action(code);
  };

  const toggle2FA = async (enable) => {
      if (enable) {
          const data = await apiFetch('/auth/2fa/setup', { method: 'POST' });
          setTwoFaSetup(data);
      } else {
          triggerSecAction(async (code) => {
              await apiFetch('/auth/2fa/disable', { 
                  method: 'POST', 
                  headers: { 'x-2fa-code': code } 
              });
              setUser({...user, has2fa: false});
              showMsg('2FA Disabled');
          });
      }
  };

  const verify2FASetup = async (code) => {
      try {
          await apiFetch('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ token: code, secret: twoFaSetup.secret }) });
          setTwoFaSetup(null);
          setUser({...user, has2fa: true});
          showMsg('2FA Enabled');
      } catch(err) { showMsg(err.message, 'error'); }
  };

  const updateProfile = async (code) => {
      try {
          const body = { language: lang };
          if (profileForm.password) body.password = profileForm.password;
          
          await apiFetch('/profile/info', { 
              method: 'PUT', 
              headers: { 'x-2fa-code': code },
              body: JSON.stringify(body)
          });
          showMsg('Profile Updated');
          setProfileForm({ password: '' });
      } catch(err) { showMsg(err.message, 'error'); }
  };

  const clearMyLogs = async (code) => {
      try {
          await apiFetch('/profile/logs', { method: 'DELETE', headers: { 'x-2fa-code': code } });
          showMsg('Logs Cleared');
          loadStats();
      } catch(err) { showMsg(err.message, 'error'); }
  };

  const deleteMyAccount = async (code) => {
      try {
          await apiFetch('/profile/account', { method: 'DELETE', headers: { 'x-2fa-code': code } });
          localStorage.clear();
          window.location.reload();
      } catch(err) { showMsg(err.message, 'error'); }
  };

  // --- Admin Actions ---

  const loadAdminUsers = async () => {
      try { setAdminUsers(await apiFetch('/admin/users')); } catch(e){}
  };

  const adminDeleteUser = (id) => triggerSecAction(async (code) => {
      await apiFetch(`/admin/users/${id}`, { method: 'DELETE', headers: { 'x-2fa-code': code } });
      showMsg('User Deleted');
      loadAdminUsers();
  });

  const adminClearUserLogs = (id) => triggerSecAction(async (code) => {
      await apiFetch(`/admin/users/${id}/logs`, { method: 'DELETE', headers: { 'x-2fa-code': code } });
      showMsg('User Logs Cleared');
      loadAdminUsers();
  });

  const adminResetPass = (id) => triggerSecAction(async (code) => {
      const newPass = prompt("Enter new password for user:");
      if(!newPass) return;
      await apiFetch(`/admin/users/${id}/reset-password`, { 
          method: 'POST', 
          headers: { 'x-2fa-code': code },
          body: JSON.stringify({ newPassword: newPass })
      });
      showMsg('Password Reset');
  });

  const adminCreateAward = async (e) => {
      e.preventDefault();
      const criteria = { minDxcc: parseInt(newAward.minDxcc) };
      if(newAward.band) criteria['jsonb_raw.band'] = newAward.band;
      if(newAward.mode) criteria['jsonb_raw.mode'] = newAward.mode;
      try {
          await apiFetch('/admin/awards', { method: 'POST', body: JSON.stringify({ ...newAward, bgStyle: 'bg-blue-100', criteria }) });
          showMsg('Award Created');
      } catch(e) { showMsg(e.message, 'error'); }
  };

  const adminUpdateSettings = async (type) => { // path or password
      triggerSecAction(async (code) => {
          if (type === 'path') {
              const p = prompt("New Admin Path:");
              if(p) {
                await apiFetch('/admin/settings/path', { method: 'POST', headers: { 'x-2fa-code': code }, body: JSON.stringify({ newPath: p }) });
                showMsg('Path Updated');
                setSysConfig({...sysConfig, adminPath: p});
              }
          } else {
              const p = prompt("New Admin Password:");
              if(p) await apiFetch('/admin/settings/password', { method: 'POST', headers: { 'x-2fa-code': code }, body: JSON.stringify({ newPassword: p }) });
              showMsg('Password Updated');
          }
      });
  };

  // --- Render ---

  if (appState === 'loading') return <div className="p-10 text-center">{t('loading')}</div>;

  if (appState === 'install') return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center p-4">
        <form onSubmit={handleInstall} className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full space-y-4">
            <h2 className="text-2xl font-bold">{t('installTitle')}</h2>
            <div className="grid grid-cols-2 gap-2">
                <input className="border p-2 rounded" placeholder={t('dbHost')} value={installForm.dbHost} onChange={e=>setInstallForm({...installForm, dbHost: e.target.value})} />
                <input className="border p-2 rounded" placeholder="DB Port" value={installForm.dbPort} onChange={e=>setInstallForm({...installForm, dbPort: e.target.value})} />
                <input className="border p-2 rounded" placeholder="DB User" value={installForm.dbUser} onChange={e=>setInstallForm({...installForm, dbUser: e.target.value})} />
                <input className="border p-2 rounded" placeholder="DB Pass" type="password" value={installForm.dbPass} onChange={e=>setInstallForm({...installForm, dbPass: e.target.value})} />
                <input className="border p-2 rounded col-span-2" placeholder="DB Name" value={installForm.dbName} onChange={e=>setInstallForm({...installForm, dbName: e.target.value})} />
            </div>
            <div className="border-t pt-4 space-y-2">
                <input className="border p-2 rounded w-full" placeholder={t('adminCall')} value={installForm.adminCall} onChange={e=>setInstallForm({...installForm, adminCall: e.target.value})} />
                <input className="border p-2 rounded w-full" placeholder={t('password')} type="password" value={installForm.adminPass} onChange={e=>setInstallForm({...installForm, adminPass: e.target.value})} />
                <div className="flex items-center gap-2">
                    <span>/#/</span>
                    <input className="border p-2 rounded flex-1" placeholder={t('adminPath')} value={installForm.adminPath} onChange={e=>setInstallForm({...installForm, adminPath: e.target.value})} />
                </div>
            </div>
            <button className="w-full bg-green-600 text-white py-2 rounded font-bold">Install</button>
        </form>
    </div>
  );

  if (appState === 'login') return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md">
              <h1 className="text-2xl font-bold text-center mb-6">{t('loginTitle')}</h1>
              <form onSubmit={handleLogin} className="space-y-4">
                  <input className="w-full p-2 border rounded uppercase" placeholder={t('callsign')} value={authForm.callsign} onChange={e=>setAuthForm({...authForm, callsign: e.target.value.toUpperCase()})} />
                  <input className="w-full p-2 border rounded" type="password" placeholder={t('password')} value={authForm.password} onChange={e=>setAuthForm({...authForm, password: e.target.value})} />
                  <input className="w-full p-2 border rounded" placeholder={t('code2fa')} value={authForm.code} onChange={e=>setAuthForm({...authForm, code: e.target.value})} />
                  <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded">{t('loginBtn')}</button>
                      <button type="button" onClick={handleRegister} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded">{t('regBtn')}</button>
                  </div>
              </form>
              {msg.text && <div className="mt-4 p-2 bg-red-100 text-red-700 text-sm rounded text-center">{msg.text}</div>}
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
        <SecurityModal isOpen={secModal.open} onClose={()=>setSecModal({open:false, action:null})} onConfirm={confirmSecAction} has2FA={user.has2fa} />
        
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col">
            <div className="p-6 font-bold text-xl border-b border-slate-700 flex items-center gap-2">
                <Database className="text-blue-400"/> HAM LOG
            </div>
            <div className="p-4 border-b border-slate-700">
                <div className="font-mono text-xl text-yellow-400">{user.callsign}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                    {user.has2fa ? <Lock size={10} className="text-green-400"/> : <Lock size={10} className="text-red-400"/>} 
                    {user.has2fa ? '2FA ON' : '2FA OFF'}
                </div>
            </div>
            <nav className="p-4 space-y-2 flex-1">
                <button onClick={()=>setView('home')} className={`w-full flex items-center gap-3 px-4 py-3 rounded ${view==='home'?'bg-blue-700':'hover:bg-slate-800'}`}>
                    <Award size={18}/> {t('awards')}
                </button>
                <button onClick={()=>setView('upload')} className={`w-full flex items-center gap-3 px-4 py-3 rounded ${view==='upload'?'bg-blue-700':'hover:bg-slate-800'}`}>
                    <Upload size={18}/> {t('upload')}
                </button>
                <button onClick={()=>setView('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded ${view==='profile'?'bg-blue-700':'hover:bg-slate-800'}`}>
                    <User size={18}/> {t('profile')}
                </button>
                
                {user.role === 'admin' && view === 'admin' && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="px-4 text-xs text-slate-400 mb-2 font-bold uppercase">{t('adminPanel')}</div>
                        <button onClick={()=>setAdminTab('awards')} className={`w-full text-left px-4 py-2 text-sm ${adminTab==='awards'?'text-purple-300':'text-gray-400'}`}>{t('adminTabs', 'awards')}</button>
                        <button onClick={()=>{setAdminTab('users'); loadAdminUsers();}} className={`w-full text-left px-4 py-2 text-sm ${adminTab==='users'?'text-purple-300':'text-gray-400'}`}>{t('adminTabs', 'users')}</button>
                        <button onClick={()=>setAdminTab('settings')} className={`w-full text-left px-4 py-2 text-sm ${adminTab==='settings'?'text-purple-300':'text-gray-400'}`}>{t('adminTabs', 'settings')}</button>
                    </div>
                )}
            </nav>
            <div className="p-4">
                <button onClick={()=>{localStorage.clear(); window.location.reload();}} className="w-full flex items-center gap-3 px-4 py-3 rounded hover:bg-red-900 text-red-400">
                    <LogOut size={18}/> {t('logout')}
                </button>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto relative">
            {msg.text && <div className={`fixed top-4 right-4 z-[90] px-6 py-3 rounded shadow animate-bounce ${msg.type==='error'?'bg-red-500 text-white':'bg-green-500 text-white'}`}>{msg.text}</div>}

            {/* 2FA Setup Overlay */}
            {twoFaSetup && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center">
                    <div className="bg-white p-6 rounded text-center">
                        <h3 className="font-bold mb-4">Scan QR Code</h3>
                        <img src={twoFaSetup.qrCode} className="mx-auto mb-4"/>
                        <input className="border p-2 rounded w-full text-center mb-4" placeholder="Enter Code" onChange={e => { if(e.target.value.length===6) verify2FASetup(e.target.value); }} />
                        <button onClick={()=>setTwoFaSetup(null)} className="text-gray-500 text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {/* --- VIEWS --- */}

            {view === 'home' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                            <div className="text-gray-500 text-sm">{t('totalQso')}</div>
                            <div className="text-3xl font-bold">{stats.qsos}</div>
                        </div>
                        <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
                            <div className="text-gray-500 text-sm">{t('dxccStats')}</div>
                            <div className="text-3xl font-bold">{stats.dxcc}</div>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Award/> {t('awards')}</h2>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {stats.awards.map(award => (
                            <div key={award.id} className="bg-white rounded-xl shadow border overflow-hidden relative">
                                {award.bg_url && <img src={award.bg_url} className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"/>}
                                <div className={`h-2 ${award.bgStyle || 'bg-blue-400'}`}></div>
                                <div className="p-6 relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-xl font-bold">{award.name}</h3>
                                        {award.eligible ? <CheckCircle className="text-green-500"/> : <span className="text-xs bg-gray-100 px-2 py-1 rounded">In Progress</span>}
                                    </div>
                                    <p className="text-gray-600 text-sm mb-4">{award.description}</p>
                                    <div className="bg-slate-50 p-3 rounded mb-4 text-xs">
                                        <div className="flex justify-between mb-1">
                                            <span>Progress</span><span className="font-bold">{award.progress} / {award.required}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                                            <div className={`h-1.5 rounded-full ${award.eligible?'bg-green-500':'bg-blue-400'}`} style={{width: `${Math.min(100, (award.progress/award.required)*100)}%`}}></div>
                                        </div>
                                    </div>
                                    <button onClick={()=>alert('Certificate viewing not implemented in this snippet')} disabled={!award.eligible} className={`w-full py-2 rounded font-bold text-sm ${award.eligible?'bg-blue-600 text-white':'bg-slate-100 text-gray-400'}`}>{t('claimCert')}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'upload' && (
                <div className="max-w-2xl mx-auto space-y-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><Upload/> {t('upload')}</h2>
                    <div className="bg-white p-6 rounded shadow border-dashed border-2 border-slate-300 text-center">
                        <input type="file" onChange={e => {
                            const reader = new FileReader();
                            reader.onload = (evt) => setUploadText(evt.target.result);
                            reader.readAsText(e.target.files[0]);
                        }} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-blue-50 file:text-blue-700"/>
                    </div>
                    {uploadProgress.processing && (
                        <div className="bg-white p-4 rounded shadow space-y-2">
                            <div className="text-sm font-bold text-blue-600">{t('processing')}</div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{width: `${uploadProgress.percent}%`}}></div>
                            </div>
                        </div>
                    )}
                    {uploadProgress.result && (
                        <div className="bg-green-50 p-4 rounded border border-green-200 text-green-800 text-sm">
                            <strong>{t('processed')}!</strong> {t('added')}: {uploadProgress.result.added}, {t('skipped')}: {uploadProgress.result.skipped}
                        </div>
                    )}
                    <button onClick={handleUpload} disabled={!uploadText || uploadProgress.processing} className={`w-full py-3 rounded font-bold text-white ${uploadText?'bg-blue-600':'bg-gray-400'}`}>{t('upload')}</button>
                </div>
            )}

            {view === 'profile' && (
                <div className="max-w-2xl mx-auto space-y-8">
                    <h2 className="text-2xl font-bold flex items-center gap-2"><User/> {t('profile')}</h2>
                    
                    {/* Basic Settings */}
                    <div className="bg-white p-6 rounded shadow space-y-4">
                        <h3 className="font-bold border-b pb-2">{t('adminTabs', 'settings')}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500">Language / 语言</label>
                                <div className="flex gap-2 mt-1">
                                    <button onClick={()=>setLang('zh')} className={`flex-1 py-1 text-sm border rounded ${lang==='zh'?'bg-blue-600 text-white':'bg-white'}`}>{t('langZh')}</button>
                                    <button onClick={()=>setLang('en')} className={`flex-1 py-1 text-sm border rounded ${lang==='en'?'bg-blue-600 text-white':'bg-white'}`}>{t('langEn')}</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">{t('password')}</label>
                                <input className="w-full border p-1 rounded mt-1" type="password" placeholder="New Password" value={profileForm.password} onChange={e=>setProfileForm({...profileForm, password: e.target.value})} />
                            </div>
                        </div>
                        <button onClick={()=>triggerSecAction(updateProfile)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"><Save size={14}/> {t('save')}</button>
                    </div>

                    {/* Security */}
                    <div className="bg-white p-6 rounded shadow space-y-4">
                        <h3 className="font-bold border-b pb-2 flex items-center gap-2"><Shield size={18}/> Security</h3>
                        <div className="flex justify-between items-center">
                            <span>2FA Status: <strong className={user.has2fa?'text-green-600':'text-red-500'}>{user.has2fa ? 'ENABLED' : 'DISABLED'}</strong></span>
                            <button onClick={()=>toggle2FA(!user.has2fa)} className={`px-4 py-2 rounded text-sm font-bold text-white ${user.has2fa?'bg-red-500':'bg-green-600'}`}>
                                {user.has2fa ? t('disable2fa') : t('enable2fa')}
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-50 border border-red-200 p-6 rounded space-y-4">
                        <h3 className="font-bold text-red-800 border-b border-red-200 pb-2">Danger Zone</h3>
                        <div className="flex gap-4">
                            <button onClick={()=>triggerSecAction(clearMyLogs)} className="flex-1 bg-white border border-red-300 text-red-600 py-2 rounded text-sm hover:bg-red-100 flex items-center justify-center gap-2">
                                <RotateCcw size={16}/> {t('clearLogs')}
                            </button>
                            <button onClick={()=>triggerSecAction(deleteMyAccount)} className="flex-1 bg-red-600 text-white py-2 rounded text-sm hover:bg-red-700 flex items-center justify-center gap-2">
                                <Trash2 size={16}/> {t('deleteAccount')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ADMIN VIEWS --- */}
            {view === 'admin' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-purple-700 flex items-center gap-2"><Settings/> {t('adminPanel')}</h2>
                    
                    {adminTab === 'awards' && (
                        <div className="bg-white p-6 rounded shadow">
                            <h3 className="font-bold mb-4">Create Award</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <input className="border p-2 rounded col-span-2" placeholder="Name" value={newAward.name} onChange={e=>setNewAward({...newAward, name: e.target.value})} />
                                <input className="border p-2 rounded col-span-2" placeholder="Desc" value={newAward.description} onChange={e=>setNewAward({...newAward, description: e.target.value})} />
                                <input className="border p-2 rounded col-span-2" placeholder="Background Image URL (Optional)" value={newAward.bgUrl} onChange={e=>setNewAward({...newAward, bgUrl: e.target.value})} />
                                <select className="border p-2 rounded" value={newAward.band} onChange={e=>setNewAward({...newAward, band: e.target.value})}><option value="">Any Band</option><option value="20M">20M</option><option value="40M">40M</option></select>
                                <select className="border p-2 rounded" value={newAward.mode} onChange={e=>setNewAward({...newAward, mode: e.target.value})}><option value="">Any Mode</option><option value="FT8">FT8</option><option value="CW">CW</option></select>
                                <input className="border p-2 rounded" type="number" placeholder="Min DXCC" value={newAward.minDxcc} onChange={e=>setNewAward({...newAward, minDxcc: e.target.value})} />
                            </div>
                            <button onClick={adminCreateAward} className="bg-purple-600 text-white px-4 py-2 rounded font-bold">Publish Award</button>
                        </div>
                    )}

                    {adminTab === 'users' && (
                        <div className="bg-white p-6 rounded shadow overflow-x-auto">
                             <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b">
                                    <tr><th className="p-2">Call</th><th className="p-2">Role</th><th className="p-2">2FA</th><th className="p-2">Lang</th><th className="p-2">QSOs</th><th className="p-2">Actions</th></tr>
                                </thead>
                                <tbody>
                                    {adminUsers.map(u => (
                                        <tr key={u.id} className="border-b">
                                            <td className="p-2 font-mono font-bold">{u.callsign}</td>
                                            <td className="p-2">{u.role}</td>
                                            <td className="p-2">{u.has_2fa ? 'ON':'OFF'}</td>
                                            <td className="p-2 uppercase">{u.language}</td>
                                            <td className="p-2">{u.qso_count}</td>
                                            <td className="p-2 flex gap-2">
                                                <button onClick={()=>adminResetPass(u.id)} className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">Reset Pass</button>
                                                <button onClick={()=>adminClearUserLogs(u.id)} className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">Clear Log</button>
                                                <button onClick={()=>adminDeleteUser(u.id)} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">Del</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {adminTab === 'settings' && (
                        <div className="bg-white p-6 rounded shadow space-y-4">
                            <h3 className="font-bold">System Configuration</h3>
                            <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded mb-4">
                                Sensitive actions here require Admin 2FA (if enabled).
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={()=>adminUpdateSettings('path')} className="border p-4 rounded hover:bg-slate-50 text-left">
                                    <div className="font-bold text-gray-700">Change Admin Path</div>
                                    <div className="text-xs text-gray-500 mt-1">Current: /#/{sysConfig.adminPath}</div>
                                </button>
                                <button onClick={()=>adminUpdateSettings('password')} className="border p-4 rounded hover:bg-slate-50 text-left">
                                    <div className="font-bold text-gray-700">Change Admin Password</div>
                                    <div className="text-xs text-gray-500 mt-1">Reset system administrator password</div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </main>
    </div>
  );
}