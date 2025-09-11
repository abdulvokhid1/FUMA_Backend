/** @format */

// server.js
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const cron = require('node-cron'); // node-cron 패키지 추가
const app = express();
const port = 3000;

app.use(express.json()); // JSON POST 파싱
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // CORS 허용

// 메모리상 주문 내역 배열
let orders = [];

// 매일 아침 6시에 orders 배열 초기화
//cron.schedule("0 0 6 * * *", () => {
//  orders = [];
//  console.log("매일 아침 6시, orders 배열이 초기화되었습니다.");
//});

// 매주 월요일 아침 6시에 orders 배열 초기화
cron.schedule('0 0 6 * * 1', () => {
  orders = [];
  console.log('매주 월요일 아침 6시, orders 배열이 초기화되었습니다.');
});

// 안전 숫자 변환 (문자열/통화기호/콤마 허용)
function toNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

// 주문 데이터 받기
app.post('/order', (req, res) => {
  //console.log("headers:", req.headers); // 디버깅 코드
  let body = req.body; // {orderNo, winrate, entry, close}

  // body가 { 'JSON문자열': '' } 형태라면, 첫 key만 꺼내서 JSON.parse!
  let keys = Object.keys(body);
  let key = keys[0]?.replace?.(/\x00$/, '') || ''; // 마지막에 널문자 제거 (방어코드)
  let order;
  try {
    order = JSON.parse(key);
  } catch (e) {
    order = {};
  }

  console.log('정상화된 주문:', order);

  orders.push(order);

  // 파일로 저장 (옵션)
  //fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2));

  res.json({ success: true });
});

// 웹페이지에서 주문 내역 조회 (기존)
app.get('/orders', (req, res) => {
  res.json(orders);
});

// trading-dashboard용 API 엔드포인트
app.get('/api/trading/data', (req, res) => {
  try {
    // orders 데이터를 trading-dashboard 형식으로 변환
    const tradingData = orders.map((order, index) => {
      return {
        round: order.orderNo || index + 1, // 회차: orderNo 또는 순번
        contracts: toNumber(order.lots) || 0, // 계약수
        loss: Math.trunc(toNumber(order.price)) || 0, // 손익금 (양수/음수 처리)
        mark: Math.trunc(toNumber(order.price)) >= 0 ? 'W' : 'L',
      };
    });

    // 총 손익금 계산
    const totalLoss = tradingData.reduce((sum, item) => sum + item.loss, 0);

    res.json({
      success: true,
      data: tradingData,
      total_loss: totalLoss,
      count: tradingData.length,
    });
  } catch (error) {
    console.error('API 에러:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// HTML 웹페이지 제공
app.get('/', (req, res) => {
  res.send(`
    <html>
    <head>
      <title>주문 내역</title>
      <meta charset="utf-8">
      <script>
        async function loadOrders() {
          const res = await fetch('/orders');
          const orders = await res.json();
          let html = '<table border="1"><tr><th>타입</th><th>순번</th><th>로트</th><th>가격</th></tr>';
          for(let o of orders){
            html += '<tr>' +
              '<td>' + (o.type || '') + '</td>' +
              '<td>' + (o.orderNo || '') + '</td>' +
              '<td>' + (o.lots || '') + '</td>' +
              '<td>' + (o.price || '') + '</td>' +
              '</tr>';
          }
          html += '</table>';
          document.getElementById('orders').innerHTML = html;
        }
        setInterval(loadOrders, 2000);
        window.onload = loadOrders;
      </script>
    </head>
    <body>
      <h1>주문 내역 실시간 전시</h1>
      <div id="orders"></div>
      <br>
      <p><a href="/dashboard" target="_blank">거래 대시보드 보기</a></p>
    </body>
    </html>
  `);
});

// 거래 대시보드 페이지 제공
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>거래 데이터 대시보드</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          background: #000000;
          color: #ffffff;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        
        .trading-dashboard {
          width: 300px;
          height: 600px; /* 800 → 600 */
          background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%);
          border: 2px solid #ffd700;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(255, 215, 0, 0.3);
          position: relative;
        }
        
        .header-section {
          height: 80px;  /* 100 → 80 */
          background: linear-gradient(90deg, #ffd700 0%, #ffed4e 100%);
          color: #000000;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        
        .header-section::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: shimmer 3s infinite;
        }
        
        .table-section {
          height: 470px; /* 600 - 80 - 50 = 470 */
          padding: 10px;
          background: #000000;
          overflow: hidden;
        }
        
        .summary-section {
          height: 50px;
          background: linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 100%);
          border-top: 2px solid #ffd700;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
        }
        
        /* FLEX layout for exact heights */
        .trading-table {
          width: 100%;
          height: 100%;
          background: #1a1a1a;
          border-radius: 8px;
          border: 1px solid #333333;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
        }
        
        .table-header {
          background: linear-gradient(90deg, #333333 0%, #2a2a2a 100%);
          padding: 12px 16px;
          border-bottom: 2px solid #ffd700;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex: 0 0 auto;
        }
        .table-header h2 {
          color: #ffd700;
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .table-count {
          background: #ffd700;
          color: #000000;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 600;
        }

        /* lots 기준값과 일치하는 행에 윗쪽 흰색 라인 표시 */
        .highlight-lots td {
          border-top: 2px solid #ffffff !important;
        }
        
        .table-wrapper {
          flex: 1 1 auto;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #ffd700 #333333;
        }
        .table-wrapper::-webkit-scrollbar { width: 6px; }
        .table-wrapper::-webkit-scrollbar-track { background: #333333; }
        .table-wrapper::-webkit-scrollbar-thumb { background: #ffd700; border-radius: 3px; }
        .table-wrapper::-webkit-scrollbar-thumb:hover { background: #ffed4e; }

        table { width: 100%; border-collapse: collapse; font-size: 15px; }
        thead { position: sticky; top: 0; background: #2a2a2a; z-index: 10; }
        th {
          padding: 10px 8px; text-align: center; color: #ffd700; font-weight: 600;
          border-bottom: 1px solid #444444; text-transform: uppercase; font-size: 15px; letter-spacing: 0.5px;
        }
        td {
          padding: 5px; text-align: center; color: #ffffff; border-bottom: 1px solid #333333;
          transition: background-color 0.2s ease; font-size: 15px;
        }
        tbody tr:hover { background: rgba(255, 215, 0, 0.1); }
        tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }

        /* sign-aware colors */
        .loss-pos { color: #ff6b6b; font-weight: 600; font-family: 'Courier New', monospace; } /* red for + */
        .loss-neg { color: #4da3ff; font-weight: 600; font-family: 'Courier New', monospace; } /* blue for - */
        .loss-zero { color: #ddd;     font-weight: 600; font-family: 'Courier New', monospace; }
        
        .VS { font-family: 'Courier New', monospace; } /* W, L의 전시 장평이 같게 해주기 위해 */

        /* tiny spacer so last row never sits flush to bottom border */
        tbody::after { content: ""; display: block; height: 2px; }

        .summary-section {
          height: 50px;
          background: linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 100%);
          border-top: 2px solid #ffd700;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
        }
        .summary-item { display: flex; align-items: center; gap: 8px; }
        .summary-label { color: #cccccc; font-size: 20px; font-weight: 500; }
        .summary-value { color: #ffd700; font-size: 20px; font-weight: 700; font-family: 'Courier New', monospace; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
        
        .loading {
          display: flex; align-items: center; justify-content: center;
          color: #ffd700; font-size: 36px; font-weight: 600; animation: pulse 2s infinite;
        }
        @keyframes shimmer { 0% { left: -100%; } 100% { left: 100%; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      </style>
    </head>
    <body>
      <div class="trading-dashboard" id="dashboard">
        <div class="loading">데이터 로딩 중...</div>
      </div>
      
      <script>
        let tradingData = [];
        let totalLoss = 0;

        // === 추가: URL 파라미터로 기준 lots 값 읽기 (없으면 기본 0.1) ===
        const urlParams = new URLSearchParams(location.search);
        const HLOTS = parseFloat(urlParams.get('hlots')) || 0.1;

        // === 추가: 부동소수 비교 유틸 ===
        function approxEqual(a, b, eps = 1e-8) {
          return Math.abs(a - b) <= eps;
        }

        // 스크롤 제어 관련 상태
        let currentScrollPosition = 0; // 사용자 스크롤 위치 저장
        let autoScroll = true;         // 사용자가 하단에 있을 때에만 자동 스크롤
        const BOTTOM_THRESHOLD = 30;   // 하단 근접 판정 여유(px)

        function formatNumber(num) {
          return new Intl.NumberFormat('ko-KR').format(num);
        }

        function isNearBottom(el) {
          return (el.scrollHeight - el.scrollTop - el.clientHeight) <= BOTTOM_THRESHOLD;
        }

        // 레이아웃 완료 후 정확히 바닥으로 이동 (반쪽 보임 방지)
        function scrollToBottom(el) {
          if (!el) return;
          el.scrollTop = el.scrollHeight - el.clientHeight; // immediately
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight - el.clientHeight;
            setTimeout(() => {
              el.scrollTop = el.scrollHeight - el.clientHeight;
            }, 16); // ~one frame; bump to 32 if needed
          });
        }

        async function fetchTradingData() {
          try {
            const response = await fetch('/api/trading/data');
            const data = await response.json();

            if (data.success) {
              tradingData = data.data;
              totalLoss = data.total_loss;
              renderDashboard(); // 렌더링 후 필요 시 하단 스크롤
            }
          } catch (error) {
            console.error('데이터 가져오기 실패:', error);
          }
        }

        function renderDashboard() {
          const dashboard = document.getElementById('dashboard');

          dashboard.innerHTML = \`
            <div class="header-section">
              <h1 class="dashboard-title">거래 데이터 대시보드</h1>
              <div class="subtitle">실시간 거래 현황 모니터링</div>
            </div>

            <div class="table-section">
              <div class="trading-table">
                <div class="table-header">
                  <h2>거래 내역</h2>
                  <div class="table-count">\${tradingData.length}건/주</div>
                </div>
                <div class="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>회차(승패)</th>
                        <th>계약수</th>
                        <th>손익금</th>
                      </tr>
                    </thead>
                    <tbody>
                      \${tradingData.map(item => {
                        const cls = item.loss > 0 ? 'loss-pos' : (item.loss < 0 ? 'loss-neg' : 'loss-zero');
                        const rowClass = approxEqual(item.contracts, HLOTS) ? 'highlight-lots' : '';
                        return \`<tr class="\${rowClass}">
                          <td>\${item.round} <span class="VS">(\${item.mark})</span></td>
                          <td>\${item.contracts}</td>
                          <td class="\${cls}">\${formatNumber(item.loss)}원</td>
                        </tr>\`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="summary-section">
              <div class="summary-item">
                <span class="summary-label">총 손익금:</span>
                <span class="summary-value">\${formatNumber(totalLoss)}원</span>
              </div>
            </div>
          \`;

          const tableWrapper = document.querySelector(".table-wrapper");
          if (!tableWrapper) return;

          // 스크롤 이벤트 리스너 재등록 (렌더링 마다 DOM이 새로 생김)
          tableWrapper.addEventListener('scroll', () => {
            autoScroll = isNearBottom(tableWrapper); // 하단 근처면 true, 아니면 false
            currentScrollPosition = tableWrapper.scrollTop; // 사용자 위치 저장
          });

          // 렌더 직후 스크롤 동작:
          if (autoScroll) {
            scrollToBottom(tableWrapper); // 마지막 행 온전히 보이도록
          } else {
            tableWrapper.scrollTop = currentScrollPosition; // 사용자가 올려본 위치 유지
          }
        }

        // 초기 로드
        fetchTradingData();

        // 2초마다 데이터 업데이트
        setInterval(fetchTradingData, 2000);
      </script>
    </body>
    </html>
  `);
});

app.listen(port, () => console.log('서버 실행: http://localhost:' + port));

// cd C:\\B\\GangNam\\DPS\\DSP_Indicators\\
// 터미널 실행 명령 : node Server_modified.js
// 크롬에서 주소 검색 : http://127.0.0.1:3000
// 거래 대시보드 : http://127.0.0.1:3000/dashboard

// 마틴 회차당 구분을 위한 흰색 라인 표시를 위해 0.1계약 처리를 위해서는
// http://127.0.0.1:3000/dashboard
// 이외의 값 입력을 위해서는
// http://127.0.0.1:3000/dashboard?hlots=0.2

// [실행 파일로 만들기]
// 1)
// npm init -y
// npm i express cors node-cron
// npm i -D pkg

// 2)
// package.json을 열어 아래처럼 bin과 pkg 항목을 넣어주세요.

// {
//   "name": "trading-server",
//   "version": "1.0.0",
//   "bin": "Server_modified.js",
//   "scripts": {
//     "build:win": "pkg . -t node18-win-x64 --output dist/trading-server.exe"
//   },
//   "pkg": {
//     "outputPath": "dist"
//   },
//   "dependencies": {
//     "cors": "^2.8.5",
//     "express": "^5.1.0",
//     "node-cron": "^4.2.1"
//   },
//   "devDependencies": {
//     "pkg": "^5.8.1"
//   }
// }

// 3)
// npm run build:win

// 완료되면 dist/trading-server.exe가 생성

// npm run express:dev
