import React, { useState, useEffect, useRef } from 'react';
// 移除外部引用，直接在下方定义
// import InstallView from './install.jsx'; 
import { 
  Upload, Award, Database, LogOut, CheckCircle, 
  Shield, Download, Settings, Server, Lock, QrCode, 
  User, Trash2, RotateCcw, Save, Menu, Globe, Key,
  FilePlus, Move, Check, X, AlertCircle, Edit, List,
  Layout, Eye, Play, CornerDownRight, BarChart, Plus,
  Search, ShieldCheck, UserPlus, Info, ExternalLink, Image as ImageIcon,
  Users, Activity, Radio, FileText, HardDrive, Clock, FileWarning,
  Target, Calculator, Filter, Layers, Trophy // Added Icons for new designer
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

  // === 修复：拦截 401 错误，自动登出 ===
  if (res.status === 401) {
      console.warn("Token expired or invalid. Logging out...");
      localStorage.removeItem('ham_token');
      localStorage.removeItem('ham_user');
      // 强制刷新页面以重置状态并返回登录页
      window.location.reload();
      throw { status: 401, message: '登录已过期，正在跳转...' };
  }

  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
};

// ================= Components =================

// --- Merged InstallView Component ---
function InstallView({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    dbHost: 'localhost',
    dbPort: '5432',
    dbUser: '',
    dbPass: '',
    dbName: 'ham_awards',
    adminCall: '',
    adminPass: '',
    adminPath: 'admin',
    minioEndpoint: '',
    minioPort: '9000',
    minioAccessKey: '',
    minioSecretKey: '',
    minioBucket: 'ham-awards', // 默认 Bucket 名称
    useHttps: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          minio: config.minioEndpoint ? {
            endPoint: config.minioEndpoint,
            port: parseInt(config.minioPort),
            useSSL: config.useHttps,
            accessKey: config.minioAccessKey,
            secretKey: config.minioSecretKey
          } : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '安装失败');
      alert('安装成功！Bucket ' + config.minioBucket + ' 已初始化。页面将刷新。');
      onComplete();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Server className="text-blue-500" /> 系统初始化
          </h1>
          <p className="text-slate-400 text-sm mt-2">HAM AWARDS SYSTEM Setup Wizard</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg flex items-center gap-2"><Database className="text-blue-600"/> 数据库配置 (PostgreSQL)</h3>
              <div className="grid grid-cols-2 gap-4">
                <input name="dbHost" value={config.dbHost} onChange={handleChange} required className="w-full border rounded-lg p-3" placeholder="Host" />
                <input name="dbPort" value={config.dbPort} onChange={handleChange} required className="w-full border rounded-lg p-3" placeholder="Port" />
                <input name="dbUser" value={config.dbUser} onChange={handleChange} required className="w-full border rounded-lg p-3" placeholder="User" />
                <input name="dbPass" type="password" value={config.dbPass} onChange={handleChange} required className="w-full border rounded-lg p-3" placeholder="Password" />
                <input name="dbName" value={config.dbName} onChange={handleChange} required className="col-span-2 w-full border rounded-lg p-3" placeholder="Database Name" />
              </div>
              <button type="button" onClick={() => setStep(2)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">下一步</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg flex items-center gap-2"><HardDrive className="text-orange-600"/> 存储配置 (MinIO)</h3>
              <div className="p-4 bg-orange-50 text-orange-800 rounded-lg text-sm mb-4">
                MinIO 用于存储奖状背景图。系统将自动尝试创建指定的 Bucket。
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="minioEndpoint" value={config.minioEndpoint} onChange={handleChange} className="col-span-2 w-full border rounded-lg p-3" placeholder="Endpoint (e.g. localhost)" />
                <input name="minioAccessKey" value={config.minioAccessKey} onChange={handleChange} className="w-full border rounded-lg p-3" placeholder="Access Key" />
                <input name="minioSecretKey" type="password" value={config.minioSecretKey} onChange={handleChange} className="w-full border rounded-lg p-3" placeholder="Secret Key" />
                <div className="col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Bucket Name (将自动创建)</label>
                    <input name="minioBucket" value={config.minioBucket} onChange={handleChange} className="w-full border rounded-lg p-3" placeholder="e.g. ham-awards" />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setStep(1)} className="flex-1 bg-slate-100 font-bold rounded-xl">上一步</button>
                <button type="button" onClick={() => setStep(3)} className="flex-1 bg-slate-900 text-white py-4 rounded-xl font-bold">下一步</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg flex items-center gap-2"><Shield className="text-red-600"/> 管理员与安全</h3>
              <div className="space-y-4">
                <input name="adminCall" value={config.adminCall} onChange={handleChange} required className="w-full border rounded-lg p-3" placeholder="管理员呼号" />
                <input name="adminPass" type="password" value={config.adminPass} onChange={handleChange} required className="w-full border rounded-lg p-3" placeholder="管理员密码" />
                <input name="adminPath" value={config.adminPath} onChange={handleChange} required className="w-full border rounded-lg p-3" placeholder="自定义管理路径 (默认: admin)" />
                
                <label className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl cursor-pointer">
                  <input type="checkbox" name="useHttps" checked={config.useHttps} onChange={handleChange} className="w-5 h-5 accent-blue-600" />
                  <span className="font-bold text-blue-800">启用 HTTPS (影响生成链接)</span>
                </label>
              </div>
              <div className="flex gap-4">
                <button type="button" onClick={() => setStep(2)} className="flex-1 bg-slate-100 font-bold rounded-xl">上一步</button>
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold">
                  {loading ? '安装中...' : '完成配置'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// 0. Dashboard View (Updated)
const DashboardView = ({ user }) => {
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiFetch('/stats/dashboard')
            .then(setStats)
            .catch(err => {
                console.error(err);
                if (err.status !== 401) {
                   setError(err.message || "无法加载统计数据");
                }
            });
    }, []);

    if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg border border-red-200 m-8">❌ 统计数据加载失败: {error}</div>;

    if (!stats) return (
        <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            加载统计数据中...
        </div>
    );

    // Helper Card Component
    const StatCard = ({ title, value, icon: Icon, color, sub }) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
                <div className="text-slate-500 text-xs font-bold uppercase mb-2">{title}</div>
                <div className="text-3xl font-black text-slate-800">{value}</div>
                {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
            </div>
            {Icon && <div className={`p-4 rounded-full ${color || 'bg-blue-50 text-blue-600'}`}><Icon size={24} /></div>}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-900 text-white rounded-lg"><Activity size={20}/></div>
                <h2 className="text-2xl font-bold">概览仪表盘</h2>
            </div>

            {/* 普通用户视图 */}
            {user.role === 'user' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="日志总数 (QSO)" value={stats.qsos} icon={Database} color="bg-blue-100 text-blue-700" />
                    <StatCard title="通联波段" value={stats.bands} icon={Radio} color="bg-indigo-100 text-indigo-700" />
                    <StatCard title="通联模式" value={stats.modes} icon={Activity} color="bg-purple-100 text-purple-700" />
                    <StatCard title="DXCC 实体" value={stats.dxccs} icon={Globe} color="bg-green-100 text-green-700" />
                    <div className="col-span-full md:col-span-2">
                        <StatCard title="已获奖状" value={stats.my_awards} icon={Award} color="bg-yellow-100 text-yellow-700" />
                    </div>
                </div>
            )}

            {/* 奖状管理员视图 - 仅显示自己的数据 */}
            {user.role === 'award_admin' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <StatCard title="我的发布" value={stats.my_approved} icon={CheckCircle} color="bg-green-100 text-green-700" sub="已通过审核" />
                    <StatCard title="审核中" value={stats.my_pending} icon={Clock} color="bg-blue-100 text-blue-700" sub="等待管理员操作" />
                    <StatCard title="我的草稿" value={stats.my_drafts} icon={FileText} color="bg-slate-100 text-slate-700" sub="未提交" />
                    <StatCard title="被打回" value={stats.my_returned} icon={FileWarning} color="bg-red-100 text-red-700" sub="需修改后重交" />
                </div>
            )}

            {/* 系统管理员视图 - 显示全局数据 */}
            {user.role === 'admin' && (
                <div className="space-y-8">
                    {/* 第一排：系统状态与人员 */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                         <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg shadow-slate-300">
                             <div className="text-slate-400 text-xs font-bold uppercase mb-2">系统状态</div>
                             <div className="text-2xl font-bold flex items-center gap-2">
                                 <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div> 运行正常
                             </div>
                         </div>
                         <StatCard title="在线用户" value={stats.online_users?.reduce((a,b)=>a+parseInt(b.count),0) || 0} icon={Activity} color="bg-green-100 text-green-700" sub={stats.online_users?.map(u => `${u.role}: ${u.count}`).join(', ')} />
                         <StatCard title="注册用户总数" value={stats.total_users?.find(u=>u.role==='user')?.count || 0} icon={Users} color="bg-blue-100 text-blue-700" />
                         <StatCard title="奖状管理员" value={stats.total_users?.find(u=>u.role==='award_admin')?.count || 0} icon={Shield} color="bg-purple-100 text-purple-700" />
                    </div>

                    {/* 第二排：奖状数据 */}
                    <div>
                        <h3 className="font-bold text-lg mb-4 text-slate-600">奖状系统数据</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard title="已发布奖状" value={stats.awards_approved} icon={Award} color="bg-green-100 text-green-700" />
                            <StatCard title="待审核奖状" value={stats.awards_pending} icon={AlertCircle} color="bg-orange-100 text-orange-700" sub="需立即处理" />
                            <StatCard title="已颁发奖状总次" value={stats.awards_issued || 0} icon={CheckCircle} color="bg-yellow-100 text-yellow-700" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// New: My Awards View (Visual Gallery)
const MyAwardsView = ({ user }) => {
    const [awards, setAwards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/user/my-awards')
            .then(setAwards)
            .catch(console.error)
            .finally(()=>setLoading(false));
    }, []);

    if (loading) return <div className="text-center p-8 text-slate-400">加载中...</div>;

    if (awards.length === 0) return (
        <div className="text-center p-16 bg-white rounded-2xl border border-dashed">
            <Trophy size={48} className="mx-auto text-slate-300 mb-4"/>
            <h3 className="text-lg font-bold text-slate-600">您还没有获得任何奖状</h3>
            <p className="text-slate-400 text-sm mt-2">快去上传日志并前往奖状大厅申领吧！</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><Award className="text-orange-500"/> 我的荣誉墙 (My Awards)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                {awards.map(ua => (
                    <div key={ua.id} className="relative group perspective">
                        {/* Certificate Card */}
                        <div className="bg-white rounded-xl shadow-xl overflow-hidden border-4 border-slate-900 aspect-[1.414/1] relative">
                             {/* Background */}
                             <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: `url(${ua.bg_url})`}}></div>
                             <div className="absolute inset-0 bg-black/10"></div>
                             
                             {/* Overlay Info */}
                             <div className="absolute inset-0 p-8 flex flex-col justify-between text-white drop-shadow-md">
                                 <div className="flex justify-between items-start">
                                     <div className="bg-black/40 backdrop-blur px-3 py-1 rounded text-xs font-mono tracking-widest border border-white/20">
                                         NO. {ua.serial_number}
                                     </div>
                                     {ua.level && (
                                         <div className="bg-yellow-500 text-black px-4 py-1 rounded-full font-black uppercase text-sm shadow-lg">
                                             {ua.level} LEVEL
                                         </div>
                                     )}
                                 </div>
                                 <div className="text-center">
                                     <h2 className="text-3xl font-black uppercase tracking-wider mb-2" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>{ua.name}</h2>
                                     <div className="text-lg font-serif italic">Presented to {user.callsign}</div>
                                 </div>
                                 <div className="flex justify-between items-end text-xs opacity-80">
                                     <div>{new Date(ua.issued_at).toLocaleDateString()}</div>
                                     <div className="font-mono">{ua.tracking_id}</div>
                                 </div>
                             </div>
                        </div>
                        
                        {/* Action Bar */}
                        <div className="mt-4 flex justify-between items-center px-2">
                             <div className="text-sm font-bold text-slate-600">{ua.name}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Common Award Detail Modal (UPDATED: Multi-level)
const AwardDetailModal = ({ award, onClose, onApply, userRole }) => {
    const [checkResult, setCheckResult] = useState(null);
    const [checking, setChecking] = useState(false);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (userRole === 'user') {
            checkEligibility();
        }
    }, []);

    const checkEligibility = async () => {
        setChecking(true);
        try {
            const res = await apiFetch(`/awards/${award.id}/check`);
            setCheckResult(res);
        } catch (err) {
            console.error(err);
            setCheckResult({ error: err.message });
        } finally {
            setChecking(false);
        }
    };

    const handleApplyClick = async () => {
        if (!checkResult?.eligible) return;
        setApplying(true);
        try {
            await apiFetch(`/awards/${award.id}/apply`, { method: 'POST' });
            alert('🎉 恭喜！奖状申领成功！');
            onClose();
        } catch (err) {
            alert('申领失败: ' + err.message);
        } finally {
            setApplying(false);
        }
    };

    const rules = award.rules || {};
    const hasComplexRules = !!rules.v2;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh]">
                <div className="w-full md:w-5/12 bg-slate-100 bg-cover bg-center h-48 md:h-auto min-h-[200px] flex flex-col justify-end p-6" style={{backgroundImage: `url(${award.bg_url})`}}>
                    <div className="bg-black/50 backdrop-blur-sm p-4 rounded-xl text-white">
                        <div className="text-xs font-bold opacity-70 uppercase tracking-wider mb-1">奖状详情</div>
                        <h2 className="text-2xl font-black leading-tight">{award.name}</h2>
                    </div>
                </div>
                
                <div className="flex-1 p-8 flex flex-col overflow-y-auto">
                    <div className="flex justify-between items-start mb-6">
                         <div className="space-y-1">
                            <h3 className="font-bold text-slate-800 text-lg">规则说明</h3>
                            <div className="text-xs font-mono text-slate-400">ID: {award.tracking_id || award.id}</div>
                         </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                    </div>
                    
                    <div className="space-y-6 flex-1">
                        <div>
                            <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase flex items-center gap-2"><Info size={14}/> 简介</h4>
                            <p className="text-slate-700 leading-relaxed text-sm bg-slate-50 p-4 rounded-xl border">{award.description || '暂无描述'}</p>
                        </div>

                        {/* Conditions Display */}
                        <div>
                            <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase flex items-center gap-2"><Filter size={14}/> 判定条件</h4>
                            <div className="bg-slate-50 rounded-xl p-4 border text-sm space-y-2">
                                {hasComplexRules ? (
                                    <>
                                        {rules.basic?.startDate && <div>📅 时间范围: {rules.basic.startDate} 至 {rules.basic.endDate || '至今'}</div>}
                                        {rules.basic?.qslRequired && <div className="text-green-600 font-bold">✅ 需要 QSL 确认</div>}
                                        {rules.filters?.length > 0 ? (
                                            rules.filters.map((f, i) => (
                                                <div key={i} className="flex gap-2"><span className="font-mono bg-white px-1 border rounded text-xs">{f.field}</span> {f.operator} <b>{f.value}</b></div>
                                            ))
                                        ) : <div className="text-slate-400 text-xs">无特殊筛选条件</div>}
                                    </>
                                ) : (
                                    (Array.isArray(award.rules) ? award.rules : []).map((rule, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <CheckCircle size={14} className="text-green-500"/>
                                            <span><span className="font-mono bg-white px-1 border rounded">{rule.field}</span> {rule.operator} <span className="font-bold">{rule.value}</span></span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Logic & Targets */}
                        {hasComplexRules && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase flex items-center gap-2"><Calculator size={14}/> 计分模式</h4>
                                    <div className="bg-slate-50 p-3 rounded-lg border text-sm">
                                        <div className="font-bold text-slate-700 mb-1">{rules.logic === 'collection' ? '📦 收集型 (计数)' : '🔢 计分型 (累计)'}</div>
                                        <div className="text-xs text-slate-500">目标: {rules.targets?.type?.toUpperCase() || '任意 QSO'}</div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase flex items-center gap-2"><Trophy size={14}/> 等级要求</h4>
                                    <div className="bg-slate-50 p-3 rounded-lg border text-sm space-y-1">
                                        {(rules.thresholds || [{value:0, name:'Basic'}]).map((t,i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span>{t.name}</span>
                                                <span className="font-bold">{t.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Real-time Check Result Area */}
                        {userRole === 'user' && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="font-bold text-sm text-slate-500 mb-3 uppercase flex items-center gap-2">
                                    <Activity size={14}/> 您的进度
                                    {checking && <span className="text-xs font-normal text-blue-600 animate-pulse ml-2">正在分析日志...</span>}
                                </h4>
                                
                                {checkResult ? (
                                    <div className={`rounded-xl p-5 border-2 ${checkResult.eligible ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-slate-500">当前累计</span>
                                            <span className="text-2xl font-black">{checkResult.current_score} <span className="text-sm text-slate-400 font-normal">/ {checkResult.target_score}</span></span>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-slate-200 rounded-full h-3 mb-3 overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-1000 ${checkResult.eligible ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                style={{width: `${Math.min(100, (checkResult.current_score / checkResult.target_score) * 100)}%`}}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="text-xs text-slate-500 font-bold">
                                                {checkResult.details?.msg}
                                            </div>
                                            {checkResult.eligible && <div className="px-2 py-1 bg-green-200 text-green-800 text-xs font-bold rounded flex items-center gap-1"><Check size={12}/> 已达成: {checkResult.achieved_level?.name}</div>}
                                        </div>
                                        {/* Multi-level Claim Info */}
                                        {checkResult.claimed_levels?.length > 0 && (
                                            <div className="mt-2 text-xs text-slate-400">
                                                已领取: {checkResult.claimed_levels.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed">
                                        日志分析未就绪或出现错误
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-6">
                        {userRole === 'user' ? (
                            <button 
                                onClick={handleApplyClick} 
                                disabled={!checkResult?.eligible || applying || checkResult?.claimed_levels?.includes(checkResult?.achieved_level?.name)}
                                className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                                    checkResult?.eligible && !checkResult?.claimed_levels?.includes(checkResult?.achieved_level?.name)
                                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200 active:scale-95' 
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                }`}
                            >
                                {applying ? '正在提交...' 
                                    : checkResult?.claimed_levels?.includes(checkResult?.achieved_level?.name) 
                                        ? `已领取当前等级 (${checkResult.achieved_level.name})`
                                        : checkResult?.eligible 
                                            ? `申领 ${checkResult.achieved_level.name} 奖状` 
                                            : '条件未满足，无法申领'}
                            </button>
                        ) : (
                             <div className="text-center text-slate-400 text-sm bg-slate-50 p-3 rounded-lg border">
                                 {userRole === 'admin' ? '管理员模式 - 仅供预览' : '仅普通用户可申领'}
                             </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// 1. Award Center View (All Approved Awards)
const AwardCenterView = ({ user }) => {
    const [awards, setAwards] = useState([]);
    const [selectedAward, setSelectedAward] = useState(null);

    useEffect(() => {
        apiFetch('/awards/all_approved').then(setAwards).catch(console.error);
    }, []);

    const handleApply = (award) => {
        // Only called if passed to Modal, but logic moved inside Modal now
        setSelectedAward(null);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><Award className="text-orange-500"/> 奖状大厅 (Award Center)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {awards.map(aw => (
                    <div 
                        key={aw.id} 
                        onClick={() => setSelectedAward(aw)}
                        className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow group cursor-pointer`}
                    >
                        <div className="h-48 bg-slate-200 bg-cover bg-center relative" style={{backgroundImage: `url(${aw.bg_url})`}}>
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white font-bold border-2 border-white px-4 py-2 rounded-full">查看详情与进度</span>
                            </div>
                        </div>
                        <div className="p-6">
                            <h4 className="font-bold text-lg mb-2 group-hover:text-blue-600 transition-colors">{aw.name}</h4>
                            <p className="text-slate-500 text-sm line-clamp-2">{aw.description}</p>
                            <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs text-slate-400">
                                <span>ID: {aw.tracking_id}</span>
                                <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded">详情</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {selectedAward && <AwardDetailModal award={selectedAward} onClose={() => setSelectedAward(null)} onApply={handleApply} userRole={user.role} />}
        </div>
    );
};

// 2. Award Admin Manager (Refactored: Split Create, Drafts, Audit, Returned)
const AwardAdminManager = () => {
    const [tab, setTab] = useState('create'); // create, drafts, returned, audit_list
    const [drafts, setDrafts] = useState([]);
    const [auditList, setAuditList] = useState([]);
    const [editingAward, setEditingAward] = useState(null); 
    const [timelineModal, setTimelineModal] = useState(null); 

    const loadData = async () => {
        if (tab === 'drafts') apiFetch('/awards/my?status=drafts').then(setDrafts);
        if (tab === 'returned') apiFetch('/awards/my?status=returned').then(setDrafts);
        if (tab === 'audit_list') apiFetch('/awards/my?status=audit_list').then(setAuditList);
    };

    useEffect(() => { loadData(); }, [tab]);

    const handleDelete = async (id) => {
        if(!confirm('确定删除此记录吗？')) return;
        try {
            await apiFetch(`/awards/${id}`, { method: 'DELETE' });
            loadData();
        } catch(e) { alert(e.message); }
    };

    const renderTimeline = () => {
        if (!timelineModal) return null;
        const logs = timelineModal.audit_log || [];
        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">审核进度详情 - {timelineModal.tracking_id}</h3>
                        <button onClick={()=>setTimelineModal(null)}><X/></button>
                    </div>
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
                        {logs.map((log, idx) => (
                            <div key={idx} className="relative pl-8">
                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                                    log.action === 'approved' ? 'bg-green-500' :
                                    log.action === 'returned' || log.action.includes('reject') ? 'bg-red-500' :
                                    'bg-blue-500'
                                }`}></div>
                                <div className="text-sm text-slate-400 mb-1">{new Date(log.time).toLocaleString()}</div>
                                <div className="font-bold text-slate-800">{
                                    log.action === 'submitted' ? '提交审核' : 
                                    log.action === 'approved' ? '审核通过' : 
                                    log.action === 'returned' ? '被退回' : 
                                    log.action === 'saved_draft' ? '保存草稿' : log.action
                                }</div>
                                <div className="text-sm text-slate-600">操作人: {log.actor}</div>
                                {log.reason && <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded border border-red-100">原因: {log.reason}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border w-fit">
                {[
                    {id: 'create', label: '新建奖状', icon: Plus},
                    {id: 'drafts', label: '我的草稿', icon: FileText},
                    {id: 'returned', label: '打回草稿', icon: FileWarning},
                    {id: 'audit_list', label: '审核列表', icon: List},
                ].map(t => (
                    <button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab===t.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <t.icon size={16}/> {t.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[400px]">
                {tab === 'create' && (
                    <div className="text-center py-10">
                        <div className="mb-4 text-slate-400">点击下方按钮开始设计新奖状</div>
                        <button onClick={()=>setEditingAward({})} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 mx-auto hover:bg-blue-700 transition-colors">
                            <Plus size={20}/> 创建新奖状
                        </button>
                    </div>
                )}

                {(tab === 'drafts' || tab === 'returned') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {drafts.length === 0 && <div className="col-span-full text-center text-slate-400 py-10">空空如也</div>}
                        {drafts.map(d => (
                            <div key={d.id} className="border rounded-xl overflow-hidden hover:border-blue-300 transition-colors group">
                                <div className="h-32 bg-slate-100 bg-cover bg-center relative" style={{backgroundImage: `url(${d.bg_url})`}}>
                                    {tab === 'returned' && <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded font-bold">已退回</div>}
                                </div>
                                <div className="p-4">
                                    <h4 className="font-bold mb-1">{d.name || '未命名奖状'}</h4>
                                    {tab === 'returned' && d.reject_reason && (
                                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-2">原因: {d.reject_reason}</div>
                                    )}
                                    <div className="flex gap-2 mt-4">
                                        <button onClick={()=>setEditingAward(d)} className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-bold">编辑/重交</button>
                                        <button onClick={()=>handleDelete(d.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'audit_list' && (
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                            <tr><th className="p-4">追踪码</th><th className="p-4">奖状名称</th><th className="p-4">提交时间</th><th className="p-4">当前状态</th><th className="p-4">操作</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {auditList.map(item => (
                                <tr key={item.id}>
                                    <td className="p-4 font-mono text-xs">{item.tracking_id}</td>
                                    <td className="p-4 font-bold">{item.name}</td>
                                    <td className="p-4 text-sm text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            item.status === 'approved' ? 'bg-green-100 text-green-700' :
                                            item.status === 'returned' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {item.status === 'approved' ? '已通过' : item.status === 'returned' ? '已退回' : '审核中'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <button onClick={()=>setTimelineModal(item)} className="text-blue-600 hover:underline text-sm font-bold">查看详情</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {editingAward && <AwardDesigner initData={editingAward} onClose={()=>{setEditingAward(null); loadData();}} />}
            {timelineModal && renderTimeline()}
        </div>
    );
};

// 3. System Admin Award Manager (Refactored: Audit & Overview)
const SystemAdminAwardManager = () => {
    const [view, setView] = useState('audit'); // audit (pending), overview (approved)
    const [list, setList] = useState([]);
    const [actionModal, setActionModal] = useState(null); // { id, action, title }
    const [reason, setReason] = useState('');
    const [detailModal, setDetailModal] = useState(null); // For viewing details

    const load = () => {
        const url = view === 'audit' ? '/admin/awards/pending' : '/admin/awards/approved';
        apiFetch(url).then(setList);
    };

    useEffect(() => { load(); }, [view]);

    const handleAction = async () => {
        try {
            await apiFetch('/admin/awards/audit', {
                method: 'POST',
                body: JSON.stringify({ id: actionModal.id, action: actionModal.action, reason })
            });
            alert('操作成功');
            setActionModal(null); setReason(''); load();
        } catch(e) { alert(e.message); }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-4 mb-4">
                <button onClick={()=>setView('audit')} className={`px-6 py-3 rounded-xl font-bold text-lg flex items-center gap-2 ${view==='audit'?'bg-blue-600 text-white shadow-lg shadow-blue-200':'bg-white text-slate-400'}`}>
                    <CheckCircle/> 奖状审核
                </button>
                <button onClick={()=>setView('overview')} className={`px-6 py-3 rounded-xl font-bold text-lg flex items-center gap-2 ${view==='overview'?'bg-purple-600 text-white shadow-lg shadow-purple-200':'bg-white text-slate-400'}`}>
                    <Layout/> 奖状总览 (抽查)
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4">ID</th><th className="p-4">名称</th><th className="p-4">提交人</th><th className="p-4">提交时间</th><th className="p-4 w-48">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {list.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">暂无数据</td></tr>}
                        {list.map(item => (
                            <tr key={item.id}>
                                <td className="p-4 text-xs font-mono">{item.tracking_id || item.id}</td>
                                <td className="p-4 font-bold">{item.name}</td>
                                <td className="p-4 text-sm">{item.creator_call}</td>
                                <td className="p-4 text-sm text-slate-500">{new Date(item.created_at).toLocaleDateString()}</td>
                                <td className="p-4 flex gap-2">
                                    <button onClick={()=>setDetailModal(item)} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200" title="查看详情"><Eye size={16}/></button>
                                    {view === 'audit' ? (
                                        <>
                                            <button onClick={()=>apiFetch('/admin/awards/audit', {method:'POST', body:JSON.stringify({id:item.id, action:'已通过'})}).then(()=>{alert('已通过');load()})} className="px-3 py-1 bg-green-100 text-green-700 rounded font-bold text-sm">通过</button>
                                            <button onClick={()=>setActionModal({id:item.id, action:'打回修改', title:'打回申请'})} className="px-3 py-1 bg-red-100 text-red-700 rounded font-bold text-sm">打回</button>
                                        </>
                                    ) : (
                                        <button onClick={()=>setActionModal({id:item.id, action:'撤回修改', title:'撤回奖状'})} className="px-3 py-1 bg-orange-100 text-orange-700 rounded font-bold text-sm flex items-center gap-1"><RotateCcw size={14}/> 撤回/打回</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {actionModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
                        <h3 className="font-bold text-lg">{actionModal.title}</h3>
                        <textarea className="w-full border rounded-lg p-3 h-32" placeholder="请输入原因 (必填)" value={reason} onChange={e=>setReason(e.target.value)}></textarea>
                        <div className="flex gap-2">
                            <button onClick={()=>setActionModal(null)} className="flex-1 bg-slate-100 py-2 rounded-lg font-bold">取消</button>
                            <button onClick={handleAction} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold">确认执行</button>
                        </div>
                    </div>
                </div>
            )}
            
            {detailModal && (
                <AwardDetailModal 
                    award={detailModal} 
                    onClose={()=>setDetailModal(null)} 
                    userRole="admin" // Pass admin role to hide apply button
                />
            )}
        </div>
    );
};

// 4. Award Designer (COMPLETELY OVERHAULED FOR ADVANCED RULES)
const AwardDesigner = ({ initData, onClose }) => {
    // Basic UI States
    const [step, setStep] = useState(1);
    const [bgUrl, setBgUrl] = useState(initData?.bg_url || '');
    const [layout, setLayout] = useState(initData?.layout || []); 
    const [dragId, setDragId] = useState(null);

    // Initial Rule Structure (Complex V2)
    const defaultRules = {
        v2: true, // Marker for new rule system
        basic: { startDate: '', endDate: '', qslRequired: false },
        filters: [], // [{ field, operator, value }]
        logic: 'collection', // 'collection' or 'points'
        targets: { type: 'any', list: '' }, // type: any, callsign, dxcc, grid, etc.
        scoring: { cw: 1, phone: 1, data: 1, multis: [] },
        deduplication: 'none', // none, call, call_band, qso
        thresholds: [{ name: 'Award', value: 1 }]
    };

    // Migrate old rules or use init
    const [rules, setRules] = useState(() => {
        if (!initData?.rules) return defaultRules;
        if (Array.isArray(initData.rules)) return { ...defaultRules, filters: initData.rules }; // Migrate V1
        return { ...defaultRules, ...initData.rules };
    });

    const [meta, setMeta] = useState({ name: initData?.name || '', description: initData?.description || '' });

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

    const addLayoutElement = (type) => {
        setLayout([...layout, { id: Date.now(), type, x: 50, y: 50, label: type === 'text' ? '{CALLSIGN}' : 'Logo' }]);
    };

    const handleDrag = (e) => {
        if (!dragId) return;
        const container = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - container.left) / container.width) * 100; 
        const y = ((e.clientY - container.top) / container.height) * 100;
        setLayout(layout.map(el => el.id === dragId ? { ...el, x, y } : el));
    };

    const saveAward = async (status) => {
        try {
            // Validation
            if (!meta.name) throw new Error("请输入奖状名称");
            if (!bgUrl) throw new Error("请上传奖状背景图");

            await apiFetch('/awards', {
                method: 'POST',
                body: JSON.stringify({ 
                    id: initData?.id,
                    name: meta.name, 
                    description: meta.description, 
                    bg_url: bgUrl, 
                    rules, 
                    layout, 
                    status 
                })
            });
            alert(status === 'draft' ? '草稿已保存' : '已提交审核');
            onClose();
        } catch(err) { alert(err.message); }
    };

    // Steps Configuration
    const steps = [
        { id: 1, label: '基本信息', icon: Info },
        { id: 2, label: '规则配置', icon: Settings },
        { id: 3, label: '视觉设计', icon: Layout }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <div className="flex items-center gap-4">
                        <h2 className="font-bold text-lg">{initData?.id ? '编辑奖状' : '新建奖状'}</h2>
                        <div className="flex bg-white rounded-lg p-1 border">
                            {steps.map(s => (
                                <button key={s.id} onClick={()=>setStep(s.id)} className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition-all ${step===s.id ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <s.icon size={14}/> {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose}><X /></button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Step 1: Basic Info */}
                    {step === 1 && (
                        <div className="flex-1 p-8 overflow-y-auto max-w-3xl mx-auto w-full space-y-6">
                            <h3 className="text-xl font-bold border-b pb-4 mb-6">基本信息</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">奖状名称</label>
                                    <input className="w-full p-3 border rounded-xl" value={meta.name} onChange={e=>setMeta({...meta, name:e.target.value})} placeholder="例如: 2024 年度 DX 大师奖"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">描述说明</label>
                                    <textarea className="w-full p-3 border rounded-xl h-32" value={meta.description} onChange={e=>setMeta({...meta, description:e.target.value})} placeholder="奖状的简介、颁发机构等..."/>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">开始日期 (可选)</label>
                                        <input type="date" className="w-full p-3 border rounded-xl" value={rules.basic.startDate} onChange={e=>setRules({...rules, basic: {...rules.basic, startDate: e.target.value}})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">结束日期 (可选)</label>
                                        <input type="date" className="w-full p-3 border rounded-xl" value={rules.basic.endDate} onChange={e=>setRules({...rules, basic: {...rules.basic, endDate: e.target.value}})} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 p-4 border rounded-xl bg-slate-50 cursor-pointer">
                                    <input type="checkbox" checked={rules.basic.qslRequired} onChange={e=>setRules({...rules, basic: {...rules.basic, qslRequired: e.target.checked}})} className="w-5 h-5"/>
                                    <div>
                                        <div className="font-bold">仅限已确认 QSO (QSL Required)</div>
                                        <div className="text-xs text-slate-500">勾选后，只有 LotW 或实物卡片确认的记录才参与计算</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Advanced Rules Engine */}
                    {step === 2 && (
                        <div className="flex-1 flex h-full">
                            <div className="w-64 bg-slate-50 border-r p-4 space-y-2">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">配置模块</div>
                                {['filters', 'logic', 'scoring', 'threshold'].map(m => (
                                    <button key={m} onClick={()=>document.getElementById(`mod-${m}`).scrollIntoView({behavior:'smooth'})} className="block w-full text-left px-4 py-2 rounded hover:bg-white text-sm font-medium text-slate-600">
                                        {m==='filters'?'1. 筛选条件':m==='logic'?'2. 逻辑与目标':m==='scoring'?'3. 计分规则':'4. 达标阈值'}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 p-8 overflow-y-auto space-y-10">
                                {/* Filters */}
                                <section id="mod-filters" className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><Filter className="text-blue-500"/> 1. 有效 QSO 筛选条件</h4>
                                    <div className="bg-slate-50 p-4 rounded-xl border space-y-2">
                                        <div className="text-xs text-slate-400 mb-2">💡 提示：如需匹配任意值（如任意波段），请留空或输入 ANY。</div>
                                        {rules.filters.map((f, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input className="w-1/3 p-2 border rounded text-sm" placeholder="字段 (如 band)" value={f.field} onChange={e=>{const n=[...rules.filters];n[idx].field=e.target.value;setRules({...rules, filters:n})}}/>
                                                <select className="p-2 border rounded text-sm" value={f.operator} onChange={e=>{const n=[...rules.filters];n[idx].operator=e.target.value;setRules({...rules, filters:n})}}>
                                                    <option value="eq">等于 (=)</option><option value="neq">不等于 (!=)</option><option value="gt">大于 (&gt;)</option><option value="contains">包含</option>
                                                </select>
                                                <input className="flex-1 p-2 border rounded text-sm" placeholder="值 (如 20M)" value={f.value} onChange={e=>{const n=[...rules.filters];n[idx].value=e.target.value;setRules({...rules, filters:n})}}/>
                                                <button onClick={()=>setRules({...rules, filters: rules.filters.filter((_,i)=>i!==idx)})} className="text-red-500"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                        <button onClick={()=>setRules({...rules, filters: [...rules.filters, {field:'', operator:'eq', value:''}]})} className="text-sm font-bold text-blue-600">+ 添加筛选条件</button>
                                    </div>
                                </section>

                                {/* Logic & Targets */}
                                <section id="mod-logic" className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><Target className="text-purple-500"/> 2. 核心逻辑与目标对象</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 border rounded-xl hover:border-blue-500 cursor-pointer transition-all" onClick={()=>setRules({...rules, logic: 'collection'})} style={{borderColor: rules.logic==='collection'?'#3b82f6':''}}>
                                            <div className="font-bold mb-1">📦 收集型 (Collection)</div>
                                            <div className="text-xs text-slate-500">统计唯一目标的数量 (如: 100个 DXCC，50个网格)</div>
                                        </div>
                                        <div className="p-4 border rounded-xl hover:border-blue-500 cursor-pointer transition-all" onClick={()=>setRules({...rules, logic: 'points'})} style={{borderColor: rules.logic==='points'?'#3b82f6':''}}>
                                            <div className="font-bold mb-1">🔢 计分型 (Points)</div>
                                            <div className="text-xs text-slate-500">基于分值的累加 (如: CW 10分，总分 500分)</div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border">
                                        <label className="block text-sm font-bold mb-2">目标对象类型</label>
                                        <select className="w-full p-2 border rounded mb-2" value={rules.targets.type} onChange={e=>setRules({...rules, targets: {...rules.targets, type: e.target.value}})}>
                                            <option value="any">任意 QSO (仅依靠筛选)</option>
                                            <option value="callsign">特定呼号列表</option>
                                            <option value="dxcc">特定 DXCC 实体</option>
                                            <option value="any_dxcc">任意 DXCC (收集唯一 DXCC)</option>
                                            <option value="grid">特定网格 (Grid)</option>
                                            <option value="any_grid">任意网格 (收集唯一 Grid)</option>
                                            <option value="iota">特定 IOTA</option>
                                            <option value="any_iota">任意 IOTA (收集唯一 IOTA)</option>
                                            <option value="state">特定州/省 (State)</option>
                                            <option value="any_state">任意州/省 (收集唯一 State)</option>
                                        </select>
                                        {['callsign', 'dxcc', 'grid', 'iota', 'state'].includes(rules.targets.type) && (
                                            <textarea 
                                                className="w-full p-2 border rounded h-24 text-sm font-mono" 
                                                placeholder="输入目标列表，用逗号分隔 (例如: BA1AA, BA4AA, BY1CRA...)"
                                                value={rules.targets.list}
                                                onChange={e=>setRules({...rules, targets: {...rules.targets, list: e.target.value}})}
                                            />
                                        )}
                                    </div>
                                </section>

                                {/* Scoring & Deduplication */}
                                <section id="mod-scoring" className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><Calculator className="text-green-500"/> 3. 计分与去重</h4>
                                    {rules.logic === 'points' && (
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            {['cw', 'phone', 'data'].map(m => (
                                                <div key={m} className="bg-slate-50 p-3 rounded-lg border text-center">
                                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">{m} 分值</div>
                                                    <input type="number" className="w-full text-center p-1 border rounded" value={rules.scoring[m]} onChange={e=>setRules({...rules, scoring: {...rules.scoring, [m]: parseFloat(e.target.value)}})} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="bg-slate-50 p-4 rounded-xl border">
                                        <label className="block text-sm font-bold mb-2">去重规则 (Deduplication)</label>
                                        <select className="w-full p-2 border rounded" value={rules.deduplication} onChange={e=>setRules({...rules, deduplication: e.target.value})}>
                                            <option value="none">不去重 (所有有效 QSO 均计算)</option>
                                            <option value="call">按呼号去重 (每个呼号只计一次)</option>
                                            <option value="call_band">按呼号+波段去重 (每个呼号每个波段计一次)</option>
                                            <option value="slot">按 Slot 去重 (呼号+波段+模式)</option>
                                        </select>
                                    </div>
                                </section>

                                {/* Threshold */}
                                <section id="mod-threshold" className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><Trophy className="text-yellow-500"/> 4. 达标等级 (Thresholds)</h4>
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 space-y-3">
                                        <p className="text-xs text-yellow-800 mb-2">设置不同的奖项等级（如金、银、铜），系统将自动判定最高达成等级。</p>
                                        {(rules.thresholds || [{name: 'Award', value: 1}]).map((t, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <input 
                                                    className="flex-1 p-2 border rounded text-sm" 
                                                    placeholder="等级名称 (如: Gold)" 
                                                    value={t.name}
                                                    onChange={e=>{const n=[...rules.thresholds];n[idx].name=e.target.value;setRules({...rules, thresholds:n})}}
                                                />
                                                <span className="font-bold text-yellow-800">需:</span>
                                                <input 
                                                    type="number" 
                                                    className="w-24 p-2 border rounded text-center font-bold" 
                                                    value={t.value}
                                                    onChange={e=>{const n=[...rules.thresholds];n[idx].value=parseFloat(e.target.value);setRules({...rules, thresholds:n})}}
                                                />
                                                <span className="text-xs text-yellow-800">{rules.logic === 'collection' ? '个' : '分'}</span>
                                                <button onClick={()=>{
                                                    if (rules.thresholds.length > 1) {
                                                        setRules({...rules, thresholds: rules.thresholds.filter((_,i)=>i!==idx)});
                                                    }
                                                }} className="text-red-500 p-2"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                        <button onClick={()=>setRules({...rules, thresholds: [...(rules.thresholds || []), {name: 'Level ' + ((rules.thresholds?.length||0)+1), value: 0}]})} className="text-sm font-bold text-yellow-700 flex items-center gap-1">
                                            <Plus size={14}/> 添加等级
                                        </button>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Visual Design (Same as before but cleaner) */}
                    {step === 3 && (
                         <div className="flex-1 flex overflow-hidden">
                            <div className="w-72 bg-slate-50 border-r p-4 overflow-y-auto space-y-6">
                                <div>
                                    <h4 className="font-bold mb-2">上传背景</h4>
                                    <input type="file" onChange={handleBgUpload} className="text-sm w-full" />
                                </div>
                                <div>
                                    <h4 className="font-bold mb-2">动态元素</h4>
                                    <div className="flex flex-col gap-2">
                                        <button onClick={()=>addLayoutElement('text')} className="bg-white border p-2 rounded text-sm hover:bg-slate-100 flex items-center gap-2"><Move size={14}/> 文本变量 {`{...}`}</button>
                                        <button onClick={()=>addLayoutElement('image')} className="bg-white border p-2 rounded text-sm hover:bg-slate-100 flex items-center gap-2"><ImageIcon size={14}/> 图片/Logo</button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">支持变量: {'{CALLSIGN}'}, {'{DATE}'}, {'{SCORE}'}</p>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-200 p-8 flex items-center justify-center overflow-auto">
                                <div className="bg-white shadow-xl relative overflow-hidden select-none"
                                    style={{ width: '800px', height: '600px', backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                    onMouseMove={handleDrag} onMouseUp={()=>setDragId(null)} onMouseLeave={()=>setDragId(null)}
                                >
                                    {layout.map(el => (
                                        <div key={el.id} className={`absolute cursor-move border border-dashed border-transparent hover:border-blue-500 px-2 py-1 ${dragId === el.id ? 'border-blue-500' : ''}`}
                                            style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)' }} onMouseDown={()=>setDragId(el.id)}
                                        >
                                            <input value={el.label} onChange={e => setLayout(layout.map(x => x.id === el.id ? {...x, label: e.target.value} : x))}
                                                className="bg-transparent text-black font-bold text-xl border-none focus:ring-0 w-40 text-center" 
                                                style={{textShadow: '0 0 2px white'}}
                                            />
                                            <button onClick={()=>setLayout(layout.filter(x=>x.id!==el.id))} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs"><X size={10}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
                    <div className="text-xs text-slate-400">
                        {step === 2 && '提示: 配置完成后，请前往"视觉设计"步骤设置证书外观。'}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={()=>saveAward('draft')} className="px-6 py-2 border rounded-lg font-bold text-slate-600">保存草稿</button>
                        <button onClick={()=>saveAward('pending')} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">提交审核</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 5. User Center (Same as provided, kept intact)
const UserCenterView = ({ user, refreshUser, onLogout }) => {
    const [modal, setModal] = useState(null); 
    const [qr, setQr] = useState('');
    const [secret, setSecret] = useState('');
    const [code, setCode] = useState('');
    const [passForm, setPassForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [confirmActionPass, setConfirmActionPass] = useState('');

    const start2FASetup = async () => {
        try {
            const res = await apiFetch('/user/2fa/setup', { method: 'POST' });
            setSecret(res.secret); setQr(res.qr); setModal('2fa_setup');
        } catch(err) { alert(err.message); }
    };

    const confirm2FA = async () => {
        try {
            await apiFetch('/user/2fa/enable', { method: 'POST', body: JSON.stringify({ secret, token: code }) });
            alert('2FA 已成功开启！'); setModal(null); refreshUser();
        } catch(err) { alert(err.message); }
    };

    const disable2FA = async () => {
        try {
            await apiFetch('/user/2fa/disable', { method: 'POST', body: JSON.stringify({ password: confirmActionPass }) });
            alert('2FA 已关闭'); setModal(null); refreshUser();
        } catch(err) { alert(err.message); }
    };

    const changePassword = async () => {
        if(passForm.newPassword !== passForm.confirmPassword) return alert('两次输入的新密码不一致');
        try {
            if (user.has2fa) {
                const c = prompt('请输入 2FA 验证码以确认修改密码:');
                if(!c) return;
                sessionStorage.setItem('temp_2fa_code', c);
            }
            await apiFetch('/user/password', { method: 'POST', body: JSON.stringify(passForm) });
            alert('密码修改成功'); setModal(null);
        } catch(err) { alert(err.message); }
    };

    const handleDangerousAction = async (action) => {
        try {
            if (user.has2fa) {
                const c = prompt('请输入 2FA 验证码以确认:');
                if(!c) return;
                sessionStorage.setItem('temp_2fa_code', c);
            }
            const url = action === 'clear_logs' ? '/user/logs' : '/user/account';
            await apiFetch(url, { 
                method: 'DELETE', 
                body: JSON.stringify({ password: confirmActionPass }) 
            });
            
            if (action === 'delete_account') {
                alert('账号已注销');
                onLogout();
            } else {
                alert('操作成功');
                setModal(null);
            }
        } catch (err) { alert(err.message); }
    };

    return (
        <div className="max-w-3xl space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><User className="text-blue-600"/> 用户中心</h3>
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-black text-slate-400">{user.callsign.substring(0,2)}</div>
                    <div>
                        <div className="text-2xl font-bold">{user.callsign}</div>
                        <div className="text-slate-500 text-sm">角色: {user.role}</div>
                    </div>
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><ShieldCheck className="text-green-600"/> 安全设置</h4>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3"><Key className="text-slate-400" /><div><div className="font-bold">登录密码</div></div></div>
                        <button onClick={() => setModal('password')} className="bg-white border px-4 py-2 rounded-lg text-sm font-bold">修改密码</button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3"><Lock className={user.has2fa ? "text-green-500" : "text-slate-400"} /><div><div className="font-bold">两步验证 (2FA)</div><div className="text-xs text-slate-400">{user.has2fa ? '已开启' : '未开启'}</div></div></div>
                        {user.has2fa ? (
                            <button onClick={() => setModal('2fa_disable')} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold">关闭</button>
                        ) : (
                            <button onClick={start2FASetup} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">开启</button>
                        )}
                    </div>
                </div>
            </div>
            {user.role === 'user' && (
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
                    <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-600"><AlertCircle/> 危险区域</h4>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-red-50/50 rounded-xl">
                            <div><div className="font-bold text-red-800">清空所有日志</div><div className="text-xs text-red-600">将永久删除您上传的所有 QSO 记录</div></div>
                            <button onClick={() => setModal('clear_logs')} className="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg text-sm font-bold">清空日志</button>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-red-50/50 rounded-xl">
                            <div><div className="font-bold text-red-800">注销账号</div><div className="text-xs text-red-600">将永久删除您的账号及所有数据，无法恢复</div></div>
                            <button onClick={() => setModal('delete_account')} className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-bold">注销账号</button>
                        </div>
                    </div>
                 </div>
            )}
            {modal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 relative z-[101]">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="font-bold text-lg">{modal === 'password' ? '修改密码' : modal === '2fa_setup' ? '配置 2FA' : '安全确认'}</h3>
                            <button onClick={()=>{setModal(null); setQr('');}}><X size={20}/></button>
                        </div>
                        {modal === 'password' && (
                            <div className="space-y-4">
                                <input type="password" placeholder="当前密码" className="w-full border p-3 rounded-lg" onChange={e=>setPassForm({...passForm, oldPassword: e.target.value})} />
                                <input type="password" placeholder="新密码" className="w-full border p-3 rounded-lg" onChange={e=>setPassForm({...passForm, newPassword: e.target.value})} />
                                <input type="password" placeholder="确认新密码" className="w-full border p-3 rounded-lg" onChange={e=>setPassForm({...passForm, confirmPassword: e.target.value})} />
                                <button onClick={changePassword} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">确认修改</button>
                            </div>
                        )}
                        {modal === '2fa_setup' && (
                            <div className="space-y-4 text-center">
                                <div className="flex justify-center bg-white p-2 border rounded-lg">
                                    {qr ? <img src={qr} alt="2FA QR" className="w-48 h-48"/> : <div>Loading...</div>}
                                </div>
                                <input placeholder="6 位验证码" className="w-full border p-3 rounded-lg text-center font-mono text-xl" maxLength={6} onChange={e=>setCode(e.target.value)} />
                                <button onClick={confirm2FA} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">验证开启</button>
                            </div>
                        )}
                        {(modal === '2fa_disable' || modal === 'clear_logs' || modal === 'delete_account') && (
                            <div className="space-y-4">
                                <p className="text-sm bg-red-50 text-red-600 p-3 rounded-lg">
                                    {modal === '2fa_disable' ? '警告：关闭 2FA 将降低账户安全性。' : '此操作不可逆，请输入登录密码以确认。'}
                                </p>
                                <input type="password" placeholder="登录密码" className="w-full border p-3 rounded-lg" onChange={e=>setConfirmActionPass(e.target.value)} />
                                <button onClick={() => {
                                    if(modal==='2fa_disable') disable2FA();
                                    else handleDangerousAction(modal);
                                }} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold">确认执行</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// 6. Logbook View (Same as provided, kept intact)
const LogbookView = () => {
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

// 7. User Management (Same as provided, kept intact)
const UserManage = () => {
    const [users, setUsers] = useState([]);
    const [editing, setEditing] = useState(null);
    const [creating, setCreating] = useState(false);
    const [twoFaCode, setTwoFaCode] = useState('');
    const [newUserInfo, setNewUserInfo] = useState({ callsign: '', password: '', role: 'user' });
    
    useEffect(() => { loadUsers(); }, []);
    
    const loadUsers = async () => { 
        try { 
            const data = await apiFetch('/admin/users'); 
            setUsers(data); 
        } catch(e) { 
            console.error("Failed to load users:", e);
            if (e.status !== 401 && e.status !== 403) alert("加载用户列表失败: " + e.message);
        } 
    };

    const handleAction = async (method, url, body = {}) => {
        try {
            const headers = twoFaCode ? { 'x-2fa-code': twoFaCode } : {};
            await apiFetch(url, { method, body: JSON.stringify(body), headers });
            alert('操作成功');
            loadUsers(); setEditing(null); setCreating(false); setTwoFaCode(''); setNewUserInfo({ callsign: '', password: '', role: 'user' });
        } catch (err) {
            if (err.error === '2FA_REQUIRED') {
                const code = prompt('请输入管理员 2FA 验证码以继续:');
                if(code) { setTwoFaCode(code); alert('验证码已缓存，请再次点击确认。'); }
            } else { alert(err.message); }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-xl flex items-center gap-2"><User size={24}/> 用户管理</h3>
                <button onClick={()=>setCreating(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><UserPlus size={18}/> 添加用户</button>
            </div>
            {users.length === 0 ? (
                <div className="text-center p-8 bg-white rounded-xl shadow border border-slate-100 text-slate-400">暂无用户数据或加载失败</div>
            ) : (
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
            )}
            {(editing || creating) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
                        <h4 className="font-bold">{creating ? '添加新用户' : `编辑用户 ${editing.callsign}`}</h4>
                        {creating && <input className="w-full p-2 border rounded" placeholder="呼号" value={newUserInfo.callsign} onChange={e=>setNewUserInfo({...newUserInfo, callsign: e.target.value})} />}
                        <select className="w-full p-2 border rounded" value={creating ? newUserInfo.role : editing.role} onChange={e=> creating ? setNewUserInfo({...newUserInfo, role: e.target.value}) : setEditing({...editing, role:e.target.value})}>
                            <option value="user">普通用户</option><option value="award_admin">奖状管理员</option><option value="admin">系统管理员</option>
                        </select>
                        <input className="w-full p-2 border rounded" placeholder={creating ? "设置密码" : "重置密码 (留空不修改)"} type="password" id="modal-pass" value={creating ? newUserInfo.password : undefined} onChange={creating ? (e)=>setNewUserInfo({...newUserInfo, password:e.target.value}) : undefined}/>
                        <button onClick={()=>{
                            if (creating) handleAction('POST', '/admin/users', newUserInfo);
                            else { const pass = document.getElementById('modal-pass').value; handleAction('PUT', `/admin/users/${editing.id}`, { role: editing.role, password: pass || undefined }); }
                        }} className="w-full bg-blue-600 text-white py-2 rounded font-bold">确认保存</button>
                        <button onClick={()=>{setEditing(null); setCreating(false);}} className="w-full text-slate-500 py-2">取消</button>
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
  const [subView, setSubView] = useState('dashboard');
  const [loginTab, setLoginTab] = useState('user'); 
  const [show2FAInput, setShow2FAInput] = useState(false);
  const [loginForm, setLoginForm] = useState({});
  const [authMode, setAuthMode] = useState('login'); // Added for in-page register

  useEffect(() => {
    apiFetch('/system-status').then(status => {
        if (!status.installed) {
            setView('install');
        } else {
            const savedUser = localStorage.getItem('ham_user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
                setView('main');
            } else {
                setView('auth'); // Changed from 'login' to 'auth'
            }
        }
    }).catch(() => setView('auth'));
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
          setSubView('dashboard');
          setView('main');
          setShow2FAInput(false);
      } catch (err) {
          if (err.error === '2FA_REQUIRED') {
              setLoginForm(data);
              setShow2FAInput(true);
          } else { alert(err.message || '登录失败'); }
      }
  };

  const handleRegister = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData);
      if (data.password !== data.confirmPassword) return alert("两次输入的密码不一致");
      
      try {
          await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) });
          alert('注册成功！请登录。');
          setAuthMode('login');
      } catch (err) { alert(err.message); }
  };

  const handleLogout = () => { localStorage.clear(); window.location.reload(); };

  if (view === 'install') return <InstallView onComplete={() => window.location.reload()} />;

  if (view === 'auth') return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <div className="flex border-b">
            <button onClick={()=>setAuthMode('login')} className={`flex-1 py-4 font-bold text-sm ${authMode==='login'?'text-blue-600 bg-blue-50/50':'text-slate-400'}`}>登录</button>
            <button onClick={()=>setAuthMode('register')} className={`flex-1 py-4 font-bold text-sm ${authMode==='register'?'text-blue-600 bg-blue-50/50':'text-slate-400'}`}>注册新账号</button>
        </div>

        {authMode === 'login' ? (
            <div className="p-8">
                <div className="flex mb-6 bg-slate-100 p-1 rounded-lg">
                    <button onClick={()=>{setLoginTab('user'); setShow2FAInput(false)}} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${loginTab==='user'?'bg-white shadow text-black':'text-slate-500'}`}>普通用户</button>
                    <button onClick={()=>{setLoginTab('admin'); setShow2FAInput(false)}} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${loginTab==='admin'?'bg-slate-800 shadow text-white':'text-slate-500'}`}>管理员</button>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
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
                    <button className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${loginTab==='admin'?'bg-slate-800 shadow-slate-200':'bg-blue-600 shadow-blue-200'}`}>{show2FAInput ? '验证并登录' : '登录系统'}</button>
                </form>
            </div>
        ) : (
            <div className="p-8">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800">欢迎加入 HAM AWARDS</h2>
                    <p className="text-xs text-slate-400 mt-1">创建您的账户以申请奖状和管理日志</p>
                </div>
                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">注册呼号</label><input name="callsign" required className="w-full border rounded-lg p-3" placeholder="例如: BA1AA" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">设置密码</label><input name="password" type="password" required className="w-full border rounded-lg p-3" /></div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase">确认密码</label><input name="confirmPassword" type="password" required className="w-full border rounded-lg p-3" /></div>
                    <button className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-colors">立即注册</button>
                </form>
            </div>
        )}
      </div>
    </div>
  );

  if (view === 'main') {
      const menu = [
          { id: 'dashboard', label: '概览', icon: BarChart, show: true },
          { id: 'awards', label: '奖状大厅', icon: Award, show: true },
          { id: 'my_awards', label: '我的奖状', icon: CheckCircle, show: user.role === 'user' },
          { id: 'logbook', label: '日志管理', icon: Database, show: user.role === 'user' },
          // Updated Menu Structure
          { id: 'awardCreator', label: '奖状管理', icon: FilePlus, show: user.role === 'award_admin' },
          { id: 'awardAudit', label: '奖状审核', icon: ShieldCheck, show: user.role === 'admin' },
          
          { id: 'users', label: '用户管理', icon: Users, show: user.role === 'admin' },
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
                  <div className="max-w-6xl mx-auto">
                      {subView === 'dashboard' && <DashboardView user={user} />}
                      {subView === 'awards' && <AwardCenterView user={user} />} 
                      {subView === 'my_awards' && <MyAwardsView user={user} />}
                      {subView === 'logbook' && <LogbookView />}
                      {subView === 'users' && <UserManage />}
                      
                      {/* New Split Views */}
                      {subView === 'awardCreator' && <AwardAdminManager />}
                      {subView === 'awardAudit' && <SystemAdminAwardManager />}                      
                      {subView === 'userCenter' && <UserCenterView user={user} refreshUser={refreshUser} onLogout={handleLogout} />}
                  </div>
              </main>
          </div>
      );
  }
  return null;
}