import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // 确保您的组件文件名为 App.jsx 并位于 src 目录下
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);