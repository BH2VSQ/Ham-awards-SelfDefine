import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
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
  Target, Calculator, Filter, Layers, Trophy, Crop, ZoomIn, ZoomOut, Grid, ChevronDown, ChevronRight, Bell
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

  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch (jsonError) {
    console.error('JSON解析错误:', jsonError);
    console.error('响应状态:', res.status);
    console.error('响应文本:', text);
    throw { status: res.status, error: 'JSON_ERROR', message: '服务器响应格式错误' };
  }
  if (!res.ok) throw { status: res.status, ...data };
  return data;
};

// ================= Helper Utils =================
// Determine text color (black/white) based on hex background
const getContrastColor = (hexColor) => {
    if (!hexColor) return '#000000';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
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
                    <StatCard title="DXCC 实体 (Unique)" value={stats.dxccs} icon={Globe} color="bg-green-100 text-green-700" />
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
                            <StatCard title="已颁发奖状总次" value={stats.awards_issued || 0} icon={Trophy} color="bg-yellow-100 text-yellow-700" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

// Log Matrix Component (Updated for dynamic columns based on deduplication)
const LogMatchMatrix = ({ qsos, award, checkResult }) => {
    // 2. 包含特定判定项收集的奖项，日志比对详情显示参考附件中图片所示
    const rules = award.rules || {};
    const hasSpecificTargets = rules.targets?.type && ['callsign', 'dxcc', 'grid', 'iota', 'state'].includes(rules.targets.type) && rules.targets.list;

    // View 1: Specific Target List View (The new requirement)
    if (hasSpecificTargets && checkResult?.breakdown) {
        const { breakdown } = checkResult;
        
        // We need to know the LABEL of the target type
        const targetLabel = rules.targets.type.toUpperCase();
        
        const missingItems = breakdown.missing.map(m => ({ target: m, qso: null }));
        
        // Merge
        const allItems = [...breakdown.achieved, ...missingItems];
        // Sort by target name
        allItems.sort((a,b) => a.target.localeCompare(b.target));

        return (
            <div className="overflow-auto border rounded-xl shadow-sm max-h-[60vh] relative">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 z-20 shadow-sm">
                        <tr className="bg-slate-100 text-slate-600 font-bold border-b-2 border-slate-200">
                            <th className="p-3 text-left w-1/3 border-r bg-slate-100">{targetLabel}</th>
                            <th className="p-3 text-left bg-slate-100">Confirmed QSO</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allItems.map((item, idx) => {
                            const isAchieved = !!item.qso;
                            return (
                                <tr key={idx} className={`border-b ${isAchieved ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <td className={`p-3 font-mono font-bold border-r ${isAchieved ? 'text-green-800' : 'text-red-800'}`}>
                                        {item.target}
                                    </td>
                                    <td className="p-3">
                                        {isAchieved ? (
                                            <div className="text-blue-600 font-bold underline cursor-pointer hover:text-blue-800">
                                                {item.qso.call} <span className="text-xs text-slate-500 no-underline font-normal ml-2">({item.qso.band} / {item.qso.mode})</span>
                                            </div>
                                        ) : (
                                            <span className="text-red-400 italic">Not Confirmed</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    // View 2: Standard Band/Mode Matrix (Fallback for general awards)
    // 6. 用户的奖项日志匹配详情的波段模式表头按照波长顺序排列，从左到右从长到短
    if (!qsos || qsos.length === 0) return <div className="p-4 text-center text-slate-400">暂无匹配日志</div>;

    // Define Wavelength Sort Order
    const bandOrder = ['160M', '80M', '60M', '40M', '30M', '20M', '17M', '15M', '12M', '10M', '6M', '4M', '2M', '70CM', '23CM'];
    const getBandIndex = (b) => {
        const idx = bandOrder.indexOf(b?.toUpperCase());
        return idx === -1 ? 999 : idx;
    };

    const bands = Array.from(new Set(qsos.map(q => q.band))).sort((a,b) => getBandIndex(a) - getBandIndex(b));
    
    // Row Logic
    let getRowKey = (q) => q.call; // Default
    let rowLabel = "Callsign";
    
    // Even if not "Specific Targets List", we might group by Entity if logic implies
    if (rules.targets?.type === 'dxcc') { getRowKey = (q) => q.dxcc || q.country; rowLabel = "DXCC"; }
    else if (rules.targets?.type === 'grid') { getRowKey = (q) => (q.grid || '').substring(0,4); rowLabel = "Grid"; }
    else if (rules.targets?.type === 'state') { getRowKey = (q) => q.state; rowLabel = "State"; }
    
    const rowKeys = Array.from(new Set(qsos.map(q => getRowKey(q)))).sort();
    const modes = ['CW', 'PHONE', 'DIGI'];

    const getModeCat = (m) => {
        if (!m) return 'DIGI';
        m = m.toUpperCase();
        if (['CW'].includes(m)) return 'CW';
        if (['SSB', 'AM', 'FM', 'USB', 'LSB'].includes(m)) return 'PHONE';
        return 'DIGI';
    };

    // Build Map: RowKey -> Band -> Mode -> Count
    const dataMap = {};
    qsos.forEach(q => {
        const rKey = getRowKey(q);
        if (!rKey) return;
        if (!dataMap[rKey]) dataMap[rKey] = {};
        if (!dataMap[rKey][q.band]) dataMap[rKey][q.band] = { CW:0, PHONE:0, DIGI:0 };
        dataMap[rKey][q.band][getModeCat(q.mode)]++;
    });

    return (
        <div className="overflow-auto border rounded-xl shadow-sm max-h-[60vh] relative">
            <table className="w-full text-xs text-center border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                    <tr className="bg-slate-100 text-slate-600">
                        <th rowSpan="2" className="p-2 border sticky left-0 top-0 z-30 bg-slate-100 w-24 text-left shadow-r">{rowLabel}</th>
                        {bands.map(b => (
                            <th key={b} colSpan="3" className="p-2 border font-bold bg-slate-50">{b}</th>
                        ))}
                    </tr>
                    <tr className="bg-slate-50 text-slate-500 text-[10px]">
                        {bands.map(b => (
                            <React.Fragment key={b}>
                                <th className="border p-1 w-8">CW</th>
                                <th className="border p-1 w-8">SSB</th>
                                <th className="border p-1 w-8">DIGI</th>
                            </React.Fragment>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {rowKeys.map(rKey => (
                        <tr key={rKey} className="hover:bg-blue-50">
                            <td className="p-2 border font-mono font-bold sticky left-0 bg-white hover:bg-blue-50 z-10 text-left border-r shadow-sm">{rKey}</td>
                            {bands.map(b => (
                                <React.Fragment key={b}>
                                    {modes.map(m => {
                                        const count = dataMap[rKey]?.[b]?.[m] || 0;
                                        return (
                                            <td key={m} className={`border p-1 ${count > 0 ? 'bg-green-100 text-green-700 font-bold' : 'text-slate-200'}`}>
                                                {count > 0 ? count : '-'}
                                            </td>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// New: My Awards View (Visual Gallery with Colored Badges)
const MyAwardsView = ({ user }) => {
    const [awards, setAwards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAward, setSelectedAward] = useState(null); // For detail view
    const awardRefs = useRef({}); // Store refs for each award card

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

    const getLevelColor = (ua) => {
        // Try to find the color definition in rules
        if (ua.rules && ua.rules.thresholds) {
            const t = ua.rules.thresholds.find(th => th.name === ua.level);
            if (t && t.color) return t.color;
        }
        return '#eab308'; // Default yellow-500
    };

    const handleDownload = async (e, awardId, award) => {
        e.stopPropagation();
        
        try {
            const cardElement = awardRefs.current[awardId];
            if (!cardElement) {
                throw new Error('找不到奖状卡片元素');
            }

            // 创建一个克隆元素，用于生成无边框的图片
            const cloneElement = cardElement.cloneNode(true);
            // 移除克隆元素的边框和阴影
            cloneElement.style.border = 'none';
            cloneElement.style.boxShadow = 'none';
            cloneElement.style.margin = '0';
            cloneElement.style.padding = '0';
            
            // 临时将克隆元素添加到文档中（但不可见）
            cloneElement.style.position = 'absolute';
            cloneElement.style.top = '-9999px';
            cloneElement.style.left = '-9999px';
            cloneElement.style.width = '800px'; // 设置固定宽度以确保生成的图片大小一致
            document.body.appendChild(cloneElement);

            // 等待所有图片加载完成
            await new Promise((resolve) => {
                const images = cloneElement.querySelectorAll('img');
                const backgroundDivs = cloneElement.querySelectorAll('[style*="backgroundImage"]');
                const allElements = [...images, ...backgroundDivs];
                let loaded = 0;
                const total = allElements.length;
                
                if (total === 0) {
                    resolve();
                    return;
                }
                
                allElements.forEach(element => {
                    if (element.tagName === 'IMG') {
                        // 处理img元素
                        if (element.complete) {
                            loaded++;
                            if (loaded === total) resolve();
                        } else {
                            element.onload = () => {
                                loaded++;
                                if (loaded === total) resolve();
                            };
                            element.onerror = () => {
                                loaded++;
                                if (loaded === total) resolve();
                            };
                        }
                    } else {
                        // 处理带有背景图片的div
                        const bgStyle = element.style.backgroundImage;
                        if (bgStyle) {
                            const urlMatch = bgStyle.match(/url\(['"]?(.*?)['"]?\)/);
                            if (urlMatch) {
                                const bgUrl = urlMatch[1];
                                const img = new Image();
                                img.crossOrigin = 'anonymous';
                                img.onload = () => {
                                    loaded++;
                                    if (loaded === total) resolve();
                                };
                                img.onerror = () => {
                                    loaded++;
                                    if (loaded === total) resolve();
                                };
                                img.src = bgUrl;
                            } else {
                                loaded++;
                                if (loaded === total) resolve();
                            }
                        } else {
                            loaded++;
                            if (loaded === total) resolve();
                        }
                    }
                });
            });

            // 使用 html2canvas 捕获克隆元素
            console.log('开始生成图片，克隆元素:', cloneElement);
            const canvas = await html2canvas(cloneElement, {
                scale: 2, // 提高分辨率
                useCORS: true,
                backgroundColor: '#ffffff',
                allowTaint: true,
                logging: true,
                removeContainer: true,
                width: 800,
                height: 566, // 1.414:1 的宽高比
                x: 0,
                y: 0
            });
            console.log('Canvas生成成功，尺寸:', canvas.width, 'x', canvas.height);

            // 移除临时克隆元素
            if (document.body.contains(cloneElement)) {
                document.body.removeChild(cloneElement);
            }

            // 转换为Blob并创建URL
            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, 'image/png', 1.0);
            });
            
            if (!blob) {
                throw new Error('Blob生成失败');
            }
            
            console.log('Blob生成成功，大小:', blob.size);
            const url = URL.createObjectURL(blob);
            
            // 打开新窗口预览并下载
            const newWindow = window.open();
            if (!newWindow) {
                // 如果无法打开新窗口，直接下载
                const link = document.createElement('a');
                link.href = url;
                link.download = `award_${award.serial_number}_${award.name.replace(/\s+/g, '_')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                }, 10000);
                return;
            }
            
            // 写入新窗口内容
            newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>奖状预览</title>
                    <style>
                        body {
                            margin: 20px;
                            padding: 0;
                            font-family: Arial, sans-serif;
                            background-color: #f5f5f5;
                        }
                        .container {
                            max-width: 800px;
                            margin: 0 auto;
                            text-align: center;
                        }
                        img {
                            max-width: 100%;
                            max-height: 80vh;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            border-radius: 8px;
                        }
                        .download-btn {
                            margin-top: 20px;
                            padding: 10px 20px;
                            background-color: #3b82f6;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 16px;
                            text-decoration: none;
                            display: inline-block;
                        }
                        .download-btn:hover {
                            background-color: #2563eb;
                        }
                        .loading {
                            margin: 20px;
                            padding: 20px;
                            background-color: #f0f0f0;
                            border-radius: 4px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>奖状预览</h1>
                        <div class="loading" id="loading">生成图片中，请稍候...</div>
                        <img src="${url}" alt="奖状" id="award-image" style="display: none;" onload="document.getElementById('loading').style.display='none'; this.style.display='block';" />
                        <a href="${url}" class="download-btn" download="award_${award.serial_number}_${award.name.replace(/\s+/g, '_')}.png">下载奖状</a>
                    </div>
                    <script>
                        // 自动触发下载
                        setTimeout(() => {
                            const link = document.createElement('a');
                            link.href = '${url}';
                            link.download = 'award_${award.serial_number}_${award.name.replace(/\s+/g, '_')}.png';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }, 1500);
                    </script>
                </body>
                </html>
            `);
            
            // 延迟清理，确保文件下载完成
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 10000);
            
        } catch (error) {
            console.error('下载失败:', error);
            // 移除临时元素（如果存在）
            try {
                const tempElements = document.querySelectorAll('[style*="top: -9999px"]');
                tempElements.forEach(el => {
                    if (document.body.contains(el)) {
                        document.body.removeChild(el);
                    }
                });
            } catch (cleanupError) {
                console.error('清理临时元素失败:', cleanupError);
            }
            alert('下载失败，请稍后重试: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2"><Award className="text-orange-500"/> 我的荣誉墙 (My Awards)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                {awards.map(ua => {
                    const badgeColor = getLevelColor(ua);
                    const textColor = getContrastColor(badgeColor);
                    return (
                        <div key={ua.id} className="relative group perspective cursor-pointer" onClick={() => setSelectedAward(ua)}>
                            {/* Certificate Card with ref */}
                            <div 
                                ref={el => awardRefs.current[ua.id] = el}
                                className="bg-white rounded-xl shadow-xl overflow-hidden border-4 border-slate-900 aspect-[1.414/1] relative"
                            >
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
                                             <div 
                                                className="px-4 py-1 rounded-full font-black uppercase text-sm shadow-lg"
                                                style={{ backgroundColor: badgeColor, color: textColor }}
                                             >
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
                                 <div className="text-sm font-bold text-slate-600 flex items-center gap-2"><Eye size={14}/> {ua.name}</div>
                                 <button 
                                     onClick={(e) => handleDownload(e, ua.id, ua)}
                                     className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                 >
                                     <Download size={12}/> 下载奖状
                                 </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Pass userRole as admin to hide 'apply' button but allow matrix viewing */}
            {selectedAward && (
                <AwardDetailModal 
                    award={{...selectedAward, id: selectedAward.award_id}} 
                    onClose={() => setSelectedAward(null)} 
                    userRole="user" 
                    mode="view_only" // Signal to just show progress/matrix
                />
            )}
        </div>
    );
};

// Common Award Detail Modal (UPDATED: Multi-level)
const AwardDetailModal = ({ award, onClose, onApply, userRole, mode }) => {
    const [checkResult, setCheckResult] = useState(null);
    const [checking, setChecking] = useState(false);
    const [applying, setApplying] = useState(false);
    const [showMatrix, setShowMatrix] = useState(false);

    useEffect(() => {
        if (userRole === 'user') {
            checkEligibility();
        }
    }, []);

    const checkEligibility = async (includeQsos = false) => {
        setChecking(true);
        try {
            // mode='view_only' implies we might want to see the matrix immediately or just load progress
            // Check requires ?include_qsos=true for matrix
            const url = `/awards/${award.id}/check` + (includeQsos || showMatrix ? '?include_qsos=true' : '');
            const res = await apiFetch(url);
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

    const handleLoadMatrix = () => {
        setShowMatrix(true);
        checkEligibility(true); // reload with qsos
    };

    const rules = award.rules || {};
    const hasComplexRules = !!rules.v2;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh]">
                <div className="w-full md:w-4/12 bg-slate-100 bg-cover bg-center h-48 md:h-auto min-h-[200px] flex flex-col justify-end p-6" style={{backgroundImage: `url(${award.bg_url})`}}>
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
                    
                    {showMatrix ? (
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <button onClick={()=>setShowMatrix(false)} className="text-sm text-slate-500 hover:text-black">← 返回详情</button>
                                <h4 className="font-bold">日志匹配分析 (Log Matrix)</h4>
                            </div>
                            <div className="flex-1 overflow-hidden relative">
                                {checkResult?.matching_qsos ? (
                                    <LogMatchMatrix qsos={checkResult.matching_qsos} award={award} checkResult={checkResult} />
                                ) : (
                                    <div className="text-center p-8 text-slate-400">加载中...</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 flex-1 overflow-y-auto">
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
                                                    <div key={i} className="mt-2">
                                                        <div className="font-bold text-slate-700">条件 {i+1}</div>
                                                        {f.bands && <div>• 波段: {f.bands.join(', ')}</div>}
                                                        {f.modes && <div>• 模式: {f.modes.join(', ')}</div>}
                                                    </div>
                                                ))
                                            ) : null}
                                            {rules.thresholds?.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="font-bold text-slate-700 mb-2">等级要求</div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                        {rules.thresholds.map((t, i) => (
                                                            <div key={i} className="p-2 rounded-lg" style={{backgroundColor: t.color + '20', borderLeft: `4px solid ${t.color}`}}>
                                                                <div className="font-bold">{t.name}</div>
                                                                <div className="text-xs text-slate-600">{t.count} 个有效通联</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {rules.bands && <div>• 波段: {rules.bands.join(', ')}</div>}
                                            {rules.modes && <div>• 模式: {rules.modes.join(', ')}</div>}
                                            {rules.count && <div>• 需通联: {rules.count} 个不同实体</div>}
                                            {rules.dxccs && <div>• 特定 DXCC: {rules.dxccs.length} 个</div>}
                                            {rules.callsigns && <div>• 特定呼号: {rules.callsigns.length} 个</div>}
                                            {rules.grid && <div>• 网格要求: {rules.grid}</div>}
                                            {rules.state && <div>• 州: {rules.state}</div>}
                                            {rules.iota && <div>• IOTA: {rules.iota}</div>}
                                            {rules.startDate && <div>• 开始日期: {rules.startDate}</div>}
                                            {rules.endDate && <div>• 结束日期: {rules.endDate}</div>}
                                            {rules.qslRequired && <div className="text-green-600 font-bold">✅ 需要 QSL 确认</div>}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Eligibility Check */}
                            {userRole === 'user' && (
                                <div>
                                    <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase flex items-center gap-2"><Target size={14}/> 资格检查</h4>
                                    {checking ? (
                                        <div className="p-8 text-center text-slate-400">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                            检查中...
                                        </div>
                                    ) : checkResult?.error ? (
                                        <div className="p-4 text-red-500 bg-red-50 rounded-lg border border-red-200">
                                            ❌ {checkResult.error}
                                        </div>
                                    ) : checkResult ? (
                                        <div className="space-y-4">
                                            <div className={`p-4 rounded-lg border ${checkResult.eligible ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                <div className="font-bold mb-2">
                                                    {checkResult.eligible ? '✅ 恭喜！您已具备申领资格' : '❌ 抱歉，您尚未满足要求'}
                                                </div>
                                                <div className="text-sm">
                                                    已完成: {checkResult.achieved}/{checkResult.required} ({Math.round((checkResult.achieved/checkResult.required)*100)}%)
                                                </div>
                                            </div>
                                            {checkResult.matching_qsos && (
                                                <button 
                                                    onClick={handleLoadMatrix}
                                                    className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                                                >
                                                    查看详细匹配日志
                                                </button>
                                            )}
                                            {checkResult.eligible && !mode && onApply && (
                                                <button 
                                                    onClick={handleApplyClick}
                                                    disabled={applying}
                                                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                                                >
                                                    {applying ? '申领中...' : '立即申领奖状'}
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => checkEligibility()}
                                            className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
                                        >
                                            检查资格
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Main App Component
function App() {
    const [user, setUser] = useState(null);
    const [subView, setSubView] = useState('dashboard');
    const [expandedMenus, setExpandedMenus] = useState({});
    const [authMode, setAuthMode] = useState('login');
    const [show2FAInput, setShow2FAInput] = useState(false);
    const [isInstalled, setIsInstalled] = useState(true);

    // Check if installed on load
    useEffect(() => {
        fetch('/api/installed')
            .then(res => res.json())
            .then(data => {
                setIsInstalled(data.installed);
            })
            .catch(() => {
                setIsInstalled(false);
            });
    }, []);

    // Check user session
    useEffect(() => {
        const savedUser = localStorage.getItem('ham_user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error('Failed to parse user data:', e);
                localStorage.removeItem('ham_user');
                localStorage.removeItem('ham_token');
            }
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (res.requires_2fa) {
                setShow2FAInput(true);
                return;
            }

            localStorage.setItem('ham_token', res.token);
            localStorage.setItem('ham_user', JSON.stringify(res.user));
            setUser(res.user);
            setSubView('dashboard');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        if (data.password !== data.confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }

        try {
            const res = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            alert('注册成功！请登录');
            setAuthMode('login');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('ham_token');
        localStorage.removeItem('ham_user');
        setUser(null);
        setSubView('dashboard');
    };

    const handleInstallComplete = () => {
        window.location.reload();
    };

    const toggleMenu = (menuId) => {
        setExpandedMenus(prev => ({
            ...prev,
            [menuId]: !prev[menuId]
        }));
    };

    const handleMenuClick = (item) => {
        setSubView(item.id);
        if (item.parent) {
            setExpandedMenus(prev => ({
                ...prev,
                [item.parent]: true
            }));
        }
    };

    const getNavItems = (role) => {
        const baseItems = [
            { id: 'dashboard', label: '仪表盘', icon: Activity },
            { id: 'awards', label: '奖状大厅', icon: Award },
            { id: 'my-awards', label: '我的奖状', icon: Trophy },
            { id: 'logbook', label: '日志上传', icon: FileText }
        ];

        if (role === 'admin') {
            return [
                ...baseItems,
                {
                    id: 'admin',
                    label: '管理中心',
                    icon: Shield,
                    children: [
                        { id: 'users', label: '用户管理', icon: Users, parent: 'admin' },
                        { id: 'awards-admin', label: '奖状管理', icon: Award, parent: 'admin' },
                        { id: 'audit-awards', label: '审核奖状', icon: CheckCircle, parent: 'admin' },
                        { id: 'create-award', label: '创建奖状', icon: FilePlus, parent: 'admin' },
                        { id: 'system', label: '系统设置', icon: Settings, parent: 'admin' },
                        { id: 'notifications', label: '通知中心', icon: Bell, parent: 'admin' }
                    ]
                }
            ];
        } else if (role === 'award_admin') {
            return [
                ...baseItems,
                {
                    id: 'admin',
                    label: '管理中心',
                    icon: Shield,
                    children: [
                        { id: 'awards-admin', label: '奖状管理', icon: Award, parent: 'admin' },
                        { id: 'audit-awards', label: '审核奖状', icon: CheckCircle, parent: 'admin' },
                        { id: 'create-award', label: '创建奖状', icon: FilePlus, parent: 'admin' }
                    ]
                }
            ];
        }

        return baseItems;
    };

    const renderSubView = () => {
        switch (subView) {
            case 'dashboard':
                return <DashboardView user={user} />;
            case 'my-awards':
                return <MyAwardsView user={user} />;
            default:
                return <div className="p-8 text-center text-slate-400">页面开发中...</div>;
        }
    };

    // Render Install View if not installed
    if (!isInstalled) {
        return <InstallView onComplete={handleInstallComplete} />;
    }

    // Render Login View if no user
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="bg-slate-900 p-8 text-white">
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Shield className="text-blue-500" /> HAM AWARDS
                        </h1>
                        <p className="text-slate-400 text-sm mt-2">登录系统</p>
                    </div>
                    <div className="p-8">
                        {/* Auth Mode Toggle */}
                        <div className="flex border rounded-lg overflow-hidden mb-6">
                            <button onClick={()=>setAuthMode('login')} className={`flex-1 py-4 font-bold text-sm ${authMode==='login'?'text-blue-600 bg-blue-50/50':'text-slate-400'}`}>登录</button>
                            <button onClick={()=>setAuthMode('register')} className={`flex-1 py-4 font-bold text-sm ${authMode==='register'?'text-blue-600 bg-blue-50/50':'text-slate-400'}`}>注册</button>
                        </div>
                        {/* Login Form */}
                        {authMode === 'login' && (
                            <form onSubmit={handleLogin}>
                                {show2FAInput ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">两步验证码</label>
                                            <input type="text" name="code" required className="w-full border rounded-lg p-3" placeholder="请输入验证码" />
                                        </div>
                                        <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                                            验证
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">呼号</label>
                                            <input type="text" name="callsign" required className="w-full border rounded-lg p-3" placeholder="请输入呼号" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">密码</label>
                                            <input type="password" name="password" required className="w-full border rounded-lg p-3" placeholder="请输入密码" />
                                        </div>
                                        <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                                            登录
                                        </button>
                                    </div>
                                )}
                            </form>
                        )}
                        {/* Register Form */}
                        {authMode === 'register' && (
                            <form onSubmit={handleRegister}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">呼号</label>
                                        <input type="text" name="callsign" required className="w-full border rounded-lg p-3" placeholder="请输入呼号" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">密码</label>
                                        <input type="password" name="password" required className="w-full border rounded-lg p-3" placeholder="请输入密码" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">确认密码</label>
                                        <input type="password" name="confirmPassword" required className="w-full border rounded-lg p-3" placeholder="请再次输入密码" />
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                                        注册
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-sm border-r border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-900 text-white rounded-lg">
                            <Radio size={20} />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">HAM AWARDS</h1>
                            <p className="text-xs text-slate-500">{user.callsign}</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 overflow-y-auto">
                    <ul className="space-y-1">
                        {getNavItems(user.role).map((item) => (
                            <li key={item.id}>
                                {item.children ? (
                                    <div>
                                        <button
                                            onClick={() => toggleMenu(item.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${expandedMenus[item.id] ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <item.icon size={18} />
                                            <span className="font-medium">{item.label}</span>
                                            <ChevronRight size={16} className={`ml-auto transition-transform ${expandedMenus[item.id] ? 'rotate-90' : ''}`} />
                                        </button>
                                        {expandedMenus[item.id] && (
                                            <ul className="mt-1 space-y-1 pl-10">
                                                {item.children.map((child) => (
                                                    <li key={child.id}>
                                                        <button
                                                            onClick={() => handleMenuClick(child)}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-slate-600 hover:bg-slate-50 ${subView === child.id ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                                                        >
                                                            <child.icon size={16} />
                                                            <span>{child.label}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleMenuClick(item)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${subView === item.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <item.icon size={18} />
                                        <span className="font-medium">{item.label}</span>
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50"
                    >
                        <LogOut size={18} />
                        <span className="font-medium">退出登录</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-y-auto">
                {/* Header */}
                <header className="mb-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            {subView === 'dashboard' ? '仪表盘' :
                             subView === 'awards' ? '奖状大厅' :
                             subView === 'my-awards' ? '我的奖状' :
                             subView === 'logbook' ? '日志上传' :
                             subView === 'users' ? '用户管理' :
                             subView === 'awards-admin' ? '奖状管理' :
                             subView === 'system' ? '系统设置' :
                             subView === 'create-award' ? '创建奖状' :
                             subView === 'audit-awards' ? '审核奖状' :
                             subView === 'notifications' ? '通知中心' : 'HAM AWARDS'}
                        </h2>
                        <p className="text-sm text-slate-500">欢迎回来，{user.callsign}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-slate-100 rounded-full">
                            <Bell size={20} />
                        </button>
                        <div className="relative">
                            <button className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200">
                                <User size={16} />
                                <span className="text-sm font-medium">{user.callsign}</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="space-y-6">
                    {renderSubView()}
                </div>
            </main>
        </div>
    );
}