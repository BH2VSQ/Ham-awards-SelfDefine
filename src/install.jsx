import React, { useState } from 'react';
import { Server, Database, Lock, User, Shield, HardDrive, Globe, CheckCircle } from 'lucide-react';

export default function InstallView({ onComplete, t }) {
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
    minioBucket: 'ham-awards',
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
      alert('安装成功！页面将刷新。');
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
              <div className="grid grid-cols-2 gap-4">
                <input name="minioEndpoint" value={config.minioEndpoint} onChange={handleChange} className="col-span-2 w-full border rounded-lg p-3" placeholder="Endpoint (e.g. localhost)" />
                <input name="minioAccessKey" value={config.minioAccessKey} onChange={handleChange} className="w-full border rounded-lg p-3" placeholder="Access Key" />
                <input name="minioSecretKey" type="password" value={config.minioSecretKey} onChange={handleChange} className="w-full border rounded-lg p-3" placeholder="Secret Key" />
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
                  <span className="font-bold text-blue-800">启用 HTTPS</span>
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