import React, { useState, useEffect, useRef } from 'react';
import InstallView from './install';
import { 
  Upload, Award, Database, LogOut, CheckCircle, 
  Shield, Download, Settings, Server, Lock, QrCode, 
  User, Trash2, RotateCcw, Save, Menu, Globe, Key,
  FilePlus, Move, Check, X, AlertCircle, Edit, List,
  Layout, Eye, Play, CornerDownRight, BarChart, Plus,
  Search, ShieldCheck, UserPlus, Info, ExternalLink, Image as ImageIcon
} from 'lucide-react';

// ================= API Utils =================
const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('ham_token');
  const headers = options.headers || {};
  
  // 仅在有 body 且非 FormData 时添加 JSON Content-Type
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  // 2FA Header handling
  const twoFaCode = sessionStorage.getItem('temp_2fa_code');
  if (twoFaCode) {
      headers['x-2fa-code'] = twoFaCode;
      sessionStorage.removeItem('temp_2fa_code'); 
  }

  const res = await fetch(`/api${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
};

// ================= Components =================

// 1. User Center (Updated)
const UserCenterView = ({ user, refreshUser }) => {
    const [modal, setModal] = useState(null); // 'password', '2fa_setup', '2fa_disable'
    const [qr, setQr] = useState('');
    const [secret, setSecret] = useState('');
    const [code, setCode] = useState('');
    
    // Forms state
    const [passForm, setPassForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [disablePass, setDisablePass] = useState('');

    // Handle 2FA Setup Flow
    const start2FASetup = async (e) => {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        try {
            const res = await apiFetch('/user/2fa/setup', { method: 'POST' });
            setSecret(res.secret);
            setQr(res.qr);
            setModal('2fa_setup');
        } catch(err) { alert(err.message); }
    };

    const confirm2FA = async (e) => {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        try {
            await apiFetch('/user/2fa/enable', { method: 'POST', body: JSON.stringify({ secret, token: code }) });
            alert('2FA 已成功开启！');
            setModal(null);
            refreshUser();
        } catch(err) { alert(err.message); }
    };

    // Handle 2FA Disable
    const disable2FA = async (e) => {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        try {
            await apiFetch('/user/2fa/disable', { method: 'POST', body: JSON.stringify({ password: disablePass }) });
            alert('2FA 已关闭');
            setModal(null);
            refreshUser();
        } catch(err) { alert(err.message); }
    };

    // Handle Password Change
    const changePassword = async (e) => {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        if(passForm.newPassword !== passForm.confirmPassword) return alert('两次输入的新密码不一致');
        try {
            // Check if 2FA header needed
            if (user.has2fa) {
                const c = prompt('请输入 2FA 验证码以确认修改密码:');
                if(!c) return;
                sessionStorage.setItem('temp_2fa_code', c);
            }
            
            await apiFetch('/user/password', { method: 'POST', body: JSON.stringify(passForm) });
            alert('密码修改成功');
            setModal(null);
            setPassForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch(err) { alert(err.message); }
    };

    return (
        <div className="max-w-3xl space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><User className="text-blue-600"/> 用户中心</h3>
            
            {/* Account Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-black text-slate-400">
                        {user.callsign.substring(0,2)}
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{user.callsign}</div>
                        <div className="text-slate-500 text-sm">用户ID: {user.id} | 角色: {user.role}</div>
                    </div>
                </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><ShieldCheck className="text-green-600"/> 安全设置</h4>
                <div className="space-y-4">
                    
                    {/* Password */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Key className="text-slate-400" />
                            <div>
                                <div className="font-bold">登录密码</div>
                                <div className="text-xs text-slate-400">建议定期修改密码以保护账户安全</div>
                            </div>
                        </div>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModal('password'); }} className="bg-white border hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors">修改密码</button>
                    </div>

                    {/* 2FA */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Lock className={user.has2fa ? "text-green-500" : "text-slate-400"} />
                            <div>
                                <div className="font-bold">两步验证 (2FA)</div>
                                <div className="text-xs text-slate-400">{user.has2fa ? '已开启，账户受到保护' : '未开启，建议开启以提升安全性'}</div>
                            </div>
                        </div>
                        {user.has2fa ? (
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModal('2fa_disable'); }} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors">关闭</button>
                        ) : (
                            <button type="button" onClick={start2FASetup} className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors">开启</button>
                        )}
                    </div>

                </div>
            </div>

            {/* Modals */}
            {modal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 relative z-[101]">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="font-bold text-lg">
                                {modal === 'password' && '修改密码'}
                                {modal === '2fa_setup' && '配置两步验证'}
                                {modal === '2fa_disable' && '关闭两步验证'}
                            </h3>
                            <button type="button" onClick={()=>{setModal(null); setQr(''); setSecret('');}}><X size={20}/></button>
                        </div>

                        {modal === 'password' && (
                            <div className="space-y-4">
                                <input type="password" placeholder="当前密码" className="w-full border p-3 rounded-lg"
                                    value={passForm.oldPassword} onChange={e=>setPassForm({...passForm, oldPassword: e.target.value})} />
                                <input type="password" placeholder="新密码" className="w-full border p-3 rounded-lg"
                                    value={passForm.newPassword} onChange={e=>setPassForm({...passForm, newPassword: e.target.value})} />
                                <input type="password" placeholder="确认新密码" className="w-full border p-3 rounded-lg"
                                    value={passForm.confirmPassword} onChange={e=>setPassForm({...passForm, confirmPassword: e.target.value})} />
                                <button type="button" onClick={changePassword} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">确认修改</button>
                            </div>
                        )}

                        {modal === '2fa_setup' && (
                            <div className="space-y-4 text-center">
                                <p className="text-sm text-slate-500 text-left">请使用 Authenticator App (如 Google Auth, Microsoft Auth) 扫描下方二维码。</p>
                                <div className="flex justify-center bg-white p-2 border rounded-lg">
                                    {qr ? <img src={qr} alt="2FA QR Code" className="w-48 h-48"/> : <div className="w-48 h-48 flex items-center justify-center text-slate-300">加载中...</div>}
                                </div>
                                <input placeholder="输入 App 生成的 6 位验证码" className="w-full border p-3 rounded-lg text-center font-mono text-xl tracking-widest"
                                    maxLength={6} value={code} onChange={e=>setCode(e.target.value)} />
                                <button type="button" onClick={confirm2FA} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">验证并开启</button>
                            </div>
                        )}

                        {modal === '2fa_disable' && (
                            <div className="space-y-4">
                                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">警告：关闭两步验证将降低您的账户安全性。</p>
                                <input type="password" placeholder="输入当前登录密码以确认" className="w-full border p-3 rounded-lg"
                                    value={disablePass} onChange={e=>setDisablePass(e.target.value)} />
                                <button type="button" onClick={disable2FA} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold">确认关闭</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// 2. Logbook View (from previous context, kept for completeness)
const LogbookView = ({ t }) => {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [stats, setStats] = useState(null);

    const handleUpload = async (e) => {
        e.preventDefault();
        if(!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await apiFetch('/logbook/upload', { method: 'POST', body: formData });
            setStats(res);
            alert(`成功导入 ${res.imported} 条 QSO 记录`);
        } catch (err) { alert(err.message); } finally { setUploading(false); }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Upload className="text-blue-600"/> 上传日志 (ADIF)</h3>
                <form onSubmit={handleUpload} className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
                        <input type="file" accept=".adi,.adif" onChange={e => setFile(e.target.files[0])} className="hidden" id="adif-input" />
                        <label htmlFor="adif-input" className="cursor-pointer block">
                            <Database size={48} className="mx-auto text-slate-400 mb-2"/>
                            <div className="text-slate-600 font-medium">{file ? file.name : "点击选择或拖拽 ADIF 文件"}</div>
                        </label>
                    </div>
                    {uploading && <div className="text-center text-blue-600 font-bold animate-pulse">正在解析并导入数据...</div>}
                    <button disabled={!file || uploading} className="bg-blue-600 text-white w-full py-3 rounded-xl font-bold disabled:opacity-50">
                        {uploading ? '处理中...' : '开始上传'}
                    </button>
                </form>
                {stats && (
                    <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-xl flex items-center gap-3">
                        <CheckCircle size={20} />
                        <span>本次解析 {stats.count} 条记录，成功入库 {stats.imported} 条 (去重后)。</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// 3. Award Designer (from previous context)
const AwardDesigner = ({ onClose }) => {
    const [bgUrl, setBgUrl] = useState('');
    const [elements, setElements] = useState([]); 
    const [dragId, setDragId] = useState(null);
    const [rules, setRules] = useState([{ field: 'band', operator: 'eq', value: '20M' }]);
    const [meta, setMeta] = useState({ name: '', description: '' });

    const handleBgUpload = async (e) => {
        const f = e.target.files[0];
        if(!f) return;
        const fd = new FormData();
        fd.append('bg', f);
        try {
            const res = await apiFetch('/awards/upload-bg', { method: 'POST', body: fd });
            setBgUrl(res.url);
        } catch (err) { alert('背景上传失败: ' + err.message); }
    };

    const addElement = (type) => {
        setElements([...elements, { id: Date.now(), type, x: 50, y: 50, label: type === 'text' ? '{CALLSIGN}' : 'Logo' }]);
    };

    const handleDrag = (e) => {
        if (!dragId) return;
        const container = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - container.left) / container.width) * 100; 
        const y = ((e.clientY - container.top) / container.height) * 100;
        setElements(elements.map(el => el.id === dragId ? { ...el, x, y } : el));
    };

    const saveAward = async (status = 'draft') => {
        try {
            await apiFetch('/awards', {
                method: 'POST',
                body: JSON.stringify({ name: meta.name, description: meta.description, bg_url: bgUrl, rules, layout: elements, status })
            });
            alert('保存成功');
            onClose();
        } catch(err) { alert(err.message); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <h2 className="font-bold text-lg">奖状设计器</h2>
                    <button onClick={onClose}><X /></button>
                </div>
                <div className="flex-1 flex overflow-hidden">
                    <div className="w-80 bg-slate-50 border-r p-4 overflow-y-auto space-y-6">
                        <div>
                            <h4 className="font-bold mb-2">基本信息</h4>
                            <input className="w-full mb-2 p-2 border rounded" placeholder="奖状名称" value={meta.name} onChange={e=>setMeta({...meta, name:e.target.value})} />
                            <textarea className="w-full p-2 border rounded" placeholder="描述" value={meta.description} onChange={e=>setMeta({...meta, description:e.target.value})} />
                        </div>
                        <div>
                            <h4 className="font-bold mb-2">判定规则 (ADIF)</h4>
                            {rules.map((r, idx) => (
                                <div key={idx} className="flex gap-2 mb-2">
                                    <input className="w-1/3 p-1 text-sm border rounded" value={r.field} onChange={e=>{const n=[...rules];n[idx].field=e.target.value;setRules(n)}} placeholder="Field"/>
                                    <input className="w-1/3 p-1 text-sm border rounded" value={r.value} onChange={e=>{const n=[...rules];n[idx].value=e.target.value;setRules(n)}} placeholder="Value"/>
                                    <button onClick={()=>setRules(rules.filter((_,i)=>i!==idx))} className="text-red-500"><X size={16}/></button>
                                </div>
                            ))}
                            <button onClick={()=>setRules([...rules, {field:'', operator:'eq', value:''}])} className="text-xs text-blue-600 font-bold">+ 添加规则</button>
                        </div>
                        <div>
                            <h4 className="font-bold mb-2">背景图</h4>
                            <input type="file" onChange={handleBgUpload} className="text-sm" />
                        </div>
                        <div>
                            <h4 className="font-bold mb-2">元素添加</h4>
                            <div className="flex gap-2">
                                <button onClick={()=>addElement('text')} className="flex-1 bg-white border p-2 rounded text-sm hover:bg-slate-100">插入文本变量</button>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">支持变量: {'{CALLSIGN}'}, {'{DATE}'}</p>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-200 p-8 flex items-center justify-center overflow-auto">
                        <div className="bg-white shadow-xl relative overflow-hidden select-none"
                            style={{ width: '800px', height: '600px', backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                            onMouseMove={handleDrag} onMouseUp={()=>setDragId(null)} onMouseLeave={()=>setDragId(null)}
                        >
                            {elements.map(el => (
                                <div key={el.id} className={`absolute cursor-move border border-dashed border-transparent hover:border-blue-500 px-2 py-1 ${dragId === el.id ? 'border-blue-500' : ''}`}
                                    style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)' }} onMouseDown={()=>setDragId(el.id)}
                                >
                                    <input value={el.label} onChange={e => setElements(elements.map(x => x.id === el.id ? {...x, label: e.target.value} : x))}
                                        className="bg-transparent text-black font-bold text-xl border-none focus:ring-0 w-40 text-center" />
                                    <button onClick={()=>setElements(elements.filter(x=>x.id!==el.id))} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs"><X size={10}/></button>
                                </div>
                            ))}
                            {(!bgUrl) && <div className="absolute inset-0 flex items-center justify-center text-slate-400">请上传背景图</div>}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-4">
                    <button onClick={()=>saveAward('draft')} className="px-6 py-2 border rounded-lg font-bold text-slate-600">保存草稿</button>
                    <button onClick={()=>saveAward('pending')} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">提交审核</button>
                </div>
            </div>
        </div>
    );
};

// 4. User Management (Admin - from previous context)
const UserManage = () => {
    const [users, setUsers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [twoFaCode, setTwoFaCode] = useState('');
    
    useEffect(() => { loadUsers(); }, []);
    
    const loadUsers = async () => { try { const data = await apiFetch('/admin/users'); setUsers(data); } catch(e) {} };

    const handleAction = async (method, url, body = {}) => {
        try {
            const headers = twoFaCode ? { 'x-2fa-code': twoFaCode } : {};
            await apiFetch(url, { method, body: JSON.stringify(body), headers });
            alert('操作成功');
            loadUsers(); setEditing(null); setTwoFaCode('');
        } catch (err) {
            if (err.error === '2FA_REQUIRED') {
                const code = prompt('请输入管理员 2FA 验证码以继续:');
                if(code) { setTwoFaCode(code); alert('验证码已缓存，请再次点击确认。'); }
            } else { alert(err.message); }
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="font-bold text-xl flex items-center gap-2"><User size={24}/> 用户管理</h3>
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr><th className="p-4">ID</th><th className="p-4">呼号</th><th className="p-4">角色</th><th className="p-4">2FA</th><th className="p-4">操作</th></tr>
                    </thead>
                    <tbody className="divide-y">
                        {users.map(u => (
                            <tr key={u.id}>
                                <td className="p-4">{u.id}</td>
                                <td className="p-4 font-mono font-bold">{u.callsign}</td>
                                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role==='admin'?'bg-red-100 text-red-700':u.role==='award_admin'?'bg-purple-100 text-purple-700':'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                                <td className="p-4">{u.has_2fa ? <Check className="text-green-500"/> : <span className="text-slate-300">-</span>}</td>
                                <td className="p-4 flex gap-2">
                                    <button onClick={()=>setEditing(u)} className="p-2 hover:bg-slate-100 rounded"><Edit size={16}/></button>
                                    <button onClick={()=>handleAction('DELETE', `/admin/users/${u.id}`)} className="p-2 hover:bg-red-50 text-red-500 rounded"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
                        <h4 className="font-bold">编辑用户 {editing.callsign}</h4>
                        <select className="w-full p-2 border rounded" value={editing.role} onChange={e=>setEditing({...editing, role:e.target.value})}>
                            <option value="user">普通用户</option><option value="award_admin">奖状管理员</option><option value="admin">系统管理员</option>
                        </select>
                        <input className="w-full p-2 border rounded" placeholder="重置密码 (留空不修改)" type="password" id="newpass"/>
                        <button onClick={()=>{
                            const pass = document.getElementById('newpass').value;
                            handleAction('PUT', `/admin/users/${editing.id}`, { role: editing.role, password: pass || undefined })
                        }} className="w-full bg-blue-600 text-white py-2 rounded font-bold">保存修改</button>
                        <button onClick={()=>setEditing(null)} className="w-full text-slate-500 py-2">取消</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ================= Main App =================

export default function App() {
  const [view, setView] = useState('loading'); 
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [subView, setSubView] = useState('dashboard');
  const [loginTab, setLoginTab] = useState('user'); 
  const [show2FAInput, setShow2FAInput] = useState(false);
  const [loginForm, setLoginForm] = useState({});
  const [showDesigner, setShowDesigner] = useState(false);

  useEffect(() => {
    apiFetch('/system-status').then(status => {
        setConfig(status);
        if (!status.installed) {
            setView('install');
        } else {
            const savedUser = localStorage.getItem('ham_user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
                setView('main');
            } else {
                setView('login');
            }
        }
    }).catch(() => setView('login'));
  }, []);

  const refreshUser = async () => {
    try {
        const u = await apiFetch('/user/profile');
        setUser(u);
        localStorage.setItem('ham_user', JSON.stringify(u));
    } catch(e) { console.error(e); }
  };

  const handleLogin = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      const payload = { ...loginForm, ...data, loginType: loginTab };
      
      try {
          const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
          localStorage.setItem('ham_token', res.token);
          localStorage.setItem('ham_user', JSON.stringify(res.user));
          setUser(res.user);
          if (loginTab === 'admin') setSubView(res.user.role === 'admin' ? 'sysAdmin' : 'awardAdmin');
          else setSubView('dashboard');
          setView('main');
          setShow2FAInput(false);
      } catch (err) {
          if (err.error === '2FA_REQUIRED') {
              setLoginForm(data);
              setShow2FAInput(true);
          } else { alert(err.message || '登录失败'); }
      }
  };

  const handleLogout = () => { localStorage.clear(); window.location.reload(); };

  if (view === 'install') return <InstallView onComplete={() => window.location.reload()} t={{installTitle: '系统安装'}} />;

  if (view === 'login') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className={`p-8 text-white text-center transition-colors ${loginTab === 'admin' ? 'bg-slate-800' : 'bg-blue-600'}`}>
          <h1 className="text-2xl font-bold mb-2">HAM AWARDS</h1>
          <p className="text-sm opacity-80">{loginTab === 'admin' ? '管理人员通道' : '会员中心'}</p>
        </div>
        <div className="flex border-b">
            <button onClick={()=>{setLoginTab('user'); setShow2FAInput(false)}} className={`flex-1 py-4 font-bold text-sm ${loginTab==='user'?'text-blue-600 border-b-2 border-blue-600':'text-slate-400'}`}>普通用户登录</button>
            <button onClick={()=>{setLoginTab('admin'); setShow2FAInput(false)}} className={`flex-1 py-4 font-bold text-sm ${loginTab==='admin'?'text-slate-800 border-b-2 border-slate-800':'text-slate-400'}`}>管理员登录</button>
        </div>
        <form onSubmit={handleLogin} className="p-8 space-y-4">
            {!show2FAInput ? (
                <>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">呼号</label><input name="callsign" required className="w-full border rounded-lg p-3 outline-none focus:ring-2 ring-blue-100 transition-all" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">密码</label><input name="password" type="password" required className="w-full border rounded-lg p-3 outline-none focus:ring-2 ring-blue-100 transition-all" /></div>
                </>
            ) : (
                <div className="space-y-1 animate-in fade-in slide-in-from-right duration-300">
                    <label className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2"><Lock size={12}/> 二步验证码 (2FA)</label>
                    <input name="code" autoFocus className="w-full border-2 border-blue-500 rounded-lg p-3 text-center tracking-[1em] font-mono font-bold text-xl" placeholder="000000" maxLength={6} />
                    <button type="button" onClick={()=>setShow2FAInput(false)} className="text-xs text-slate-400 hover:text-slate-600 underline w-full text-center block mt-2">返回重新输入账号</button>
                </div>
            )}
            <button className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${loginTab==='admin'?'bg-slate-800 shadow-slate-200':'bg-blue-600 shadow-blue-200'}`}>{show2FAInput ? '验证并登录' : '下一步'}</button>
            {loginTab === 'user' && !show2FAInput && <button type="button" onClick={() => {const c=prompt('注册呼号:');const p=prompt('注册密码:');if(c&&p)apiFetch('/auth/register',{method:'POST',body:JSON.stringify({callsign:c,password:p})}).then(()=>alert('注册成功')).catch(e=>alert(e.message));}} className="w-full text-center text-sm text-slate-400 hover:text-blue-600">没有账号？立即注册</button>}
        </form>
      </div>
    </div>
  );

  if (view === 'main') {
      const menu = [
          { id: 'dashboard', label: '概览', icon: BarChart, show: true },
          { id: 'awards', label: '奖状大厅', icon: Award, show: true },
          { id: 'my_awards', label: '我的奖状', icon: CheckCircle, show: user.role === 'user' },
          { id: 'logbook', label: '日志管理', icon: Database, show: user.role === 'user' },
          { id: 'awardAdmin', label: '奖状管理', icon: FilePlus, show: ['admin', 'award_admin'].includes(user.role) },
          { id: 'sysAdmin', label: '系统设置', icon: Settings, show: user.role === 'admin' },
          { id: 'users', label: '用户管理', icon: User, show: user.role === 'admin' },
          { id: 'userCenter', label: '用户中心', icon: User, show: true },
      ].filter(i => i.show);

      return (
          <div className="flex h-screen bg-slate-50 overflow-hidden">
              <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
                  <div className="p-6 border-b border-slate-800">
                      <h1 className="font-black text-xl tracking-wider">HAM AWARDS</h1>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>{user.callsign} ({user.role})</div>
                  </div>
                  <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                      {menu.map(item => (
                          <button key={item.id} onClick={()=>setSubView(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${subView===item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                              <item.icon size={18} /><span className="font-medium text-sm">{item.label}</span>
                          </button>
                      ))}
                  </nav>
                  <div className="p-4 border-t border-slate-800">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg"><LogOut size={18} /> <span className="font-medium text-sm">退出登录</span></button>
                  </div>
              </aside>
              <main className="flex-1 overflow-y-auto p-8 relative">
                  <div className="max-w-5xl mx-auto">
                      {subView === 'dashboard' && (
                          <div className="grid grid-cols-3 gap-6">
                              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs font-bold uppercase mb-2">操作权限</div><div className="text-2xl font-black text-slate-800 capitalize">{user.role.replace('_', ' ')}</div></div>
                              <div className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-200 text-white"><div className="text-blue-200 text-xs font-bold uppercase mb-2">系统状态</div><div className="text-2xl font-bold flex items-center gap-2"><CheckCircle /> 正常运行</div></div>
                              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between"><div className="text-slate-500 text-xs font-bold uppercase mb-2">账户安全</div><div className="flex items-center justify-between"><span className="font-bold">{user.has2fa ? '2FA 已开启' : '2FA 未开启'}</span>{!user.has2fa && <button onClick={()=>{setSubView('userCenter')}} className="text-xs bg-slate-900 text-white px-2 py-1 rounded">去开启</button>}</div></div>
                          </div>
                      )}
                      {subView === 'logbook' && <LogbookView />}
                      {subView === 'users' && <UserManage />}
                      {subView === 'awardAdmin' && (
                          <div className="space-y-6">
                             <div className="flex justify-between items-center"><h3 className="font-bold text-xl">奖状管理</h3><button onClick={()=>setShowDesigner(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow flex items-center gap-2"><Plus size={18}/> 新建奖状</button></div>
                             <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">暂无已发布的奖状，请点击新建</div>
                          </div>
                      )}
                      {subView === 'userCenter' && <UserCenterView user={user} refreshUser={refreshUser} />}
                  </div>
                  {showDesigner && <AwardDesigner onClose={()=>setShowDesigner(false)} />}
              </main>
          </div>
      );
  }
  return null;
}