


require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Global state for staggered search
let currentIndustryIndex = 0;
let currentCountryCodeIndex = 0;
const COUNTRY_CODE_BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES_MS = 60 * 1000; // 1 minute delay between batches
const PROTOCOL_TIMEOUT_MS = 60000; // 1 minute for faster proxy failure detection

// Proxy support with rotation — Proxyscrape API + static list
const PROXY_API_KEY = process.env.PROXY_API_KEY || 'HVIsHemQvnWDqumZo9707iGXo0VpmypJaj4S51RiLUHMBtuYS1cpGcHQFSgTrshR';
const CAPTCHA_SERVICE = process.env.CAPTCHA_SERVICE || '2captcha';
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY || '';
const PROXY_API_URL = `https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=ip:port&format=text&timeout=10000&api_key=${PROXY_API_KEY}`;

// Static proxy list (from spys.one) — if one fails, moves to next
const STATIC_PROXY_LIST = [
  '107.155.87.251:3128', '222.167.236.151:8080', '222.167.236.73:8080', '45.26.30.144:8888',
  '12.50.107.219:80', '66.210.33.34:8080', '154.12.231.32:80', '85.239.235.128:3128',
  '198.111.166.184:80', '38.226.48.45:999', '64.188.29.191:8080', '132.145.164.194:2192',
  '67.20.129.199:8080', '38.127.179.219:41923', '143.198.135.176:80', '179.253.66.78:3128',
  '98.147.60.146:48678', '43.159.128.164:10000', '68.169.55.189:80', '70.61.188.34:3128',
  '68.225.17.237:4228', '216.125.18.67:3128', '75.102.134.109:8080', '172.86.126.201:3128',
  '38.180.137.149:999', '108.170.12.13:80', '98.153.152.141:7070', '96.3.60.222:80',
  '3.224.26.242:80', '199.66.182.232:4145', '104.168.134.178:3128', '47.88.14.212:3128',
  '5.161.55.103:3128', '40.113.234.46:8080', '64.130.54.246:3128', '72.205.0.67:4145',
  '98.170.57.231:4145', '198.98.51.187:3128', '201.79.106.25:3128', '173.205.202.33:8181',
  '35.245.216.241:443', '43.130.53.240:35643', '24.102.236.218:8888', '69.48.201.94:80',
  '167.148.33.176:3128', '204.8.189.118:1080', '52.173.28.127:8080', '132.145.207.194:8080',
  '98.154.21.253:4228', '116.204.166.178:8080', '69.75.140.157:8080', '162.255.110.24:8080',
  '12.50.107.221:80', '199.102.104.70:4145', '45.66.156.107:2080', '170.9.13.229:2020',
  '154.53.61.174:3128', '177.202.88.184:3128', '24.173.217.114:55443', '97.76.251.138:8080',
  '192.252.211.193:4145', '45.79.62.195:3128', '141.148.8.171:1080', '47.85.9.228:10800',
  '184.182.240.211:4145', '70.166.65.160:4145', '45.61.133.104:7777', '72.194.42.156:4145',
  '24.106.221.230:53281', '192.171.18.128:1080', '167.99.173.119:3128', '75.102.134.110:8080',
  '192.111.129.150:4145', '184.181.178.33:4145', '98.191.0.37:4145', '67.201.39.14:4145',
  '98.188.47.150:4145', '184.178.172.25:15291', '162.248.227.230:3128', '173.205.202.241:8181',
  '69.164.215.77:3128', '163.245.222.247:3128', '34.42.192.244:8888', '116.204.166.153:8080',
  '207.246.102.111:8888', '45.17.96.43:8888', '102.129.137.249:8080', '167.172.250.185:999',
  '129.146.7.166:80', '168.235.80.215:3128', '20.228.172.227:3128', '205.172.58.121:3128',
  '75.102.134.1:8080', '74.62.179.122:8080', '107.173.41.13:3128', '23.254.195.190:1080',
  '40.160.36.112:999', '24.72.215.236:8246', '154.26.232.100:10086', '159.89.138.136:3128',
  '185.147.157.135:3128', '116.204.166.202:8080', '15.204.129.229:8080', '209.145.53.118:8080',
  '205.172.56.239:3128', '70.63.90.245:8080', '38.43.93.161:8000', '104.243.157.1:8080',
  '13.59.11.63:3128', '12.49.24.22:8080', '206.135.80.74:999', '184.181.217.194:4145',
  '158.101.8.92:1080', '178.156.206.253:8118', '12.218.209.130:53281', '49.51.252.36:3128',
  '108.170.12.12:80', '20.98.45.49:3128', '82.29.72.145:30501', '177.3.34.2:3128',
  '201.58.182.153:3128', '104.36.236.101:8080', '107.172.234.212:3128', '23.185.192.66:8181',
  '146.190.60.147:8011', '108.170.12.11:80', '34.102.0.242:443', '67.201.35.145:4145',
  '204.9.208.153:8080', '216.49.115.7:8080', '184.170.251.30:11288', '34.125.117.216:443',
  '45.79.62.197:3128', '152.86.78.16:1080', '143.42.6.185:3128', '192.252.210.233:4145',
  '69.144.137.154:8080', '213.142.152.123:31280', '207.246.234.115:4669', '192.92.182.221:8080',
  '104.36.237.230:8080', '50.104.182.9:3128', '144.31.66.195:8888', '172.236.235.129:3128',
  '206.246.26.65:1080', '63.175.157.2:30005', '2.27.9.217:3128', '172.85.99.64:16062',
  '172.245.64.104:8888', '67.43.112.129:8080', '173.205.202.225:8181', '208.67.28.29:58090',
  '174.75.34.109:80', '108.161.135.118:80', '185.213.91.24:9100', '23.225.30.118:9999',
  '108.170.12.10:80', '116.204.166.148:8080', '143.42.121.126:3086', '104.251.93.95:16062',
  '24.153.226.234:8056', '38.156.141.96:999', '66.170.46.17:1080', '51.81.22.6:18080',
  '157.230.134.174:3128', '172.85.99.53:16062', '20.171.155.180:3128', '107.210.56.161:80',
  '31.76.42.91:3128', '167.71.115.154:3128', '216.9.225.61:1080', '72.195.101.99:4145',
  '50.222.120.243:1080', '192.6.154.179:3128', '154.29.145.165:1080', '95.81.92.173:3128',
  '35.238.48.39:8888', '172.233.182.154:51517', '38.172.125.42:1080', '107.173.125.200:443',
  '75.102.134.206:8080', '129.158.48.4:9050', '45.79.62.98:3128', '38.156.145.128:999',
  '64.130.54.245:3128', '167.99.3.26:6666', '52.15.61.255:3128', '172.86.72.37:3128',
  '104.218.199.16:16062', '18.222.225.236:3128', '154.17.8.103:1680', '74.214.254.17:8080',
  '24.249.199.4:4145', '5.78.181.0:9052', '72.194.42.131:4145', '12.50.107.220:80',
  '64.83.17.183:8888', '192.73.243.98:3128', '4.227.178.164:3128', '18.223.1.23:3128',
  '206.135.80.94:999', '104.218.199.115:16062', '40.90.200.185:3128', '45.61.129.165:9050',
  '199.66.183.226:4145', '47.251.249.48:7777', '24.121.176.155:1080', '104.218.199.17:16062',
  '104.218.199.245:16062', '47.251.166.203:1080', '15.204.245.180:8088', '12.50.107.222:80',
  '38.252.228.2:999', '129.146.163.237:8888', '129.80.80.197:9050', '72.207.109.5:4145',
  '104.218.199.8:16062', '12.50.107.217:80', '47.85.13.198:1080', '104.251.93.103:16062',
  '104.251.93.55:16062', '172.86.84.97:1085', '23.191.176.193:1080', '95.182.114.15:3128',
  '40.160.73.206:8099', '208.67.28.27:58090', '167.99.8.113:8011', '216.105.128.144:4145',
  '74.131.237.22:1080', '38.226.48.42:999', '16.5.163.105:10802', '184.170.169.216:8888',
  '71.78.199.161:1080', '204.9.208.73:8080', '216.105.130.131:4145', '67.204.153.223:1080',
  '103.11.76.177:10808', '137.131.46.178:7890', '38.226.48.43:999', '149.104.29.39:20000',
  '208.67.28.19:58090', '104.237.139.220:3128', '108.170.12.14:80', '216.105.143.146:4145',
  '198.252.108.20:9050', '172.235.147.5:3128', '67.201.58.190:4145', '206.135.80.78:999',
  '104.225.220.233:80', '142.249.112.84:8088', '104.161.23.122:5006', '206.135.80.194:999',
  '34.148.25.49:8080', '104.219.55.50:8118', '96.18.6.140:8080', '72.206.74.126:4145',
  '43.153.28.68:3128', '104.251.93.219:16062', '67.205.161.254:8118', '104.251.93.129:16062',
  '138.2.216.186:1080', '68.71.242.118:4145', '31.44.5.192:1081', '172.85.99.179:16062',
  '130.51.22.190:3080', '222.167.236.143:8080', '167.99.8.113:8017', '148.153.56.51:80',
  '104.129.203.244:8800', '104.129.203.244:9443', '66.175.235.158:8118', '66.231.128.103:1080',
  '104.129.203.85:9480', '8.221.106.175:7000', '208.64.37.70:8000', '116.204.166.132:8080',
  '208.95.22.65:8282', '172.212.125.72:3128', '204.13.233.74:3128', '172.85.99.37:16062',
  '184.170.104.86:8888', '199.38.169.219:8080', '184.170.104.86:80', '43.153.123.79:80',
  '72.207.33.64:4145', '64.227.0.146:3129', '35.212.160.97:3128', '164.92.105.30:1080',
  '104.218.199.249:16062', '204.9.208.237:8080', '116.204.166.205:8080', '167.99.3.26:6337',
  '34.153.18.123:443', '201.34.153.192:3128', '192.255.228.188:3128', '104.218.199.199:16062',
  '172.85.99.192:16062', '116.204.166.51:8080', '116.204.166.151:8080', '157.230.179.200:3128',
  '116.204.166.200:8080', '104.251.93.248:16062', '116.204.166.199:8080', '167.99.3.26:8242',
  '167.99.3.26:6250', '167.99.3.26:8083', '116.204.166.48:8080', '159.223.142.17:3128',
  '167.99.3.26:7621', '172.85.99.17:16062', '172.239.170.24:3128', '152.53.81.29:8888',
  '69.166.8.100:3128', '186.244.208.185:808', '203.31.199.68:8118', '144.31.40.34:3128',
  '116.204.166.49:8080', '172.85.99.63:16062', '152.70.156.142:3128', '3.12.102.40:3128',
  '116.204.166.40:8080', '207.180.29.28:3128', '104.218.199.74:16062', '172.85.99.150:16062',
  '209.255.132.243:8080', '205.164.46.6:3185', '168.220.92.179:8081', '18.117.194.82:3128',
  '47.254.31.207:1080', '79.127.223.28:8080', '31.76.84.141:1081', '104.251.93.159:16062',
  '148.153.73.246:8080', '79.127.223.56:8070', '23.247.128.4:9005', '50.242.55.85:1080',
  '34.162.194.108:443', '205.164.46.6:3125', '144.31.64.67:3128', '144.31.55.116:3128',
  '208.105.13.2:1080', '146.190.0.12:8080', '146.190.60.147:8018', '104.218.199.24:16062',
  '154.9.26.161:9050', '209.50.255.91:1080', '23.155.156.3:1080', '158.101.23.103:40002',
  '72.36.32.222:9050', '45.74.31.42:6600', '107.174.66.209:3128', '172.109.168.65:1080',
  '134.209.64.182:3128', '67.225.241.201:3128', '70.32.0.18:3128', '66.94.112.133:1088',
  '38.102.238.81:80', '34.162.141.126:443', '216.51.177.106:1080', '20.83.147.124:3128',
  '68.64.179.186:8080', '23.94.68.53:3128', '142.93.65.222:3129', '12.199.82.226:8080',
  '104.161.23.122:5060', '69.87.216.54:7989', '143.20.185.219:8118', '104.251.93.144:16062',
  '155.138.221.32:1082', '155.138.236.211:18080', '38.18.230.153:8888', '172.245.168.179:21241',
  '157.245.129.129:10000', '96.60.107.30:9050', '12.199.82.230:8080', '104.251.93.244:16062',
  '167.99.3.26:13629', '75.102.134.202:8080', '47.254.122.220:5443', '159.223.167.188:10000',
  '72.201.137.8:1080', '147.124.220.64:1080', '193.122.239.127:3128', '64.83.11.169:8880',
  '173.205.202.11:8181', '23.254.233.221:1080', '23.95.37.207:3128', '157.245.129.129:10000',
  '134.195.210.155:3128', '34.69.84.111:443', '143.20.185.219:9150', '113.20.7.76:30002',
  '104.251.93.22:16062', '149.248.194.233:8888', '170.39.31.113:8080', '158.101.99.182:1080',
  '172.85.99.128:16062', '149.248.213.249:9000', '23.95.60.62:8080', '23.254.196.69:8888',
  '129.153.105.194:9050', '208.92.216.54:1080', '149.104.4.88:10809', '37.46.18.192:1080',
  '31.59.139.118:9050', '154.26.232.100:3128', '192.163.200.82:17071', '181.214.152.92:8000',
  '47.85.37.60:1080', '104.218.199.26:16062', '104.161.23.122:5003', '20.121.179.183:3001',
  '157.254.223.42:1080', '159.223.167.188:10000', '181.214.152.92:3128', '12.199.82.229:8080',
  '20.121.179.183:3002', '75.46.35.87:80', '104.244.95.184:1088', '209.151.155.46:8080',
  '64.83.11.169:8888', '167.99.3.26:10919', '167.99.3.26:10810', '205.164.46.6:3124',
  '20.121.179.183:3005', '158.101.1.100:42171', '205.164.46.6:3137', '162.243.172.237:8118',
  '103.195.102.123:10813', '98.175.31.222:4145', '154.38.165.63:3128', '45.77.146.130:1080',
  '134.199.204.161:3128', '222.167.236.72:8080', '71.44.207.66:1080', '137.66.24.131:1080',
  '71.168.71.12:8890', '147.93.176.66:3128', '64.112.40.81:8888', '54.153.26.143:3128',
  '158.101.23.103:40001', '149.248.18.106:1081', '20.75.169.229:3000', '167.99.3.26:7395',
  '192.254.65.12:1080', '45.76.13.121:49995', '47.253.185.151:3128', '47.251.127.154:1080',
  '20.121.179.183:3000', '103.195.102.123:10808', '129.146.121.2:10808', '146.190.41.200:3128',
  '150.136.58.221:1080', '35.153.161.173:8080', '154.17.9.96:3096', '209.160.241.5:1080',
  '167.71.102.253:3128', '5.161.204.82:8888', '47.251.100.26:3128', '146.235.220.109:9050',
  '92.63.225.173:3128', '64.23.232.59:3128', '129.80.56.169:3128', '162.214.74.29:8085',
  '162.214.159.94:3128', '18.221.175.172:8000', '170.106.188.46:5432', '2.27.47.146:3128',
  '67.205.161.254:9050', '172.82.64.79:3128', '13.56.188.38:80', '13.56.188.38:8080',
  '72.241.55.239:8080', '18.224.158.143:8080', '104.233.202.124:22609', '207.57.123.131:9000',
  '98.88.36.190:8080', '157.151.196.142:1080', '98.84.217.196:8080', '98.10.49.48:1080',
  '198.44.179.236:3128', '104.218.199.152:16062', '88.210.37.30:3128', '116.204.166.44:8080',
  '217.216.67.197:3128', '152.70.156.142:1080', '222.167.236.247:8080', '3.14.230.162:8080',
  '116.204.166.204:8080', '208.95.20.33:8282', '13.56.147.239:3128', '3.19.55.34:3128',
  '104.218.199.159:16062'
];

// Additional proxies from spys.one
const ADDITIONAL_PROXY_LIST = [
  '202.40.180.145:38423', '31.57.178.195:8080', '125.209.110.83:39617', '2.237.63.228:80',
  '103.51.223.133:8080', '91.107.186.23:8081', '173.212.207.102:1214', '34.42.192.244:8888',
  '216.125.18.67:3128', '143.42.121.126:3086', '31.28.4.192:80', '172.236.235.129:8888',
  '124.108.19.6:9292', '190.103.16.70:999', '91.193.238.172:10808', '180.211.93.110:8080',
  '12.50.107.219:80', '176.191.124.3:80', '45.195.90.142:8080', '207.180.254.198:8080',
  '163.172.167.48:80', '109.199.119.160:80', '210.8.69.103:808', '138.0.143.120:8080',
  '197.221.234.149:80', '103.131.19.51:8080', '110.38.234.74:1256', '110.39.156.195:8080',
  '41.220.16.211:80', '154.12.231.32:80', '149.18.81.114:7890', '198.111.166.184:80',
  '202.169.229.139:53281', '64.188.29.191:8080', '96.1.101.113:80', '62.60.216.244:3128',
  '47.250.140.201:7000', '38.127.179.219:41923', '197.221.249.196:80', '185.118.51.163:3128',
  '202.21.101.37:8088', '210.61.216.63:60808', '143.198.135.176:80', '182.16.171.65:43188',
  '158.101.152.7:7890', '103.56.206.77:8099', '150.140.148.235:80', '103.141.244.139:8080',
  '200.116.198.222:9812', '171.253.93.127:2080', '185.85.111.18:80', '94.70.148.177:8080',
  '68.169.55.189:80', '77.242.177.57:3128', '38.43.158.7:8080', '117.20.31.166:8080',
  '45.67.213.4:3128', '104.105.4.195:10001', '104.111.32.26:10002', '213.171.212.110:8080',
  '185.222.30.155:31623', '178.128.223.15:3128', '197.221.235.122:80', '103.107.136.70:8081',
  '85.214.107.177:80', '103.7.248.24:8080', '197.221.240.178:80', '43.224.171.232:8080',
  '82.137.90.253:80', '116.104.52.124:2073', '124.6.143.5:8080', '197.221.249.197:80',
  '20.235.56.94:8080', '45.117.60.150:8080', '41.65.103.168:8080', '211.22.151.163:60808',
  '106.104.177.158:60808', '158.247.125.5:9443', '77.77.210.90:21056', '154.208.58.89:8080',
  '194.14.207.87:8001', '108.170.12.13:80', '103.84.56.101:8080', '72.56.73.23:80',
  '43.248.254.130:83', '185.247.141.86:3128', '194.186.246.22:8888', '164.52.11.194:18080',
  '45.198.8.110:8080', '193.233.90.71:40000', '42.112.14.230:2080', '91.213.99.134:3128',
  '197.221.237.248:80', '88.156.178.59:1122', '103.155.166.226:7850', '103.66.47.10:8080',
  '181.114.62.1:8085', '201.139.115.206:8082', '109.122.203.91:3128', '45.195.91.59:8080',
  '103.158.237.90:8080', '82.41.42.140:8181', '103.171.183.129:3125', '157.15.1.190:8080',
  '96.3.60.222:80', '130.33.157.174:3128', '190.103.16.93:999', '3.224.26.242:80',
  '47.254.213.60:1082', '139.255.94.122:39635', '195.72.143.238:8080', '165.99.102.66:1452',
  '5.22.217.168:3128', '5.181.178.46:8080', '154.65.39.8:80', '123.231.252.218:8080',
  '45.6.224.76:1256', '103.172.70.153:9191', '45.238.220.1:8181', '103.246.109.114:8080',
  '207.246.234.115:4669', '206.42.117.129:8080', '165.22.99.36:8015', '37.193.95.9:10808',
  '180.149.235.41:311', '43.167.240.38:8118', '78.142.61.76:3128', '83.118.60.147:8213',
  '188.165.76.198:4040', '57.128.44.204:3128', '43.164.129.36:3128', '63.175.157.2:30005',
  '172.85.99.64:16062', '201.139.115.38:8080', '185.202.165.1:53281', '8.220.189.51:8118',
  '203.76.220.126:16464', '27.131.14.9:8812', '172.245.64.104:8888', '110.93.218.62:8080',
  '119.159.251.98:8080', '183.110.216.159:8091', '174.75.34.109:80', '145.239.80.10:3128',
  '178.253.38.101:10808', '103.148.217.247:8080', '108.161.135.118:80', '129.150.39.242:8118',
  '41.33.172.171:8080', '91.217.33.161:8080', '108.170.12.10:80', '113.176.118.255:7654',
  '31.202.49.61:33761', '131.163.89.148:3128', '123.253.136.159:1256', '139.84.135.33:80',
  '110.39.173.100:8080', '122.129.80.123:8080', '197.255.125.12:80', '101.53.238.37:8080',
  '104.251.93.95:16062', '119.63.130.153:8080', '24.153.226.234:8056', '82.165.182.74:8080',
  '103.86.135.98:8080', '77.238.79.111:8080', '190.122.185.170:999', '183.110.216.159:8090',
  '45.168.244.16:8080', '51.81.22.6:18080', '110.38.233.122:8080', '113.171.152.72:8080',
  '45.194.41.70:8080', '185.109.244.69:8080', '42.115.112.128:8080', '80.87.193.111:12345',
  '159.65.195.221:3128', '202.142.167.194:8080', '172.85.99.53:16062', '157.101.165.36:80',
  '103.151.17.201:8080', '152.32.68.171:65535', '159.65.27.1:10000', '64.176.55.231:8886',
  '95.0.15.137:8080', '107.210.56.161:80', '31.76.42.91:3128', '167.71.115.154:3128',
  '31.57.178.211:8080', '47.80.26.236:8080', '178.217.99.33:3129', '96.9.229.25:8118',
  '43.129.170.202:8080', '192.6.154.179:3128', '45.174.149.222:999', '37.252.188.101:3128',
  '41.217.220.61:32650', '47.79.90.218:8080', '47.250.112.180:443', '35.238.48.39:8888',
  '172.233.182.154:51517', '152.42.192.59:3128', '209.38.24.108:3128', '38.76.166.241:8443',
  '107.173.125.200:443', '129.151.130.247:1111', '80.246.16.160:3128', '193.233.220.20:80',
  '103.80.87.30:3128', '154.127.70.1:1976', '58.27.200.225:8080', '217.142.139.207:8085',
  '148.253.212.68:8080', '77.163.47.213:3128', '45.194.41.155:8080'
];

// Merge additional proxies into static list
const STATIC_PROXY_LIST_MERGED = [...STATIC_PROXY_LIST, ...ADDITIONAL_PROXY_LIST];

// Proxy rotation state
let proxyList = [...STATIC_PROXY_LIST_MERGED];
let currentProxyIndex = 0;
let failedProxies = new Set();
let proxyFetchAttempted = false;

// Fetch fresh proxies from Proxyscrape API
async function fetchProxiesFromAPI() {
  if (proxyFetchAttempted) return;
  proxyFetchAttempted = true;
  try {
    console.log('[INFO] Fetching fresh proxies from Proxyscrape API...');
    const response = await fetch(PROXY_API_URL, { signal: AbortSignal.timeout(15000) });
    if (response.ok) {
      const text = await response.text();
      const lines = text.trim().split('\n').filter(line => line.match(/^\d+\.\d+\.\d+\.\d+:\d+$/));
      if (lines.length > 0) {
        const apiProxies = [...new Set(lines)];
        proxyList = [...new Set([...STATIC_PROXY_LIST_MERGED, ...apiProxies])];
        console.log(`[INFO] Loaded ${apiProxies.length} proxies from Proxyscrape API (total: ${proxyList.length})`);
      } else {
        console.log('[INFO] Proxyscrape API returned no proxies, using static list');
      }
    } else {
      console.log(`[INFO] Proxyscrape API returned ${response.status}, using static list`);
    }
  } catch (e) {
    console.log(`[INFO] Proxyscrape API fetch failed: ${e.message}, using static list`);
  }
}

// Get the next available proxy (skips failed ones)
function getNextProxy() {
  if (proxyList.length === 0) return null;
  let attempts = 0;
  while (attempts < proxyList.length) {
    const proxy = proxyList[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
    attempts++;
    if (!failedProxies.has(proxy)) {
      return proxy;
    }
  }
  if (proxyList.length > 0) {
    failedProxies.clear();
    currentProxyIndex = 0;
    return proxyList[0];
  }
  return null;
}

// Mark a proxy as failed
function markProxyFailed(proxy) {
  if (proxy) {
    failedProxies.add(proxy);
    console.log(`[INFO] Proxy marked failed: ${proxy} (${failedProxies.size}/${proxyList.length} failed)`);
  }
}

// Build puppeteer launch args with optional proxy
function getLaunchArgs(proxy = null) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--single-process',
    '--no-zygote',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--ignore-certificate-errors-spki-list',
    '--ignore-ssl-errors-ignore-untrusted',
    '--disable-blink-features=AutomationControlled',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-site-isolation-trials',
    '--disable-web-security',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-translate',
    '--hide-scrollbars',
    '--mute-audio',
    '--lang=en-US,en'
  ];
  if (proxy) {
    args.unshift(`--proxy-server=http://${proxy}`);
  }
  return args;
}

// 2Captcha solving integration
const TWOCAPTCHA_IN_URL = 'http://2captcha.com/in.php';
const TWOCAPTCHA_RES_URL = 'http://2captcha.com/res.php';

async function submitCaptchaTo2captcha(sitekey, pageUrl) {
  if (!CAPTCHA_API_KEY) return null;
  const formData = new URLSearchParams();
  formData.append('method', 'userrecaptcha');
  formData.append('googlekey', sitekey);
  formData.append('pageurl', pageUrl);
  formData.append('key', CAPTCHA_API_KEY);
  formData.append('json', '1');
  try {
    const resp = await fetch(TWOCAPTCHA_IN_URL, { method: 'POST', body: formData });
    const data = await resp.json();
    if (data.status === 1) return data.request;
    return null;
  } catch (e) {
    return null;
  }
}

async function getCaptchaResultFrom2captcha(captchaId, maxWaitMs = 120000) {
  if (!CAPTCHA_API_KEY || !captchaId) return null;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await wait(5000);
    try {
      const url = `${TWOCAPTCHA_RES_URL}?key=${CAPTCHA_API_KEY}&action=get&id=${captchaId}&json=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status === 1) return data.request;
      if (data.request === 'CAPCHA_NOT_READY' || data.request === 'ERROR_NO_SUCH_CAPCHA_ID') continue;
      return null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function solveRecaptcha(page) {
  if (!CAPTCHA_API_KEY) return false;
  const sitekey = await page.evaluate(() => {
    const el = document.querySelector('[data-sitekey]');
    return el ? el.getAttribute('data-sitekey') : null;
  });
  if (!sitekey) return false;
  const pageUrl = page.url();
  const captchaId = await submitCaptchaTo2captcha(sitekey, pageUrl);
  if (!captchaId) return false;
  const token = await getCaptchaResultFrom2captcha(captchaId);
  if (!token) return false;
  try {
    await page.evaluate((token) => {
      const textarea = document.querySelector('textarea#g-recaptcha-response');
      if (textarea) textarea.innerHTML = token;
      const cbEl = document.querySelector('[data-callback]');
      if (cbEl && cbEl.getAttribute('data-callback') && window[cbEl.getAttribute('data-callback')]) {
        window[cbEl.getAttribute('data-callback')](token);
      }
    }, token);
  } catch (e) {
    return false;
  }
  return true;
}

// User agent rotation to reduce bot detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}





// Function to load leads from leads.json
function loadLeads() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'leads.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading leads.json:', error);
    return [];
  }
}

// Function to save leads to leads.json
function saveLeads(leads) {
  try {
    fs.writeFileSync(path.join(__dirname, 'leads.json'), JSON.stringify(leads, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving leads.json:', error);
  }
}

// Helper function to format email local part as a name
function formatEmailLocalPartAsName(email) {
  if (!email || typeof email !== 'string') {
    return 'Our Team';
  }

  const localPart = email.split('@')[0];

  // If the local part contains numbers, it's unlikely to be a real name
  if (/\d/.test(localPart)) {
    return 'Our Team';
  }

  // List of generic local parts that should not be used as a sender name
  // Check if the local part is a generic name
  if (CONFIG.genericNames.includes(localPart.toLowerCase())) {
    return 'Our Team';
  }

  // Replace common separators with spaces and split into words
  const words = localPart.replace(/[._-]/g, ' ').split(' ');

  // Capitalize each word and join them
  const formattedName = words.map(word => {
    if (word.length === 0) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');

  // If after formatting, the name is empty or still looks generic (e.g., just initials),
  // or if it's a single letter, fall back to 'Our Team'
  if (!formattedName.trim() || formattedName.length <= 2) {
    return 'Our Team';
  }

  return formattedName;
}

/**
 * Selects the best sender name for a lead based on available information.
 * Prioritizes scraped person's name, then non-generic email local parts,
 * then company name, finally defaulting to 'Our Team'.
 * @param {object} lead - The lead object containing emails, companyName, and sender info.
 * @returns {string} The selected sender name.
 */
function selectBestSenderName(lead) {
  // 1. Prioritize scraped person's name if available
  if (lead && lead.sender && lead.sender.first_name && lead.sender.last_name) {
    const scrapedName = `${lead.sender.first_name} ${lead.sender.last_name}`.trim();
    // If a scraped name exists and is not empty, use it directly
    if (scrapedName.length > 0) {
      return scrapedName;
    }
  }

  // 2. Look for a non-generic name from email local parts
  let bestEmailName = '';
  if (lead && lead.emails && lead.emails.length > 0) {
    for (const email of lead.emails) {
      const derivedName = formatEmailLocalPartAsName(email);
      if (derivedName !== 'Our Team') {
        // Found a non-generic name, use it
        bestEmailName = derivedName;
        break; // Take the first good one
      }
    }
  }

  if (bestEmailName) {
    return bestEmailName;
  }

  // 3. Fallback to company name if available and not too generic
  if (lead && lead.companyName) {
    const companyName = lead.companyName.trim();
    // Check if company name is not just a generic term or too short
    if (companyName.length > 2 && !CONFIG.genericNames.includes(companyName.toLowerCase())) {
      return companyName;
    }
  }

  // 4. Default to 'Our Team'
  return 'Our Team';
}

// Function to get multiple random country codes from the CONFIG.countryCodes object
function getMultipleRandomCountryCodes(count = 1) {
  const countryCodes = Object.keys(CONFIG.countryCodes);
  if (countryCodes.length === 0) {
    return []; // No country codes available
  }

  const shuffled = countryCodes.sort(() => 0.5 - Math.random());
 return shuffled.slice(0, Math.min(count, countryCodes.length));
}

// ---------- CONFIG ----------
const CONFIG = {
manualCountryCodesForSearch: [
  'CN', 'GB', 'QA', 'DE', 'RU', 'VN', 'TR', 'IT', 'FR',
  'JP', 'US', 'CA', 'AE', 'ID', 'TH', 'KR', 'AU', 'SG',
  'HK', 'AT', 'BR',

  'ES', 'PT', 'NL', 'BE', 'CH', 'SE', 'NO', 'DK', 'FI',
  'PL', 'CZ', 'HU', 'RO', 'GR', 'IE', 'UA', 'SK', 'SI',
  'HR', 'RS', 'BG', 'LT', 'LV', 'EE', 'LU', 'IS', 'MT',
  'CY', 'AL', 'BA', 'MD',

  'SA', 'EG', 'ZA', 'NG', 'KE', 'MA', 'DZ', 'IL', 'TN',
  'GH', 'ET', 'UG', 'TZ', 'CM', 'SN', 'CI', 'ZW', 'ZM',
  'BW', 'NA', 'OM', 'KW', 'BH', 'JO', 'LB', 'IQ',

  'IN', 'PK', 'BD', 'MY', 'PH', 'TW', 'LK', 'NP',
  'KZ', 'UZ', 'MM', 'KH', 'LA', 'MN', 'AF',
  'AZ', 'GE', 'AM', 'KG', 'TJ',

  'MX', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'PY',
  'BO', 'EC', 'GT', 'CR', 'PA', 'DO', 'CU', 'JM',
  'HN', 'NI', 'SV', 'BS', 'TT',

  'NZ', 'FJ', 'PG', 'WS', 'VU', 'TO', 'SB', 'FM',
  'MH', 'NR', 'KI', 'TV', 'PW',

  'AD', 'LI', 'MC', 'SM', 'VA', 'ME', 'MK', 'BY',

  'YE', 'SY', 'IR', 'PS',

  'CD', 'CG', 'AO', 'MZ', 'MW', 'RW', 'BI', 'GA',
  'GQ', 'TD', 'NE', 'ML', 'BF', 'MR', 'GM', 'GN',
  'GW', 'SL', 'LR', 'TG', 'BJ', 'ER', 'DJ', 'SO',
  'SS', 'MG', 'MU', 'SC', 'KM', 'CV', 'ST', 'LS',

  'BT', 'BN', 'TL', 'MV',

  'GY', 'SR', 'BZ',

  'AG', 'BB', 'DM', 'GD', 'KN', 'LC', 'VC',

  'CK', 'NU',

  'GL', 'FO',

  'PR', 'VI', 'GU', 'MP', 'AS',

  'AW', 'CW', 'SX', 'BQ',

  'GI', 'JE', 'GG', 'IM',

  'PF', 'NC', 'RE', 'YT',

  'MO',

  'AI', 'BM', 'KY', 'MS', 'TC', 'VG',

  'FK', 'GF', 'GP', 'MQ', 'BL', 'MF', 'PM',

  'IO', 'CX', 'CC', 'NF', 'PN', 'TK', 'WF',

  'EH', 'SJ', 'GS', 'HM', 'TF', 'AQ', 'UM'
],
  genericNames: [
    'info', 'sales', 'support', 'admin', 'administrator', 'noreply', 'no-reply', 'Email Member',
    'contact', '', 'help', 'enquiries', 'enquiry', 'marketing', 'pr',
    'press', 'billing', 'accounts', 'finance', 'hr', 'jobs', 'careers', 'team',
    'hello', 'office', 'customerservice', 'feedback', 'abuse', 'security',
    'privacy', 'legal', 'postmaster', 'hostmaster', 'usenet', 'news', 'web',
    'dev', 'development', 'test', 'testing', 'noreply', 'noresponse', 'auto',
    'automated', 'system', 'daemon', 'mailer-daemon', 'undisclosed-recipients',
    'everyone', 'all', 'group', 'list', 'subscribe', 'unsubscribe', 'newsletter',
    'digest', 'forum', 'community', 'notifications', 'alert', 'alerts', 'report',
    'reports', 'status', 'update', 'updates', 'service', 'services', 'client',
    'clients', 'customer', 'customers', 'guest', 'guests', 'user', 'users',
    'member', 'members', 'partner', 'partners', 'affiliate', 'affiliates',
    'investor', 'investors', 'media', 'relations', 'public', 'relations',
    'management', 'executive', 'ceo', 'cfo', 'cto', 'coo', 'cmo', 'cio', 'cso',
    'president', 'director', 'manager', 'supervisor', 'coordinator', 'assistant',
    'reception', 'receptionist', 'frontdesk', 'booking', 'reservations', 'orders',
    'returns', 'shipping', 'delivery', 'dispatch', 'warehouse', 'inventory',
    'purchasing', 'procurement', 'vendor', 'vendors', 'supplier', 'suppliers',
    'donations', 'donate', 'fundraising', 'volunteer', 'volunteers', 'events',
    'event', 'webinar', 'webinars', 'seminar', 'seminars', 'training', 'education',
    'academy', 'institute', 'research', 'development', 'rnd', 'innovation',
    'solutions', 'consulting', 'consultant', 'advisory', 'advisor', 'expert',
    'experts', 'specialist', 'specialists', 'engineer', 'engineers', 'developer',
    'developers', 'programmer', 'programmers', 'designer', 'designers', 'artist',
    'artists', 'creative', 'editor', 'editors', 'writer', 'writers', 'author',
    'authors', 'publisher', 'publishers', 'moderator', 'moderators', 'adminteam',
    'supportteam', 'helpdesk', 'techsupport', 'webcontact', 'clientservices',
    'accountmanager', 'accounting', 'legal', 'privacy', 'terms', 'pressoffice',
    'mediarelations', 'team', 'it', 'tech', 'techteam', 'it-support',
    'it-helpdesk', 'it-admin', 'itadmin', 'itsupport', 'ithelpdesk', 'itmanager',
    'it-manager', 'webteam', 'web-team', 'webadmin', 'web-admin', 'webdeveloper',
    'web-developer', 'webdesigner', 'web-designer', 'team', '-team',
    'admin', '-admin', 'help', 'help',
    'info', 'info', 'contact', 'contact',
    'feedback', 'feedback', 'inquiry', 'inquiry',
    'support', 'support', 'general', 'general',
    'public', 'public', 'media', 'media',
    'press', 'press', 'marketing', 'marketing',
    'sales', 'sales', 'hr', 'hr',
    'jobs', 'jobs', 'careers', 'careers',
    'billing', 'billing', 'accounts', 'accounts',
    'finance', 'finance', 'legal', 'legal',
    'privacy', 'privacy', 'terms', 'terms',
    'security', 'security', 'abuse', 'abuse',
    'feedback', 'feedback', 'hello', 'hello',
    'office', 'office', 'customerservice', 'customerservice',
    'feedback', 'feedback', 'abuse', 'abuse',
    'security', 'security', 'privacy', 'privacy',
    'legal', 'legal', 'postmaster', 'postmaster',
    'hostmaster', 'hostmaster', 'usenet', 'usenet',
    'news', 'news', 'web', 'web',
    'dev', 'dev', 'development', 'development',
    'test', 'test', 'testing', 'testing',
    'noreply', 'noreply', 'noresponse', 'noresponse',
    'auto', 'auto', 'automated', 'automated',
    'system', 'system', 'daemon', 'daemon',
    'mailer-daemon', 'mailer-daemon', 'undisclosed-recipients',
    'undisclosed-recipients', 'everyone', 'everyone',
    'all', 'all', 'group', 'group',
    'list', 'list', 'subscribe', 'subscribe',
    'unsubscribe', 'unsubscribe', 'newsletter', 'newsletter',
    'digest', 'digest', 'forum', 'forum',
    'community', 'community', 'notifications', 'notifications',
    'alert', 'alert', 'alerts', 'alerts',
    'report', 'report', 'reports', 'reports',
    'status', 'status', 'update', 'update',
    'updates', 'updates', 'service', 'service',
    'services', 'services', 'client', 'client',
    'clients', 'clients', 'customer', 'customer',
    'customers', 'customers', 'guest', 'guest',
    'guests', 'guests', 'user', 'user',
    'users', 'users', 'member', 'member',
    'members', 'members', 'partner', 'partner',
    'partners', 'partners', 'affiliate', 'affiliate',
    'affiliates', 'affiliates', 'investor', 'investor',
    'investors', 'investors', 'media', 'media',
    'relations', 'relations', 'public', 'public',
    'management', 'management', 'executive', 'executive',
    'ceo', 'ceo', 'cfo', 'cfo',
    'cto', 'cto', 'coo', 'coo',
    'cmo', 'cmo', 'cio', 'cio',
    'cso', 'cso', 'president', 'president',
    'director', 'director', 'manager', 'manager',
    'supervisor', 'supervisor', 'coordinator', 'coordinator',
    'assistant', 'assistant', 'reception', 'reception',
    'receptionist', 'receptionist', 'frontdesk', 'frontdesk',
    'booking', 'booking', 'reservations', 'reservations',
    'orders', 'orders', 'returns', 'returns',
    'shipping', 'shipping', 'delivery', 'delivery',
    'dispatch', 'dispatch', 'warehouse', 'warehouse',
    'inventory', 'inventory', 'purchasing', 'purchasing',
    'procurement', 'procurement', 'vendor', 'vendor',
    'vendors', 'vendors', 'supplier', 'supplier',
    'suppliers', 'suppliers', 'donations', 'donations',
    'donate', 'donate', 'fundraising', 'fundraising',
    'volunteer', 'volunteer', 'volunteers', 'volunteers',
    'events', 'events', 'event', 'event',
    'webinar', 'webinar', 'webinars', 'webinars',
    'seminar', 'seminar', 'seminars', 'seminars',
    'training', 'training', 'education', 'education',
    'academy', 'academy', 'institute', 'institute',
    'research', 'research', 'development', 'development',
    'rnd', 'rnd', 'innovation', 'innovation',
    'solutions', 'solutions', 'consulting', 'consulting',
    'consultant', 'consultant', 'advisory', 'advisory',
    'advisor', 'advisor', 'expert', 'expert',
    'experts', 'experts', 'specialist', 'specialist',
    'specialists', 'specialists', 'engineer', 'engineer',
    'engineers', 'engineers', 'developer', 'developer',
    'developers', 'developers', 'programmer', 'programmer',
    'programmers', 'programmers', 'designer', 'designer',
    'designers', 'designers', 'artist', 'artist',
    'artists', 'artists', 'creative', 'creative',
    'editor', 'editor', 'editors', 'editors',
    'writer', 'writer', 'writers', 'writers',
    'author', '-author', 'authors', '-authors',
    'publisher', '-publisher', 'publishers', '-publishers',
    'moderator', '-moderator', 'moderators', '-moderators',
    'undisclosed', 'recipient', 'recipients', 'anonymous', 'placeholder', 'dummy', 'testaccount',
    'invalid', 'spam', 'junk', 'abuse', 'security', 'noreply', 'no-reply', 'postmaster',
    'hostmaster', 'mailer-daemon', 'daemon', 'autoresponder', 'automated', 'system', 'robot',
    'bot', 'admin', 'administrator', 'support', 'info', 'contact', 'enquiry', 'sales',
    'marketing', 'press', 'media', 'billing', 'accounts', 'finance', 'hr', 'jobs',
    'careers', '', 'helpdesk', 'it', 'tech', 'office', 'hello', 'feedback',
    'privacy', 'legal', 'compliance', 'operations', 'management', 'team', 'group',
    'publicrelations', 'investorrelations', 'customerservice', 'clientservices', 'guestservices',
    'useraccount', 'myaccount', 'youraccount', 'account', 'service', 'services', 'alert',
    'alerts', 'notification', 'notifications', 'update', 'updates', 'report', 'reports',
    'status', 'newsletter', 'subscribe', 'unsubscribe', 'forum', 'community', 'events',
    'webinar', 'seminar', 'training', 'education', 'research', 'development', 'innovation',
    'solutions', 'consulting', 'advisory', 'expert', 'specialist', 'engineer', 'developer',
    'programmer', 'designer', 'artist', 'creative', 'editor', 'writer', 'author',
    'publisher', 'moderator', 'supervisor', 'coordinator', 'assistant', 'reception',
    'frontdesk', 'booking', 'reservations', 'orders', 'returns', 'shipping', 'delivery',
    'dispatch', 'warehouse', 'inventory', 'purchasing', 'procurement', 'vendor', 'supplier',
    'donations', 'fundraising', 'volunteer', 'academy', 'institute', 'rnd', 'ceo', 'cfo',
    'cto', 'coo', 'cmo', 'cio', 'cso', 'president', 'director', 'manager', 'executive',
    'team', 'it-support', 'it-helpdesk', 'it-admin', 'webteam', 'web-admin',
    'webdeveloper', 'webdesigner', 'team', 'admin', 'help',
    'info', 'contact', 'feedback', 'inquiry',
    'support', 'general', 'public', 'media',
    'press', 'marketing', 'sales', 'hr',
    'jobs', 'careers', 'billing', 'accounts',
    'finance', 'legal', 'privacy', 'terms',
    'security', 'abuse', 'hello', 'office',
    'customerservice', 'postmaster', 'hostmaster',
    'usenet', 'news', 'web', 'dev',
    'development', 'test', 'testing', 'noreply',
    'noresponse', 'auto', 'automated', 'system',
    'daemon', 'mailer-daemon', 'undisclosed-recipients',
    'everyone', 'all', 'group', 'list',
    'subscribe', 'unsubscribe', 'newsletter',
    'digest', 'forum', 'community', 'notifications',
    'alert', 'alerts', 'report', 'reports',
    'status', 'update', 'updates', 'service',
    'services', 'client', 'clients', 'customer',
    'customers', 'guest', 'guests', 'user',
    'users', 'member', 'members', 'partner',
    'partners', 'affiliate', 'affiliates',
    'investor', 'investors', 'media', 'relations',
    'public', 'management', 'executive', 'ceo',
    'cfo', 'cto', 'coo', 'cmo',
    'cio', 'cso', 'president', 'director',
    'manager', 'supervisor', 'coordinator',
    'assistant', 'reception', 'receptionist',
    'frontdesk', 'booking', 'reservations',
    'orders', 'returns', 'shipping',
    'delivery', 'dispatch', 'warehouse',
    'inventory', 'purchasing', 'procurement',
    'vendor', 'vendors', 'supplier',
    'suppliers', 'donations', 'donate',
    'fundraising', 'volunteer', 'volunteers',
    'events', 'event', 'webinar',
    'webinars', 'seminar', 'seminars',
    'training', 'education', 'academy',
    'institute', 'research', 'development',
    'rnd', 'innovation', 'solutions',
    'consulting', 'consultant', 'advisory',
    'advisor', 'expert', 'experts',
    'specialist', 'specialists', 'engineer',
    'engineers', 'developer', 'developers',
    'programmer', 'programmers', 'designer',
    'designers', 'artist', 'artists',
    'creative', 'editor', 'editors',
    'writer', 'writers', 'author',
    'authors', 'publisher', 'publishers',
    'moderator', 'moderators'
  ],
  industries: [
    'Agriculture', 'Apparel', 'Banking', 'Biotechnology', 'Chemical', 'Communications', 'Construction',
    'Consulting', 'Education', 'Electronics', 'Energy', 'Engineering', 'Entertainment', 'Environmental',
    'Finance', 'Food & Beverage', 'Government', 'Healthcare', 'Hospitality', 'Insurance', 'Machinery',
    'Manufacturing', 'Media', 'Not For Profit', 'Other', 'Pharmaceuticals', 'Recreation', 'Retail',
    'Shipping', 'Technology', 'Telecommunications', 'Transportation', 'Utilities', 'Wholesale',
    'Automotive', 'Aerospace', 'Plastics', 'Metallurgy', 'Pulp and Paper', 'Furniture', 'Footwear',
    'Ceramics', 'Glass', 'Industrial Machinery', 'Electrical Equipment', 'Medical Devices', 'Renewable Energy',
    'Accounting', 'Airlines/Aviation', 'Alternative Dispute Resolution', 'Alternative Medicine', 'Animation',
    'Architecture & Planning', 'Arts and Crafts', 'Automotive', 'Aviation & Aerospace', 'Broadcast Media',
    'Building Materials', 'Business Supplies and Equipment', 'Capital Markets', 'Civic & Social Organization',
    'Civil Engineering', 'Commercial Real Estate', 'Computer & Network Security', 'Computer Games',
    'Computer Hardware', 'Computer Networking', 'Computer Software', 'Consumer Electronics', 'Consumer Goods',
    'Consumer Services', 'Cosmetics', 'Dairy', 'Defense & Space', 'Design', 'E-Learning', 'Electrical/Electronic Manufacturing',
    'Events Services', 'Executive Office', 'Facilities Services', 'Farming', 'Financial Services', 'Fine Art',
    'Fishery', 'Food Production', 'Fund-Raising', 'Gambling & Casinos', 'Government Administration',
    'Government Relations', 'Graphic Design', 'Health, Wellness and Fitness', 'Higher Education', 'Human Resources',
    'Import and Export', 'Individual & Family Services', 'Industrial Automation', 'Information Services',
    'Information Technology and Services', 'International Affairs', 'International Trade and Development',
    'Investment Banking', 'Investment Management', 'Judiciary', 'Law Enforcement', 'Law Practice', 'Legal Services',
    'Legislative Office', 'Leisure, Travel & Tourism', 'Libraries', 'Logistics and Supply Chain', 'Luxury Goods & Jewelry',
    'Management Consulting', 'Maritime', 'Market Research', 'Marketing and Advertising', 'Mechanical or Industrial Engineering',
    'Media Production', 'Medical Practice', 'Mental Health Care', 'Military', 'Mining & Metals', 'Motion Pictures and Film',
    'Museums and Institutions', 'Music', 'Nanotechnology', 'Newspapers', 'Non-Profit Organization Management',
    'Oil & Energy', 'Online Media', 'Outsourcing/Offshoring', 'Package/Freight Delivery', 'Packaging and Containers',
    'Paper & Forest Products', 'Performing Arts', 'Philanthropy', 'Photography', 'Plastics', 'Political Organization',
    'Primary/Secondary Education', 'Printing', 'Professional Training & Coaching', 'Program Development',
    'Public Policy', 'Public Relations and Communications', 'Public Safety', 'Publishing', 'Railroad Manufacture',
    'Ranching', 'Real Estate', 'Religious Institutions', 'Research', 'Restaurants', 'Security and Investigations',
    'Semiconductors', 'Shipbuilding', 'Sporting Goods', 'Sports', 'Staffing and Recruiting', 'Supermarkets',
    'Telecommunications', 'Textiles', 'Think Tanks', 'Tobacco', 'Translation and Localization', 'Venture Capital & Private Equity',
    'Veterinary', 'Warehousing', 'Wholesale', 'Wine and Spirits', 'Wireless', 'Writing and Editing',
    'Food Processing', 'Textile', 'Wood', 'Printing', 'Refined Petroleum', 'Rubber', 'Non-Metallic Mineral', 'Basic Metals', 'Fabricated Metal', 'Computer and Electronic',
    'Electrical', 'Transportation Equipment', 'Furniture Manufacturing', 'Toy', 'Sporting Goods Manufacturing',
    'Advertising', 'Aerospace', 'Automotive', 'Biotechnology', 'Chemicals',
    'Consumer Goods', 'Defense', 'E-commerce', 'Fashion', 'Financial Services',
    'Food Production', 'Forestry', 'Gambling', 'Gemstone', 'Health & Wellness',
    'Home Furnishings', 'Human Resources', 'Information Technology', 'Investment Banking',
    'Journalism', 'Leisure', 'Logistics', 'Machinery', 'Management Consulting',
    'Marketing', 'Medical Devices', 'Music', 'Nanotechnology', 'Oil & Gas',
    'Packaging', 'Paper', 'Plastics', 'Publishing', 'Renewable Energy',
    'Robotics', 'Security', 'Semiconductors', 'Shipping', 'Sports',
    'Textiles', 'Tourism', 'Venture Capital', 'Waste Management', 'Water Treatment',
    'Agriculture', 'Automotive', 'Banking', 'Biotechnology', 'Chemicals',
    'Construction', 'Consulting', 'Education', 'Energy', 'Engineering',
    'Entertainment', 'Environmental Services', 'Fashion', 'Food & Beverage',
    'Government', 'Healthcare', 'Hospitality', 'Insurance', 'Legal Services',
    'Manufacturing', 'Media', 'Non-profit', 'Pharmaceuticals', 'Real Estate',
    'Retail', 'Technology', 'Telecommunications', 'Transportation', 'Utilities',
    'Cybersecurity', 'Fintech', 'Biotechnology', 'Renewable Energy', 'Logistics',
    'E-commerce', 'Digital Marketing', 'Artificial Intelligence', 'Virtual Reality', 'Augmented Reality',
    'Aerospace & Defense', 'Automotive', 'Construction & Engineering', 'Education Management',
    'Environmental Services', 'Government Administration', 'Human Resources', 'Investment Banking',
    'Legal Services', 'Marketing & Advertising', 'Media & Entertainment', 'Non-profit Organization Management',
    'Oil & Gas', 'Pharmaceuticals', 'Real Estate', 'Sports & Recreation', 'Telecommunications',
    'Transportation & Logistics', 'Utilities', 'Wholesale Trade',
    'Agriculture & Farming', 'Arts & Culture', 'Banking & Finance', 'Biotechnology & Life Sciences',
    'Chemical Manufacturing', 'Civil Engineering', 'Consulting Services', 'Consumer Goods',
    'Data Analytics', 'E-learning', 'Fashion & Apparel', 'Food & Beverage Production',
    'Healthcare Services', 'Hospitality & Tourism', 'Information Technology', 'Insurance Services',
    'Manufacturing & Production', 'Mining & Metals', 'Non-profit & Philanthropy',
    'Public Relations', 'Publishing & Editing', 'Research & Development', 'Retail Trade',
    'Software Development', 'Supply Chain Management', 'Transportation Services',
    'Waste Management', 'Water Treatment'
  ],
  
  googleResultsPerSearch: 500,
  maxPagesToVisit: 500,
  maxEmailsPerDomain: 500, // Maximum number of unique emails to collect per domain
  maxPeopleToScrape: 60, // Maximum number of people (names, titles, emails) to scrape per website
  peoplePageConcurrency: 2, // Number of people pages to scrape concurrently (reduced for container environments)
  searchPagesPerEngine: 5, // Number of search result pages to fetch per engine per TLD


  emailDelay: { min: 30000, max: 60000 }, // 30 to 60 seconds
  emailLinks: [
    "https://apexholdingsquota.vercel.app/",
  ],
  defaultCountryCode: null, // Set to a country code like 'US', 'GB', etc., to filter searches by country. Set to null for global search.
  defaultDialingCode: null, // Set to a dialing code like '+1', '+44', etc., to filter searches by dialing code. Set to null for no dialing code filter.
  searchTlds: [
    '.com', '.org', '.net', '.io', '.co', '.ad', '.ae', '.af', '.ag', '.al',
    '.am', '.ao', '.ar', '.at', '.au', '.az', '.ba', '.bb', '.bd', '.be',
    '.bf', '.bg', '.bh', '.bi', '.bj', '.bn', '.bo', '.br', '.bs', '.bt',
    '.bw', '.by', '.bz', '.ca', '.cd', '.cf', '.cg', '.ch', '.ci', '.ck',
    '.cl', '.cm', '.cn', '.co', '.cr', '.cu', '.cv', '.cy', '.cz', '.de',
    '.dj', '.dk', '.dm', '.do', '.dz', '.ec', '.ee', '.eg', '.er', '.es',
    '.et', '.eu', '.fi', '.fj', '.fm', '.fr', '.ga', '.gb', '.gd', '.ge',
    '.gh', '.gm', '.gn', '.gq', '.gr', '.gt', '.gw', '.gy', '.hk', '.hn',
    '.hr', '.ht', '.hu', '.id', '.ie', '.il', '.in', '.iq', '.ir', '.is',
    '.it', '.jm', '.jo', '.jp', '.ke', '.kg', '.kh', '.ki', '.km', '.kn',
    '.kp', '.kr', '.kw', '.kz', '.la', '.lb', '.lc', '.li', '.lk', '.lr',
    '.ls', '.lt', '.lu', '.lv', '.ly', '.ma', '.mc', '.md', '.me', '.mg',
    '.mh', '.mk', '.ml', '.mm', '.mn', '.mo', '.mr', '.mt', '.mu', '.mv',
    '.mw', '.mx', '.my', '.mz', '.na', '.ne', '.ng', '.ni', '.nl', '.no',
    '.np', '.nr', '.nz', '.om', '.pa', '.pe', '.pg', '.ph', '.pk', '.pl',
    '.pt', '.pw', '.py', '.qa', '.ro', '.rs', '.ru', '.rw', '.sa', '.sb',
    '.sc', '.sd', '.se', '.sg', '.si', '.sk', '.sl', '.sm', '.sn', '.so',
    '.sr', '.st', '.sv', '.sy', '.sz', '.td', '.tg', '.th', '.tj', '.tl',
    '.tm', '.tn', '.to', '.tr', 'tt', '.tv', '.tz', '.ua', '.ug', '.us',
    '.uy', '.uz', '.va', '.vc', '.ve', '.vn', '.vu', '.ws', '.ye', '.za',
    '.zm', '.zw'
  ],
  countryCodes: {
    'US': 'United States', 'CA': 'Canada', 'GB': 'United Kingdom', 'AU': 'Australia', 'DE': 'Germany',
    'FR': 'France', 'JP': 'Japan', 'IN': 'India', 'BR': 'Brazil', 'CN': 'China',
    'ES': 'Spain', 'IT': 'Italy', 'NL': 'Netherlands', 'SE': 'Sweden', 'CH': 'Switzerland',
    'MX': 'Mexico', 'SG': 'Singapore', 'NZ': 'New Zealand', 'IE': 'Ireland', 'ZA': 'South Africa',
    'AE': 'United Arab Emirates', 'AR': 'Argentina', 'AT': 'Austria', 'BE': 'Belgium', 'CL': 'Chile',
    'CO': 'Colombia', 'DK': 'Denmark', 'FI': 'Finland', 'GR': 'Greece', 'HK': 'Hong Kong',
    'ID': 'Indonesia', 'IL': 'Israel', 'KR': 'South Korea', 'MY': 'Malaysia', 'NO': 'Norway',
    'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'RU': 'Russia', 'SA': 'Saudi Arabia',
    'TH': 'Thailand', 'TR': 'Turkey', 'TW': 'Taiwan', 'VN': 'Vietnam',
    'NG': 'Nigeria', 'GH': 'Ghana', 'KE': 'Kenya',
    'EG': 'Egypt', 'PK': 'Pakistan', 'BD': 'Bangladesh', 'PE': 'Peru', 'VE': 'Venezuela',
    'UA': 'Ukraine', 'CZ': 'Czech Republic', 'HU': 'Hungary', 'RO': 'Romania', 'BG': 'Bulgaria',
    'HR': 'Croatia', 'RS': 'Serbia', 'SK': 'Slovakia', 'SI': 'Slovenia', 'LT': 'Lithuania',
    'LV': 'Latvia', 'EE': 'Estonia', 'MA': 'Morocco', 'DZ': 'Algeria', 'TN': 'Tunisia',
    'ET': 'Ethiopia', 'TZ': 'Tanzania', 'UG': 'Uganda', 'KZ': 'Kazakhstan', 'UZ': 'Uzbekistan',
    'MN': 'Mongolia', 'LK': 'Sri Lanka', 'NP': 'Nepal', 'FJ': 'Fiji', 'PG': 'Papua New Guinea',
      'AF': 'Afghanistan', 'AL': 'Albania', 'AD': 'Andorra', 'AO': 'Angola',
  'AM': 'Armenia', 'AZ': 'Azerbaijan', 'BH': 'Bahrain', 'BY': 'Belarus',
  'BZ': 'Belize', 'BJ': 'Benin', 'BT': 'Bhutan', 'BA': 'Bosnia and Herzegovina',
  'BW': 'Botswana', 'BN': 'Brunei', 'BF': 'Burkina Faso', 'BI': 'Burundi',
  'KH': 'Cambodia', 'CM': 'Cameroon', 'CV': 'Cape Verde',
  'CF': 'Central African Republic', 'TD': 'Chad', 'KM': 'Comoros',
  'CG': 'Congo (Brazzaville)', 'CD': 'Congo (Kinshasa)', 'CR': 'Costa Rica',
  'CI': "Cote d'Ivoire", 'CU': 'Cuba', 'CY': 'Cyprus',
  'DJ': 'Djibouti', 'DM': 'Dominica', 'DO': 'Dominican Republic',
  'EC': 'Ecuador', 'SV': 'El Salvador', 'GQ': 'Equatorial Guinea',
  'ER': 'Eritrea', 'SZ': 'Eswatini', 'GA': 'Gabon',
  'GM': 'Gambia', 'GE': 'Georgia', 'GD': 'Grenada',
  'GT': 'Guatemala', 'GN': 'Guinea', 'GW': 'Guinea-Bissau',
  'GY': 'Guyana', 'HT': 'Haiti', 'HN': 'Honduras',
  'IS': 'Iceland', 'IQ': 'Iraq', 'IR': 'Iran',
  'JM': 'Jamaica', 'JO': 'Jordan', 'KG': 'Kyrgyzstan',
  'LA': 'Laos', 'LB': 'Lebanon', 'LS': 'Lesotho',
  'LR': 'Liberia', 'LY': 'Libya', 'LI': 'Liechtenstein',
  'LU': 'Luxembourg', 'MG': 'Madagascar', 'MW': 'Malawi',
  'MV': 'Maldives', 'ML': 'Mali', 'MT': 'Malta',
  'MH': 'Marshall Islands', 'MR': 'Mauritania', 'MU': 'Mauritius',
  'FM': 'Micronesia', 'MD': 'Moldova', 'MC': 'Monaco',
  'ME': 'Montenegro', 'MZ': 'Mozambique', 'MM': 'Myanmar',
  'NA': 'Namibia', 'NR': 'Nauru', 'NI': 'Nicaragua',
  'NE': 'Niger', 'MK': 'North Macedonia', 'OM': 'Oman',
  'PW': 'Palau', 'PA': 'Panama', 'PY': 'Paraguay',
  'QA': 'Qatar', 'RW': 'Rwanda', 'KN': 'Saint Kitts and Nevis',
  'LC': 'Saint Lucia', 'VC': 'Saint Vincent and the Grenadines',
  'WS': 'Samoa', 'SM': 'San Marino', 'ST': 'Sao Tome and Principe',
  'SN': 'Senegal', 'SC': 'Seychelles', 'SL': 'Sierra Leone',
  'SB': 'Solomon Islands', 'SO': 'Somalia', 'SS': 'South Sudan',
  'LK': 'Sri Lanka', 'SD': 'Sudan', 'SR': 'Suriname',
  'SY': 'Syria', 'TJ': 'Tajikistan', 'TL': 'Timor-Leste',
  'TG': 'Togo', 'TO': 'Tonga', 'TT': 'Trinidad and Tobago',
  'TM': 'Turkmenistan', 'TV': 'Tuvalu', 'UY': 'Uruguay',
  'VU': 'Vanuatu', 'VA': 'Vatican City', 'YE': 'Yemen',
  'ZM': 'Zambia', 'ZW': 'Zimbabwe'
  },
  countryTldMapping: {
    'US': ['.com', '.org', '.net', '.us', '.info', '.biz', '.name'],
    'CA': ['.ca', '.com', '.org', '.net'],
    'GB': ['.co.uk', '.org.uk', '.uk', '.com', '.info', '.biz', '.name'],
    'AU': ['.com.au', '.net.au', '.org.au', '.au'],
    'DE': ['.de', '.com', '.org', '.net', '.info', '.biz', '.name'],
    'FR': ['.fr', '.com', '.org', '.net'],
    'JP': ['.jp', '.co.jp', '.or.jp', '.ne.jp', '.com'],
    'IN': ['.in', '.co.in', '.org.in', '.net.in', '.com'],
    'BR': ['.br', '.com.br', '.org.br', '.net.br', '.com'],
    'CN': ['.cn', '.com.cn', '.org.cn', '.net.cn', '.com'],
    'ES': ['.es', '.com', '.org', '.net'],
    'IT': ['.it', '.com', '.org', '.net'],
    'NL': ['.nl', '.com', '.org', '.net'],
    'SE': ['.se', '.com', '.org', '.net'],
    'CH': ['.ch', '.com', '.org', '.net'],
    'MX': ['.mx', '.com.mx', '.org.mx', '.net.mx', '.com'],
    'SG': ['.sg', '.com.sg', '.org.sg', '.net.sg', '.com'],
    'NZ': ['.nz', '.co.nz', '.org.nz', '.net.nz', '.com'],
    'IE': ['.ie', '.com', '.org', '.net'],
    'ZA': ['.co.za', '.org.za', '.net.za', '.za', '.com'],
    'AE': ['.ae', '.com', '.org', '.net'],
    'AR': ['.ar', '.com.ar', '.org.ar', '.net.ar', '.com'],
    'AT': ['.at', '.com', '.org', '.net'],
    'BE': ['.be', '.com', '.org', '.net'],
    'CL': ['.cl', '.com.cl', '.org.cl', '.net.cl', '.com'],
    'CO': ['.co', '.com.co', '.org.co', '.net.co'],
    'DK': ['.dk', '.com', '.org', '.net'],
    'FI': ['.fi', '.com', '.org', '.net'],
    'GR': ['.gr', '.com.gr', '.org.gr', '.net.gr', '.com'],
    'HK': ['.hk', '.com.hk', '.org.hk', '.net.hk', '.com'],
    'ID': ['.id', '.co.id', '.or.id', '.net.id', '.com'],
    'IL': ['.il', '.co.il', '.org.il', '.net.il', '.com'],
    'KR': ['.kr', '.co.kr', '.or.kr', '.ne.kr', '.com'],
    'MY': ['.my', '.com.my', '.org.my', '.net.my', '.com'],
    'NO': ['.no', '.com', '.org', '.net'],
    'PH': ['.ph', '.com.ph', '.org.ph', '.net.ph', '.com'],
    'PL': ['.pl', '.com.pl', '.org.pl', '.net.pl', '.com'],
    'PT': ['.pt', '.com.pt', '.org.pt', '.net.pt', '.com'],
    'RU': ['.ru', '.com', '.org', '.net'],
    'SA': ['.sa', '.com.sa', '.org.sa', '.net.sa', '.com'],
    'TH': ['.th', '.co.th', '.or.th', '.net.th', '.com'],
    'TR': ['.tr', '.com.tr', '.org.tr', '.net.tr', '.com'],
    'TW': ['.tw', '.com.tw', '.org.tw', '.net.tw', '.com'],
    'VN': ['.vn', '.com.vn', '.org.vn', '.net.vn', '.com'],
    'NG': ['.ng', '.com.ng', '.org.ng', '.net.ng', '.com'],
    'GH': ['.gh', '.com.gh', '.org.gh', '.net.gh', '.com'],
    'KE': ['.ke', '.co.ke', '.or.ke', '.ne.ke', '.com'],
    'EG': ['.eg', '.com.eg', '.org.eg', '.net.eg', '.com'],
    'PK': ['.pk', '.com.pk', '.org.pk', '.net.pk', '.com'],
    'BD': ['.bd', '.com.bd', '.org.bd', '.net.bd', '.com'],
    'PE': ['.pe', '.com.pe', '.org.pe', '.net.pe', '.com'],
    'VE': ['.ve', '.com.ve', '.org.ve', '.net.ve', '.com'],
    'UA': ['.ua', '.com.ua', '.org.ua', '.net.ua', '.com'],
    'CZ': ['.cz', '.com.cz', '.org.cz', '.net.cz', '.com'],
    'HU': ['.hu', '.co.hu', '.org.hu', '.net.hu', '.com'],
    'RO': ['.ro', '.com.ro', '.org.ro', '.net.ro', '.com'],
    'BG': ['.bg', '.com.bg', '.org.bg', '.net.bg', '.com'],
    'HR': ['.hr', '.com.hr', '.org.hr', '.net.hr', '.com'],
    'RS': ['.rs', '.com.rs', '.org.rs', '.net.rs', '.com'],
    'SK': ['.sk', '.com.sk', '.org.sk', '.net.sk', '.com'],
    'SI': ['.si', '.com.si', '.org.si', '.net.si', '.com'],
    'LT': ['.lt', '.com.lt', '.org.lt', '.net.lt', '.com'],
    'LV': ['.lv', '.com.lv', '.org.lv', '.net.lv', '.com'],
    'EE': ['.ee', '.com.ee', '.org.ee', '.net.ee', '.com'],
    'MA': ['.ma', '.co.ma', '.org.ma', '.net.ma', '.com'],
    'DZ': ['.dz', '.com.dz', '.org.dz', '.net.dz', '.com'],
    'TN': ['.tn', '.com.tn', '.org.tn', '.net.tn', '.com'],
    'ET': ['.et', '.com.et', '.org.et', '.net.et', '.com'],
    'TZ': ['.tz', '.co.tz', '.or.tz', '.ne.tz', '.com'],
    'UG': ['.ug', '.co.ug', '.or.ug', '.ne.ug', '.com'],
    'KZ': ['.kz', '.com.kz', '.org.kz', '.net.kz', '.com'],
    'UZ': ['.uz', '.com.uz', '.org.uz', '.net.uz', '.com'],
    'MN': ['.mn', '.com.mn', '.org.mn', '.net.mn', '.com'],
    'LK': ['.lk', '.com.lk', '.org.lk', '.net.lk', '.com'],
    'NP': ['.np', '.com.np', '.org.np', '.net.np', '.com'],
    'FJ': ['.fj', '.com.fj', '.org.fj', '.net.fj', '.com'],
    'PG': ['.pg', '.com.pg', '.org.pg', '.net.pg', '.com'],
      'AF': ['.af', '.com', '.org', '.net'],
  'AL': ['.al', '.com', '.org', '.net'],
  'AD': ['.ad', '.com', '.org', '.net'],
  'AO': ['.ao', '.co.ao', '.org.ao', '.net.ao', '.com'],
  'AM': ['.am', '.com', '.org', '.net'],
  'AZ': ['.az', '.com', '.org', '.net'],
  'BH': ['.bh', '.com.bh', '.org.bh', '.net.bh', '.com'],
  'BY': ['.by', '.com', '.org', '.net'],
  'BZ': ['.bz', '.com.bz', '.org.bz', '.net.bz', '.com'],
  'BJ': ['.bj', '.com', '.org', '.net'],
  'BT': ['.bt', '.com.bt', '.org.bt', '.net.bt', '.com'],
  'BA': ['.ba', '.com.ba', '.org.ba', '.net.ba', '.com'],
  'BW': ['.bw', '.co.bw', '.org.bw', '.net.bw', '.com'],
  'BN': ['.bn', '.com.bn', '.org.bn', '.net.bn', '.com'],
  'BF': ['.bf', '.com', '.org', '.net'],
  'BI': ['.bi', '.co.bi', '.org.bi', '.net.bi', '.com'],
  'KH': ['.kh', '.com.kh', '.org.kh', '.net.kh', '.com'],
  'CM': ['.cm', '.co.cm', '.org.cm', '.net.cm', '.com'],
  'CV': ['.cv', '.com.cv', '.org.cv', '.net.cv', '.com'],
  'CF': ['.cf', '.com.cf', '.org.cf', '.net.cf', '.com'],
  'TD': ['.td', '.com', '.org', '.net'],
  'KM': ['.km', '.com.km', '.org.km', '.net.km', '.com'],
  'CG': ['.cg', '.com.cg', '.org.cg', '.net.cg', '.com'],
  'CD': ['.cd', '.com', '.org', '.net'],
  'CR': ['.cr', '.co.cr', '.or.cr', '.fi.cr', '.com'],
  'CI': ['.ci', '.com.ci', '.org.ci', '.net.ci', '.com'],
  'CU': ['.cu', '.com.cu', '.org.cu', '.net.cu', '.com'],
  'CY': ['.cy', '.com.cy', '.org.cy', '.net.cy', '.com'],
  'DJ': ['.dj', '.com.dj', '.org.dj', '.net.dj', '.com'],
  'DM': ['.dm', '.com.dm', '.org.dm', '.net.dm', '.com'],
  'DO': ['.do', '.com.do', '.org.do', '.net.do', '.com'],
  'EC': ['.ec', '.com.ec', '.org.ec', '.net.ec', '.com'],
  'SV': ['.sv', '.com.sv', '.org.sv', '.net.sv', '.com'],
  'GQ': ['.gq', '.com.gq', '.org.gq', '.net.gq', '.com'],
  'ER': ['.er', '.com.er', '.org.er', '.net.er', '.com'],
  'SZ': ['.sz', '.co.sz', '.org.sz', '.net.sz', '.com'],
  'GA': ['.ga', '.com.ga', '.org.ga', '.net.ga', '.com'],
  'GM': ['.gm', '.com.gm', '.org.gm', '.net.gm', '.com'],
  'GE': ['.ge', '.com.ge', '.org.ge', '.net.ge', '.com'],
  'GD': ['.gd', '.com.gd', '.org.gd', '.net.gd', '.com'],
  'GT': ['.gt', '.com.gt', '.org.gt', '.net.gt', '.com'],
  'GN': ['.gn', '.com.gn', '.org.gn', '.net.gn', '.com'],
  'GW': ['.gw', '.com.gw', '.org.gw', '.net.gw', '.com'],
  'GY': ['.gy', '.com.gy', '.org.gy', '.net.gy', '.com'],
  'HT': ['.ht', '.com.ht', '.org.ht', '.net.ht', '.com'],
  'HN': ['.hn', '.com.hn', '.org.hn', '.net.hn', '.com'],
  'IS': ['.is', '.com', '.org', '.net'],
  'IQ': ['.iq', '.com.iq', '.org.iq', '.net.iq', '.com'],
  'IR': ['.ir', '.co.ir', '.org.ir', '.net.ir', '.com'],
  'JM': ['.jm', '.com.jm', '.org.jm', '.net.jm', '.com'],
  'JO': ['.jo', '.com.jo', '.org.jo', '.net.jo', '.com'],
  'KG': ['.kg', '.com.kg', '.org.kg', '.net.kg', '.com'],
  'LA': ['.la', '.com.la', '.org.la', '.net.la', '.com'],
  'LB': ['.lb', '.com.lb', '.org.lb', '.net.lb', '.com'],
  'LS': ['.ls', '.co.ls', '.org.ls', '.net.ls', '.com'],
  'LR': ['.lr', '.com.lr', '.org.lr', '.net.lr', '.com'],
  'LY': ['.ly', '.com.ly', '.org.ly', '.net.ly', '.com'],
  'LI': ['.li', '.com', '.org', '.net'],
  'LU': ['.lu', '.com', '.org', '.net'],
  'MG': ['.mg', '.com.mg', '.org.mg', '.net.mg', '.com'],
  'MW': ['.mw', '.com.mw', '.org.mw', '.net.mw', '.com'],
  'MV': ['.mv', '.com.mv', '.org.mv', '.net.mv', '.com'],
  'ML': ['.ml', '.com.ml', '.org.ml', '.net.ml', '.com'],
  'MT': ['.mt', '.com', '.org', '.net'],
  'MH': ['.mh', '.com.mh', '.org.mh', '.net.mh', '.com'],
  'MR': ['.mr', '.com.mr', '.org.mr', '.net.mr', '.com'],
  'MU': ['.mu', '.co.mu', '.org.mu', '.net.mu', '.com'],
  'FM': ['.fm', '.com.fm', '.org.fm', '.net.fm', '.com'],
  'MD': ['.md', '.com.md', '.org.md', '.net.md', '.com'],
  'MC': ['.mc', '.com', '.org', '.net'],
  'ME': ['.me', '.co.me', '.org.me', '.net.me', '.com'],
  'MZ': ['.mz', '.co.mz', '.org.mz', '.net.mz', '.com'],
  'MM': ['.mm', '.com.mm', '.org.mm', '.net.mm', '.com'],
  'NA': ['.na', '.com.na', '.org.na', '.net.na', '.com'],
  'NR': ['.nr', '.com.nr', '.org.nr', '.net.nr', '.com'],
  'NI': ['.ni', '.com.ni', '.org.ni', '.net.ni', '.com'],
  'NE': ['.ne', '.com.ne', '.org.ne', '.net.ne', '.com'],
  'MK': ['.mk', '.com.mk', '.org.mk', '.net.mk', '.com'],
  'OM': ['.om', '.co.om', '.org.om', '.net.om', '.com'],
  'PW': ['.pw', '.com.pw', '.org.pw', '.net.pw', '.com'],
  'PA': ['.pa', '.com.pa', '.org.pa', '.net.pa', '.com'],
  'PY': ['.py', '.com.py', '.org.py', '.net.py', '.com'],
  'QA': ['.qa', '.com.qa', '.org.qa', '.net.qa', '.com'],
  'RW': ['.rw', '.co.rw', '.org.rw', '.net.rw', '.com'],
  'KN': ['.kn', '.com.kn', '.org.kn', '.net.kn', '.com'],
  'LC': ['.lc', '.com.lc', '.org.lc', '.net.lc', '.com'],
  'VC': ['.vc', '.com.vc', '.org.vc', '.net.vc', '.com'],
  'WS': ['.ws', '.com.ws', '.org.ws', '.net.ws', '.com'],
  'SM': ['.sm', '.com', '.org', '.net'],
  'ST': ['.st', '.com.st', '.org.st', '.net.st', '.com'],
  'SN': ['.sn', '.com.sn', '.org.sn', '.net.sn', '.com'],
  'SC': ['.sc', '.com.sc', '.org.sc', '.net.sc', '.com'],
  'SL': ['.sl', '.com.sl', '.org.sl', '.net.sl', '.com'],
  'SB': ['.sb', '.com.sb', '.org.sb', '.net.sb', '.com'],
  'SO': ['.so', '.com.so', '.org.so', '.net.so', '.com'],
  'SS': ['.ss', '.com', '.org', '.net'],
  'SD': ['.sd', '.com.sd', '.org.sd', '.net.sd', '.com'],
  'SR': ['.sr', '.com.sr', '.org.sr', '.net.sr', '.com'],
  'SY': ['.sy', '.com.sy', '.org.sy', '.net.sy', '.com'],
  'TJ': ['.tj', '.com.tj', '.org.tj', '.net.tj', '.com'],
  'TL': ['.tl', '.com.tl', '.org.tl', '.net.tl', '.com'],
  'TG': ['.tg', '.com.tg', '.org.tg', '.net.tg', '.com'],
  'TO': ['.to', '.com.to', '.org.to', '.net.to', '.com'],
  'TT': ['.tt', '.com.tt', '.org.tt', '.net.tt', '.com'],
  'TM': ['.tm', '.com.tm', '.org.tm', '.net.tm', '.com'],
  'TV': ['.tv', '.com.tv', '.org.tv', '.net.tv', '.com'],
  'UY': ['.uy', '.com.uy', '.org.uy', '.net.uy', '.com'],
  'VU': ['.vu', '.com.vu', '.org.vu', '.net.vu', '.com'],
  'VA': ['.va', '.com', '.org', '.net'],
  'YE': ['.ye', '.com.ye', '.org.ye', '.net.ye', '.com'],
  'ZM': ['.zm', '.co.zm', '.org.zm', '.net.zm', '.com'],
  'ZW': ['.zw', '.co.zw', '.org.zw', '.net.zw', '.com']
  },
  countryDialingCodeMapping: {
    'US': '+1',
    'CA': '+1',
    'GB': '+44',
    'AU': '+61',
    'DE': '+49',
    'FR': '+33',
    'JP': '+81',
    'IN': '+91',
    'BR': '+55',
    'CN': '+86',
    'ES': '+34',
    'IT': '+39',
    'NL': '+31',
    'SE': '+46',
    'CH': '+41',
    'MX': '+52',
    'SG': '+65',
    'NZ': '+64',
    'IE': '+353',
    'ZA': '+27',
    'AE': '+971',
    'AR': '+54',
    'AT': '+43',
    'BE': '+32',
    'CL': '+56',
    'CO': '+57',
    'DK': '+45',
    'FI': '+358',
    'GR': '+30',
    'HK': '+852',
    'ID': '+62',
    'IL': '+972',
    'KR': '+82',
    'MY': '+60',
    'NO': '+47',
    'PH': '+63',
    'PL': '+48',
    'PT': '+351',
    'RU': '+7',
    'SA': '+966',
    'TH': '+66',
    'TR': '+90',
    'TW': '+886',
    'VN': '+84',
    'NG': '+234',
    'GH': '+233',
    'KE': '+254',
    'EG': '+20', 'PK': '+92', 'BD': '+880', 'PE': '+51', 'VE': '+58',
    'UA': '+380', 'CZ': '+420', 'HU': '+36', 'RO': '+40', 'BG': '+359',
    'HR': '+385', 'RS': '+381', 'SK': '+421', 'SI': '+386', 'LT': '+370',
    'LV': '+371', 'EE': '+372', 'MA': '+212', 'DZ': '+213', 'TN': '+216',
    'ET': '+251', 'TZ': '+255', 'UG': '+256', 'KZ': '+7', 'UZ': '+998',
    'MN': '+976', 'LK': '+94', 'NP': '+977', 'FJ': '+679', 'PG': '+675',
      'AF': '+93', 'AL': '+355', 'AD': '+376', 'AO': '+244',
  'AM': '+374', 'AZ': '+994', 'BH': '+973', 'BY': '+375',
  'BZ': '+501', 'BJ': '+229', 'BT': '+975', 'BA': '+387',
  'BW': '+267', 'BN': '+673', 'BF': '+226', 'BI': '+257',
  'KH': '+855', 'CM': '+237', 'CV': '+238', 'CF': '+236',
  'TD': '+235', 'KM': '+269', 'CG': '+242', 'CD': '+243',
  'CR': '+506', 'CI': '+225', 'CU': '+53', 'CY': '+357',
  'DJ': '+253', 'DM': '+1', 'DO': '+1', 'EC': '+593',
  'SV': '+503', 'GQ': '+240', 'ER': '+291', 'SZ': '+268',
  'GA': '+241', 'GM': '+220', 'GE': '+995', 'GD': '+1',
  'GT': '+502', 'GN': '+224', 'GW': '+245', 'GY': '+592',
  'HT': '+509', 'HN': '+504', 'IS': '+354', 'IQ': '+964',
  'IR': '+98', 'JM': '+1', 'JO': '+962', 'KG': '+996',
  'LA': '+856', 'LB': '+961', 'LS': '+266', 'LR': '+231',
  'LY': '+218', 'LI': '+423', 'LU': '+352', 'MG': '+261',
  'MW': '+265', 'MV': '+960', 'ML': '+223', 'MT': '+356',
  'MH': '+692', 'MR': '+222', 'MU': '+230', 'FM': '+691',
  'MD': '+373', 'MC': '+377', 'ME': '+382', 'MZ': '+258',
  'MM': '+95', 'NA': '+264', 'NR': '+674', 'NI': '+505',
  'NE': '+227', 'MK': '+389', 'OM': '+968', 'PW': '+680',
  'PA': '+507', 'PY': '+595', 'QA': '+974', 'RW': '+250',
  'KN': '+1', 'LC': '+1', 'VC': '+1', 'WS': '+685',
  'SM': '+378', 'ST': '+239', 'SN': '+221', 'SC': '+248',
  'SL': '+232', 'SB': '+677', 'SO': '+252', 'SS': '+211',
  'SD': '+249', 'SR': '+597', 'SY': '+963', 'TJ': '+992',
  'TL': '+670', 'TG': '+228', 'TO': '+676', 'TT': '+1',
  'TM': '+993', 'TV': '+688', 'UY': '+598', 'VU': '+678',
  'VA': '+379', 'YE': '+967', 'ZM': '+260', 'ZW': '+263'
  },

  
irrelevantPhrases: [
'team member','general contact','find us','contact us','about us','our team','read more','view all','copyright','privacy policy','terms of service',
'member','email member','send email','get in touch','reach out','inquiry','support','help','admin','administrator','info','sales','hr','human resources',
'customer service','technical support','billing','accounts','finance','marketing','press','media','news','events','careers','jobs','recruiting',
'partnerships','business development','investors','board','leadership','executives','management','staff','personnel','directory','phone','fax',
'address','location','map','directions','office','headquarters','branch','department','division','group','committee','association','organization',
'noreply','no-reply','no reply','do not reply','donotreply','postmaster','','site admin','admin team','support team','helpdesk','tech support',
'feedback','suggestions','web contact','client services','account manager','accounting','legal','privacy','terms','press office','media relations',
'home','menu','navigation','footer','header','sidebar','main','content','page','site','website','online','web','portal','platform',
'login','register','signup','signin','logout','account','profile','dashboard','settings','preferences','user','guest','visitor',
'download','upload','file','document','image','video','audio','pdf','doc','xls','ppt','zip','rar','exe','app','software',
'search','filter','sort','order','buy','sell','purchase','cart','checkout','payment','shipping','delivery','tracking',
'subscribe','newsletter','blog','forum','community','social','share','like','comment','post','thread','topic','discussion',
'faq','help center','knowledge base','tutorial','guide','manual','documentation','api','developer','code','script','plugin',
'cookie','analytics','tracking','gdpr','compliance','security','encryption','ssl','https','domain','hosting','server',
'error','404','500','maintenance','coming soon','under construction','temporarily unavailable','redirect','link','url',
'button','form','input','John Doe','textarea','select','checkbox','radio','submit','reset','cancel','close','open','toggle','expand','collapse',
'icon','logo','banner','advertisement','ad','promo','offer','deal','discount','coupon','voucher','gift','free','trial',
'call to action','cta','landing page','homepage','index','default','welcome','hello','hi','greetings','thanks','thank you',
'contact form','message','subject','body','attachment','captcha','verification','confirm','validate','authenticate',
'system','automatic','bot','robot','crawler','spider','indexer','search engine','google','bing','yahoo','duckduckgo',
'meta','tag','keyword','description','title','heading','paragraph','list','table','row','column','cell','div','span','class','id',
'javascript','jquery','css','html','xml','json','endpoint','request','response','status','header','body',
'database','query','record','field','value','key','index','constraint','trigger','procedure',
'backup','restore','sync','update','upgrade','patch','version','release','changelog','roadmap','milestone','sprint',
'project','task','issue','bug','feature','enhancement','fix','deploy','staging','production','dev','test',
'integration','continuous','deployment','pipeline','workflow','automation','ci cd','git','github','gitlab','repository','repo',
'branch','commit','merge','pull request','push','clone','fork','source','codebase','library','framework',
'dependency','package','module','component','widget','plugin','extension','addon','theme','template','layout','design',
'color','font','style','responsive','mobile','desktop','tablet','screen','resolution','pixel','viewport',
'accessibility','aria','alt text','screen reader','keyboard navigation',
'performance','speed','optimization','cache','compression','lazy loading','cdn',
'cloud','aws','azure','gcp','firebase','digitalocean',
'docker','kubernetes','container','virtual machine','serverless','lambda','microservice','monolith',
'agile','scrum','kanban','waterfall','methodology','process','workflow',
'developer','tester','qa','analyst','architect','engineer','specialist','consultant',
'vendor','supplier','partner','client','customer','user','stakeholder','shareholder','investor',
'manager','director','vp','executive','officer','chairman','president','secretary','treasurer','advisor',
'recruiter','hiring manager','talent acquisition','people operations','employee experience',
'compensation','benefits','payroll','onboarding','offboarding','performance review','training',
'compliance','policy','procedure','handbook','ethics','diversity','inclusion','culture',
'remote work','hybrid','workspace','meeting room','conference','webinar','seminar','workshop',
'presentation','demo','pitch','proposal','contract','agreement','nda','sla','disclaimer',
'insurance','risk','assessment','audit','certification','regulation','law',
'intellectual property','patent','trademark','copyright','license',
'merger','acquisition','ipo','valuation','funding','investment','venture capital','angel investor',
'revenue','profit','loss','margin','roi','kpi','metric','analytics','reporting','dashboard',
'market research','survey','interview','focus group','testing',
'conversion','funnel','retention','churn','segmentation','persona','journey','experience',
'brand','identity','tagline','messaging','content','copywriting','seo','sem','ppc',
'influencer','ambassador','advocate','referral','affiliate','sponsorship','testimonial','review',
'rating','complaint','resolution','satisfaction','loyalty','engagement',
'reach','impression','click','goal','objective','strategy','tactic','campaign','initiative','program',
'timeline','deadline','deliverable','scope','budget','resource','allocation','roadmap',
'get listed','list your business','add business','add listing','submit business','claim listing','claim your business',
'remove listing','remove company','edit listing','featured listing','premium listing','top listings',
'browse categories','all categories','view category','popular searches','top companies','related companies',
'nearby businesses','similar companies','business listing','company listing','directory listing',
'read more','learn more','see more','view more','click here','tap here','load more','show more',
'back to top','next page','previous page','open menu','close menu','quick links','useful links',
'log in','sign in','sign up','create account','forgot password','reset password','join now','register now','my account',
'nigeria','lagos','abuja','port harcourt','ceo','cto','cfo','cmo','cio','cso','board member','advisory board','executive board','senior','junior','associate'
,'principal','fellow','intern','apprentice','alumni','faculty','our people','staff list','leadership team','management team','board of directors','executive committee',
'all rights reserved','terms of use','cookie policy','site map','back to top',
'next page','previous page','page of','powered by','developed by','designed by','phone number','email address','contact info','ibadan','ghana','kenya','africa',
'head office','main office','regional office','global office',
'latest articles','recent posts','blog post','news update','featured article','press release','trending topics',
'apply now','contact now','buy now','order now','get started','start now','request quote','get quote',
'subscribe now','download now','watch video','play video',
'follow us','share this','like us','join community','invite friends','leave a comment','post comment',
'all rights reserved','terms and conditions','privacy notice','cookie policy','legal notice','site map','Email Member','@1x.png'
],
  irrelevantKeywords: [
    'glassdoor', 'linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'wikipedia',
    'bloomberg', 'forbes', 'fortune', 'inc', 'reuters', 'techcrunch', 'wsj', 'nytimes', 'washingtonpost', 'theguardian', 'bbc', 'cnn', 'cnbc',
    'businessinsider', 'fastcompany', 'wired', 'marketwatch', 'money.cnn', 'seekingalpha', 'thestreet', 'yahoo', 'ycombinator',
    'crunchbase', 'owler', 'zoominfo', 'apollo.io', 'dnb.com', 'hoovers', 'manta', 'yellowpages', 'yelp', 'thomasnet',
    'alibaba', 'amazon', 'ebay', 'etsy', 'walmart', 'duckduckgo'
  ],
  
  dataFile: 'leads.json',
}

let leads = [];
if (fs.existsSync(CONFIG.dataFile)) {
  try {
    const data = fs.readFileSync(CONFIG.dataFile, 'utf8');
    if (data) { // Check if data is not empty
      leads = JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading or parsing leads.json:', error);
    // If there's an error, leads remains an empty array
  }
}

// ---------- EMAIL ACCOUNTS ----------
const emailAccounts = [];
let currentAccountIndex = 0;

// Load email accounts from .env
for (let i = 1; i <= 10; i++) { // Assuming a max of 10 accounts
  const smtpHost = process.env[`GMAIL_SMTP_HOST_${i}`];
  const smtpPort = process.env[`GMAIL_SMTP_PORT_${i}`];
  const smtpUser = process.env[`GMAIL_SMTP_USER_${i}`];
  const smtpPass = process.env[`GMAIL_SMTP_PASS_${i}`];
  const senderEmail = process.env[`GMAIL_SENDER_EMAIL_${i}`];

  if (smtpHost && smtpPort && smtpUser && smtpPass && senderEmail) {
    emailAccounts.push({
      smtpHost,
      smtpPort: parseInt(smtpPort),
      smtpUser,
      smtpPass,
      senderEmail,
      limitExceeded: false,
      emailsSentToday: 0, // New counter for emails sent today
      transporter: null // Will be created on first use
    });
  } else {
    break; // Stop if we can't find the next account
  }
}

if (emailAccounts.length === 0) {
  console.error("No Gmail SMTP accounts configured. Please set GMAIL_SMTP_HOST_1, GMAIL_SMTP_PORT_1, GMAIL_SMTP_USER_1, GMAIL_SMTP_PASS_1, and GMAIL_SENDER_EMAIL_1 in your .env file.");
  process.exit(1);
}

console.log(`[SUCCESS] Loaded ${emailAccounts.length} Gmail SMTP accounts.`);

let emailSendingPaused = false;
let limitCheckPaused = false; // New state for hourly checking
let emailQueueProcessorInterval; // To hold the interval ID
let pauseTimeout;
let probeInterval;
let lastNoLeadsLogTime = 0; // Tracks when "No unsent leads" was last logged
let consecutiveNoLeadsCount = 0; // Tracks consecutive times no leads are found
const MAX_CONSECUTIVE_NO_LEADS = 6; // Threshold for stopping email processor



// Helper to create transporter
function createTransporter(account) {
  console.log(`Attempting to create transporter for ${account.senderEmail} on host: ${account.smtpHost || 'smtp.gmail.com'}, port: ${account.smtpPort}, secure: ${account.smtpPort === 465}`);
  return nodemailer.createTransport({
    host: account.smtpHost || 'smtp.gmail.com', // Use account.smtpHost if provided, otherwise default to smtp.gmail.com
    port: account.smtpPort,
    secure: account.smtpPort === 465, // Use SSL if port is 465
    auth: {
      user: account.smtpUser,
      pass: account.smtpPass,
    },
  });
}


// ---------- EMAIL FUNCTION ----------
async function sendEmail(to, lead, leadSenderName) {
  if (emailSendingPaused) {
    console.log('Email sending is currently paused.');
    return false;
  }


  const account = emailAccounts[currentAccountIndex];
  
   // Create transporter if it doesn't exist for this account
  if (!account.transporter) {
    account.transporter = createTransporter(account);
  }

  const emailTemplate = fs.readFileSync(path.join(__dirname, 'email_template.html'), 'utf-8');
  const randomLink = CONFIG.emailLinks[Math.floor(Math.random() * CONFIG.emailLinks.length)];

  // Format recipient name from email (similar to formatEmailLocalPartAsName)
  const recipientLocalPart = to.split('@')[0];
  let recipientName = recipientLocalPart.replace(/[._-]/g, ' ').split(' ').map(word => {
    if (word.length === 0) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
  
  // Fallback if recipient name is empty or too short
  if (!recipientName.trim() || recipientName.length <= 2) {
    recipientName = 'Colleague';
  }

  let htmlContent = emailTemplate
    .replace('{random_link}', randomLink)
    // Removed logo replacement as per user request
    .replace('{email_user}', to.split('@')[0])
    .replace('{recipient_email}', to)
    .replace('{recipient_name}', recipientName)
    .replace('{timestamp}', new Date().toLocaleString());

  // Construct the 'from' address using the pre-determined leadSenderName
  let fromAddress;

  // Modify the account.senderEmail to add a +tag before the @
  const [localPart, domainPart] = account.senderEmail.split('@');
  let alias = '';
  if (lead && lead.companyName) {
    alias = lead.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '');    // Trim leading/trailing hyphens
  }

  // Fallback if alias is empty after sanitization
  if (!alias) {
    alias = 'general';
  }

  const modifiedAccountSenderEmail = `${localPart}+${alias}@${domainPart}`;

  // Use the leadSenderName directly
  fromAddress = `${leadSenderName} <${modifiedAccountSenderEmail}>`;
  // Replace all occurrences of {sender_name} in the template
  while (htmlContent.includes('{sender_name}')) {
    htmlContent = htmlContent.replace('{sender_name}', leadSenderName);
  }

  // Construct the email's subject and body for direct sending
  const subject = 'Hello from ' + leadSenderName + ' at ' + (lead && lead.companyName ? lead.companyName : 'our company');

  const mailOptions = {
    from: fromAddress,
    to: to,
    subject: subject,
    html: htmlContent,
    attachments: [
      {
        filename: 'Annual innovative summit.pdf',
        path: path.join(__dirname, 'Annual innovative summit.pdf'),
        contentType: 'application/pdf'
      }
    ],
    replyTo: (lead && lead.sender && lead.sender.email) ? lead.sender.email : undefined,
  };

  
  // console.log('Mail Options before sending:', mailOptions);
  // console.log('lead.sender.email:', (lead && lead.sender && lead.sender.email) ? lead.sender.email : 'Not available');

  try {
    await account.transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to} from ${fromAddress} using Gmail SMTP.`);
    account.emailsSentToday++; // Increment counter
    if (account.emailsSentToday >= 450) {
      console.log(`[INFO] Account ${account.senderEmail} has reached its 450 email limit for today. Switching to the next one.`);
      account.limitExceeded = true;
      currentAccountIndex = (currentAccountIndex + 1) % emailAccounts.length;
    }
    return true;
  } catch (error) {
    console.error(`Error sending email to ${to} from ${account.senderEmail} using Gmail SMTP:`, error);

    // Any error will cause a switch to the next account.
    console.log(`Error with account ${account.senderEmail}. Switching to the next one.`);
    emailAccounts[currentAccountIndex].limitExceeded = true;
    currentAccountIndex = (currentAccountIndex + 1) % emailAccounts.length;

    if (emailAccounts.every(acc => acc.limitExceeded)) {
      console.log('All email accounts have exceeded their limits. Pausing email sending and initiating hourly probe.');
      emailSendingPaused = true;
      limitCheckPaused = true;
      // Clear any existing probe interval to avoid duplicates
      if (probeInterval) clearInterval(probeInterval);
      // Set up hourly probe, only during working hours
      probeInterval = setInterval(() => {
        if (isAllowedTime()) {
          probeEmailQueue();
        } else {
          console.log('Hourly probe skipped: Outside of working hours.');
        }
      }, 60 * 60 * 1000); // Check every hour
    }
    return false;
  }
}

async function probeEmailQueue() {
  if (!isAllowedTime()) {
    console.log('Probe check skipped: Outside of working hours.');
    return;
  }
  if (!limitCheckPaused) {
    return;
  }

  console.log('Hourly check: Probing to see if Gmail SMTP sending limit is lifted...');
  const leads = loadLeads();
  const unsentLead = leads.find(lead => !lead.emailsSent && lead.emails.length > 0);

  if (!unsentLead) {
    console.log('Probe check: No more unsent emails found. Stopping hourly checks.');
    limitCheckPaused = false;
    emailSendingPaused = false;
    if (probeInterval) clearInterval(probeInterval);
    return;
  }

  // Use the first account for probing
  currentAccountIndex = 0;
  // Ensure transporter is created for the probing account
  if (!emailAccounts[currentAccountIndex].transporter) {
    emailAccounts[currentAccountIndex].transporter = createTransporter(emailAccounts[currentAccountIndex]);
  }

  // Try sending the first email of the first unsent lead
  const emailToSend = unsentLead.emails[0];
  console.log('[DEBUG] Attempting to send probe email via sendEmail function.');
  const success = await sendEmail(emailToSend, unsentLead);

  if (success) {
    console.log('Probe successful! Gmail SMTP limit has been lifted. Resuming normal email sending.');
    limitCheckPaused = false;
    emailSendingPaused = false;
    emailAccounts.forEach(acc => {
      acc.limitExceeded = false;
      acc.emailsSentToday = 0; // Reset daily counter
    });
    if (probeInterval) clearInterval(probeInterval);
    // Immediately trigger the main processor
    emailQueueProcessor();
  } else {
    // The sendEmail function will have already logged the specific error
    console.log('Probe failed. Gmail SMTP limit is still in effect. Will check again in 1 hour.');
  }
}


// Maintain a global set of sent emails to prevent duplicates across all leads
const sentEmailsGlobal = new Set();

async function emailQueueProcessor() {
  const now = new Date();
  const today = now.toDateString();
  if (!global.lastResetDay || global.lastResetDay !== today) {
    emailAccounts.forEach(acc => acc.emailsSentToday = 0);
    global.lastResetDay = today;
    emailSendingPaused = false; // Reset email sending pause
    limitCheckPaused = false; // Reset limit check pause
    console.log('Daily email send count and pause states reset for all accounts.');
  }

  // Hourly check at 8 AM to send email if paused
  if (now.getHours() === 8 && limitCheckPaused) {
    console.log('It\'s 8 AM and email sending is paused. Initiating hourly probe.');
    await probeEmailQueue();
    // After probing, if limits are lifted, emailQueueProcessor will be called again.
    // If limits are still in effect, it will remain paused.
    return; // Exit this run of emailQueueProcessor, it will be re-triggered if probe is successful
  }

  if (!isAllowedTime()) {
    console.log('Outside of working hours. Email queue processor will not run.');
    return;
  }
  if (emailSendingPaused || limitCheckPaused) {
    console.log('Email queue processor is currently paused.');
    return;
  }

  console.log('Running email queue processor...'); // Modified log
  const sentEmailsGlobal = loadSentEmails(); // Load previously sent emails
  const leads = loadLeads();

  const unsentLeads = leads.filter(lead => !lead.emailsSent);
    console.log(`Found ${unsentLeads.length} unsent leads after filtering.`); // Added log

  if (unsentLeads.length === 0) {
    consecutiveNoLeadsCount++;
    if (consecutiveNoLeadsCount > MAX_CONSECUTIVE_NO_LEADS) {
      console.log(`[INFO] No unsent leads found for ${MAX_CONSECUTIVE_NO_LEADS} consecutive checks. Stopping email queue processor.`);
      clearInterval(emailQueueProcessorInterval);
      emailQueueProcessorInterval = null; // Clear the interval ID
      emailSendingPaused = true; // Also pause sending to prevent accidental restarts
      return; // Exit the function
    }

    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // Define 1 hour in milliseconds

    // Only log "No unsent leads" if it hasn't been logged in the last hour
    if (now - lastNoLeadsLogTime > oneHour) {
      console.log('No unsent leads to process. Will check again periodically.');
      lastNoLeadsLogTime = now; // Update the last logged time
    }
  } else {
    consecutiveNoLeadsCount = 0; // Reset counter if leads are found
  }

  if (unsentLeads.length === 0) {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // Define 1 hour in milliseconds

    // Only log "No unsent leads" if it hasn't been logged in the last hour
    if (now - lastNoLeadsLogTime > oneHour) {
      console.log('No unsent leads to process. Will check again periodically.');
      lastNoLeadsLogTime = now; // Update the last logged time
    }
    return; // This return is correct; it just means this specific run has nothing to send.
  }

  console.log(`Found ${unsentLeads.length} leads with unsent emails.`); // Modified log

  for (const lead of unsentLeads) {
    // Determine the best sender name for this lead once
    const leadSenderName = selectBestSenderName(lead);

    if (!lead.emails || lead.emails.length === 0) {
      lead.emailsSent = true;
      console.log(`Lead ${lead.website} has no emails. Marking as sent.`); // Added log
      continue;
    }

    const emailsToSend = lead.emails.filter(email => !sentEmailsGlobal.has(email.toLowerCase()));

    if (emailsToSend.length === 0) {
      // All emails for this lead were already sent in previous runs
      lead.emailsSent = true;
      console.log(`All emails for lead ${lead.website} already sent or in global sent list. Marking as sent.`); // Added log
      continue;
    }

    const uniqueEmailsToSend = [...new Set(emailsToSend)];
    console.log(`Lead ${lead.website} has ${uniqueEmailsToSend.length} unique email(s) to send. Initial lead.emails length: ${lead.emails.length}`); // Modified log

    for (const email of uniqueEmailsToSend) {
      if (emailSendingPaused) {
        console.log('Email sending paused. Breaking from email loop.'); // Modified log
        break; // Break from sending emails for the CURRENT lead
      }

      const success = await sendEmail(email, lead, leadSenderName);
      if (success) {
        console.log(`Successfully sent email to ${email}.`); // Modified log
        sentEmailsGlobal.add(email.toLowerCase());
        saveSentEmails(sentEmailsGlobal); // Save updated sent emails

        // Remove the sent email from the lead's emails array
        const emailIndex = lead.emails.findIndex(e => e.toLowerCase() === email.toLowerCase());
        if (emailIndex > -1) {
          lead.emails.splice(emailIndex, 1);
          console.log(`Removed ${email} from lead.emails. Remaining emails: ${lead.emails.length}`); // Added log
        }

        // If there are no more emails for this lead, mark it as fully sent
        // if (lead.emails.length === 0) {
        //   lead.emailsSent = true;
        //   console.log(`Email sent for lead ${lead.website}. Marking lead as sent.`);
        // } else {
        //   console.log(`Email sent for lead ${lead.website}. Remaining emails: ${lead.emails.length}.`);
        // }
        // await wait(randomInt(CONFIG.emailDelay.min, CONFIG.emailDelay.max)); // REMOVED: Delay moved outside inner loop
        // break; // Removed break to allow sending all emails for the lead
      } else {
        // If sendEmail returns false, the account is likely limited.
        if (emailSendingPaused) {
          console.log('Email sending limit reached. Pausing queue processor.'); // Modified log
          break; // Break from the email loop
        }
        console.log(`Failed to send to ${email}, will retry in the next cycle.`); // Modified log
        // Don't break here, maybe it was a transient issue with one email.
        // The main pause logic will handle stopping.
      }
    }

    // After attempting to send all emails for the current lead, check if all were sent.
    if (lead.emails.length === 0) {
      lead.emailsSent = true;
      console.log(`All emails for lead ${lead.website} have been sent. Marking lead as sent. lead.emailsSent: ${lead.emailsSent}`); // Modified log
    } else {
      console.log(`Some emails for lead ${lead.website} were sent. Remaining emails: ${lead.emails.length}. lead.emailsSent: ${lead.emailsSent}`); // Modified log
    }

    // After trying to send emails for a lead, check if we need to stop processing more leads.
    if (emailSendingPaused) {
        console.log('Email sending is paused. Stopping lead processing for this cycle.'); // Modified log
        break; // Break from the main lead loop
    }

    // ADDED: Delay after processing all emails for a single lead
    await wait(randomInt(CONFIG.emailDelay.min, CONFIG.emailDelay.max));
  }

  console.log('Email queue processing cycle finished. Saving state...'); // Modified log
  const leadsToKeep = leads.filter(lead => !lead.emailsSent);

  if (leadsToKeep.length < leads.length) {
    console.log(`Deleted ${leads.length - leadsToKeep.length} leads that had all emails sent.`); // Modified log
  }
  // Save the remaining leads (those not marked as emailsSent = true)
  console.log(`Saving ${leadsToKeep.length} leads to leads.json.`);
  saveLeads(leadsToKeep);

  console.log('Email queue processing finished for this cycle.'); // Modified log
}


// ---------- UTILITY ----------
const randomInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const wait = ms => new Promise(r => setTimeout(r, ms));

// Remove stale Chrome SingletonLock files left by crashed runs so puppeteer can launch
function cleanupBrowserLocks(profileDir) {
  try {
    if (!fs.existsSync(profileDir)) return;
    const entries = fs.readdirSync(profileDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'SingletonLock' || entry.name.endsWith('Lock')) {
        try { fs.unlinkSync(path.join(profileDir, entry.name)); } catch (e) {}
      }
      if (entry.isDirectory()) {
        try {
          const sub = fs.readdirSync(path.join(profileDir, entry.name), { withFileTypes: true });
          for (const s of sub) {
            if (s.name === 'SingletonLock' || s.name.endsWith('Lock')) {
              try { fs.unlinkSync(path.join(profileDir, entry.name, s.name)); } catch (e) {}
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    // ignore cleanup errors
  }
}
function isAllowedTime() {
  return true;
}

function isValidDomain(domain) {
  const domainRegex = /^(?!-)[A-Za-z0-9-]+([\-\.]{1}[a-z0-9]+)*\.[A-Za-z]{2,6}$/;
  return domainRegex.test(domain);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Define a hierarchy for job titles to determine "least position"
const jobTitleHierarchy = {
  // Higher score means higher position
  'founder': 10, 'ceo': 10, 'chief executive officer': 10,
  'president': 9,
  'cfo': 8, 'chief financial officer': 8,
  'coo': 8, 'chief operating officer': 8,
  'cto': 8, 'chief technology officer': 8,
  'cmo': 8, 'chief marketing officer': 8,
  'vp': 7, 'vice president': 7,
  'director': 6,
  'head of': 5, 'manager': 5,
  'lead': 4, 'senior': 4,
  'specialist': 3, 'analyst': 3, 'associate': 3,
  'junior': 2,
  'intern': 1,
  'assistant': 1,
  'representative': 1,
  'executive': 1, // Often entry-level in some contexts
  'officer': 1, // Can be entry-level in some contexts
  'coordinator': 1,
  'administrator': 1,
  'support': 1,
  'clerk': 1,
  'staff': 1,
  'member': 1,
  'general contact': 0, // Lowest possible score for generic contacts
};

function getJobTitleScore(title) {
  if (!title) return 0;
  const lowerTitle = title.toLowerCase();
  for (const keyword in jobTitleHierarchy) {
    if (lowerTitle.includes(keyword)) {
      return jobTitleHierarchy[keyword];
    }
  }
  return 0; // Default to lowest score if no keyword matches
}

// ---------- UTILITY FUNCTIONS ----------
function loadLeads() {
  if (!fs.existsSync(CONFIG.dataFile)) {
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const data = fs.readFileSync(CONFIG.dataFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading or parsing leads.json:', error);
    // If the file is corrupted, back it up and start with a fresh one
    fs.renameSync(CONFIG.dataFile, `${CONFIG.dataFile}.bak`);
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify([], null, 2));
    return [];
  }
}

function saveLeads(leads) {
  fs.writeFileSync(CONFIG.dataFile, JSON.stringify(leads, null, 2));
}

const SENT_EMAILS_FILE = path.join(__dirname, 'sent_emails.json');

function loadSentEmails() {
  if (fs.existsSync(SENT_EMAILS_FILE)) {
    const data = fs.readFileSync(SENT_EMAILS_FILE, 'utf8');
    return new Set(JSON.parse(data));
  }
  return new Set();
}

function saveSentEmails(sentEmails) {
  fs.writeFileSync(SENT_EMAILS_FILE, JSON.stringify(Array.from(sentEmails), null, 2));
}

async function findPeoplePage(page, websiteUrl) {
  const peoplePageKeywords = ['team', 'about', 'contact', 'leadership', 'management', 'board', 'staff', 'people', 'our story'];
  const potentialUrls = await page.$$eval('a, button', (elements, keywords, baseUrl) => {
    const urls = new Set();
    elements.forEach(element => {
      const text = element.textContent ? element.textContent.toLowerCase() : '';
      const href = element.href || element.getAttribute('data-href'); // Get href for <a> or data-href for <button>

      if (href && href.startsWith(baseUrl)) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            urls.add(href);
            break;
          }
        }
      }
    });
    return Array.from(urls);
  }, peoplePageKeywords, websiteUrl);

  return potentialUrls;
}

async function findContactPage(page, websiteUrl) {
  const contactPageKeywords = ['contact', 'reach us', 'get in touch', 'support', 'enquiry', 'inquiry'];
  const potentialUrls = await page.$$eval('a, button', (elements, keywords, baseUrl) => {
    const urls = new Set();
    elements.forEach(element => {
      const text = element.textContent ? element.textContent.toLowerCase() : '';
      const href = element.href || element.getAttribute('data-href'); // Get href for <a> or data-href for <button>
      if (href && href.startsWith(baseUrl)) {
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            urls.add(href);
            break;
          }
        }
      }
    });
    return Array.from(urls);
  }, contactPageKeywords, websiteUrl);
  return potentialUrls;
}

// function saveSentLeads(sentLeads) {
//   const sentLeadsFile = path.join(__dirname, 'sent_leads.json');
//   console.log(`Moving ${sentLeads.length} completed lead(s) to ${sentLeadsFile}`);
//   let existingSentLeads = [];
//   if (fs.existsSync(sentLeadsFile)) {
//     existingSentLeads = JSON.parse(fs.readFileSync(sentLeadsFile));
//   }
//   const allSentLeads = existingSentLeads.concat(sentLeads);
//   fs.writeFileSync(sentLeadsFile, JSON.stringify(allSentLeads, null, 2));
// }

// ---------- SCRAPING ----------
async function getWebsitesByIndustry(industry, browser, countryCode = null, dialingCode = null) {
  const allLinks = new Set();
  let tldsToSearch;

  if (countryCode && CONFIG.countryTldMapping[countryCode]) {
    tldsToSearch = shuffleArray([...CONFIG.countryTldMapping[countryCode]]).slice(0, 50);
    console.log(`Searching TLDs for ${countryCode}: ${tldsToSearch.join(', ')}`);
  } else {
    tldsToSearch = shuffleArray([...CONFIG.searchTlds]).slice(0, 50);
    console.log(`Searching global TLDs: ${tldsToSearch.join(', ')}`);
  }

    for (const tld of tldsToSearch) {
    let tldSuccess = false;
    let allEngineLinks = [];

    // Search engines list (defined once per TLD, reused across proxy attempts)
    const getEnginePageUrl = (baseUrl, engineName, page) => {
      if (page === 0) return baseUrl;
      const sep = baseUrl.includes('?') ? '&' : '?';
      if (engineName === 'bing') {
        return baseUrl + sep + 'first=' + (page * 10 + 1);
      }
      if (engineName === 'ddg-html' || engineName === 'ddg-lite') {
        return baseUrl + sep + 's=' + (page * 30);
      }
      return baseUrl + sep + 'page=' + (page + 1);
    };

    const engines = [
          {
            name: 'ddg-html',
            url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: 'a.result__a',
            cleanup: (link) => {
              try {
                const url = new URL(link);
                if (url.hostname.includes('duckduckgo.com') && url.searchParams.has('uddg')) {
                  const uddgUrl = url.searchParams.get('uddg');
                  const parsed = new URL(uddgUrl);
                  if (['http:', 'https:'].includes(parsed.protocol) && parsed.hostname) {
                    return uddgUrl;
                  }
                }
                return link;
              } catch (e) {
                return null;
              }
            }
          },
          {
            name: 'ddg-lite',
            url: `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: 'a.result-link',
            cleanup: (link) => link
          },
          {
            name: 'bing',
            url: `https://www.bing.com/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: 'li.b_algo h2 a, .b_algo h2 a',
            cleanup: (link) => {
              try {
                const url = new URL(link);
                if (url.hostname.includes('bing.com') && url.searchParams.has('u')) {
                  const bingRedirect = url.searchParams.get('u');
                  let encoded = bingRedirect;
                  if (encoded.startsWith('a1')) {
                    encoded = encoded.substring(2);
                  }
                  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
                  const parsed = new URL(decoded);
                  if (['http:', 'https:'].includes(parsed.protocol) && parsed.hostname) {
                    return decoded;
                  }
                }
                return link;
              } catch (e) {
                return null;
              }
            }
          },
          {
            name: 'brave',
            url: `https://search.brave.com/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}&source=web`,
            selector: '.snippet-title a, .result-header a',
            cleanup: (link) => link
          },
          {
            name: 'mojeek',
            url: `https://www.mojeek.com/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.results-standard a, .result a',
            cleanup: (link) => link
          },
          {
            name: 'yandex',
            url: `https://yandex.com/search/?text=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.organic__url a, .serp-item__link a',
            cleanup: (link) => link
          },
          {
            name: 'aol',
            url: `https://search.aol.com/aol/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.algo h3 a, .algo .compTitle a',
            cleanup: (link) => link
          },
          {
            name: 'ask',
            url: `https://www.ask.com/web?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.PartialSearchResults-item .result-title a, .PartialSearchResults-item-title a',
            cleanup: (link) => link
          },
          {
            name: 'lycos',
            url: `https://search.lycos.com/web/?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result-title a, .title a',
            cleanup: (link) => link
          },
          {
            name: 'dogpile',
            url: `https://www.dogpile.com/serp?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result__a, .web-result__title-link',
            cleanup: (link) => link
          },
          {
            name: 'metacrawler',
            url: `https://www.metacrawler.com/web?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result__a, .title-link',
            cleanup: (link) => link
          },
          {
            name: 'startpage',
            url: `https://www.startpage.com/sp/search?query=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.w-gl__result-title a, .result-title a',
            cleanup: (link) => link
          },
          {
            name: 'swisscows',
            url: `https://swisscows.com/en/web?query=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result__title a, .result-title a',
            cleanup: (link) => link
          },
          {
            name: 'qwant',
            url: `https://www.qwant.com/?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}&t=web`,
            selector: '.web-result__title a, .result__title a',
            cleanup: (link) => link
          },
          {
            name: 'ecosia',
            url: `https://www.ecosia.org/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result__title a, .result-title a',
            cleanup: (link) => link
          },
          {
            name: 'yep',
            url: `https://yep.com/web?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result__title a, .result-title a',
            cleanup: (link) => link
          },
          {
            name: 'gibiru',
            url: `https://gibiru.com/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result-title a, .title a',
            cleanup: (link) => link
          },
          {
            name: 'searx',
            url: `https://searx.be/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}&categories=web`,
            selector: '.result__title a, .result-title a',
            cleanup: (link) => link
          },
          {
            name: 'searx2',
            url: `https://searx.tiekoetter.com/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}&categories=web`,
            selector: '.result__title a, .result-title a',
            cleanup: (link) => link
          },
          {
            name: 'marginalia',
            url: `https://search.marginalia.nu/search?query=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result a, .search-result a',
            cleanup: (link) => link
          },
          {
            name: 'kagi',
            url: `https://kagi.com/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result__title a, .result-title a',
            cleanup: (link) => link
          },
          {
            name: 'gigablast',
            url: `https://www.gigablast.com/search?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.b_title a, .title a',
            cleanup: (link) => link
          },
          {
            name: 'exalead',
            url: `https://www.exalead.com/search/web/results/?q=${encodeURIComponent(`"${industry}" site:${tld.substring(1)}`)}`,
            selector: '.result-title a, .title a',
            cleanup: (link) => link
          }
        ];

        // Try direct connection first, then rotate through proxies if all engines fail
        let proxyAttempts = 0;
        const maxProxyAttempts = proxyList.length;
        let currentProxyIndex = 0;
        let currentProxy = null; // Start with direct connection
        let lastProxy = null;

        while (!tldSuccess && proxyAttempts <= maxProxyAttempts) {
          // Relaunch browser when proxy changes (including proxy -> direct)
          if (currentProxy !== lastProxy) {
            try {
              await browser.close();
            } catch (e) {
              // ignore close errors
            }
            if (currentProxy) {
              console.log(`[INFO] Relaunching browser with proxy: ${currentProxy}`);
            } else {
              console.log(`[INFO] Relaunching browser with direct connection`);
            }
            cleanupBrowserLocks('./browser_profile');
            browser = await puppeteer.launch({
              headless: "new",
              ignoreHTTPSErrors: true,
              args: getLaunchArgs(currentProxy),
              userDataDir: './browser_profile',
              protocolTimeout: PROTOCOL_TIMEOUT_MS,
            });
            lastProxy = currentProxy;
          }

          try {

            let switchedProxy = false;

        for (const eng of engines) {
              let engineLinks = [];
              let switchProxy = false;
              for (let page = 0; page < CONFIG.searchPagesPerEngine; page++) {
                let engPage;
                try {
                  engPage = await browser.newPage();
                  await engPage.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                      get: () => false,
                    });
                    Object.defineProperty(navigator, 'plugins', {
                      get: () => [1, 2, 3, 4, 5]
                    });
                    Object.defineProperty(navigator, 'languages', {
                      get: () => ['en-US', 'en']
                    });
                  });

                  const randomUA = getRandomUserAgent();
                  await engPage.setUserAgent(randomUA);
                  await engPage.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Upgrade-Insecure-Requests': '1'
                  });
                  await engPage.setViewport({ width: 1366, height: 768 });

                  const pageUrl = getEnginePageUrl(eng.url, eng.name, page);
                  console.log(`[INFO] Searching ${eng.name} page ${page + 1} for ${industry} site:${tld.substring(1)} via ${currentProxy || 'direct'}`);
                  await engPage.goto(pageUrl, { waitUntil: 'networkidle2', timeout: PROTOCOL_TIMEOUT_MS });

                  // Try extracting links first — don't skip engines just because "captcha" appears on the page
                  const engLinks = await engPage.$$eval(eng.selector, anchors =>
                    anchors.map(a => a.href).filter(h => h && h.startsWith('http'))
                  );
                  const cleaned = engLinks.map(eng.cleanup).filter(l => l !== null);

                  if (cleaned.length > 0) {
                    console.log(`[INFO] ${eng.name} page ${page + 1} returned ${cleaned.length} results for ${industry} site:${tld.substring(1)}`);
                    engineLinks.push(...cleaned);
                  } else {
                    // No links found — now check if the page is actually blocked/captcha
                    let pageContent = await engPage.content();
                    let isBlocked = /No results found|captcha|unusual traffic|verify you are|robot|automated|access denied|blocked|unusual activity/i.test(pageContent);

                    if (isBlocked && CAPTCHA_API_KEY) {
                      console.log(`[INFO] ${eng.name} page ${page + 1} captcha detected, attempting to solve...`);
                      const solved = await solveRecaptcha(engPage);
                      if (solved) {
                        await wait(randomInt(3000, 6000));
                        const engLinks2 = await engPage.$$eval(eng.selector, anchors =>
                          anchors.map(a => a.href).filter(h => h && h.startsWith('http'))
                        );
                        const cleaned2 = engLinks2.map(eng.cleanup).filter(l => l !== null);
                        if (cleaned2.length > 0) {
                          console.log(`[INFO] ${eng.name} page ${page + 1} returned ${cleaned2.length} results after captcha solve for ${industry} site:${tld.substring(1)}`);
                          engineLinks.push(...cleaned2);
                          try { if (!engPage.isClosed()) await engPage.close(); } catch (e) {}
                          break; // Success after captcha, move to next page
                        }
                        pageContent = await engPage.content();
                        isBlocked = /No results found|captcha|unusual traffic|verify you are|robot|automated|access denied|blocked|unusual activity/i.test(pageContent);
                      }
                    }

                    if (isBlocked || cleaned.length === 0) {
                      try { if (!engPage.isClosed()) await engPage.close(); } catch (e) {}
                      continue; // Try next page
                    }
                  }
                  try { if (!engPage.isClosed()) await engPage.close(); } catch (e) {}
                } catch (err) {
                  console.log(`[INFO] ${eng.name} page ${page + 1} failed for ${industry} site:${tld.substring(1)}: ${err.message}`);
                  try { if (engPage && !engPage.isClosed()) await engPage.close(); } catch (e) {}
                  if (currentProxy && err.message && (err.message.includes('ERR_CONNECTION') || err.message.toLowerCase().includes('timed_out') || err.message.toLowerCase().includes('connection_reset') || err.message.toLowerCase().includes('empty_response') || err.message.includes('Protocol error') || err.message.includes('Session closed'))) {
                    failedProxies.add(currentProxy);
                    // Switch proxy immediately on connection failure
                    proxyAttempts++;
                    currentProxyIndex++;
                    if (currentProxyIndex < proxyList.length) {
                      currentProxy = proxyList[currentProxyIndex];
                      // Skip already-failed proxies
                      while (failedProxies.has(currentProxy) && currentProxyIndex < proxyList.length - 1) {
                        currentProxyIndex++;
                        currentProxy = proxyList[currentProxyIndex];
                      }
                      console.log(`[INFO] Connection failure on ${eng.name}, switching to proxy: ${currentProxy}`);
                      switchProxy = true;
                      break; // Break page loop, restart with new proxy
                    } else {
                      // All proxies exhausted - try direct connection
                      console.log(`[INFO] All proxies exhausted for ${industry} site:${tld.substring(1)}, trying direct connection...`);
                      currentProxy = null;
                      switchProxy = true;
                      break;
                    }
                  }
                }
                if (switchProxy) break;
                await wait(randomInt(2000, 5000));
              }
              if (switchProxy) {
                switchedProxy = true;
                break; // Break engine loop, restart with new proxy
              }
              if (engineLinks.length > 0) {
                allEngineLinks.push(...engineLinks);
              }
              // Delay between engines to reduce rate limiting and captcha triggering
              await wait(randomInt(3000, 8000));
            }

            if (switchedProxy) {
              continue; // Restart while loop with new proxy
            }

            if (allEngineLinks.length > 0) {
              console.log(`[INFO] Total ${allEngineLinks.length} results from all engines for ${industry} site:${tld.substring(1)}`);
              tldSuccess = true;
              break; // Exit proxy retry loop - success
            }

            // All engines returned 0 or were blocked
            if (currentProxy) {
              // Mark this proxy as failed
              failedProxies.add(currentProxy);
              proxyAttempts++;
              // Move to next proxy, skipping already-failed ones
              currentProxyIndex++;
              while (currentProxyIndex < proxyList.length && failedProxies.has(proxyList[currentProxyIndex])) {
                currentProxyIndex++;
              }
              if (currentProxyIndex < proxyList.length) {
                currentProxy = proxyList[currentProxyIndex];
                console.log(`[INFO] All engines failed with proxy, switching to next proxy: ${currentProxy}`);
                continue;
              } else {
                // All proxies exhausted - try direct connection as final fallback
                console.log(`[INFO] All proxies exhausted for ${industry} site:${tld.substring(1)}, trying direct connection...`);
                currentProxy = null;
                continue;
              }
            } else {
              // Direct connection failed - try proxies
              currentProxyIndex = 0;
              while (currentProxyIndex < proxyList.length && failedProxies.has(proxyList[currentProxyIndex])) {
                currentProxyIndex++;
              }
              if (currentProxyIndex < proxyList.length) {
                currentProxy = proxyList[currentProxyIndex];
                console.log(`[INFO] Direct connection failed for ${industry} site:${tld.substring(1)}, trying proxy: ${currentProxy}`);
                continue;
              } else {
                console.log(`[INFO] Direct connection failed and all proxies unavailable for ${industry} site:${tld.substring(1)}, skipping TLD`);
                break;
              }
            }

          } catch (error) {
            const msg = error.message || String(error);
            console.error(`Attempt ${proxyAttempts + 1}/${maxProxyAttempts + 1} failed for TLD ${tld}: ${msg}`);
            if (currentProxy) {
              failedProxies.add(currentProxy);
            }
            proxyAttempts++;
            currentProxyIndex++;
            while (currentProxyIndex < proxyList.length && failedProxies.has(proxyList[currentProxyIndex])) {
              currentProxyIndex++;
            }
            if (currentProxyIndex < proxyList.length) {
              currentProxy = proxyList[currentProxyIndex];
            } else {
              currentProxy = null;
            }
            if (!currentProxy) {
              console.error(`Giving up on TLD ${tld} after exhausting all proxies and direct connection.`);
              break;
            }
          }
        }

        // If tldSuccess, process the collected links
        if (tldSuccess) {
        // Filter out excluded domains and useless sites from engine results
        const filteredLinks = allEngineLinks.filter(link => {
          try {
            const url = new URL(link);
            const host = url.hostname.toLowerCase();
            const linkLower = link.toLowerCase();
            const path = url.pathname.toLowerCase();

            // Exclude search engine domains themselves
            if (excludedDomainsLower.some(d => host.includes(d) || host === d)) {
              return false;
            }

            // Exclude subdomains of search engines and useless sites
            if (excludedDomainsLower.some(d => host.endsWith('.' + d.replace('.', '\\.')))) {
              return false;
            }

            // Exclude Bing redirect/click tracking links
            if (linkLower.includes('/ck/a?') || linkLower.includes('bing.com/ck/a')) {
              return false;
            }

            // Exclude google translate and similar redirect services
            if (linkLower.includes('translate.google.com/translate') ||
                linkLower.includes('google.com/url') ||
                linkLower.includes('webcache.googleusercontent.com')) {
              return false;
            }

            // Exclude rubbish path patterns (directories, aggregators, listings, etc.)
            if (RUBBISH_PATH_PATTERNS.some(pat => path.includes(pat))) {
              return false;
            }

            // Exclude URLs with query parameters that look like search/tracking
            const searchParams = url.search.toLowerCase();
            if (searchParams.includes('utm_source') || searchParams.includes('utm_medium') ||
                searchParams.includes('utm_campaign') || searchParams.includes('fbclid') ||
                searchParams.includes('gclid') || searchParams.includes('ref=') ||
                searchParams.includes('source=') || searchParams.includes('medium=')) {
              return false;
            }

            // Exclude very short paths that are likely search results pages
            if (path === '/' || path === '/index' || path === '/index.html' || path === '/home') {
              return false;
            }

            const hasIrrelevantKeyword = CONFIG.irrelevantKeywords.some(keyword => linkLower.includes(keyword));
            return !hasIrrelevantKeyword;
          } catch (error) {
            return false;
          }
        });

        filteredLinks.forEach(link => allLinks.add(link));
      }

      // Delay between TLD searches to avoid rate limiting
      await wait(randomInt(2000, 5000));
    }

    return [...allLinks];
  }

// Search engines and useless sites to exclude from results
const EXCLUDED_DOMAINS = [
  'bing.com', 'duckduckgo.com', 'google.com', 'google.', 'translate.google',
  'wikipedia.org', 'wikimedia.org', 'facebook.com', 'twitter.com', 'x.com',
  'instagram.com', 'linkedin.com', 'youtube.com', 'yelp.com', 'yellowpages.com',
  'yellow-page.com', 'manta.com', 'dnb.com', 'hoovers.com', 'crunchbase.com',
  'zoominfo.com', 'apollo.io', 'glassdoor.com', 'yelp.com', 'foursquare.com',
  'trustpilot.com', 'sitejabber.com', 'bbb.org', 'amber', 'alibaba.com',
  'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'craigslist.org',
  'github.com', 'gitlab.com', 'sourceforge.net', 'medium.com', 'quora.com',
  'reddit.com', 'pinterest.com', 'tiktok.com', 'snapchat.com', 'whatsapp.com',
  'telegram.org', 'discord.com', 'slack.com', 'dropbox.com', 'drive.google.com',
  'docs.google.com', 'sheets.google.com', 'slides.google.com', 'forms.google.com',
  'blogger.com', 'wordpress.com', 'wix.com', 'squarespace.com', 'weebly.com',
  'webflow.com', 'shopify.com', 'bigcommerce.com', 'magento.com',
  'openstreetmap.org', 'maps.google.com', 'googlemaps.com',
  'weather.com', 'accuweather.com', 'timeanddate.com', 'calendar.google.com',
  'support.google.com', 'accounts.google.com', 'mail.google.com',
  'play.google.com', 'apps.apple.com', 'play.google.com/store',
  'chromewebstore.google.com', 'addons.mozilla.org',
  'stack overflow', 'stackoverflow.com', 'stackexchange.com',
  'quora.com', 'ask.com', 'answers.com', 'ehow.com', 'wikihow.com',
  'imdb.com', 'rottentomatoes.com', 'metacritic.com', 'tvguide.com',
  'fandom.com', 'gamefaqs.gamespot.com', 'ign.com', 'gamespot.com',
  'khanacademy.org', 'coursera.org', 'udemy.com', 'skillshare.com',
  'edx.org', 'udacity.com', 'pluralsight.com', 'codecademy.com',
  'freecodecamp.org', 'w3schools.com', 'mozilla.org', 'developer.mozilla.org',
  'apache.org', 'nginx.com', 'mysql.com', 'postgresql.org', 'mongodb.com',
  'docker.com', 'kubernetes.io', 'aws.amazon.com', 'azure.microsoft.com',
  'cloud.google.com', 'digitalocean.com', 'heroku.com', 'firebase.google.com',
  'vercel.com', 'netlify.com', 'cloudflare.com', 'fastly.com',
  'icann.org', 'whois.com', 'domaintools.com', 'namecheap.com',
  'godaddy.com', 'hostgator.com', 'bluehost.com', 'siteground.com',
  'inmotionhosting.com', 'dreamhost.com', 'a2hosting.com',
  'cpanel.net', 'plesk.com', 'directadmin.com',
  'web.archive.org', 'archive.org', 'archive.today', 'archive.li',
  'google.com/maps', 'google.com/earth', 'google.com/translate'
];

const excludedDomainsLower = EXCLUDED_DOMAINS.map(d => d.toLowerCase());

// Low-quality URL path patterns that indicate directory/aggregator/rubbish sites
const RUBBISH_PATH_PATTERNS = [
  '/directory', '/directories', '/listing', '/listings', '/browse', '/search',
  '/find', '/category', '/categories', '/tag', '/tags', '/page/', '/p/',
  '/results', '/result', '/query', '/q=', '/search?', '/find?',
  '/companies/', '/business/', '/businesses/', '/firms/', '/vendors/',
  '/suppliers/', '/providers/', '/professionals/', '/experts/',
  '/near-me', '/nearby', '/local/', '/top-', '/best-', '/list-of',
  '/all-', '/view-all', '/see-all', '/show-all', '/display-all',
  '/compare', '/review', '/reviews', '/rating', '/ratings',
  '/claim-your', '/add-your', '/submit-your', '/register-your',
  '/free-listing', '/paid-listing', '/premium-listing', '/featured',
  '/sponsored', '/advertise', '/ads/', '/promo', '/coupon',
  '/deal', '/deals', '/offer', '/offers', '/discount', '/sale',
  '/jobs/', '/careers/', '/hire', '/hiring', '/recruit',
  '/press/', '/news/', '/blog/', '/article', '/articles',
  '/about-us', '/contact-us', '/privacy', '/terms', '/sitemap',
  '/rss', '/feed', '/xml', '/api/', '/wp-json', '/feed/'
];

// Low-quality URL path patterns that indicate directory/aggregator/rubbish sites


async function extractEmailsFromWebsite(url, browser) {
  const visited = new Set();
  const scrapedEmails = new Set();
  const scrapedPhoneNumbers = new Set(); // Declare scrapedPhoneNumbers here
  const queue = [url];
  visited.add(url);

  let page;
  let initialHost = '';
  let companyName = '';
  let scrapedPeople = []; // Will store names, titles, and emails found via scraping
  let sender = null; // Will be selected from scrapedPeople
  let apolloContacts = []; // Initialize apolloContacts here

  try {
    page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    );

    await page.setViewport({ width: 1366, height: 768 });

    const urlObj = new URL(url);
    initialHost = urlObj.hostname;
    // Remove 'www.' if present
    if (initialHost.startsWith('www.')) {
      initialHost = initialHost.substring(4);
    }
    companyName = initialHost.split('.')[0]; // Simple company name extraction

    console.log(`Starting data extraction for ${url} (Domain: ${initialHost}, Company: ${companyName})`);


    const fileExtensionsToIgnore = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.rar', '.mp3', '.mp4', 'avi', '.mov', '.wmv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    const contactKeywords = ['contact', 'about', 'team', 'impressum'];


    while (queue.length > 0) {
      const currentUrl = queue.shift();


      if (visited.size >= CONFIG.maxPagesToVisit) {
        console.log(`Reached max pages to visit for ${url}`);
        break;
      }


      if (fileExtensionsToIgnore.some(ext => currentUrl.toLowerCase().endsWith(ext))) {
        continue;
      }


      let success = false;
      for (let i = 0; i < 5; i++) {
        try {
          await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          const content = await page.content();
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
          const foundEmails = content.match(emailRegex) || [];
          foundEmails.forEach(email => scrapedEmails.add(email)); // Scraped emails are added here

          // Extract emails from mailto: links
          const mailtoLinks = await page.$$eval('a[href*="mailto:"]', anchors =>
            anchors.map(a => a.href)
          );
          mailtoLinks.forEach(href => {
            try {
              const mailtoMatch = href.match(/mailto:([^?&]+)/);
              if (mailtoMatch && mailtoMatch[1]) {
                scrapedEmails.add(mailtoMatch[1]);
              }
            } catch (e) {
              // ignore malformed mailto links
            }
          });

          // Regex for phone numbers, including international formats
          const phoneRegex = /(\+\d{1,3}[-.\s]?)?(\(\d{1,4}\)[-.\s]?)?(\d{1,4}[-.\s]?){2,}\d{1,4}/g;
          const foundPhoneNumbers = content.match(phoneRegex) || [];
          foundPhoneNumbers.forEach(phone => scrapedPhoneNumbers.add(phone));


          const links = await page.$$eval('a', as => as.map(a => a.href));


      const internalLinks = links
        .map(link => {
          try {
            return new URL(link, currentUrl).href;
          } catch (e) {
            return null;
          }
        })
        .filter(link => {
          if (!link) return false;
          try {
            const linkUrl = new URL(link);
            const lowerLink = link.toLowerCase();
            if (fileExtensionsToIgnore.some(ext => lowerLink.endsWith(ext))) {
              return false;
            }
            const downloadKeywords = ['download', 'attachment', 'file', 'pdf', 'doc', 'xls', 'zip', 'rar', 'media', 'uploads'];
            if (downloadKeywords.some(kw => lowerLink.includes(kw))) {
              return false;
            }
            return linkUrl.hostname === initialHost && !visited.has(link) && (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https');
          } catch (e) {
            return false;
          }
        });


          const priorityLinks = internalLinks.filter(link => contactKeywords.some(keyword => link.toLowerCase().includes(keyword)));
          const otherLinks = internalLinks.filter(link => !contactKeywords.some(keyword => link.toLowerCase().includes(keyword)));


          const linksToQueue = [...priorityLinks, ...otherLinks];


          for (const link of linksToQueue) {
            if (visited.size >= CONFIG.maxPagesToVisit) break;
            if (!visited.has(link)) {
              visited.add(link);
              if (priorityLinks.includes(link)) {
                queue.unshift(link); // Add priority links to the front
              } else {
                queue.push(link);
              }
            }
          }
          success = true;
          break;
        } catch (err) {
          const isRetryableError = err.name === 'TimeoutError' || 
            err.message.includes('net::ERR_CONNECTION_TIMED_OUT') || 
            err.message.includes('net::ERR_NAME_NOT_RESOLVED') || 
            err.message.includes('net::ERR_CONNECTION_REFUSED') ||
            err.message.includes('net::ERR_CERT_DATE_INVALID') ||
            err.message.includes('net::ERR_CERT_AUTHORITY_INVALID') ||
            err.message.includes('SSL') ||
            err.message.includes('CERT');
          if (!isRetryableError) {
            console.log(`Attempt ${i + 1} failed for ${currentUrl}: ${err.message}`);
          }
          if (i === 4 && !isRetryableError) {
            console.log(`Failed to visit ${currentUrl} after 5 attempts.`);
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'TimeoutError' || 
        error.message.includes('net::ERR_CONNECTION_TIMED_OUT') || 
        error.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
        error.message.includes('net::ERR_CERT_DATE_INVALID') ||
        error.message.includes('net::ERR_CERT_AUTHORITY_INVALID') ||
        error.message.includes('SSL') ||
        error.message.includes('CERT')) {
      // Silently ignore retryable errors on initial URL load
    } else {
      console.error(`An error occurred while extracting emails from ${url}:`, error);
    }
  }

//   // --- NEW SCRAPING LOGIC FOR PEOPLE DATA GOES HERE ---
  console.log(`[INFO] Starting enhanced scraping for people data on ${initialHost}...`);

  const peoplePages = await findPeoplePage(page, url);
  const contactPages = await findContactPage(page, url);

  const potentialPeoplePages = new Set([...peoplePages, ...contactPages]);

  // If no direct links found, try constructing common people page URLs as a fallback
  if (potentialPeoplePages.size === 0) {
    const peoplePageKeywords = [
      'team','contact', 'management','about-us', 'executives', 'board',
      'staff', 'who-we-are', 'our-team', 'meet-the-team',
      'personnel', 'employees',
      'members', 'directors'
    ];
    const domainParts = initialHost.split('.');
    const isBareDomain = domainParts.length <= 2;

    for (const keyword of peoplePageKeywords) {
      potentialPeoplePages.add(`https://${initialHost}/${keyword}`);
      potentialPeoplePages.add(`https://${initialHost}/${keyword}/`);

      if (isBareDomain) {
        potentialPeoplePages.add(`https://www.${initialHost}/${keyword}`);
        potentialPeoplePages.add(`https://www.${initialHost}/${keyword}/`);
      }
    }
  }
    
// Function to validate if a string is a plausible name

  
function isValidName(name, title, irrelevantPhrases) {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return false;
  }

  // Normalize everything to lowercase ONCE
  const normalizedName = name.toLowerCase().trim();
  const normalizedTitle = (title || '').toLowerCase().trim();

  //Check irrelevant phrases (case-insensitive)
  const isIrrelevant = irrelevantPhrases.some(phrase => {
    const p = phrase.toLowerCase();
    return normalizedName.includes(p) || normalizedTitle.includes(p);
  });

  if (isIrrelevant) return false;

  // Remove weird characters before validation
  const cleanName = name.replace(/[^a-zA-Z\s'-]/g, '');

  // Reject names with numbers
  if (/\d/.test(name)) return false;

  // Reject too short names
  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length < 3) return false;

  return true;
}
  
  // Function to scrape names, titles, and emails from a given page
  async function scrapePeopleFromPage(pageUrl, browser) {
    const peopleFound = [];
    const maxRetries = 3;
    let pageInstance; // Declare pageInstance here

    try {
      pageInstance = await browser.newPage(); // Create a new page for this function call
      await pageInstance.setRequestInterception(true);

      pageInstance.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add a random delay before navigating to the page
          // const delay = Math.floor(Math.random() * 3000) + 2000; // Random delay between 2 to 5 seconds
          // await new Promise(resolve => setTimeout(resolve, delay));

          try {
            await pageInstance.goto(pageUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 60000
            });
          } catch (err) {
            console.log(`Skipping slow page: ${pageUrl}, continuing anyway...`);
            return [];
          }
          const content = await pageInstance.content();

          // More aggressive approach: look for common HTML structures and patterns
          const scrapedElements = await pageInstance.$$eval('div[class*="team-member"], div[class*="person-card"], div[class*="staff-profile"], section[class*="team"], section[class*="people"], div[class*="name"], div[class*="person"], div[class*="member"], div[class*="contact"], a[href*="mailto:"], h1, h2, h3, h4, h5, h6, p, li, span', (elements, irrelevantPhrases) => {
            const results = [];
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

            // Define isValidNameInBrowser locally for the browser context
            const isValidNameInBrowser = (name, title, irrelevantPhrases) => {
              if (!name || typeof name !== 'string' || name.trim().length < 3) { // Increased minimum length to 3
                return false;
              }

              const lowerName = name.toLowerCase().trim();
              const lowerTitle = (title || '').toLowerCase().trim();
              const words = name.split(/\s+/).filter(Boolean);

              // Consolidate all irrelevant terms
              const commonTitles = [
                // Company/organization suffixes (not person names)
                'inc', 'ltd', 'corp', 'llc', 'gmbh', 'ag', 'sa', 'bv', 'pte', 'sarl',
                'company', 'group', 'solutions', 'products', 'services', 'enterprises',
                'holdings', 'industries', 'systems', 'technologies', 'international',
                // Generic navigation/page terms (not people)
                'home', 'about', 'contact', 'blog', 'news', 'events', 'careers', 'jobs',
                'privacy', 'terms', 'legal', 'investors', 'media', 'press', 'access',
                'management', 'consulting', 'admin', 'administrator', 'root', 'guest',
                'test', 'demo', 'trial', 'noreply', 'postmaster', 'hostmaster',
                'webmaster', 'mailer-daemon', 'undisclosed-recipients',
                // Email generic local parts
                'info', 'hello', 'support', 'sales', 'billing', 'accounts', 'finance',
                'hr', 'help', 'office', 'security', 'abuse', 'feedback',
                'newsletter', 'subscribe', 'unsubscribe', 'notifications', 'updates',
                'system', 'daemon', 'alert', 'alerts', 'report', 'reports',
                'status', 'update', 'updates', 'service', 'services', 'client',
                'clients', 'customer', 'customers', 'user', 'users', 'member',
                'members', 'partner', 'partners', 'affiliate', 'affiliates',
                'investor', 'investors', 'public', 'relations', 'mediarelations',
                'team', 'it', 'tech', 'development', 'design', 'operations', 'pr',
                'publicrelations', 'investorrelations', 'partnerships', 'affiliates',
                'events', 'mail', 'email', 'website', 'domain', 'server', 'client',
                'user', 'account', 'department', 'division', 'section', 'unit',
                'branch', 'office', 'headquarters', 'corporate', 'global',
                'international', 'national', 'regional', 'local', 'general', 'main',
                'primary', 'secondary', 'tertiary'
              ];
              const allIrrelevantTerms = new Set([...irrelevantPhrases.map(p => p.toLowerCase()), ...commonTitles]);

              // Check against all irrelevant terms
              if (Array.from(allIrrelevantTerms).some(phrase => lowerName.includes(phrase) || lowerTitle.includes(phrase))) {
                return false;
              }

              // Exclude names that are all uppercase and short (likely acronyms or company names)
              if (name === name.toUpperCase() && name.length <= 5 && words.length === 1) {
                return false;
              }

              // Refined single-word validation:
              // If it's a single word, it should be a proper noun (starts with capital, rest lowercase)
              // and not be in the irrelevant terms list.
              if (words.length === 1) {
                const singleWord = words[0];
                if (!/^[A-Z][a-z]+$/.test(singleWord) || allIrrelevantTerms.has(singleWord.toLowerCase())) {
                  return false;
                }
              }

              // Check for presence of numbers or too many special characters in the name
              // Allow apostrophes and hyphens, but limit other special characters
              if (/\d/.test(name) || (name.match(/[^a-zA-Z\s'-]/g) || []).length > 1) {
                return false;
              }

              // Exclude very short names that are likely not full names (e.g., "Dr", "Mr", "CEO")
              if (words.length === 1 && name.length <= 3) {
                  return false;
              }

              // Ensure names have at least two distinct parts (first and last name) unless it's a known single name
              // This helps filter out single words that might be company names or generic terms
              // Relaxed this slightly to allow for valid single names that pass other checks
              if (words.length < 2 && name.length > 3 && !/^[A-Z][a-z]+$/.test(name)) {
                  return false;
              }

              // Check for names that are too long (unlikely to be a single person's name)
              if (name.length > 30) { // Reduced max length to 30
                  return false;
              }

              // Exclude names that are just a sequence of capital letters (e.g., "ABC Company")
              if (name === name.toUpperCase() && name.length > 1 && words.length === 1) {
                  return false;
              }

              // New check: Names should typically start with a capital letter
              if (words.length > 0 && !/^[A-Z]/.test(words[0])) {
                  return false;
              }

              // New check: Avoid names that are just initials unless they are part of a longer name (e.g., "J D" is okay, but "J" is not)
              if (words.every(word => word.length === 1 && /^[A-Z]$/.test(word)) && words.length < 2) {
                  return false;
              }

              // New check: Filter out names with too many words (e.g., more than 6)
              if (words.length > 6) { // Reduced max words to 6
                  return false;
              }

              // NEW: Check if all words (except possibly very short ones like 'de', 'van') start with a capital letter
              // This helps filter out phrases like "our sales team" or "contact us for support"
              for (const word of words) {
                if (word.length > 2 && !/^[A-Z]/.test(word)) { // Allow short words like 'de' or 'van' to be lowercase
                  return false;
                }
              }

              return true;
            };

            // Helper function to parse full name into first and last name
            const parseFullName = (fullName) => {
              const prefixes = ['dr', 'mr', 'ms', 'mrs', 'prof', 'rev', 'fr', 'sir', 'madam'];
              const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq', 'cpa'];

              let nameParts = fullName.split(/\s+/).filter(Boolean);
              let firstName = '';
              let lastName = '';

              // Remove prefixes
              if (nameParts.length > 0 && prefixes.includes(nameParts[0].toLowerCase())) {
                nameParts.shift();
              }

              // Remove suffixes (from the end)
              while (nameParts.length > 0 && suffixes.includes(nameParts[nameParts.length - 1].toLowerCase())) {
                nameParts.pop();
              }

              if (nameParts.length === 1) {
                firstName = nameParts[0];
              } else if (nameParts.length > 1) {
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(' ');
              }

              return { first_name: firstName, last_name: lastName };
            };

            elements.forEach(el => {
              if (el.innerText && el.innerText.length > 5 && el.innerText.length < 500) {
                const text = el.innerText.trim();
                const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                let name = '';
                let title = '';
                let email = '';

                // Find email in the text
                const emailMatch = text.match(emailRegex);
                if (emailMatch) {
                  email = emailMatch[0];

                  // Try different patterns to extract name and title
                  // Prioritize mailto links
                  if (el.tagName === 'A' && el.href.startsWith('mailto:')) {
                    name = el.innerText.replace(emailRegex, '').replace(/[<>\(\)\-]/g, '').trim();
                    if (!name) {
                      const mailtoNameMatch = el.href.match(/mailto:([^?]+)/);
                      if (mailtoNameMatch && mailtoNameMatch[1]) {
                        name = mailtoNameMatch[1].split('@')[0].replace(/[\._]/g, ' ').trim();
                      }
                    }
                  }

                  if (!name && lines.length >= 2) {
                    const line1 = lines[0];
                    const line2 = lines[1];

                    const nameLikeRegex = /^[A-Z][a-zA-Z\s.'-]+$/;
                    const titleLikeRegex = /^(Manager|Director|Engineer|Specialist|Lead|Head|Officer|VP|President|Founder|CEO|CTO|CFO|CMO|CIO|COO|HR|Sales|Marketing|Software|Data|Product|Project|Business|Senior|Junior|Associate|Analyst|Consultant|Developer|Designer|Architect|Scientist|Research|Operations|Customer|Support|Client|Account|Finance|Legal|Admin|Executive|Assistant|Coordinator|Specialist|Representative|Recruiter|Talent|People|Office|Facilities|Event|Public Relations|Social Media|Content|Writer|Photographer|Videographer|Graphic|Web|Investment|Portfolio|Wealth|Financial|Insurance|Real Estate|Broker|Trader|Underwriter|Claims|Actuary|Co-founder|Chief of Staff|General Manager|Program Manager|Regional Director|Area Director|Country Director|Global Director|Section Head|Group Leader|Team Leader|Supervisor|Foreman|Student|Volunteer)\b/i;

                    if (nameLikeRegex.test(line1) && titleLikeRegex.test(line2)) {
                      name = line1;
                      title = line2;
                    } else if (nameLikeRegex.test(line2) && titleLikeRegex.test(line1)) {
                      name = line2;
                      title = line1;
                    } else if (!emailRegex.test(line1) && line1.length > 3 && line1.split(' ').length <= 4) {
                      name = line1;
                      if (!emailRegex.test(line2) && line2.length > 3 && line2.split(' ').length <= 5) {
                         title = line2;
                      }
                    }
                  }

                  if (!name && lines.length === 1) {
                    name = lines[0].replace(emailRegex, '').replace(/[<>\(\)\-]/g, '').trim();
                  }

                  // Fallback: try to extract name from email if not found yet
                  if (!name && email) {
                    const emailUser = email.split('@')[0];
                    const emailParts = emailUser.split(/[\._-]/); // Split by '.', '_', or '-'
                    if (emailParts.length >= 2) {
                      name = emailParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
                    } else if (emailParts.length === 1) {
                      name = emailParts[0].replace(/[\d]/g, '').trim(); // Remove numbers
                      if (name.length > 1 && name.length < 20) {
                         name = name.charAt(0).toUpperCase() + name.slice(1);
                      } else {
                         name = '';
                      }
                    }
                  }

                  // Clean up name and title
                  if (name) name = name.replace(/[^a-zA-Z\s.'-]+/g, '').trim();
                  if (title) title = title.replace(/[^a-zA-Z\s.'-]+/g, '').trim();

                  // Additional patterns for name-email combinations
                  const patterns = [
                    /([A-Za-z\s]+)\s*<[^>]*>/g, // Name <...>
                    /\([^)]+\)\s*([A-Za-z\s]+)/g, // (...) Name
                    /([A-Za-z\s]+)\s*-\s*[^@]+@/g, // Name - ...@
                  ];
                  patterns.forEach(pattern => {
                    const match = text.match(pattern);
                    if (match) {
                      const extracted = match[0].replace(emailRegex, '').replace(/[<>\(\)\-]/g, '').trim();
                      if (extracted && !name) name = extracted;
                    }
                  });

                  // Validate and add
                  if (isValidNameInBrowser(name, title, irrelevantPhrases)) {
                    const { first_name, last_name } = parseFullName(name);
                    results.push({ name, first_name, last_name, title, email });
                  }
                }
              }
            });

            // Additional global search for specific patterns across the page
            const bodyText = document.body.innerText;
            const globalPatterns = [
              /([A-Za-z\s]+)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g, // Name <email>
              /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*\(([^)]+)\)/g, // email (name)
              /([A-Za-z\s]+)\s*-\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, // Name - email
            ];
            globalPatterns.forEach(pattern => {
              let match;
              while ((match = pattern.exec(bodyText)) !== null) {
                const name = match[1] || match[2];
                const email = match[2] || match[1];
                if (name && email && isValidNameInBrowser(name, '', irrelevantPhrases)) {
                  const { first_name, last_name } = parseFullName(name);
                results.push({ name, first_name, last_name, title: '', email });
                }
              }
            });

            return results;
          }, CONFIG.irrelevantPhrases);

          scrapedElements.forEach(person => {
            if (person.name && person.email) {
              peopleFound.push(person);
            }
          });
          return peopleFound; // Success, return the results
        } catch (error) {
          console.error(`Error scraping people from ${pageUrl} (attempt ${attempt}/${maxRetries}):`, error.message);
          if (attempt === maxRetries) {
            return []; // Return empty array after all retries
          }
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    } finally {
      if (pageInstance && !pageInstance.isClosed()) {
        await pageInstance.close(); // Ensure the page is closed
      }
    }
    return peopleFound; // Return peopleFound outside the try-finally
  }

  // Visit potential people pages and scrape concurrently
  const peoplePageUrlsToScrape = Array.from(potentialPeoplePages).filter(url => !visited.has(url));
  const limit = CONFIG.peoplePageConcurrency;
  let activePromises = 0;
  let urlIndex = 0;

  while (urlIndex < peoplePageUrlsToScrape.length || activePromises > 0) {
    while (activePromises < limit && urlIndex < peoplePageUrlsToScrape.length) {
      const peoplePageUrl = peoplePageUrlsToScrape[urlIndex++];
      if (scrapedPeople.length >= CONFIG.maxPeopleToScrape) {
        console.log(`Reached max people to scrape (${CONFIG.maxPeopleToScrape}). Stopping.`);
        break;
      }

      console.log(`[INFO] Visiting potential people page: ${peoplePageUrl}`);
      const promise = scrapePeopleFromPage(peoplePageUrl, browser)
        .then(peopleOnPage => {
          peopleOnPage.forEach(person => {
            if (scrapedPeople.length < CONFIG.maxPeopleToScrape) {
              scrapedPeople.push(person);
              scrapedEmails.add(person.email);
            }
          });
        })
        .catch(error => {
          console.error(`Error scraping people from ${peoplePageUrl} in concurrent task:`, error);
        })
        .finally(() => {
          activePromises--;
        });
      activePromises++;
    }
    // Wait for at least one promise to settle if there are active promises
    if (activePromises > 0) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to prevent busy-waiting
    }
    if (scrapedPeople.length >= CONFIG.maxPeopleToScrape) {
      break;
    }
  }
  

  // Apply "Least Position" Logic to Scraped Data
  if (scrapedPeople.length > 0) {
    // Prefer people with a real name, title, and email; sort by highest position first
    const validPeople = scrapedPeople.filter(p => p.name && p.title && p.email);
    if (validPeople.length > 0) {
      validPeople.sort((a, b) => getJobTitleScore(b.title) - getJobTitleScore(a.title));
      const chosen = validPeople[0];
      const nameParts = (chosen.name || '').split(/\s+/).filter(Boolean);
      sender = {
        first_name: nameParts[0] || 'Team',
        last_name: nameParts.slice(1).join(' ') || 'Member',
        email: chosen.email,
        title: chosen.title
      };
      console.log(`[INFO] Selected sender: ${sender.first_name} ${sender.last_name} (${sender.title}) - ${sender.email}`);
    } else {
      sender = null;
      console.log(`[INFO] No valid people with name+title+email scraped. Setting sender to null.`);
    }
  } else {
    // Fallback: if no specific people were scraped, set sender to null
    sender = null;
    console.log(`[INFO] No specific people scraped. Setting sender to null.`);
  }

  return {
    emails: Array.from(scrapedEmails),
    phoneNumbers: Array.from(scrapedPhoneNumbers),
    domain: initialHost,
    companyName,
    scrapedPeople,
    sender,
    apolloContacts
  };
 
  // Add this line at the very end of the function
  if (page && !page.isClosed()) {
    await page.close();

}

}



// ---------- MAIN BOT ----------
async function main(io) {
  if (!emailQueueProcessorInterval) {
    emailQueueProcessorInterval = setInterval(emailQueueProcessor, 2 * 60 * 1000); // Run every 2 minutes
  }

  // Fetch fresh proxies from Proxyscrape API
  await fetchProxiesFromAPI();

  const shuffledIndustries = shuffleArray([...CONFIG.industries]);

  cleanupBrowserLocks('./browser_profile');
  let browser = await puppeteer.launch({
    headless: "new",
    ignoreHTTPSErrors: true,
    args: getLaunchArgs(),
    userDataDir: './browser_profile',
    protocolTimeout: PROTOCOL_TIMEOUT_MS,
  });

  // Start email queue processor
  // emailQueueProcessor(); // Run once immediately
  // setInterval(emailQueueProcessor, 300000); // Then every 5 minutes
  // console.log('[INFO] Email queue processor started, running every 5 minutes.');

  let searchesCompletedInBatch = 0; // Initialize counter for searches

  while (true) {
    try {
      const leads = loadLeads();
      console.log(`Loaded ${leads.length} existing leads.`);

      const industries = shuffledIndustries;
      const countryCodesForSearch = CONFIG.manualCountryCodesForSearch;

      // Ensure indices are within bounds
      if (currentIndustryIndex >= industries.length) {
        currentIndustryIndex = 0; // Reset industries
      }

      const industry = industries[currentIndustryIndex];
      console.log(`\nSearching websites for industry: ${industry}`);

      const processedCountryCodes = [];
      const allWebsitesForCurrentBatch = [];
      for (let i = 0; i < COUNTRY_CODE_BATCH_SIZE; i++) {
        if (currentCountryCodeIndex >= countryCodesForSearch.length) {
          currentCountryCodeIndex = 0; // Reset country codes for the next industry cycle
          break; // Exit batching if all country codes are processed for this industry cycle
        }
        processedCountryCodes.push(countryCodesForSearch[currentCountryCodeIndex]);
        currentCountryCodeIndex++;
      }

      if (processedCountryCodes.length === 0) {
        // If no country codes were processed in this batch, move to the next industry
        currentIndustryIndex++;
        console.log(`No country codes processed in this batch for industry ${industry}. Moving to next industry.`);
        await wait(DELAY_BETWEEN_BATCHES_MS); // Wait before moving to the next industry
        continue;
      }

      for (const countryCode of processedCountryCodes) {
        console.log(`[INFO] Searching for industry: ${industry} in country: ${countryCode || 'Global'}`);

        let dialingCodeToUse = CONFIG.defaultDialingCode;
        if (!dialingCodeToUse && countryCode && CONFIG.countryDialingCodeMapping[countryCode]) {
          dialingCodeToUse = CONFIG.countryDialingCodeMapping[countryCode];
        }
        const websites = await getWebsitesByIndustry(industry, browser, countryCode, dialingCodeToUse);
        console.log(`Found ${websites.length} websites for industry ${industry} in country ${countryCode}.`);
        allWebsitesForCurrentBatch.push(...websites);

        // Delay between country searches to avoid DuckDuckGo rate limiting from datacenter IP
        await wait(randomInt(5000, 10000));
      }

      searchesCompletedInBatch++; // Increment after each country code batch

      // After processing a batch of country codes, process emails
      if (searchesCompletedInBatch >= COUNTRY_CODE_BATCH_SIZE) {
        console.log(`[INFO] Completed ${searchesCompletedInBatch} searches. Triggering email queue processor.`);
        await emailQueueProcessor();
        searchesCompletedInBatch = 0; // Reset counter
      }

      // Remove duplicates from allWebsitesForCurrentBatch
      const uniqueWebsitesForCurrentBatch = [...new Set(allWebsitesForCurrentBatch)];
      console.log(`Total unique websites found for industry ${industry} in this batch: ${uniqueWebsitesForCurrentBatch.length}`);

      for (const website of uniqueWebsitesForCurrentBatch) {
        if (leads.some(l => l.website === website)) {
          console.log(`Skipping already processed website: ${website}`);
          continue;
        }

        const { emails, phoneNumbers, domain, companyName, scrapedPeople, sender } = await extractEmailsFromWebsite(website, browser);
        // A lead is valid if we found any emails (scraped or Apollo) or Apollo contacts
        if (emails.length > 0 || phoneNumbers.length > 0 || scrapedPeople.length > 0) {
          const lead = {
            website,
            domain, // Store the extracted domain
            companyName, // Store the extracted company name
            emails, // Emails found via scraping and Apollo (excluding sender)
            phoneNumbers, // Phone numbers found via scraping
            scrapedPeople, // All relevant Apollo contacts
            sender, // The selected sender contact from Apollo
            industry,
            timestamp: new Date().toISOString(),
            emailsSent: false,
            sentEmailLinks: [],
          };
          leads.push(lead);
          saveLeads(leads);
          console.log(`Saved new lead for ${website}. Total leads: ${leads.length}`); // Added log
          io.emit('new-lead', lead);
        } else {
          console.log(`No emails found for ${website}.`); // Added log
        }
      }

      // After processing a batch of country codes for the current industry, wait
      console.log(`Finished batch for industry: ${industry}. Waiting for ${DELAY_BETWEEN_BATCHES_MS / 1000} seconds before next batch/industry.`);
      await wait(DELAY_BETWEEN_BATCHES_MS);

      // If all country codes for the current industry have been processed, move to the next industry
      if (currentCountryCodeIndex >= countryCodesForSearch.length) {
        console.log(`[INFO] Industry ${industry} completed. Relaunching browser for next industry.`);
        if (browser) {
          await browser.close();
        }
        browser = await puppeteer.launch({
          headless: "new",
          ignoreHTTPSErrors: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--ignore-certificate-errors-spki-list',
            '--ignore-ssl-errors-ignore-untrusted',
            '--disable-blink-features=AutomationControlled'
          ],
          protocolTimeout: PROTOCOL_TIMEOUT_MS,
        });
        currentIndustryIndex++;
        currentCountryCodeIndex = 0; // Reset country code index for the new industry
      }


      console.log('\nFinished scraping all industries. Restarting in a bit...');
      if (io) { // Only emit if io is defined
        io.emit('bot-status', { message: 'Finished scraping all industries. Restarting in a bit...' });
      }
      await wait(10000);
    } catch (error) {
      console.error('A critical error occurred in the main loop:', error);
      if (io) { // Only emit if io is defined
        io.emit('bot-error', { message: error.message });
      }
      if (browser) await browser.close();
      console.log('Restarting browser and continuing...');
      browser = await puppeteer.launch({
        headless: "new", // Changed to "new" as per deprecation warning
        ignoreHTTPSErrors: true, // Add this line
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list',
          '--ignore-ssl-errors-ignore-untrusted',
          '--disable-blink-features=AutomationControlled'

          
        ],
        protocolTimeout: PROTOCOL_TIMEOUT_MS, // Increase timeout for stealth plugin
      });
    }
  }
  }

  
module.exports = { main };

if (require.main === module) {
  main();
}