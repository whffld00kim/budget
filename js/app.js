/* =============================================
   인증은 js/cloud.js 로 옮겼다 (2026-08-20).
   그전까지 이 자리에 4자리 PIN(하드코딩) 잠금 화면 코드가 있었다.
   공개 저장소에 비밀번호가 그대로 노출돼 있었고 기기 간 동기화도 불가능해서,
   구글 로그인 + Firebase RTDB 로 함께 교체했다. 되돌리지 말 것.
============================================= */

/* =============================================
   상수 / 설정
============================================= */
const DEFAULT_INCOME_ACCOUNTS  = ['개인연금', '보너스', '월급'];
const DEFAULT_EXPENSE_ACCOUNTS = ['주식', '금', '개인연금', '대출금상환', '비과세연금', '생활비', 'ISA', '가상화폐'];
const SUBJECTS = ['도연', '민성', '공통'];
const MONTHS   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

const ACCOUNT_COLORS = {
  '개인연금':'#6366F1', '보너스':'#F59E0B', '월급':'#22C55E',
  '주식':'#3B82F6', '금':'#F97316', '대출금상환':'#EF4444',
  '비과세연금':'#8B5CF6', '생활비':'#06B6D4',
};
const COLOR_PALETTE = [
  '#6366F1','#F59E0B','#22C55E','#3B82F6','#F97316',
  '#EF4444','#8B5CF6','#06B6D4','#EC4899','#10B981','#F43F5E','#A78BFA',
];

function getColor(account, idx) {
  return ACCOUNT_COLORS[account] || COLOR_PALETTE[idx % COLOR_PALETTE.length];
}

/* =============================================
   localStorage
============================================= */
const STORAGE_TX  = 'gaegybu_final_tx_v3';
const STORAGE_CUS = 'gaegybu_final_custom_v3';
const STORAGE_FIXED = 'gaegybu_final_fixed_v1';
const STORAGE_IRR = 'gaegybu_irregular_v1';
const STORAGE_DEDUCT = 'gaegybu_deduct_v1';
const STORAGE_LIVING = 'gaegybu_living_v1';

/* =============================================
   초기 데이터 — 비워 둔다 (2026-09-02)
   실제 데이터는 Firebase(/home-ledger/{hid})에 있고, 로그인 뒤 cloud.js가
   localStorage에 써넣은 다음 이 앱을 초기화한다. 공개 저장소이므로
   실제 거래·월급·카드값을 여기에 시드로 두지 않는다.
   구조는 cloud.js의 DEFAULTS와 같아야 한다.
============================================= */
const INIT_TX = [];

const INIT_CUSTOM = { income: [], expense: [] };

const INIT_FIXED = [];

const INIT_IRREGULAR = { categories: [], entries: [] };
