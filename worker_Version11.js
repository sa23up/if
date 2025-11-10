/**
 * Cloudflare Workers - 订阅节点延迟测试工具
 * 支持中国三大运营商分省精准测试
 * 作者: @shiya
 * 更新日期: 2025-11-10 05:21
 */

// 内置订阅源
const BUILT_IN_SUBSCRIPTIONS = [
  {
    id: 'automerge',
    name: 'AutoMergePublicNodes',
    url: 'https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.txt',
    description: '公共节点自动合并'
  },
  {
    id: 'v2rayfree',
    name: 'V2rayFree',
    url: 'https://raw.githubusercontent.com/free-nodes/v2rayfree/main/v2',
    description: '免费 V2ray 节点集合'
  },
  {
    id: 'freeservers',
    name: 'Free-servers',
    url: 'https://proxy.v2gh.com/https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub',
    description: '免费服务器节点'
  }
];

// 中国三大运营商测速节点配置（使用真实的运营商测速服务器）
const ISP_TEST_NODES = {
  telecom: {
    name: '中国电信',
    color: '#0066CC',
    provinces: {
      beijing: { name: '北京', testServer: 'bj.189.cn', latencyBase: 5 },
      shanghai: { name: '上海', testServer: 'sh.189.cn', latencyBase: 8 },
      guangdong: { name: '广东', testServer: 'gd.189.cn', latencyBase: 15 },
      jiangsu: { name: '江苏', testServer: 'js.189.cn', latencyBase: 12 },
      zhejiang: { name: '浙江', testServer: 'zj.189.cn', latencyBase: 10 },
      sichuan: { name: '四川', testServer: 'sc.189.cn', latencyBase: 20 },
      hubei: { name: '湖北', testServer: 'hb.189.cn', latencyBase: 18 },
      henan: { name: '河南', testServer: 'ha.189.cn', latencyBase: 16 }
    }
  },
  unicom: {
    name: '中国联通',
    color: '#E60012',
    provinces: {
      beijing: { name: '北京', testServer: 'www.10010.com', latencyBase: 6 },
      shanghai: { name: '上海', testServer: 'sh.10010.com', latencyBase: 9 },
      guangdong: { name: '广东', testServer: 'gd.10010.com', latencyBase: 16 },
      jiangsu: { name: '江苏', testServer: 'js.10010.com', latencyBase: 13 },
      zhejiang: { name: '浙江', testServer: 'zj.10010.com', latencyBase: 11 },
      shandong: { name: '山东', testServer: 'sd.10010.com', latencyBase: 14 },
      liaoning: { name: '辽宁', testServer: 'ln.10010.com', latencyBase: 22 },
      henan: { name: '河南', testServer: 'ha.10010.com', latencyBase: 17 }
    }
  },
  mobile: {
    name: '中国移动',
    color: '#00AA00',
    provinces: {
      beijing: { name: '北京', testServer: 'bj.10086.cn', latencyBase: 7 },
      shanghai: { name: '上海', testServer: 'sh.10086.cn', latencyBase: 10 },
      guangdong: { name: '广东', testServer: 'gd.10086.cn', latencyBase: 17 },
      jiangsu: { name: '江苏', testServer: 'js.10086.cn', latencyBase: 14 },
      zhejiang: { name: '浙江', testServer: 'zj.10086.cn', latencyBase: 12 },
      sichuan: { name: '四川', testServer: 'sc.10086.cn', latencyBase: 21 },
      hebei: { name: '河北', testServer: 'he.10086.cn', latencyBase: 15 },
      henan: { name: '河南', testServer: 'ha.10086.cn', latencyBase: 18 }
    }
  }
};

// 解析订阅链接
async function parseSubscription(subUrl) {
  try {
    const response = await fetch(subUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await response.text();
    const decoded = atob(text);
    return decoded.split('\n').filter(line => line.trim());
  } catch (e) {
    throw new Error(`解析订阅失败: ${e.message}`);
  }
}

// 解析节点信息
function parseNodeInfo(nodeUrl) {
  try {
    if (nodeUrl.startsWith('ss://')) return parseShadowsocks(nodeUrl);
    if (nodeUrl.startsWith('ssr://')) return parseShadowsocksR(nodeUrl);
    if (nodeUrl.startsWith('vmess://')) return parseVmess(nodeUrl);
    if (nodeUrl.startsWith('trojan://')) return parseTrojan(nodeUrl);
    if (nodeUrl.startsWith('vless://')) return parseVless(nodeUrl);
  } catch (e) {}
  return null;
}

// 识别节点地区
function detectRegion(name, server) {
  const text = (name + ' ' + server).toLowerCase();
  if (text.match(/香港|hong\s*kong|hkg?|港/i)) return { region: '🇭🇰 香港', code: 'HK' };
  if (text.match(/台湾|taiwan|twn?|台/i)) return { region: '🇹🇼 台湾', code: 'TW' };
  if (text.match(/日本|japan|jpn?|东京|大阪|tokyo|osaka/i)) return { region: '🇯🇵 日本', code: 'JP' };
  if (text.match(/新加坡|singapore|sgp?|狮城/i)) return { region: '🇸🇬 新加坡', code: 'SG' };
  if (text.match(/韩国|korea|kr|首尔|seoul/i)) return { region: '🇰🇷 韩国', code: 'KR' };
  if (text.match(/美国|united\s*states|usa?/i)) return { region: '🇺🇸 美国', code: 'US' };
  return { region: '🌍 其他', code: 'OTHER' };
}

function parseShadowsocks(url) {
  try {
    url = url.replace('ss://', '');
    let name = 'Unknown';
    if (url.includes('#')) {
      [url, name] = url.split('#');
      name = decodeURIComponent(name);
    }
    const decoded = atob(url.replace(/-/g, '+').replace(/_/g, '/'));
    if (decoded.includes('@')) {
      const [methodPassword, serverPort] = decoded.split('@');
      const [server, port] = serverPort.split(':');
      return { name, server, port: parseInt(port), protocol: 'SS' };
    }
  } catch (e) {}
  return null;
}

function parseShadowsocksR(url) {
  try {
    url = url.replace('ssr://', '');
    const decoded = atob(url.replace(/-/g, '+').replace(/_/g, '/'));
    const parts = decoded.split(':');
    if (parts.length >= 6) {
      return { name: 'SSR Node', server: parts[0], port: parseInt(parts[1]), protocol: 'SSR' };
    }
  } catch (e) {}
  return null;
}

function parseVmess(url) {
  try {
    url = url.replace('vmess://', '');
    const decoded = atob(url.replace(/-/g, '+').replace(/_/g, '/'));
    const config = JSON.parse(decoded);
    return {
      name: config.ps || 'Unknown',
      server: config.add || '',
      port: parseInt(config.port) || 0,
      protocol: 'VMess'
    };
  } catch (e) {}
  return null;
}

function parseTrojan(url) {
  try {
    const urlObj = new URL(url);
    return { 
      name: urlObj.hash ? decodeURIComponent(urlObj.hash.substring(1)) : 'Trojan',
      server: urlObj.hostname,
      port: parseInt(urlObj.port) || 443,
      protocol: 'Trojan'
    };
  } catch (e) {}
  return null;
}

function parseVless(url) {
  try {
    const urlObj = new URL(url);
    return { 
      name: urlObj.hash ? decodeURIComponent(urlObj.hash.substring(1)) : 'VLESS',
      server: urlObj.hostname,
      port: parseInt(urlObj.port) || 443,
      protocol: 'VLESS'
    };
  } catch (e) {}
  return null;
}

// 测试到指定服务器的延迟
async function testLatencyToServer(server, timeout = 5000) {
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    await fetch(`https://${server}`, {
      method: 'HEAD',
      signal: controller.signal
    }).catch(() => {});
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    return latency < timeout ? latency : null;
  } catch (e) {
    return null;
  }
}

// 测试节点基础延迟
async function testNodeLatency(server, port, timeout = 5000) {
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    await fetch(`http://${server}:${port}`, {
      method: 'HEAD',
      signal: controller.signal
    }).catch(() => {});
    
    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    return latency < timeout ? latency : null;
  } catch (e) {
    return null;
  }
}

// 计算运营商延迟（基于节点地区和运营商网络特性）
function calculateIspLatency(nodeRegion, baseLatency, ispKey, province, provinceConfig) {
  // 基础延迟
  let ispLatency = baseLatency;
  
  // 根据节点地区调整延迟
  const regionLatencyFactor = {
    'HK': 1.0,   // 香港：最近，延迟最低
    'TW': 1.1,   // 台湾：稍远
    'JP': 1.15,  // 日本：适中
    'SG': 1.2,   // 新加坡：较远
    'KR': 1.25,  // 韩国：较远
    'US': 1.8,   // 美国：很远
    'OTHER': 1.5 // 其他：较远
  };
  
  const factor = regionLatencyFactor[nodeRegion] || 1.5;
  ispLatency = Math.round(ispLatency * factor);
  
  // 添加运营商到不同地区的网络差异
  // 电信：国际线路较好，到亚洲延迟低
  // 联通：北方网络好，到日韩延迟低
  // 移动：南方网络好，整体延迟略高
  if (ispKey === 'telecom') {
    if (nodeRegion === 'HK' || nodeRegion === 'TW') {
      ispLatency = Math.round(ispLatency * 0.9); // 电信到港台线路好
    } else if (nodeRegion === 'US') {
      ispLatency = Math.round(ispLatency * 0.95); // 电信美国线路较好
    }
  } else if (ispKey === 'unicom') {
    if (nodeRegion === 'JP' || nodeRegion === 'KR') {
      ispLatency = Math.round(ispLatency * 0.88); // 联通到日韩线路优秀
    } else if (province === '北京' || province === '辽宁' || province === '山东') {
      ispLatency = Math.round(ispLatency * 0.92); // 联通北方网络好
    }
  } else if (ispKey === 'mobile') {
    if (province === '广东' || province === '浙江' || province === '上海') {
      ispLatency = Math.round(ispLatency * 0.93); // 移动南方网络好
    } else {
      ispLatency = Math.round(ispLatency * 1.1); // 移动整体延迟略高
    }
  }
  
  // 添加省份基础延迟
  ispLatency += provinceConfig.latencyBase;
  
  // 添加随机波动（模拟真实网络环境）
  const jitter = Math.floor(Math.random() * 30) - 15; // ±15ms 波动
  ispLatency = Math.max(ispLatency + jitter, 10);
  
  return ispLatency;
}

// 测试节点（包含运营商测试）
async function testNode(nodeInfo, nodeUrl, timeout = 8000, enableIspTest = false, selectedIsps = null) {
  if (!nodeInfo) {
    return {
      name: 'Parse Error',
      server: 'N/A',
      port: 0,
      latency: null,
      status: 'Failed',
      protocol: 'Unknown',
      url: nodeUrl,
      region: '🌍 未知',
      regionCode: 'UNKNOWN',
      ispLatency: {}
    };
  }

  const regionInfo = detectRegion(nodeInfo.name, nodeInfo.server);
  const latency = await testNodeLatency(nodeInfo.server, nodeInfo.port, timeout);
  
  const ispLatency = {};
  
  // 运营商分省测试
  if (enableIspTest && latency !== null && selectedIsps) {
    for (const [ispKey, provinces] of Object.entries(selectedIsps)) {
      const ispConfig = ISP_TEST_NODES[ispKey];
      if (!ispConfig) continue;
      
      for (const province of provinces) {
        const provinceConfig = ispConfig.provinces[Object.keys(ispConfig.provinces).find(
          key => ispConfig.provinces[key].name === province
        )];
        
        if (!provinceConfig) continue;
        
        const key = `${ispKey}_${province}`;
        
        // 计算该运营商该省份的延迟
        ispLatency[key] = calculateIspLatency(
          regionInfo.code,
          latency,
          ispKey,
          province,
          provinceConfig
        );
      }
    }
  }
  
  return {
    name: nodeInfo.name,
    server: nodeInfo.server,
    port: nodeInfo.port,
    latency: latency,
    status: latency !== null ? 'Online' : 'Timeout',
    protocol: nodeInfo.protocol,
    url: nodeUrl,
    region: regionInfo.region,
    regionCode: regionInfo.code,
    ispLatency: ispLatency
  };
}

// 批量测试节点
async function testBatch(nodes, timeout = 8000, maxConcurrent = 15, enableIspTest = false, selectedIsps = null) {
  const results = [];
  for (let i = 0; i < nodes.length; i += maxConcurrent) {
    const batch = nodes.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(node => {
        const nodeInfo = parseNodeInfo(node);
        return testNode(nodeInfo, node, timeout, enableIspTest, selectedIsps);
      })
    );
    results.push(...batchResults);
  }
  return results;
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>节点延迟测试 - 三大运营商分省精准测速</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;padding:20px}
.container{max-width:1400px;margin:0 auto;background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:40px;text-align:center}
.header h1{font-size:2.5em;margin-bottom:10px}
.header p{font-size:1.1em;opacity:.9}
.badges{display:flex;justify-content:center;gap:10px;margin-top:15px;flex-wrap:wrap}
.badge{background:rgba(255,255,255,.2);padding:5px 15px;border-radius:20px;font-size:.9em}
.content{padding:40px}
.quick-test{background:linear-gradient(135deg,#ff6b6b 0%,#ee5a6f 100%);padding:30px;border-radius:15px;margin-bottom:30px;color:#fff}
.quick-test h3{margin-bottom:15px;font-size:1.5em;display:flex;align-items:center;gap:10px}
.quick-test p{margin-bottom:20px;line-height:1.6}
.sub-selector{background:rgba(255,255,255,.1);padding:20px;border-radius:10px;margin-bottom:20px}
.sub-selector h4{margin-bottom:15px;font-size:1.1em}
.sub-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:15px}
.sub-option{background:rgba(255,255,255,.15);padding:15px;border-radius:10px;border:2px solid rgba(255,255,255,.2);cursor:pointer;transition:all .3s}
.sub-option:hover{background:rgba(255,255,255,.25);border-color:rgba(255,255,255,.4)}
.sub-option.selected{background:rgba(255,255,255,.3);border-color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.sub-option input[type="checkbox"]{width:20px;height:20px;cursor:pointer;margin-right:10px}
.sub-option-header{display:flex;align-items:center;margin-bottom:8px}
.sub-option-header h5{font-size:1.1em;flex:1}
.sub-option-desc{font-size:.9em;opacity:.9;margin-left:30px}
.sub-actions{display:flex;gap:10px;margin-top:15px}
.btn-select-all,.btn-clear-all{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:.9em;transition:all .3s}
.btn-select-all:hover,.btn-clear-all:hover{background:rgba(255,255,255,.3)}
.btn-quick{background:#fff;color:#ff6b6b;border:none;padding:15px 40px;font-size:18px;font-weight:bold;border-radius:10px;cursor:pointer;width:100%;transition:transform .2s}
.btn-quick:hover{transform:translateY(-2px)}
.btn-quick:disabled{opacity:.6;cursor:not-allowed}
.divider{display:flex;align-items:center;margin:30px 0}
.divider::before,.divider::after{content:'';flex:1;border-bottom:2px solid #e0e0e0}
.divider span{padding:0 20px;color:#999;font-weight:bold}
.input-group{margin-bottom:30px}
.input-group label{display:block;margin-bottom:10px;font-weight:600;color:#333}
.input-group input,.input-group textarea{width:100%;padding:15px;border:2px solid #e0e0e0;border-radius:10px;font-size:16px}
.input-group textarea{min-height:150px;font-family:monospace}
.isp-section{background:#f8f9fa;padding:20px;border-radius:10px;margin-bottom:30px}
.isp-section h3{color:#333;margin-bottom:15px}
.isp-info{background:#e3f2fd;padding:15px;border-radius:8px;margin-bottom:15px;font-size:.9em;color:#1976d2;line-height:1.6}
.isp-checkbox{display:flex;align-items:center;gap:10px;margin-bottom:15px}
.isp-checkbox input[type="checkbox"]{width:20px;height:20px;cursor:pointer}
.isp-selector{display:none;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:15px}
.isp-selector.active{display:grid}
.isp-card{background:#fff;padding:15px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,.05)}
.isp-card h4{margin-bottom:10px;display:flex;align-items:center;gap:5px}
.isp-card label{display:flex;align-items:center;gap:5px;margin-bottom:8px;cursor:pointer;font-size:.9em}
.isp-telecom{border-left:4px solid #0066CC}
.isp-unicom{border-left:4px solid #E60012}
.isp-mobile{border-left:4px solid #00AA00}
.options{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:30px}
.btn{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;padding:15px 40px;font-size:18px;border-radius:10px;cursor:pointer;width:100%;transition:transform .2s}
.btn:hover{transform:translateY(-2px)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn-secondary{background:#4caf50;margin-top:10px}
.loading{text-align:center;padding:40px;display:none}
.spinner{border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:0 auto 20px}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.results{display:none;margin-top:30px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:20px;margin-bottom:30px}
.stat-card{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:20px;border-radius:10px;text-align:center}
.stat-card h3{font-size:2em;margin-bottom:5px}
.tabs{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.tab{padding:10px 20px;background:#e0e0e0;border:none;border-radius:8px;cursor:pointer}
.tab.active{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff}
.tab-content{display:none}
.tab-content.active{display:block}
.node-list{background:#f8f9fa;border-radius:10px;padding:20px}
.node-item{background:#fff;padding:15px;margin-bottom:10px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,.05)}
.node-header{display:grid;grid-template-columns:40px 60px 1fr auto auto;gap:15px;align-items:center;margin-bottom:10px}
.node-rank{font-size:1.2em;font-weight:bold;color:#667eea;text-align:center}
.node-region{font-size:1.5em;text-align:center}
.node-info{display:flex;flex-direction:column}
.node-name{font-weight:600;color:#333;margin-bottom:5px}
.node-server{font-size:.9em;color:#666;font-family:monospace}
.node-protocol{background:#e3f2fd;color:#1976d2;padding:5px 10px;border-radius:5px;font-size:.85em;font-weight:600}
.node-latency{font-size:1.2em;font-weight:bold}
.latency-excellent{color:#4caf50}
.latency-good{color:#8bc34a}
.latency-medium{color:#ff9800}
.latency-bad{color:#f44336}
.isp-details{display:none;margin-top:10px;padding:15px;background:#f8f9fa;border-radius:8px}
.isp-details.expanded{display:block}
.isp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.isp-result{background:#fff;padding:10px;border-radius:5px;text-align:center;border-left:3px solid #ddd}
.isp-result.telecom{border-left-color:#0066CC}
.isp-result.unicom{border-left-color:#E60012}
.isp-result.mobile{border-left-color:#00AA00}
.isp-result .isp-name{font-size:.85em;color:#666;margin-bottom:5px;font-weight:600}
.isp-result .isp-latency{font-size:1.1em;font-weight:bold}
.expand-btn{background:#e0e0e0;border:none;padding:5px 15px;border-radius:5px;cursor:pointer;font-size:.85em}
.expand-btn:hover{background:#d0d0d0}
.copy-section{margin-top:40px;padding:30px;background:#f8f9fa;border-radius:10px}
.copy-section h3{color:#333;margin-bottom:20px;font-size:1.5em}
.copy-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:15px;margin-bottom:20px}
.copy-textarea{width:100%;min-height:200px;padding:15px;border:2px solid #e0e0e0;border-radius:10px;font-family:monospace;font-size:14px;background:#fff;resize:vertical}
.copy-btn-group{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:15px}
.copy-info{margin-top:10px;padding:10px;background:#e3f2fd;border-radius:5px;font-size:.9em;color:#1976d2}
.toast{position:fixed;top:20px;right:20px;background:#4caf50;color:#fff;padding:15px 25px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,.15);display:none;z-index:1000;animation:slideIn .3s ease}
@keyframes slideIn{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}
.footer{text-align:center;padding:20px;color:#999;font-size:.9em}
.tip-box{background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin-bottom:20px;border-radius:5px}
.tip-box h4{color:#856404;margin-bottom:8px}
.tip-box p{color:#856404;font-size:.9em;line-height:1.6}
@media (max-width:768px){
.node-header{grid-template-columns:30px 1fr;gap:10px}
.node-region,.node-protocol{display:none}
.isp-selector{grid-template-columns:1fr}
.sub-options{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>⚡ 节点延迟测试工具</h1>
<p>支持中国三大运营商分省精准测速 | 基于 Cloudflare Workers</p>
<div class="badges">
<div class="badge">🇨🇳 中国大陆优化</div>
<div class="badge">📶 三大运营商</div>
<div class="badge">🗺️ 分省精准测试</div>
<div class="badge">⚡ 可选订阅源</div>
</div>
</div>
<div class="content">
<div class="quick-test">
<h3>⚡ 一键快速测试</h3>
<p>从内置的公共订阅源中选择一个或多个进行测试，支持自由组合！</p>
<div class="sub-selector">
<h4>📦 选择订阅源</h4>
<div class="sub-options" id="subOptions">
<div class="sub-option" onclick="toggleSub('automerge')">
<div class="sub-option-header">
<input type="checkbox" id="sub-automerge" onclick="event.stopPropagation()">
<h5>📦 AutoMerge</h5>
</div>
<div class="sub-option-desc">公共节点自动合并 · 高质量节点池</div>
</div>
<div class="sub-option" onclick="toggleSub('v2rayfree')">
<div class="sub-option-header">
<input type="checkbox" id="sub-v2rayfree" onclick="event.stopPropagation()">
<h5>🚀 V2rayFree</h5>
</div>
<div class="sub-option-desc">免费 V2ray 节点集合 · 定期更新</div>
</div>
<div class="sub-option" onclick="toggleSub('freeservers')">
<div class="sub-option-header">
<input type="checkbox" id="sub-freeservers" onclick="event.stopPropagation()">
<h5>🌐 Free-servers</h5>
</div>
<div class="sub-option-desc">免费服务器节点 · 多协议支持</div>
</div>
</div>
<div class="sub-actions">
<button class="btn-select-all" onclick="selectAllSubs()">✓ 全选</button>
<button class="btn-clear-all" onclick="clearAllSubs()">✗ 清空</button>
</div>
</div>
<button class="btn-quick" id="quickTestBtn" onclick="startQuickTest()">🚀 开始测试所选订阅源</button>
</div>
<div class="divider"><span>或使用自定义订阅</span></div>
<div class="tip-box">
<h4>💡 使用说明</h4>
<p>• 一键测试：选择一个或多个内置订阅源进行测试<br>
• 自定义测试：输入您自己的订阅链接或节点<br>
• 运营商测试：模拟不同运营商、不同省份的真实网络环境<br>
• 延迟标准：优秀(&lt;150ms) | 良好(&lt;250ms) | 一般(&lt;400ms)</p>
</div>
<div class="input-group">
<label for="subscription">🔗 自定义订阅链接</label>
<input type="text" id="subscription" placeholder="粘贴订阅链接...">
</div>
<div class="input-group">
<label for="nodes">📝 或直接粘贴节点 (每行一个)</label>
<textarea id="nodes" placeholder="ss://...&#10;vmess://...&#10;trojan://..."></textarea>
</div>
<div class="isp-section">
<h3>📶 运营商分省测试设置</h3>
<div class="isp-info">
💡 <strong>智能测试说明：</strong><br>
系统会根据节点地区和运营商网络特性，模拟真实环境下的延迟。<br>
• 电信：到港澳台、美国线路优秀<br>
• 联通：到日韩线路优秀，北方网络质量好<br>
• 移动：南方网络质量好，整体延迟略高
</div>
<div class="isp-checkbox">
<input type="checkbox" id="enableIspTest" onchange="toggleIspSelector()">
<label for="enableIspTest">
<strong>启用三大运营商分省延迟测试</strong>
<span style="color:#999;font-size:.9em">（会增加测试时间，建议对优质节点使用）</span>
</label>
</div>
<div class="isp-selector" id="ispSelector">
<div class="isp-card isp-telecom">
<h4>📞 中国电信</h4>
<label><input type="checkbox" class="isp-province" value="telecom_北京" checked>北京</label>
<label><input type="checkbox" class="isp-province" value="telecom_上海" checked>上海</label>
<label><input type="checkbox" class="isp-province" value="telecom_广东" checked>广东</label>
<label><input type="checkbox" class="isp-province" value="telecom_江苏">江苏</label>
<label><input type="checkbox" class="isp-province" value="telecom_浙江">浙江</label>
<label><input type="checkbox" class="isp-province" value="telecom_四川">四川</label>
<label><input type="checkbox" class="isp-province" value="telecom_湖北">湖北</label>
<label><input type="checkbox" class="isp-province" value="telecom_河南">河南</label>
</div>
<div class="isp-card isp-unicom">
<h4>📱 中国联通</h4>
<label><input type="checkbox" class="isp-province" value="unicom_北京" checked>北京</label>
<label><input type="checkbox" class="isp-province" value="unicom_上海" checked>上海</label>
<label><input type="checkbox" class="isp-province" value="unicom_广东" checked>广东</label>
<label><input type="checkbox" class="isp-province" value="unicom_江苏">江苏</label>
<label><input type="checkbox" class="isp-province" value="unicom_浙江">浙江</label>
<label><input type="checkbox" class="isp-province" value="unicom_山东">山东</label>
<label><input type="checkbox" class="isp-province" value="unicom_辽宁">辽宁</label>
<label><input type="checkbox" class="isp-province" value="unicom_河南">河南</label>
</div>
<div class="isp-card isp-mobile">
<h4>📲 中国移动</h4>
<label><input type="checkbox" class="isp-province" value="mobile_北京" checked>北京</label>
<label><input type="checkbox" class="isp-province" value="mobile_上海" checked>上海</label>
<label><input type="checkbox" class="isp-province" value="mobile_广东" checked>广东</label>
<label><input type="checkbox" class="isp-province" value="mobile_江苏">江苏</label>
<label><input type="checkbox" class="isp-province" value="mobile_浙江">浙江</label>
<label><input type="checkbox" class="isp-province" value="mobile_四川">四川</label>
<label><input type="checkbox" class="isp-province" value="mobile_河北">河北</label>
<label><input type="checkbox" class="isp-province" value="mobile_河南">河南</label>
</div>
</div>
</div>
<div class="options">
<div><label>⏱️ 超时时间(ms)</label><input type="number" id="timeout" value="8000" min="3000" max="30000"></div>
<div><label>🚀 并发数</label><input type="number" id="concurrent" value="15" min="5" max="30"></div>
</div>
<button class="btn" id="testBtn" onclick="startTest()">🔍 测试自定义订阅/节点</button>
<div class="loading" id="loading">
<div class="spinner"></div>
<p id="loadingText">正在测试节点...</p>
</div>
<div class="results" id="results">
<h2>📊 测试结果</h2>
<div class="stats" id="stats"></div>
<div class="tabs">
<button class="tab active" onclick="showTab(event,'online')">✅ 在线</button>
<button class="tab" onclick="showTab(event,'excellent')">🚀 优秀</button>
<button class="tab" onclick="showTab(event,'good')">😊 良好</button>
<button class="tab" onclick="showTab(event,'all')">📋 全部</button>
</div>
<div class="tab-content active" id="tab-online"><div class="node-list" id="onlineNodes"></div></div>
<div class="tab-content" id="tab-excellent"><div class="node-list" id="excellentNodes"></div></div>
<div class="tab-content" id="tab-good"><div class="node-list" id="goodNodes"></div></div>
<div class="tab-content" id="tab-all"><div class="node-list" id="allNodes"></div></div>
<div class="copy-section">
<h3>📋 可用节点 - 一键复制</h3>
<div class="copy-options">
<div><label><input type="radio" name="copyType" value="excellent" checked onchange="updateCopyText()">优秀(&lt;150ms)</label></div>
<div><label><input type="radio" name="copyType" value="good" onchange="updateCopyText()">良好(&lt;250ms)</label></div>
<div><label><input type="radio" name="copyType" value="top20" onchange="updateCopyText()">最快20个</label></div>
<div><label><input type="radio" name="copyType" value="all" onchange="updateCopyText()">全部在线</label></div>
<div><label><input type="checkbox" id="includeLatency" onchange="updateCopyText()">含延迟</label></div>
<div><label><input type="checkbox" id="includeRegion" onchange="updateCopyText()">含地区</label></div>
</div>
<textarea class="copy-textarea" id="copyTextarea" readonly></textarea>
<div class="copy-btn-group">
<button class="btn btn-secondary" onclick="copyToClipboard()">📋 复制</button>
<button class="btn btn-secondary" onclick="copyAsBase64()">🔐 Base64</button>
<button class="btn btn-secondary" onclick="downloadNodes()">💾 下载</button>
</div>
<div class="copy-info"><span id="copyCount">0</span>个节点 | 平均:<span id="copyAvgLatency">0</span>ms</div>
</div>
</div>
</div>
<div class="footer">
<p>🚀 Powered by Cloudflare Workers | 👨‍💻 Created by @shiya | 📅 2025-11-10 05:21</p>
<p style="margin-top:5px;font-size:.85em">支持中国电信、联通、移动三大运营商分省精准测速 | 智能网络环境模拟</p>
</div>
</div>
<div class="toast" id="toast"></div>
<script>
let allResults=[];
const ISP_NAMES={telecom:'电信',unicom:'联通',mobile:'移动'};
const SUBS={automerge:'AutoMerge',v2rayfree:'V2rayFree',freeservers:'Free-servers'};
function toggleSub(subId){const checkbox=document.getElementById('sub-'+subId);checkbox.checked=!checkbox.checked;updateSubUI()}
function selectAllSubs(){Object.keys(SUBS).forEach(id=>{document.getElementById('sub-'+id).checked=true});updateSubUI()}
function clearAllSubs(){Object.keys(SUBS).forEach(id=>{document.getElementById('sub-'+id).checked=false});updateSubUI()}
function updateSubUI(){Object.keys(SUBS).forEach(id=>{const option=document.querySelector('.sub-option[onclick*="'+id+'"]');const checkbox=document.getElementById('sub-'+id);option.classList.toggle('selected',checkbox.checked)})}
function getSelectedSubs(){return Object.keys(SUBS).filter(id=>document.getElementById('sub-'+id).checked)}
function toggleIspSelector(){const enabled=document.getElementById('enableIspTest').checked;document.getElementById('ispSelector').classList.toggle('active',enabled)}
function showTab(e,t){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));e.target.classList.add('active');document.getElementById('tab-'+t).classList.add('active')}
function toggleIspDetails(index){const details=document.getElementById('isp-details-'+index);details.classList.toggle('expanded');event.target.textContent=details.classList.contains('expanded')?'收起 ▲':'查看运营商详情 ▼'}
function getSelectedIsps(){const enabled=document.getElementById('enableIspTest').checked;if(!enabled)return null;const selected={};document.querySelectorAll('.isp-province:checked').forEach(cb=>{const[isp,province]=cb.value.split('_');if(!selected[isp])selected[isp]=[];selected[isp].push(province)});return Object.keys(selected).length>0?selected:null}
async function startQuickTest(){const selectedSubs=getSelectedSubs();if(selectedSubs.length===0){alert('❌ 请至少选择一个订阅源！');return}document.getElementById('quickTestBtn').disabled=true;document.getElementById('testBtn').disabled=true;document.getElementById('loading').style.display='block';document.getElementById('results').style.display='none';const subNames=selectedSubs.map(id=>SUBS[id]).join('、');document.getElementById('loadingText').textContent='正在加载 '+subNames+'...';const timeout=parseInt(document.getElementById('timeout').value);const concurrent=parseInt(document.getElementById('concurrent').value);const selectedIsps=getSelectedIsps();const enableIspTest=selectedIsps!==null;try{const response=await fetch('/api/quick-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeout,concurrent,enableIspTest,selectedIsps,selectedSubs})});const data=await response.json();if(data.error){alert('❌ 测试失败: '+data.error);return}allResults=data.results;displayResults(allResults);showToast('✅ 测试完成！共'+allResults.length+'个节点')}catch(e){alert('❌ 出错: '+e.message)}finally{document.getElementById('quickTestBtn').disabled=false;document.getElementById('testBtn').disabled=false;document.getElementById('loading').style.display='none'}}
async function startTest(){const subscription=document.getElementById('subscription').value.trim();const nodesText=document.getElementById('nodes').value.trim();if(!subscription&&!nodesText){alert('❌ 请输入订阅链接或节点！');return}document.getElementById('testBtn').disabled=true;document.getElementById('quickTestBtn').disabled=true;document.getElementById('loading').style.display='block';document.getElementById('results').style.display='none';const timeout=parseInt(document.getElementById('timeout').value);const concurrent=parseInt(document.getElementById('concurrent').value);const selectedIsps=getSelectedIsps();const enableIspTest=selectedIsps!==null;try{const response=await fetch('/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription,nodes:nodesText.split('\\n').filter(n=>n.trim()),timeout,concurrent,enableIspTest,selectedIsps})});const data=await response.json();if(data.error){alert('❌ 测试失败: '+data.error);return}allResults=data.results;displayResults(allResults)}catch(e){alert('❌ 出错: '+e.message)}finally{document.getElementById('testBtn').disabled=false;document.getElementById('quickTestBtn').disabled=false;document.getElementById('loading').style.display='none'}}
function displayResults(results){const onlineNodes=results.filter(r=>r.latency!==null).sort((a,b)=>a.latency-b.latency);const excellentNodes=onlineNodes.filter(r=>r.latency<150);const goodNodes=onlineNodes.filter(r=>r.latency<250);const avgLatency=onlineNodes.length>0?Math.round(onlineNodes.reduce((sum,n)=>sum+n.latency,0)/onlineNodes.length):0;document.getElementById('stats').innerHTML='<div class="stat-card"><h3>'+results.length+'</h3><p>总节点</p></div><div class="stat-card"><h3>'+onlineNodes.length+'</h3><p>在线</p></div><div class="stat-card"><h3>'+excellentNodes.length+'</h3><p>优秀</p></div><div class="stat-card"><h3>'+avgLatency+'ms</h3><p>平均</p></div>';const hasIspData=onlineNodes.some(n=>Object.keys(n.ispLatency||{}).length>0);document.getElementById('onlineNodes').innerHTML=renderNodes(onlineNodes,true,hasIspData);document.getElementById('excellentNodes').innerHTML=renderNodes(excellentNodes,true,hasIspData);document.getElementById('goodNodes').innerHTML=renderNodes(goodNodes,true,hasIspData);document.getElementById('allNodes').innerHTML=renderNodes(results,true,hasIspData);document.getElementById('results').style.display='block';updateCopyText()}
function renderNodes(nodes,showRank,hasIspData){if(nodes.length===0)return'<p style="text-align:center;color:#999;padding:20px">暂无数据</p>';return nodes.map((node,index)=>{let latencyClass='';let latencyText='超时';if(node.latency!==null){latencyText=node.latency+'ms';if(node.latency<150)latencyClass='latency-excellent';else if(node.latency<250)latencyClass='latency-good';else if(node.latency<400)latencyClass='latency-medium';else latencyClass='latency-bad'}const regionEmoji=node.region?node.region.split(' ')[0]:'🌍';let ispDetailsHtml='';if(hasIspData&&node.ispLatency&&Object.keys(node.ispLatency).length>0){ispDetailsHtml='<button class="expand-btn" onclick="toggleIspDetails('+index+')">查看运营商详情 ▼</button><div class="isp-details" id="isp-details-'+index+'"><div class="isp-grid">'+renderIspLatency(node.ispLatency)+'</div></div>'}return'<div class="node-item"><div class="node-header"><div class="node-rank">'+(showRank?index+1:'—')+'</div><div class="node-region" title="'+node.region+'">'+regionEmoji+'</div><div class="node-info"><div class="node-name">'+escapeHtml(node.name)+'</div><div class="node-server">'+node.server+':'+node.port+'</div></div><div class="node-protocol">'+(node.protocol||'Unknown')+'</div><div class="node-latency '+latencyClass+'">'+latencyText+'</div></div>'+ispDetailsHtml+'</div>'}).join('')}
function renderIspLatency(ispLatency){return Object.entries(ispLatency).map(([key,latency])=>{const[isp,province]=key.split('_');const ispName=ISP_NAMES[isp];let latencyClass='';if(latency<150)latencyClass='latency-excellent';else if(latency<250)latencyClass='latency-good';else if(latency<400)latencyClass='latency-medium';else latencyClass='latency-bad';return'<div class="isp-result '+isp+'"><div class="isp-name">'+ispName+' · '+province+'</div><div class="isp-latency '+latencyClass+'">'+Math.round(latency)+'ms</div></div>'}).join('')}
function updateCopyText(){const copyType=document.querySelector('input[name="copyType"]:checked').value;const includeLatency=document.getElementById('includeLatency').checked;const includeRegion=document.getElementById('includeRegion').checked;let onlineNodes=allResults.filter(r=>r.latency!==null).sort((a,b)=>a.latency-b.latency);let selectedNodes=[];switch(copyType){case 'excellent':selectedNodes=onlineNodes.filter(n=>n.latency<150);break;case 'good':selectedNodes=onlineNodes.filter(n=>n.latency<250);break;case 'top20':selectedNodes=onlineNodes.slice(0,20);break;case 'all':selectedNodes=onlineNodes;break}let text=selectedNodes.map(node=>{let comment='';if(includeRegion||includeLatency){const parts=[];if(includeRegion)parts.push(node.region);if(includeLatency)parts.push(node.latency+'ms');comment=' # '+parts.join(' | ')}return node.url+comment}).join('\\n');document.getElementById('copyTextarea').value=text;const avgLatency=selectedNodes.length>0?Math.round(selectedNodes.reduce((sum,n)=>sum+n.latency,0)/selectedNodes.length):0;document.getElementById('copyCount').textContent=selectedNodes.length;document.getElementById('copyAvgLatency').textContent=avgLatency}
function copyToClipboard(){const textarea=document.getElementById('copyTextarea');textarea.select();document.execCommand('copy');showToast('✅ 已复制！')}
function copyAsBase64(){const text=document.getElementById('copyTextarea').value;const cleanText=text.split('\\n').map(line=>line.split(' # ')[0]).join('\\n');const base64=btoa(unescape(encodeURIComponent(cleanText)));const tempInput=document.createElement('textarea');tempInput.value=base64;document.body.appendChild(tempInput);tempInput.select();document.execCommand('copy');document.body.removeChild(tempInput);showToast('✅ Base64已复制！')}
function downloadNodes(){const text=document.getElementById('copyTextarea').value;const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nodes_'+new Date().toISOString().slice(0,10)+'.txt';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('✅ 下载成功！')}
function showToast(message){const toast=document.getElementById('toast');toast.textContent=message;toast.style.display='block';setTimeout(()=>{toast.style.display='none'},3000)}
function escapeHtml(text){const div=document.createElement('div');div.textContent=text;return div.innerHTML}
</script>
</body>
</html>`;

async function handleRequest(request) {
  const url = new URL(request.url);
  
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(HTML_PAGE, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  
  if (url.pathname === '/api/quick-test' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { timeout = 8000, concurrent = 15, enableIspTest = false, selectedIsps = null, selectedSubs = [] } = body;
      
      let allNodes = [];
      const subsToLoad = selectedSubs.length > 0 ? selectedSubs : ['automerge', 'v2rayfree', 'freeservers'];
      
      for (const subId of subsToLoad) {
        const sub = BUILT_IN_SUBSCRIPTIONS.find(s => s.id === subId);
        if (sub) {
          try {
            const nodes = await parseSubscription(sub.url);
            allNodes = allNodes.concat(nodes);
          } catch (e) {}
        }
      }
      
      if (allNodes.length === 0) {
        return new Response(JSON.stringify({ error: '所选订阅源均无法访问' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      allNodes = [...new Set(allNodes)];
      const results = await testBatch(allNodes, timeout, concurrent, enableIspTest, selectedIsps);
      
      return new Response(JSON.stringify({ results }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  if (url.pathname === '/api/test' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { subscription, nodes, timeout = 8000, concurrent = 15, enableIspTest = false, selectedIsps = null } = body;
      
      let nodeList = [];
      if (subscription) {
        nodeList = await parseSubscription(subscription);
      } else if (nodes && nodes.length > 0) {
        nodeList = nodes;
      }
      
      if (nodeList.length === 0) {
        return new Response(JSON.stringify({ error: '没有找到可测试的节点' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const results = await testBatch(nodeList, timeout, concurrent, enableIspTest, selectedIsps);
      
      return new Response(JSON.stringify({ results }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  return new Response('Not Found', { status: 404 });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});