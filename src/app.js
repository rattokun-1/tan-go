const firebaseConfig = window.TANGO_FIREBASE_CONFIG || { enabled: false };
const isFirebaseConfigured = () => Boolean(firebaseConfig.enabled && firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

const STORAGE_KEY = "tango.app.state"; // legacy localStorage key (migration only)
const COOKIE_KEY = "tango_state";
const COOKIE_CHUNK = 3500;
const VERSION = 3;
let firebaseAuth = null;
let firebaseDb = null;
let firebaseUser = null;
let syncTimer = null;
let applyingRemoteState = false;
let syncStatus = { state: "idle", message: "" };
let leaderboardState = { loading: false, rows: [], error: "" };
const app = document.querySelector("#app");

const icons = {
  home: `<svg class="icon" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>`,
  learn: `<svg class="icon" viewBox="0 0 24 24"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17.5a2.5 2.5 0 0 0-2.5-2.5H5z"/><path d="M5 4.5v15A2.5 2.5 0 0 0 7.5 22H20"/><path d="M9 7h7M9 11h5"/></svg>`,
  rank: `<svg class="icon" viewBox="0 0 24 24"><path d="M8 21V10H4v11M14 21V3h-4v18M20 21v-7h-4v7"/></svg>`,
  collection: `<svg class="icon" viewBox="0 0 24 24"><path d="M12 3c4.5 0 8 2.4 8 5.4v7.1c0 3-3.5 5.4-8 5.4s-8-2.4-8-5.4V8.4C4 5.4 7.5 3 12 3Z"/><path d="M4 8.5c0 3 3.5 5.4 8 5.4s8-2.4 8-5.4"/><path d="M12 6v4"/></svg>`,
  friends: `<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 19c.6-3.2 2.5-4.8 5.5-4.8s4.9 1.6 5.5 4.8M15 15c2.8 0 4.5 1.3 5 4"/></svg>`,
  user: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.5-6 8-6s7.2 1.8 8 6"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24"><path d="M20.7 15.2A8.6 8.6 0 0 1 8.8 3.3 9 9 0 1 0 20.7 15.2Z"/></svg>`,
  flame: `<svg class="icon" viewBox="0 0 24 24"><path d="M12.5 2.5c1.1 4.8-3.6 5.7-2.2 9.3.5 1.2 1.4 1.8 2.7 1.8 2.2 0 3.6-2.1 2.7-4.4 2.8 2 4.1 4.6 3.2 7.4-.9 2.9-3.5 4.9-6.7 4.9-4.1 0-7.2-3.1-7.2-7.2 0-4.2 3.1-7.1 7.5-11.8Z"/></svg>`,
  coin: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M15 9.5c-.6-.6-1.5-1-2.6-1-1.4 0-2.4.6-2.4 1.7 0 2.8 5 1.1 5 4 0 1.1-1.1 1.8-2.6 1.8-1.2 0-2.2-.4-2.9-1.2M12.5 7v10"/></svg>`,
  heart: `<svg class="icon" viewBox="0 0 24 24"><path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z"/></svg>`,
  arrow: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  back: `<svg class="icon" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>`,
  close: `<svg class="icon" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  spark: `<svg class="icon" viewBox="0 0 24 24"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>`,
  check: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>`,
  play: `<svg class="icon" viewBox="0 0 24 24"><path d="m8 5 10 7-10 7Z"/></svg>`,
  volume: `<svg class="icon" viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
  bookmark: `<svg class="icon" viewBox="0 0 24 24"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/></svg>`,
  flag: `<svg class="icon" viewBox="0 0 24 24"><path d="M5 21V4m0 1c4-3 6 2 11-1v9c-5 3-7-2-11 1"/></svg>`,
  skip: `<svg class="icon" viewBox="0 0 24 24"><path d="m5 5 9 7-9 7V5ZM19 5v14"/></svg>`,
  auto: `<svg class="icon" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 1.1 4"/><path d="M20 4v7h-7"/></svg>`,
  info: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
  lock: `<svg class="icon" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
  share: `<svg class="icon" viewBox="0 0 24 24"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></svg>`,
  gear: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.6 1Z"/></svg>`,
  database: `<svg class="icon" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/></svg>`,
  chevron: `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>`
};

const vocab = [
  { id: "believe", word: "believe", kana: "/believe/", meaning: "を信じる", options: ["を判断する", "を信じる", "内気な、恥ずかしがりの", "救急車"] },
  { id: "consider", word: "consider", kana: "/consider/", meaning: "を見なす", options: ["を見なす", "（人）に（賞など）を授与する", "困難、苦労", "を援助する"] },
  { id: "expect", word: "expect", kana: "/expect/", meaning: "を予期する、と思う", options: ["を予期する、と思う", "最近", "控えめな", "成功する、継承する"] },
  { id: "decide", word: "decide", kana: "/decide/", meaning: "決める", options: ["を掘る", "ありそうな", "使命、任務", "決める"] },
  { id: "allow", word: "allow", kana: "/allow/", meaning: "を許す", options: ["したがって", "を許す", "（車などが通った）跡", "スタッフ、職員"] },
  { id: "remember", word: "remember", kana: "/remember/", meaning: "覚えている", options: ["（人が）自立した", "最も重要な，第一の", "覚えている", "スタッフ、職員"] },
  { id: "worry", word: "worry", kana: "/worry/", meaning: "心配する", options: ["を関連づける", "心配する", "我慢する", "優れている"] },
  { id: "concern", word: "concern", kana: "/concern/", meaning: "に関係する、を心配させる", options: ["飲み込む", "に関係する、を心配させる", "を試みる", "逃れる、脱出する、を免れる"] },
  { id: "suggest", word: "suggest", kana: "/suggest/", meaning: "を提案する", options: ["肥満", "を混同する", "を提案する", "それとなく言う"] },
  { id: "explain", word: "explain", kana: "/explain/", meaning: "説明する", options: ["願望", "説明する", "を生産する", "顧客"] },
  { id: "describe", word: "describe", kana: "/describe/", meaning: "の特徴を述べる", options: ["集める、蓄積する", "我慢する", "構造", "の特徴を述べる"] },
  { id: "improve", word: "improve", kana: "/improve/", meaning: "を改善する", options: ["人間の", "を改善する", "（料理の）材料", "死"] },
  { id: "produce", word: "produce", kana: "/produce/", meaning: "を生産する", options: ["を生産する", "を測る", "札", "したがって、その結果"] },
  { id: "create", word: "create", kana: "/create/", meaning: "を創造する", options: ["地震", "人間の", "を創造する", "を満足させる"] },
  { id: "provide", word: "provide", kana: "/provide/", meaning: "を供給する", options: ["を供給する", "悲観的な", "を調べる", "投票"] },
  { id: "increase", word: "increase", kana: "/increase/", meaning: "増える", options: ["増える", "美徳", "争い", "に補償する"] },
  { id: "grow", word: "grow", kana: "/grow/", meaning: "成長する", options: ["法廷、裁判所", "世話", "成長する", "に不満を抱かせる"] },
  { id: "develop", word: "develop", kana: "/develop/", meaning: "を開発する", options: ["産業", "使命、任務", "を開発する", "儀式"] },
  { id: "rise", word: "rise", kana: "/rise/", meaning: "上がる、昇る", options: ["流ちょうな", "上がる、昇る", "資本", "（具体）例"] },
  { id: "raise", word: "raise", kana: "/raise/", meaning: "を上げる、（子供）を育てる", options: ["を上げる、（子供）を育てる", "概念", "（社会の）慣習", "思索する"] },
  { id: "follow", word: "follow", kana: "/follow/", meaning: "次に続く、に従う", options: ["表面", "縮む", "普通の", "次に続く、に従う"] },
  { id: "require", word: "require", kana: "/require/", meaning: "を要求する", options: ["徹底的な", "を要求する", "殺害する", "資源"] },
  { id: "fill", word: "fill", kana: "/fill/", meaning: "を満たす", options: ["を満たす", "陳述", "減る", "指示"] },
  { id: "support", word: "support", kana: "/support/", meaning: "を支持する", options: ["を支持する", "無礼な", "帝国", "を巻き込む"] },
  { id: "share", word: "share", kana: "/share/", meaning: "を共同で使う", options: ["を共同で使う", "に（偶然）出会う", "よく知っている", "部門、分野"] },
  { id: "face", word: "face", kana: "/face/", meaning: "に直面する、（危険などが）の身に迫る", options: ["札", "に直面する、（危険などが）の身に迫る", "成長する", "よく知っている"] },
  { id: "touch", word: "touch", kana: "/touch/", meaning: "を感動させる", options: ["を感動させる", "儀式", "伝える", "を輸入する"] },
  { id: "store", word: "store", kana: "/store/", meaning: "を蓄える", options: ["を蓄える", "（自動車の）ハンドル", "ごみ", "を判断する"] },
  { id: "pay", word: "pay", kana: "/pay/", meaning: "（金）を支払う", options: ["離婚", "契約", "（金）を支払う", "まいらせる"] },
  { id: "deal", word: "deal", kana: "/deal/", meaning: "に対処する，を扱う", options: ["科学の", "に対処する，を扱う", "困難な", "を燃やす"] },
  { id: "save", word: "save", kana: "/save/", meaning: "（時間、金銭など）を節約する", options: ["平易な", "恐れ、予兆", "耐える", "（時間、金銭など）を節約する"] },
  { id: "happen", word: "happen", kana: "/happen/", meaning: "（事が）起こる、たまたまする", options: ["を反映する、を反射する", "（事が）起こる、たまたまする", "（具体）例", "を掘る"] },
  { id: "occur", word: "occur", kana: "/occur/", meaning: "（事が）起こる", options: ["経験する", "（事が）起こる", "後で", "範囲"] },
  { id: "work", word: "work", kana: "/work/", meaning: "機能する", options: ["機能する", "気づく", "軍（隊）の、軍事の", "災害"] },
  { id: "change", word: "change", kana: "/change/", meaning: "を変える", options: ["なまり、方言", "立ちはだかる", "を変える", "建築（学）"] },
  { id: "run", word: "run", kana: "/run/", meaning: "を経営する", options: ["従う", "を限定する", "を経営する", "叫ぶ"] },
  { id: "turn", word: "turn", kana: "/turn/", meaning: "の向きを変える", options: ["の特徴を述べる", "儀式", "要因、要素", "の向きを変える"] },
  { id: "return", word: "return", kana: "/return/", meaning: "戻る、帰る", options: ["戻る、帰る", "をありがたく思う、を正しく認証（評価）する", "策略、いたずら", "を共同で使う"] },
  { id: "stand", word: "stand", kana: "/stand/", meaning: "を我慢する", options: ["を混ぜる", "移る", "に安心させる", "を我慢する"] },
  { id: "lie", word: "lie", kana: "/lie/", meaning: "横たわる、うそをつく", options: ["を（公式に）禁止する", "低い", "生産高", "横たわる、うそをつく"] },
  { id: "brain", word: "brain", kana: "/brain/", meaning: "脳", options: ["非難する", "脳", "貢献する、を寄付する", "農業"] },
  { id: "mind", word: "mind", kana: "/mind/", meaning: "心、精神", options: ["心、精神", "感覚", "表面", "理想的な"] },
  { id: "language", word: "language", kana: "/language/", meaning: "言語", options: ["才能", "精神を集中する", "言語", "を動揺させる"] },
  { id: "thought", word: "thought", kana: "/thought/", meaning: "考え", options: ["最近", "正しい", "ウイルス", "考え"] },
  { id: "knowledge", word: "knowledge", kana: "/knowledge/", meaning: "知識", options: ["立ちはだかる", "を促進する", "知識", "評判"] },
  { id: "skill", word: "skill", kana: "/skill/", meaning: "技能、技術", options: ["威信、名声", "技能、技術", "を埋める", "を翻訳する"] },
  { id: "technology", word: "technology", kana: "/technology/", meaning: "科学技術", options: ["科学技術", "（位置、方針など）を変える", "熱望して", "世界"] },
  { id: "culture", word: "culture", kana: "/culture/", meaning: "文化", options: ["努力", "引用する", "を後悔する、を残念に思う", "文化"] },
  { id: "experience", word: "experience", kana: "/experience/", meaning: "経験", options: ["経験", "好ましくない、消極的な", "議会", "意見が合わない"] },
  { id: "result", word: "result", kana: "/result/", meaning: "結果", options: ["結果", "に到着する", "家畜", "優秀さ、長所"] },
  { id: "reason", word: "reason", kana: "/reason/", meaning: "理由", options: ["理由", "（将来の）展望", "輝く", "を裏付ける、(本当だと)確認する"] },
  { id: "cause", word: "cause", kana: "/cause/", meaning: "原因", options: ["を埋める", "連続", "（問題など）を処理する", "原因"] },
  { id: "effect", word: "effect", kana: "/effect/", meaning: "影響、効果", options: ["を選び取る、を摘む", "影響、効果", "（大きな音を立てて）衝突する", "退く"] },
  { id: "matter", word: "matter", kana: "/matter/", meaning: "問題", options: ["問題", "を当惑させる、に恥ずかしい思いをさせる", "浮かぶ", "収穫"] },
  { id: "sense", word: "sense", kana: "/sense/", meaning: "感覚", options: ["感覚", "保険", "物質", "その土地の、地元の"] },
  { id: "way", word: "way", kana: "/way/", meaning: "方法、道", options: ["方法、道", "積極的な", "をかき回す、呼び起こす", "準備する"] },
  { id: "term", word: "term", kana: "/term/", meaning: "期間、（専門）用語", options: ["境界（線）", "と述べる、言う", "期間、（専門）用語", "予期する"] },
  { id: "situation", word: "situation", kana: "/situation/", meaning: "状況", options: ["賢明な", "状況", "いらいらさせる", "貧困"] },
  { id: "condition", word: "condition", kana: "/condition/", meaning: "状態、状況", options: ["通勤[通学]する", "虫歯、衰退、荒廃", "小作農", "状態、状況"] },
  { id: "position", word: "position", kana: "/position/", meaning: "（所定の）位置、場所、立場", options: ["追いかける", "（所定の）位置、場所、立場", "を関連づける", "を混ぜる"] },
  { id: "environment", word: "environment", kana: "/environment/", meaning: "環境", options: ["環境", "夜明け", "文明", "を知覚する"] },
  { id: "nature", word: "nature", kana: "/nature/", meaning: "自然", options: ["妥協する", "異なる", "自然", "を認める"] },
  { id: "research", word: "research", kana: "/research/", meaning: "研究、調査", options: ["に出席する", "相当する", "研究、調査", "章"] },
  { id: "rule", word: "rule", kana: "/rule/", meaning: "規則", options: ["規則", "（日常の）食事", "めったに…ない", "浅い"] },
  { id: "interest", word: "interest", kana: "/interest/", meaning: "興味", options: ["興味", "借金", "内部の", "谷"] },
  { id: "value", word: "value", kana: "/value/", meaning: "価値", options: ["を裏切る、を漏らす", "価値", "満たす", "熱望して"] },
  { id: "view", word: "view", kana: "/view/", meaning: "意見", options: ["を拒む", "を延長する", "に当たる、（人）に印象を与える", "意見"] },
  { id: "sound", word: "sound", kana: "/sound/", meaning: "音", options: ["を主催する", "きちんとした", "（問題、困難、機会などが）生じる", "音"] },
  { id: "form", word: "form", kana: "/form/", meaning: "形状、（記入）用紙", options: ["形状、（記入）用紙", "危機", "分析", "研究所、実験室"] },
  { id: "case", word: "case", kana: "/case/", meaning: "場合", options: ["鉱山", "郊外", "豊富な", "場合"] },
  { id: "role", word: "role", kana: "/role/", meaning: "役割", options: ["を生産する", "影響、効果", "を痛める", "役割"] },
  { id: "age", word: "age", kana: "/age/", meaning: "年齢", options: ["世帯", "年齢", "編集者", "機能"] },
  { id: "care", word: "care", kana: "/care/", meaning: "世話", options: ["名残；（通った）跡", "普通の", "痛み、骨折り、苦労", "世話"] },
  { id: "risk", word: "risk", kana: "/risk/", meaning: "危険（性）", options: ["寛大な", "危険（性）", "（最小）単位", "を懇願する、請う"] },
  { id: "human", word: "human", kana: "/human/", meaning: "人間の", options: ["を奮起させる", "人間の", "を懇願する、請う", "活動的な"] },
  { id: "free", word: "free", kana: "/free/", meaning: "自由な", options: ["機関、制度", "技能、技術", "自由な", "兵器、武器"] },
  { id: "sure", word: "sure", kana: "/sure/", meaning: "確信して", options: ["口論", "爆発する", "確信して", "静かな"] },
  { id: "certain", word: "certain", kana: "/certain/", meaning: "確信して、ある程度の", options: ["（人）に無理やりさせる", "確信して、ある程度の", "潜在的な", "嫌悪感を持たせる"] },
  { id: "main", word: "main", kana: "/main/", meaning: "主要な", options: ["主要な", "を満足させる", "分厚い", "海軍"] },
  { id: "major", word: "major", kana: "/major/", meaning: "主要な", options: ["を（展覧会などに）展示する、（感情、兆候など）を示す", "微妙な", "おじぎする", "主要な"] },
  { id: "minor", word: "minor", kana: "/minor/", meaning: "重要でない", options: ["地域社会", "重要でない", "金額", "邪魔する"] },
  { id: "clear", word: "clear", kana: "/clear/", meaning: "明らかな", options: ["を稼ぐ", "明らかな", "相手、敵", "を弱める"] },
  { id: "likely", word: "likely", kana: "/likely/", meaning: "ありそうな", options: ["ありそうな", "分析", "自然", "害"] },
  { id: "possible", word: "possible", kana: "/possible/", meaning: "あり得る、可能な", options: ["あり得る、可能な", "一時停止する", "第一の、主要な", "好況、ブーム"] },
  { id: "similar", word: "similar", kana: "/similar/", meaning: "似ている", options: ["（対戦相手）を負かす", "反対する", "哺乳類、哺乳動物", "似ている"] },
  { id: "close", word: "close", kana: "/close/", meaning: "（ごく）近い", options: ["自慢する", "（ごく）近い", "～の味がする", "をこぼす"] },
  { id: "common", word: "common", kana: "/common/", meaning: "共通の", options: ["稲妻", "共通の", "地域社会", "使い方"] },
  { id: "general", word: "general", kana: "/general/", meaning: "一般的な", options: ["を破壊する", "完全に", "タンパク質", "一般的な"] },
  { id: "ordinary", word: "ordinary", kana: "/ordinary/", meaning: "普通の", options: ["傾向", "ユーモア", "委員会", "普通の"] },
  { id: "specific", word: "specific", kana: "/specific/", meaning: "明確な", options: ["明確な", "呼吸する", "きちんとした", "崩壊する、倒れる"] },
  { id: "particular", word: "particular", kana: "/particular/", meaning: "特別の", options: ["応答する", "典型的な", "特別の", "純粋な"] },
  { id: "individual", word: "individual", kana: "/individual/", meaning: "個人の", options: ["正方形", "個人の", "性格", "交通（量）"] },
  { id: "unique", word: "unique", kana: "/unique/", meaning: "特有の", options: ["10年間", "特有の", "候補者", "運賃"] },
  { id: "rare", word: "rare", kana: "/rare/", meaning: "珍しい、まれな", options: ["引退する", "控える", "要因、要素", "珍しい、まれな"] },
  { id: "therefore", word: "therefore", kana: "/therefore/", meaning: "したがって、その結果", options: ["ささげる", "に警告する", "したがって、その結果", "を困らせる"] },
  { id: "thus", word: "thus", kana: "/thus/", meaning: "したがって", options: ["見えること", "ローン、貸付金", "資本", "したがって"] },
  { id: "moreover", word: "moreover", kana: "/moreover/", meaning: "そのうえ、さらに", options: ["できない", "信じられない", "威信、名声", "そのうえ、さらに"] },
  { id: "furthermore", word: "furthermore", kana: "/furthermore/", meaning: "そのうえ", options: ["賢明な", "栄光", "合理的な", "そのうえ"] },
  { id: "besides", word: "besides", kana: "/besides/", meaning: "そのうえ", options: ["重大な", "を付ける、愛着を抱いている", "そのうえ", "心理学"] },
  { id: "nonetheless", word: "nonetheless", kana: "/nonetheless/", meaning: "それにもかかわらず", options: ["安全な", "を我慢する、を（心に）抱く", "湿気のある", "それにもかかわらず"] },
  { id: "notice", word: "notice", kana: "/notice/", meaning: "気づく", options: ["を創造する", "を発明する", "気づく", "に不満を抱かせる"] },
  { id: "note", word: "note", kana: "/note/", meaning: "注意する、注目する", options: ["注意する、注目する", "（広大な）地域", "を後悔する、を残念に思う", "を満足させる"] },
  { id: "discover", word: "discover", kana: "/discover/", meaning: "を発見する", options: ["（罪、過失など）を犯す、（金、人、時間など）を投入する", "を発見する", "任命する", "を満足させる"] },
  { id: "realize", word: "realize", kana: "/realize/", meaning: "（はっきりと）理解する", options: ["ごみ", "（はっきりと）理解する", "を修理する", "輝く"] },
  { id: "recognize", word: "recognize", kana: "/recognize/", meaning: "をそれとわかる", options: ["物質", "反応する", "をそれとわかる", "に乗り遅れる"] },
  { id: "encourage", word: "encourage", kana: "/encourage/", meaning: "を励ます", options: ["引退する", "を励ます", "価値", "在庫品"] },
  { id: "force", word: "force", kana: "/force/", meaning: "（人）に無理やりさせる", options: ["を開発する", "寄りかかる", "大人になった", "（人）に無理やりさせる"] },
  { id: "order", word: "order", kana: "/order/", meaning: "を注文する", options: ["を経営する", "ぎゅっとつかむ,理解する", "を注文する", "利用できる、入手できる"] },
  { id: "affect", word: "affect", kana: "/affect/", meaning: "に影響する", options: ["を主催する", "ためらう、躊躇する", "に影響する", "断固要求する"] },
  { id: "offer", word: "offer", kana: "/offer/", meaning: "（人）に（物・事）を提供する", options: ["複雑な", "（人）に（物・事）を提供する", "交換する", "を探し求める"] },
  { id: "demand", word: "demand", kana: "/demand/", meaning: "を要求する", options: ["を要求する", "抽象的な", "範囲", "と主張する"] },
  { id: "argue", word: "argue", kana: "/argue/", meaning: "と主張する", options: ["と主張する", "科学の", "気前のよい", "材料、原料"] },
  { id: "claim", word: "claim", kana: "/claim/", meaning: "を主張する", options: ["巨大な、莫大な", "犠牲", "を主張する", "現象"] },
  { id: "object", word: "object", kana: "/object/", meaning: "反対する", options: ["教授", "質", "反対する", "使い方"] },
  { id: "challenge", word: "challenge", kana: "/challenge/", meaning: "に異議を唱える", options: ["に異議を唱える", "取り扱いの難しい", "を押す", "現れる"] },
  { id: "involve", word: "involve", kana: "/involve/", meaning: "を巻き込む", options: ["海の", "引きずる", "を巻き込む", "影響、効果"] },
  { id: "include", word: "include", kana: "/include/", meaning: "を含む", options: ["を含む", "疫病", "に納得させる", "知能の高い、聡明な"] },
  { id: "contain", word: "contain", kana: "/contain/", meaning: "を含む", options: ["相互に作用する", "を含む", "病気", "（男女の）性"] },
  { id: "relate", word: "relate", kana: "/relate/", meaning: "を関連づける", options: ["を関連づける", "計り知れない", "労働", "近づく"] },
  { id: "connect", word: "connect", kana: "/connect/", meaning: "をつなぐ", options: ["を共同で使う", "をつなぐ", "目的", "（自動車の）ハンドル"] },
  { id: "refer", word: "refer", kana: "/refer/", meaning: "言及する", options: ["を追求する、（仕事など）に従事する", "元の", "言及する", "むしろ、かなり"] },
  { id: "contact", word: "contact", kana: "/contact/", meaning: "と連絡する", options: ["理解する", "を許す", "と連絡する", "異なる、多様である"] },
  { id: "compare", word: "compare", kana: "/compare/", meaning: "を比べる", options: ["を怠る", "を比べる", "品目、項目", "許可する"] },
  { id: "measure", word: "measure", kana: "/measure/", meaning: "を測る", options: ["を測る", "絶滅した", "を決定する", "に直面する、（危険などが）の身に迫る"] },
  { id: "mark", word: "mark", kana: "/mark/", meaning: "（印など）をつける", options: ["信用", "（印など）をつける", "を処分する", "範囲"] },
  { id: "approach", word: "approach", kana: "/approach/", meaning: "近づく", options: ["貢献する、を寄付する", "とてつもない", "近づく", "を雇う"] },
  { id: "reach", word: "reach", kana: "/reach/", meaning: "に到着する", options: ["（位置、方針など）を変える", "結果", "に到着する", "額縁"] },
  { id: "achieve", word: "achieve", kana: "/achieve/", meaning: "を達成する", options: ["安全な", "積極的な", "を達成する", "を意図する、つもりでいる"] },
  { id: "receive", word: "receive", kana: "/receive/", meaning: "を受け取る", options: ["（伝達などの）媒体", "を受け取る", "原則、原理", "品目、項目"] },
  { id: "complete", word: "complete", kana: "/complete/", meaning: "を完成させる", options: ["豪華な、雄大な", "を完成させる", "高価な", "革命"] },
  { id: "lead", word: "lead", kana: "/lead/", meaning: "を導く", options: ["を導く", "をうらやむ", "実際の", "収益"] },
  { id: "win", word: "win", kana: "/win/", meaning: "勝つ", options: ["（人）に（物）を貸す", "訴える", "崇拝", "勝つ"] },
  { id: "lose", word: "lose", kana: "/lose/", meaning: "を失う", options: ["相当する", "を失う", "相互の", "配達する"] },
  { id: "fail", word: "fail", kana: "/fail/", meaning: "できない", options: ["財産", "できない", "冷蔵庫", "見込み"] },
  { id: "miss", word: "miss", kana: "/miss/", meaning: "に乗り遅れる", options: ["（個人的な）習慣", "崩壊する、倒れる", "傾向", "に乗り遅れる"] },
  { id: "lack", word: "lack", kana: "/lack/", meaning: "に欠けている、が不足している", options: ["極端な", "参加する", "に欠けている、が不足している", "冷静な"] },
  { id: "reduce", word: "reduce", kana: "/reduce/", meaning: "を減らす", options: ["明らかな", "会議", "を減らす", "苦い、つらい"] },
  { id: "avoid", word: "avoid", kana: "/avoid/", meaning: "を避ける", options: ["進化する、発展する", "（人）に（物）を（求めに応じて）与える", "転がる", "を避ける"] },
  { id: "limit", word: "limit", kana: "/limit/", meaning: "を制限する", options: ["見つめる", "青白い", "革新", "を制限する"] },
  { id: "prevent", word: "prevent", kana: "/prevent/", meaning: "を妨げる", options: ["跳ぶ", "と述べる、言う", "を妨げる", "懸命の努力、奮闘"] },
  { id: "wear", word: "wear", kana: "/wear/", meaning: "を身に着けている", options: ["を明らかにする、暴露する", "困難、苦労", "を身に着けている", "害"] },
  { id: "bear", word: "bear", kana: "/bear/", meaning: "を我慢する、を（心に）抱く", options: ["次に続く、に従う", "抱きしめる", "を我慢する、を（心に）抱く", "臓器"] },
  { id: "focus", word: "focus", kana: "/focus/", meaning: "を集中させる", options: ["記憶（力）", "酸素", "を集中させる", "戦闘"] },
  { id: "author", word: "author", kana: "/author/", meaning: "著者", options: ["候補者", "賢明な", "商業的な、営利的な", "著者"] },
  { id: "professor", word: "professor", kana: "/professor/", meaning: "教授", options: ["生物（学）の", "会社", "教授", "破裂する"] },
  { id: "sentence", word: "sentence", kana: "/sentence/", meaning: "文、（宣告された）刑", options: ["文、（宣告された）刑", "(生）ごみ", "なまり、方言", "断固要求する"] },
  { id: "passage", word: "passage", kana: "/passage/", meaning: "（文章の）一節", options: ["予報", "反応する", "相反する", "（文章の）一節"] },
  { id: "message", word: "message", kana: "/message/", meaning: "伝言、メッセージ", options: ["スタッフ、職員", "徐々の", "祖先", "伝言、メッセージ"] },
  { id: "statement", word: "statement", kana: "/statement/", meaning: "陳述", options: ["概念", "を避ける", "決める", "陳述"] },
  { id: "topic", word: "topic", kana: "/topic/", meaning: "論題、話題", options: ["本物の", "宇宙", "価値のある", "論題、話題"] },
  { id: "article", word: "article", kana: "/article/", meaning: "記事", options: ["（サービスに対する）料金", "記事", "訴える", "を引きつける"] },
  { id: "issue", word: "issue", kana: "/issue/", meaning: "問題", options: ["（性質・能力など）を持っている", "問題", "（場所など）を探す、捜索する", "象徴"] },
  { id: "theory", word: "theory", kana: "/theory/", meaning: "理論", options: ["能力", "地震", "理論", "を困らせる"] },
  { id: "evidence", word: "evidence", kana: "/evidence/", meaning: "証拠", options: ["（発達、変化の）段階", "懸命の努力、奮闘", "凍る", "証拠"] },
  { id: "experiment", word: "experiment", kana: "/experiment/", meaning: "実験", options: ["（問題、困難、機会などが）生じる", "実験", "耐える", "夜明け"] },
  { id: "subject", word: "subject", kana: "/subject/", meaning: "（研究、話などの）主題", options: ["（研究、話などの）主題", "を破壊する", "（…し）たいと思う(to do)", "を持ち上げる"] },
  { id: "government", word: "government", kana: "/government/", meaning: "政府", options: ["姿を消す", "を意図する、つもりでいる", "意見", "政府"] },
  { id: "policy", word: "policy", kana: "/policy/", meaning: "政策、方針", options: ["明確な", "を（事実と）認める", "政策、方針", "（人）に（物・事）を提供する"] },
  { id: "education", word: "education", kana: "/education/", meaning: "教育", options: ["宝物", "（切り抜けて）生き残る", "形状、（記入）用紙", "教育"] },
  { id: "company", word: "company", kana: "/company/", meaning: "会社", options: ["姿を消す", "を産出する、（利益など）を生む、屈する", "時代", "会社"] },
  { id: "colleague", word: "colleague", kana: "/colleague/", meaning: "同僚", options: ["を生産する", "（国家などの）経済", "同僚", "に異議を唱える"] },
  { id: "industry", word: "industry", kana: "/industry/", meaning: "産業", options: ["できない", "覚えている", "開花する", "産業"] },
  { id: "trade", word: "trade", kana: "/trade/", meaning: "貿易", options: ["儀式", "を雇う", "貿易", "と連絡する"] },
  { id: "economy", word: "economy", kana: "/economy/", meaning: "（国家などの）経済", options: ["尊敬する", "（国家などの）経済", "記事", "空いている"] },
  { id: "customer", word: "customer", kana: "/customer/", meaning: "顧客", options: ["原子", "を賃借りする", "顧客", "を設計する"] },
  { id: "benefit", word: "benefit", kana: "/benefit/", meaning: "（物質的、精神的）利益", options: ["研究、調査", "を区別する", "を宣伝する", "（物質的、精神的）利益"] },
  { id: "figure", word: "figure", kana: "/figure/", meaning: "図", options: ["連続、（連続するものの）順番", "図", "避難（所）", "前の"] },
  { id: "rate", word: "rate", kana: "/rate/", meaning: "比率", options: ["症状", "（仕事など）を割り当てる", "比率", "時代"] },
  { id: "chance", word: "chance", kana: "/chance/", meaning: "見込み", options: ["ひも、糸", "を励ます", "見込み", "恐れ、予兆"] },
  { id: "opportunity", word: "opportunity", kana: "/opportunity/", meaning: "機会", options: ["を掘る", "のほうを好む", "好ましくない、消極的な", "機会"] },
  { id: "project", word: "project", kana: "/project/", meaning: "事業", options: ["穀物", "章", "事業", "に反対する"] },
  { id: "practice", word: "practice", kana: "/practice/", meaning: "練習", options: ["目的地", "練習", "を得る", "結局（は）"] },
  { id: "effort", word: "effort", kana: "/effort/", meaning: "努力", options: ["を比べる", "つかむ", "努力", "期間"] },
  { id: "quality", word: "quality", kana: "/quality/", meaning: "質", options: ["質", "を調べる", "を（場所に）置く", "ちらりと見る"] },
  { id: "quantity", word: "quantity", kana: "/quantity/", meaning: "量", options: ["量", "楽しみ、おもしろいこと（人）", "をこぼす", "許可する"] },
  { id: "amount", word: "amount", kana: "/amount/", meaning: "金額", options: ["を分離する", "哲学", "金額", "参加する"] },
  { id: "scientific", word: "scientific", kana: "/scientific/", meaning: "科学の", options: ["ひどい", "科学の", "単に", "不足"] },
  { id: "political", word: "political", kana: "/political/", meaning: "政治の", options: ["好む", "政治の", "栄える", "地域社会"] },
  { id: "social", word: "social", kana: "/social/", meaning: "社会の", options: ["を疑わしいと思う、ではないと思う", "気が進まない", "気にかけない", "社会の"] },
  { id: "official", word: "official", kana: "/official/", meaning: "公式の", options: ["ありそうな", "仕組み", "漠然とした", "公式の"] },
  { id: "financial", word: "financial", kana: "/financial/", meaning: "財政（上）の", options: ["を裏切る、を漏らす", "を観察する", "財政（上）の", "仮説"] },
  { id: "expensive", word: "expensive", kana: "/expensive/", meaning: "高価な", options: ["影響", "高価な", "（人）に無理やりさせる", "実験"] },
  { id: "various", word: "various", kana: "/various/", meaning: "さまざまな", options: ["を経営する", "さまざまな", "を（引っ張って）伸ばす、広げる", "被害者、犠牲者"] },
  { id: "normal", word: "normal", kana: "/normal/", meaning: "普通の", options: ["（涙）を流す", "を定義する", "普通の", "をありがたく思う、を正しく認証（評価）する"] },
  { id: "familiar", word: "familiar", kana: "/familiar/", meaning: "よく知っている", options: ["よく知っている", "を褒める", "優れている", "領土"] },
  { id: "appropriate", word: "appropriate", kana: "/appropriate/", meaning: "適切な", options: ["微小な", "適切な", "特典、特権", "（物事の）側面"] },
  { id: "necessary", word: "necessary", kana: "/necessary/", meaning: "必要な", options: ["締め出す", "必要な", "（罪、過失など）を犯す、（金、人、時間など）を投入する", "宝物"] },
  { id: "correct", word: "correct", kana: "/correct/", meaning: "正しい", options: ["許可する", "形状、（記入）用紙", "正しい", "を雇用する、を（手段などに）用いる"] },
  { id: "available", word: "available", kana: "/available/", meaning: "利用できる、入手できる", options: ["財政（上）の", "分割する", "を設立する", "利用できる、入手できる"] },
  { id: "typical", word: "typical", kana: "/typical/", meaning: "典型的な", options: ["典型的な", "を（～のことで）責める(for)、を（～の）せいにする(on)", "知識", "無罪の"] },
  { id: "positive", word: "positive", kana: "/positive/", meaning: "積極的な", options: ["積極的な", "飲み込む", "と述べる、言う", "を意図する、つもりでいる"] },
  { id: "negative", word: "negative", kana: "/negative/", meaning: "好ましくない、消極的な", options: ["を表現する", "好ましくない、消極的な", "を輸送する", "投げかける"] },
  { id: "passive", word: "passive", kana: "/passive/", meaning: "受動的な", options: ["救急車", "～媒介で", "受動的な", "（将来の）展望"] },
  { id: "physical", word: "physical", kana: "/physical/", meaning: "身体の", options: ["を明らかにする、暴露する", "好奇心の強い", "たとえ何を…しても、たとえ何が…であろうと", "身体の"] },
  { id: "mental", word: "mental", kana: "/mental/", meaning: "精神の", options: ["精神の", "を維持する、を主張する", "辞める", "（人）に（物）を（求めに応じて）与える"] },
  { id: "rather", word: "rather", kana: "/rather/", meaning: "むしろ、かなり", options: ["極めて重要な", "危険（性）", "むしろ、かなり", "を（展覧会などに）展示する、（感情、兆候など）を示す"] },
  { id: "instead", word: "instead", kana: "/instead/", meaning: "その代わりに", options: ["帝国", "原子力の、核の", "死", "その代わりに"] },
  { id: "otherwise", word: "otherwise", kana: "/otherwise/", meaning: "そうでなければ、それ以外は", options: ["巨大な、莫大な", "道（筋）", "を解釈する", "そうでなければ、それ以外は"] },
  { id: "somehow", word: "somehow", kana: "/somehow/", meaning: "どうにかして", options: ["期間", "を怒らせる", "死", "どうにかして"] },
  { id: "somewhat", word: "somewhat", kana: "/somewhat/", meaning: "いくぶん", options: ["いくぶん", "疲労", "冷静な", "困難、苦労"] },
  { id: "wonder", word: "wonder", kana: "/wonder/", meaning: "と思う", options: ["をありがたく思う、を正しく認証（評価）する", "を減らす", "を調節する", "と思う"] },
  { id: "suppose", word: "suppose", kana: "/suppose/", meaning: "（たぶん）と思う、もしならば", options: ["を主張する", "内気な、恥ずかしがりの", "（たぶん）と思う、もしならば", "（ワールドワイド）ウェブ"] },
  { id: "imagine", word: "imagine", kana: "/imagine/", meaning: "を想像する", options: ["を想像する", "調和する", "異なる、多様である", "を命ずる"] },
  { id: "regard", word: "regard", kana: "/regard/", meaning: "を見なす", options: ["振る舞う", "を見なす", "抗議する", "目の見えない"] },
  { id: "wish", word: "wish", kana: "/wish/", meaning: "と思う", options: ["を産出する、（利益など）を生む、屈する", "と思う", "を集める、拾い集める", "初期の"] },
  { id: "determine", word: "determine", kana: "/determine/", meaning: "を決定する", options: ["を決定する", "温暖な", "断固要求する", "（主に人文系の）学者"] },
  { id: "express", word: "express", kana: "/express/", meaning: "を表現する", options: ["を埋める", "会議", "を表現する", "形、体調"] },
  { id: "represent", word: "represent", kana: "/represent/", meaning: "を象徴する、を代表する", options: ["（仕事など）を割り当てる", "縮む", "明確な", "を象徴する、を代表する"] },
  { id: "identify", word: "identify", kana: "/identify/", meaning: "を特定する", options: ["増える", "を限定する", "非難する", "を特定する"] },
  { id: "mention", word: "mention", kana: "/mention/", meaning: "に言及する", options: ["に言及する", "を操作する、手術を行う", "逃れる、脱出する、を免れる", "応答する"] },
  { id: "solve", word: "solve", kana: "/solve/", meaning: "を解決する", options: ["を治す", "生産高", "動機", "を解決する"] },
  { id: "prove", word: "prove", kana: "/prove/", meaning: "を証明する", options: ["に入る", "を証明する", "期間", "（語）をつづる"] },
  { id: "communicate", word: "communicate", kana: "/communicate/", meaning: "意思を通じ合う", options: ["要素", "意思を通じ合う", "困難な", "筋肉"] },
  { id: "respect", word: "respect", kana: "/respect/", meaning: "を尊敬する", options: ["材料、原料", "を思い出す", "帝国", "を尊敬する"] },
  { id: "prefer", word: "prefer", kana: "/prefer/", meaning: "のほうを好む", options: ["続く", "血行、発行部数", "を認める", "のほうを好む"] },
  { id: "design", word: "design", kana: "/design/", meaning: "を設計する", options: ["を決定する", "（問題）に取り組む、（人）に演説する", "予定で、締め切りの", "を設計する"] },
  { id: "establish", word: "establish", kana: "/establish/", meaning: "を設立する", options: ["を設立する", "に思い出させる", "部分、（食べ物の）一人前", "活動的な"] },
  { id: "found", word: "found", kana: "/found/", meaning: "を設立する", options: ["土壌、土", "を設立する", "概念", "（景色、事件などの）背景"] },
  { id: "publish", word: "publish", kana: "/publish/", meaning: "を出版する", options: ["を出版する", "を成し遂げる", "音", "即時の"] },
  { id: "serve", word: "serve", kana: "/serve/", meaning: "役に立つ", options: ["に安心させる", "を取り去る", "高齢者の、（地位などが）上級の", "役に立つ"] },
  { id: "supply", word: "supply", kana: "/supply/", meaning: "を供給する", options: ["と主張する", "を供給する", "見つめる", "目標"] },
  { id: "apply", word: "apply", kana: "/apply/", meaning: "申し込む、を適用する", options: ["申し込む、を適用する", "恐れて", "重要でない", "男の"] },
  { id: "treat", word: "treat", kana: "/treat/", meaning: "を扱う、を治療する", options: ["革命", "分割する", "を扱う、を治療する", "構造"] },
  { id: "search", word: "search", kana: "/search/", meaning: "（場所など）を探す、捜索する", options: ["札", "を持ち上げる", "（場所など）を探す、捜索する", "争い"] },
  { id: "prepare", word: "prepare", kana: "/prepare/", meaning: "準備する", options: ["～のにおいがする", "準備する", "予定で、締め切りの", "燃料"] },
  { id: "protect", word: "protect", kana: "/protect/", meaning: "を保護する", options: ["高貴な", "故意の", "を保護する", "を生産する"] },
  { id: "pick", word: "pick", kana: "/pick/", meaning: "を選び取る、を摘む", options: ["を選び取る、を摘む", "最も重要な", "計画", "帝国"] },
  { id: "fit", word: "fit", kana: "/fit/", meaning: "ピッタリ合う、うまく合う", options: ["遺伝子", "すぐ近くの", "ピッタリ合う、うまく合う", "を反映する、を反射する"] },
  { id: "gain", word: "gain", kana: "/gain/", meaning: "を（努力して）手に入れる", options: ["を（努力して）手に入れる", "犯罪", "をかく", "王室の"] },
  { id: "enter", word: "enter", kana: "/enter/", meaning: "に入る", options: ["年配の", "を非難する", "固体の、しっかりした", "に入る"] },
  { id: "spread", word: "spread", kana: "/spread/", meaning: "広がる", options: ["広がる", "振る舞う", "残り、息", "崇拝"] },
  { id: "advance", word: "advance", kana: "/advance/", meaning: "前進する", options: ["興味", "前進する", "覚えている", "を退屈させる"] },
  { id: "tend", word: "tend", kana: "/tend/", meaning: "傾向がある", options: ["国民", "をまねる", "傾向がある", "世話"] },
  { id: "depend", word: "depend", kana: "/depend/", meaning: "依存する", options: ["依存する", "に補償する", "個人的な", "熱中して"] },
  { id: "exist", word: "exist", kana: "/exist/", meaning: "存在する", options: ["（日常の）食事", "存在する", "自分勝手な", "を大目に見る、の言い訳をする"] },
  { id: "decline", word: "decline", kana: "/decline/", meaning: "減る、衰える", options: ["減る、衰える", "嫉妬深い", "を燃やす", "商業的な、営利的な"] },
  { id: "decrease", word: "decrease", kana: "/decrease/", meaning: "減る", options: ["を繁殖させる、飼育する、（動物が）子を産む", "を押す", "浅い", "減る"] },
  { id: "waste", word: "waste", kana: "/waste/", meaning: "を浪費する", options: ["哺乳類、哺乳動物", "人口", "差別", "を浪費する"] },
  { id: "damage", word: "damage", kana: "/damage/", meaning: "（物、体の一部）に損害を与える", options: ["を許す", "（物、体の一部）に損害を与える", "分割する", "国内の"] },
  { id: "suffer", word: "suffer", kana: "/suffer/", meaning: "苦しむ", options: ["流ちょうな", "苦しむ", "研究所、実験室", "をかく"] },
  { id: "act", word: "act", kana: "/act/", meaning: "行動する", options: ["質", "異なる、多様である", "したがって", "行動する"] },
  { id: "perform", word: "perform", kana: "/perform/", meaning: "を行う", options: ["予定で、締め切りの", "世話", "を行う", "を染める"] },
  { id: "species", word: "species", kana: "/species/", meaning: "（生物の）種", options: ["結合する", "（生物の）種", "故意の", "従来の、ありきたりの"] },
  { id: "variety", word: "variety", kana: "/variety/", meaning: "多様（性）", options: ["多様（性）", "を始める", "心配して、切望して", "絶滅した"] },
  { id: "degree", word: "degree", kana: "/degree/", meaning: "程度", options: ["程度", "提出する", "バイリンガルの，2言語を話す", "短時間の"] },
  { id: "range", word: "range", kana: "/range/", meaning: "範囲", options: ["を動揺させる", "領土", "上がる、昇る", "範囲"] },
  { id: "standard", word: "standard", kana: "/standard/", meaning: "水準、基準", options: ["調和する", "に不満を抱かせる", "水準、基準", "たとえ何を…しても、たとえ何が…であろうと"] },
  { id: "medium", word: "medium", kana: "/medium/", meaning: "（伝達などの）媒体", options: ["相互の", "物質", "（外国からの）移住", "（伝達などの）媒体"] },
  { id: "advantage", word: "advantage", kana: "/advantage/", meaning: "有利な点", options: ["わくわくさせる", "筋肉", "有利な点", "ちらりと見えること"] },
  { id: "task", word: "task", kana: "/task/", meaning: "（課された）任務、仕事", options: ["問題", "（人）に（物・事）を提供する", "（課された）任務、仕事", "自然"] },
  { id: "rest", word: "rest", kana: "/rest/", meaning: "残り、息", options: ["残り、息", "従来の、ありきたりの", "（うまく）対処する", "（事が）起こる"] },
  { id: "purpose", word: "purpose", kana: "/purpose/", meaning: "目的", options: ["災害", "目的", "多様性", "地震"] },
  { id: "feature", word: "feature", kana: "/feature/", meaning: "特徴", options: ["第一の、主要な", "特徴", "古代の", "を思い出す"] },
  { id: "factor", word: "factor", kana: "/factor/", meaning: "要因、要素", options: ["要因、要素", "笑わせる", "を発見する", "装備する"] },
  { id: "shape", word: "shape", kana: "/shape/", meaning: "形、体調", options: ["を編む", "政治の", "形、体調", "敵"] },
  { id: "image", word: "image", kana: "/image/", meaning: "イメージ、印象", options: ["緊急（事態）", "青白い", "イメージ、印象", "ささやく"] },
  { id: "detail", word: "detail", kana: "/detail/", meaning: "詳細（な情報）", options: ["着実な", "詳細（な情報）", "広大な", "建築（学）"] },
  { id: "character", word: "character", kana: "/character/", meaning: "性格", options: ["泥棒", "見込み", "性格", "場合、時"] },
  { id: "function", word: "function", kana: "/function/", meaning: "機能", options: ["（事が）起こる、たまたまする", "を邪魔する", "機能", "うなずく"] },
  { id: "structure", word: "structure", kana: "/structure/", meaning: "構造", options: ["構造", "困難", "謝る", "やせた"] },
  { id: "ground", word: "ground", kana: "/ground/", meaning: "地上", options: ["地上", "のほうを好む", "極(地)", "をなんとかやり遂げる、をうまく扱う"] },
  { id: "influence", word: "influence", kana: "/influence/", meaning: "影響", options: ["影響", "を魅了する", "流ちょうな", "疲れ果てた"] },
  { id: "disease", word: "disease", kana: "/disease/", meaning: "病気", options: ["病気", "（精神的）負担、重荷", "要因、要素", "期間、（専門）用語"] },
  { id: "pain", word: "pain", kana: "/pain/", meaning: "痛み、骨折り、苦労", options: ["正方形", "痛み、骨折り、苦労", "銀河", "（人が）自立した"] },
  { id: "medicine", word: "medicine", kana: "/medicine/", meaning: "薬", options: ["をかく", "夜明け", "に納得させる", "薬"] },
  { id: "death", word: "death", kana: "/death/", meaning: "死", options: ["臓器", "余暇", "奪う", "死"] },
  { id: "fear", word: "fear", kana: "/fear/", meaning: "恐怖（心）", options: ["微小な", "に知らせる", "恐怖（心）", "違反する"] },
  { id: "memory", word: "memory", kana: "/memory/", meaning: "記憶（力）", options: ["記憶（力）", "原子", "安全な", "情熱"] },
  { id: "emotion", word: "emotion", kana: "/emotion/", meaning: "（喜怒哀楽の）感情", options: ["を征服する", "収益", "民主主義", "（喜怒哀楽の）感情"] },
  { id: "movement", word: "movement", kana: "/movement/", meaning: "（政治的な）運動", options: ["（政治的な）運動", "（痛みなどが）ひどい、厳しい", "源", "を説得する"] },
  { id: "region", word: "region", kana: "/region/", meaning: "（広大な）地域", options: ["を計算する", "ボランティア", "公正な、(数量などが)かなりの", "（広大な）地域"] },
  { id: "climate", word: "climate", kana: "/climate/", meaning: "（長期的な）気候", options: ["を治す、癒す", "口論", "（長期的な）気候", "同時に起こる"] },
  { id: "temperature", word: "temperature", kana: "/temperature/", meaning: "体温", options: ["を限定する", "を盗む", "（…に）順応する(to)", "体温"] },
  { id: "community", word: "community", kana: "/community/", meaning: "地域社会", options: ["遠く離れた", "心配する", "転がる", "地域社会"] },
  { id: "population", word: "population", kana: "/population/", meaning: "人口", options: ["に到着する", "言語", "前の", "人口"] },
  { id: "generation", word: "generation", kana: "/generation/", meaning: "世代", options: ["世代", "多くの(部分から成る)", "中心的な", "恐れて"] },
  { id: "present", word: "present", kana: "/present/", meaning: "出席している、現在の", options: ["出席している、現在の", "提出する", "個人的な", "名残；（通った）跡"] },
  { id: "recent", word: "recent", kana: "/recent/", meaning: "最近の", options: ["を追求する、（仕事など）に従事する", "海軍", "最近の", "広範囲にわたる"] },
  { id: "current", word: "current", kana: "/current/", meaning: "現在の", options: ["状況", "振る舞う", "から?奪する、取り去る", "現在の"] },
  { id: "ancient", word: "ancient", kana: "/ancient/", meaning: "古代の", options: ["生の", "爆発する", "古代の", "に知らせる"] },
  { id: "previous", word: "previous", kana: "/previous/", meaning: "前の", options: ["時代", "凍る", "前の", "成長する"] },
  { id: "serious", word: "serious", kana: "/serious/", meaning: "真剣な", options: ["真剣な", "を主張する", "耳が聞こえない", "を閉める"] },
  { id: "careful", word: "careful", kana: "/careful/", meaning: "注意深い", options: ["注意深い", "地理、地理学", "考え", "化石"] },
  { id: "responsible", word: "responsible", kana: "/responsible/", meaning: "責任がある", options: ["根本的な", "責任がある", "請求書、勘定（書）", "伝染病"] },
  { id: "active", word: "active", kana: "/active/", meaning: "活動的な", options: ["伝達経路", "を設計する", "決める", "活動的な"] },
  { id: "afraid", word: "afraid", kana: "/afraid/", meaning: "恐れて", options: ["谷", "恐れて", "耳が聞こえない", "を切り離す"] },
  { id: "aware", word: "aware", kana: "/aware/", meaning: "気づいて", options: ["気づいて", "タンパク質", "に当たる、（人）に印象を与える", "正義"] },
  { id: "patient", word: "patient", kana: "/patient/", meaning: "我慢強い", options: ["相反する", "に不満を抱かせる", "地域社会", "我慢強い"] },
  { id: "whole", word: "whole", kana: "/whole/", meaning: "全体の", options: ["繁盛する；繁殖する", "全体の", "好奇心の強い", "恥じて"] },
  { id: "low", word: "low", kana: "/low/", meaning: "低い", options: ["を設計する", "低い", "優しい", "見たところ"] },
  { id: "huge", word: "huge", kana: "/huge/", meaning: "巨大な", options: ["を怠る", "巨大な", "政策、方針", "準備する"] },
  { id: "blank", word: "blank", kana: "/blank/", meaning: "空白の", options: ["空白の", "を（引っ張って）伸ばす、広げる", "谷", "を否定する"] },
  { id: "central", word: "central", kana: "/central/", meaning: "中心的な", options: ["を征服する", "密集した", "を掛ける", "中心的な"] },
  { id: "safe", word: "safe", kana: "/safe/", meaning: "安全な", options: ["をさらす", "不利（な点）", "安全な", "すばらしい"] },
  { id: "wild", word: "wild", kana: "/wild/", meaning: "野生の", options: ["（結果）を（～の）せい[おかげ]と考える(on)", "楽しませる", "哲学", "野生の"] },
  { id: "eventually", word: "eventually", kana: "/eventually/", meaning: "結局（は）", options: ["古代の", "残念なこと", "結局（は）", "に出席する"] },
  { id: "unfortunately", word: "unfortunately", kana: "/unfortunately/", meaning: "残念なことに", options: ["を象徴する、を代表する", "利用する", "銀河", "残念なことに"] },
  { id: "seemingly", word: "seemingly", kana: "/seemingly/", meaning: "見たところ", options: ["絶滅した", "（専門的な）職業", "見たところ", "代わりに使う"] },
  { id: "afterward", word: "afterward", kana: "/afterward/", meaning: "後で", options: ["後で", "内気な、恥ずかしがりの", "努力", "筋肉"] },
  { id: "altogether", word: "altogether", kana: "/altogether/", meaning: "完全に", options: ["を満たす", "化学の", "完全に", "巨大な"] },
  { id: "assume", word: "assume", kana: "/assume/", meaning: "当然と思う", options: ["基本の", "当然と思う", "（景色、事件などの）背景", "基準"] },
  { id: "guess", word: "guess", kana: "/guess/", meaning: "と思う", options: ["を消費する", "と思う", "離婚", "流ちょうな"] },
  { id: "associate", word: "associate", kana: "/associate/", meaning: "から連想する", options: ["卒業する", "量", "崩壊する、倒れる", "から連想する"] },
  { id: "desire", word: "desire", kana: "/desire/", meaning: "を強く望む", options: ["依存する", "教育", "を強く望む", "遅れ"] },
  { id: "indicate", word: "indicate", kana: "/indicate/", meaning: "を示す", options: ["借金", "現代の", "を示す", "明確な"] },
  { id: "respond", word: "respond", kana: "/respond/", meaning: "応答する", options: ["障害（物）", "熱", "応答する", "を占める、を占領する"] },
  { id: "reply", word: "reply", kana: "/reply/", meaning: "返事を出す", options: ["汗", "性格", "ぜいたく（品）", "返事を出す"] },
  { id: "attempt", word: "attempt", kana: "/attempt/", meaning: "を試みる", options: ["暴力的な", "を試みる", "経験", "に入る"] },
  { id: "manage", word: "manage", kana: "/manage/", meaning: "をなんとかやり遂げる、をうまく扱う", options: ["をなんとかやり遂げる、をうまく扱う", "を引き裂く", "選挙", "余分の"] },
  { id: "maintain", word: "maintain", kana: "/maintain/", meaning: "を維持する、を主張する", options: ["不足", "（喜怒哀楽の）感情", "を維持する、を主張する", "王室の"] },
  { id: "unite", word: "unite", kana: "/unite/", meaning: "結合する", options: ["不平を言う", "を破壊する", "結合する", "並外れた"] },
  { id: "join", word: "join", kana: "/join/", meaning: "（会、団体、人）に加わる", options: ["（会、団体、人）に加わる", "緩い", "災害", "を要求する"] },
  { id: "attract", word: "attract", kana: "/attract/", meaning: "を引きつける", options: ["汗", "を引きつける", "方法、行儀、作法", "要素"] },
  { id: "match", word: "match", kana: "/match/", meaning: "調和する", options: ["ささやく", "に安心させる", "調和する", "機能する"] },
  { id: "attack", word: "attack", kana: "/attack/", meaning: "を襲う、攻撃する", options: ["さまざまな", "に入る", "（…に）順応する(to)", "を襲う、攻撃する"] },
  { id: "seek", word: "seek", kana: "/seek/", meaning: "を探し求める", options: ["を侵略する、に侵攻する", "を探し求める", "めったに…ない", "を認める"] },
  { id: "engage", word: "engage", kana: "/engage/", meaning: "従事する、を引き入れる", options: ["酸素", "源", "従事する、を引き入れる", "国民"] },
  { id: "succeed", word: "succeed", kana: "/succeed/", meaning: "成功する、継承する", options: ["を拡大する", "必要な", "成功する、継承する", "知識"] },
  { id: "marry", word: "marry", kana: "/marry/", meaning: "と結婚する", options: ["と結婚する", "徹底的な", "環境", "一致する、（手紙などで）連絡を取り合う"] },
  { id: "attend", word: "attend", kana: "/attend/", meaning: "に出席する", options: ["に出席する", "を発表する", "最近", "最近の"] },
  { id: "satisfy", word: "satisfy", kana: "/satisfy/", meaning: "を満足させる", options: ["投資する", "大臣", "を満足させる", "を思い出す"] },
  { id: "survive", word: "survive", kana: "/survive/", meaning: "（切り抜けて）生き残る", options: ["うなずく", "疫病", "（切り抜けて）生き残る", "願望"] },
  { id: "promote", word: "promote", kana: "/promote/", meaning: "を促進する", options: ["を促進する", "をかく", "頼る", "仮説"] },
  { id: "earn", word: "earn", kana: "/earn/", meaning: "を稼ぐ", options: ["（ワールドワイド）ウェブ", "を稼ぐ", "を（滅亡の）危険にさらす", "を当惑させる"] },
  { id: "feed", word: "feed", kana: "/feed/", meaning: "に食べ物を与える", options: ["当然と思う", "を決定する", "に食べ物を与える", "それにもかかわらず"] },
  { id: "taste", word: "taste", kana: "/taste/", meaning: "～の味がする", options: ["地域社会", "ささげる", "～の味がする", "を雇う"] },
  { id: "smell", word: "smell", kana: "/smell/", meaning: "～のにおいがする", options: ["を疑わしいと思う、ではないと思う", "を引き裂く", "部分、（食べ物の）一人前", "～のにおいがする"] },
  { id: "adapt", word: "adapt", kana: "/adapt/", meaning: "（…に）順応する(to)", options: ["（…に）順応する(to)", "障害（物）", "を約束する", "起源"] },
  { id: "adopt", word: "adopt", kana: "/adopt/", meaning: "（考え、方針）を採用する", options: ["（考え、方針）を採用する", "（…に）順応する(to)", "を減らす", "争い"] },
  { id: "adjust", word: "adjust", kana: "/adjust/", meaning: "を調節する", options: ["に祝いの言葉を述べる", "守る", "を尊敬する", "を調節する"] },
  { id: "separate", word: "separate", kana: "/separate/", meaning: "を分離する", options: ["目標", "を分離する", "（罪、過失など）を犯す、（金、人、時間など）を投入する", "進歩"] },
  { id: "exchange", word: "exchange", kana: "/exchange/", meaning: "交換する", options: ["交換する", "を約束する", "そのうえ", "式典、儀式"] },
  { id: "replace", word: "replace", kana: "/replace/", meaning: "を取り替える", options: ["構成する", "材料、原料", "を身に着けている", "を取り替える"] },
  { id: "remove", word: "remove", kana: "/remove/", meaning: "を取り去る", options: ["を取り去る", "関係のある", "道具、機器", "承諾、同意"] },
  { id: "release", word: "release", kana: "/release/", meaning: "（ガスなど）を放出する", options: ["性格", "を修理する", "（ガスなど）を放出する", "目に見える"] },
  { id: "disappear", word: "disappear", kana: "/disappear/", meaning: "姿を消す", options: ["航海", "裸の", "と述べる、言う", "姿を消す"] },
  { id: "observe", word: "observe", kana: "/observe/", meaning: "を観察する", options: ["訴える", "を予約する", "を観察する", "を改善する"] },
  { id: "estimate", word: "estimate", kana: "/estimate/", meaning: "と推定する", options: ["浮かぶ", "泥棒", "委員会", "と推定する"] },
  { id: "reveal", word: "reveal", kana: "/reveal/", meaning: "を明らかにする、暴露する", options: ["有能な", "を明らかにする、暴露する", "凍る", "を予期する、と思う"] },
  { id: "emerge", word: "emerge", kana: "/emerge/", meaning: "現れる", options: ["相続する", "現れる", "即時の", "の向きを変える"] },
  { id: "arise", word: "arise", kana: "/arise/", meaning: "（問題、困難、機会などが）生じる", options: ["（切り抜けて）生き残る", "動機", "（問題、困難、機会などが）生じる", "を我慢する"] },
  { id: "citizen", word: "citizen", kana: "/citizen/", meaning: "国民", options: ["（事が）起こる、たまたまする", "超える", "個人的な", "国民"] },
  { id: "career", word: "career", kana: "/career/", meaning: "経歴", options: ["のほうを好む", "民族の、人種の", "経歴", "成る、（本質が）ある"] },
  { id: "income", word: "income", kana: "/income/", meaning: "（定期）収入", options: ["増える", "心理学", "静かな", "（定期）収入"] },
  { id: "billion", word: "billion", kana: "/billion/", meaning: "10億", options: ["（総）量、体積、容積", "を蓄える", "10億", "を征服する"] },
  { id: "bill", word: "bill", kana: "/bill/", meaning: "請求書、勘定（書）", options: ["請求書、勘定（書）", "資本", "陪審", "頼る"] },
  { id: "charge", word: "charge", kana: "/charge/", meaning: "（サービスに対する）料金", options: ["（サービスに対する）料金", "を埋める", "深い悲しみ", "を禁止する"] },
  { id: "item", word: "item", kana: "/item/", meaning: "品目、項目", options: ["延期する", "軽くたたく", "資本", "品目、項目"] },
  { id: "scale", word: "scale", kana: "/scale/", meaning: "規模", options: ["液体", "規模", "（考え、方針）を採用する", "を要求する"] },
  { id: "site", word: "site", kana: "/site/", meaning: "場所、用地", options: ["熱帯（地方）の", "引用する", "相互の", "場所、用地"] },
  { id: "section", word: "section", kana: "/section/", meaning: "部分", options: ["を雇用する、を（手段などに）用いる", "に安心させる", "をかき回す、呼び起こす", "部分"] },
  { id: "crop", word: "crop", kana: "/crop/", meaning: "（農）作物", options: ["を失望させる", "中立の", "（農）作物", "伝記"] },
  { id: "diet", word: "diet", kana: "/diet/", meaning: "（日常の）食事", options: ["科学技術", "引用する", "（日常の）食事", "計画"] },
  { id: "source", word: "source", kana: "/source/", meaning: "源", options: ["（人）を手伝う", "移る", "源", "をなんとかやり遂げる、をうまく扱う"] },
  { id: "resource", word: "resource", kana: "/resource/", meaning: "資源", options: ["資源", "を注文する", "貢献する、を寄付する", "影響、効果"] },
  { id: "moment", word: "moment", kana: "/moment/", meaning: "瞬間", options: ["を引きつける", "瞬間", "伝記", "（自動車の）ハンドル"] },
  { id: "decade", word: "decade", kana: "/decade/", meaning: "10年間", options: ["10年間", "を保証する、確約する", "見つめる", "仮想の"] },
  { id: "stage", word: "stage", kana: "/stage/", meaning: "（発達、変化の）段階", options: ["（発達、変化の）段階", "と連絡する", "確固とした", "提出する"] },
  { id: "aspect", word: "aspect", kana: "/aspect/", meaning: "（物事の）側面", options: ["哲学", "を取り替える", "（物事の）側面", "金額"] },
  { id: "sort", word: "sort", kana: "/sort/", meaning: "種類", options: ["要因、要素", "特別の", "種類", "儀式"] },
  { id: "instance", word: "instance", kana: "/instance/", meaning: "（具体）例", options: ["（具体）例", "海軍", "個人的な", "非難する"] },
  { id: "link", word: "link", kana: "/link/", meaning: "関連、つながり", options: ["関連、つながり", "不足", "許可する", "知識"] },
  { id: "contrast", word: "contrast", kana: "/contrast/", meaning: "対照", options: ["を捨てる", "対照", "出席している、現在の", "能力"] },
  { id: "access", word: "access", kana: "/access/", meaning: "利用、入手", options: ["法律（上）の", "精神を集中する", "王室の", "利用、入手"] },
  { id: "device", word: "device", kana: "/device/", meaning: "装置", options: ["に値する", "装置", "を救う", "分析"] },
  { id: "survey", word: "survey", kana: "/survey/", meaning: "（アンケートによる意識などの）調査", options: ["（アンケートによる意識などの）調査", "むしろ、かなり", "自殺", "ぶらつく，歩き回る"] },
  { id: "technique", word: "technique", kana: "/technique/", meaning: "技術", options: ["技術", "使い方", "に欠けている、が不足している", "相反する"] },
  { id: "content", word: "content", kana: "/content/", meaning: "中身", options: ["に賛成する、を好む", "中身", "墓", "をさらす"] },
  { id: "surface", word: "surface", kana: "/surface/", meaning: "表面", options: ["（熱で）溶ける", "を弱める", "着実な", "表面"] },
  { id: "concept", word: "concept", kana: "/concept/", meaning: "概念", options: ["概念", "郊外", "形状、（記入）用紙", "を強くする"] },
  { id: "difficulty", word: "difficulty", kana: "/difficulty/", meaning: "困難、苦労", options: ["困難、苦労", "消え失せる", "奇妙な", "を測る"] },
  { id: "trouble", word: "trouble", kana: "/trouble/", meaning: "困難", options: ["を設立する", "困難", "郊外", "離婚"] },
  { id: "crime", word: "crime", kana: "/crime/", meaning: "犯罪", options: ["のほうを好む", "犯罪", "地位、身分", "妥協する"] },
  { id: "attitude", word: "attitude", kana: "/attitude/", meaning: "態度", options: ["感覚", "態度", "を宣言する", "に値する"] },
  { id: "habit", word: "habit", kana: "/habit/", meaning: "（個人的な）習慣", options: ["編集者", "に到着する", "規模", "（個人的な）習慣"] },
  { id: "whatever", word: "whatever", kana: "/whatever/", meaning: "たとえ何を…しても、たとえ何が…であろうと", options: ["たとえ何を…しても、たとえ何が…であろうと", "を要求する", "正義", "漠然とした"] },
  { id: "urban", word: "urban", kana: "/urban/", meaning: "都市の", options: ["財産", "ウイルス", "（生物の）種", "都市の"] },
  { id: "rural", word: "rural", kana: "/rural/", meaning: "田園の、田舎の", options: ["田園の、田舎の", "前の", "自然", "生きている"] },
  { id: "local", word: "local", kana: "/local/", meaning: "その土地の、地元の", options: ["（見て）明らかな、見たところ?らしい", "その土地の、地元の", "ピッタリ合う、うまく合う", "を発表する"] },
  { id: "native", word: "native", kana: "/native/", meaning: "生まれた土地の", options: ["教授", "生まれた土地の", "（熱で）溶ける", "を経営する"] },
  { id: "smart", word: "smart", kana: "/smart/", meaning: "頭の良い", options: ["頭の良い", "（心理）療法", "産業", "減る"] },
  { id: "intelligent", word: "intelligent", kana: "/intelligent/", meaning: "知能の高い、聡明な", options: ["緩い", "話", "知能の高い、聡明な", "（孤独で）寂しい"] },
  { id: "intellectual", word: "intellectual", kana: "/intellectual/", meaning: "知的な", options: ["を要求する", "状況", "知的な", "減る"] },
  { id: "potential", word: "potential", kana: "/potential/", meaning: "潜在的な", options: ["承諾、同意", "社会の", "を維持する、を主張する", "潜在的な"] },
  { id: "moral", word: "moral", kana: "/moral/", meaning: "道徳（上）の", options: ["の特徴を述べる", "国民", "を思いとどまらせる、を落胆させる", "道徳（上）の"] },
  { id: "private", word: "private", kana: "/private/", meaning: "個人的な", options: ["個人的な", "恐怖（心）", "地震", "を嫌う"] },
  { id: "equal", word: "equal", kana: "/equal/", meaning: "等しい、平等な", options: ["を禁止する", "（心理）療法", "等しい、平等な", "定住する、を決める"] },
  { id: "fair", word: "fair", kana: "/fair/", meaning: "公正な、(数量などが)かなりの", options: ["に反対する", "控える", "公正な、(数量などが)かなりの", "と連絡する"] },
  { id: "entire", word: "entire", kana: "/entire/", meaning: "全体の", options: ["ささやく", "全体の", "（考え、方針）を採用する", "（事が）起こる"] },
  { id: "initial", word: "initial", kana: "/initial/", meaning: "初期の", options: ["心に訴える", "料金", "を伝達する", "初期の"] },
  { id: "essential", word: "essential", kana: "/essential/", meaning: "必要不可欠な", options: ["関連、つながり", "脳", "必要不可欠な", "儀式"] },
  { id: "significant", word: "significant", kana: "/significant/", meaning: "重要な", options: ["くっつく、固執する、を貼り付ける", "極(地)", "重要な", "(公共の場での)ごみ"] },
  { id: "terrible", word: "terrible", kana: "/terrible/", meaning: "ひどい", options: ["困難、苦労", "年配の", "を縫いつける", "ひどい"] },
  { id: "digital", word: "digital", kana: "/digital/", meaning: "デジタル(方式)の", options: ["を取り替える", "デジタル(方式)の", "逮捕する", "熱望して"] },
  { id: "direct", word: "direct", kana: "/direct/", meaning: "直接の", options: ["を裏付ける、(本当だと)確認する", "を操作する、手術を行う", "直接の", "控えめな"] },
  { id: "nearly", word: "nearly", kana: "/nearly/", meaning: "もう少しで", options: ["進化する、発展する", "もう少しで", "集める、蓄積する", "（景色、事件などの）背景"] },
  { id: "merely", word: "merely", kana: "/merely/", meaning: "単に", options: ["を奮起させる", "動機", "保険", "単に"] },
  { id: "seldom", word: "seldom", kana: "/seldom/", meaning: "めったに…ない", options: ["めったに…ない", "感覚", "ちらりと見えること", "資金、基金"] },
  { id: "lately", word: "lately", kana: "/lately/", meaning: "最近", options: ["方言", "深い悲しみ", "最近", "生物（学）の"] },
  { id: "apart", word: "apart", kana: "/apart/", meaning: "（空間、時間的に）離れて", options: ["（空間、時間的に）離れて", "応答する", "（見て）明らかな、見たところ?らしい", "能力"] },
  { id: "trust", word: "trust", kana: "/trust/", meaning: "を信頼する", options: ["無罪の", "わくわくさせる", "締め出す", "を信頼する"] },
  { id: "promise", word: "promise", kana: "/promise/", meaning: "を約束する", options: ["思索する", "状況、事情", "をなんとかやり遂げる、をうまく扱う", "を約束する"] },
  { id: "predict", word: "predict", kana: "/predict/", meaning: "を予測する", options: ["を予測する", "冷蔵庫", "（人）に（物）を（求めに応じて）与える", "相当する"] },
  { id: "reflect", word: "reflect", kana: "/reflect/", meaning: "を反映する、を反射する", options: ["契約", "を当惑させる、に恥ずかしい思いをさせる", "を反映する、を反射する", "を怠る"] },
  { id: "recall", word: "recall", kana: "/recall/", meaning: "を思い出す", options: ["障害（物）", "公式の", "まいらせる", "を思い出す"] },
  { id: "rely", word: "rely", kana: "/rely/", meaning: "頼る", options: ["活動的な", "原子力の、核の", "頼る", "を消化する"] },
  { id: "commit", word: "commit", kana: "/commit/", meaning: "（罪、過失など）を犯す、（金、人、時間など）を投入する", options: ["を関連づける", "（罪、過失など）を犯す、（金、人、時間など）を投入する", "崩壊する、倒れる", "卒業する"] },
  { id: "appreciate", word: "appreciate", kana: "/appreciate/", meaning: "をありがたく思う、を正しく認証（評価）する", options: ["いらいらさせる", "能力がある", "をありがたく思う、を正しく認証（評価）する", "を上げる、（子供）を育てる"] },
  { id: "praise", word: "praise", kana: "/praise/", meaning: "を褒める", options: ["とてつもない", "似ている", "じっと見つめる", "を褒める"] },
  { id: "doubt", word: "doubt", kana: "/doubt/", meaning: "を疑わしいと思う、ではないと思う", options: ["を疑わしいと思う、ではないと思う", "積極的な", "柔軟な", "症状"] },
  { id: "complain", word: "complain", kana: "/complain/", meaning: "不平を言う", options: ["いじめる", "を治す", "不平を言う", "を消化する"] },
  { id: "ignore", word: "ignore", kana: "/ignore/", meaning: "を無視する", options: ["を混同する", "覚えている", "大衆", "を無視する"] },
  { id: "warn", word: "warn", kana: "/warn/", meaning: "に警告する", options: ["神聖な", "陪審", "真剣な、本気の", "に警告する"] },
  { id: "gather", word: "gather", kana: "/gather/", meaning: "を集める、拾い集める", options: ["真剣な", "を集める、拾い集める", "を繰り返す", "虫歯、衰退、荒廃"] },
  { id: "acquire", word: "acquire", kana: "/acquire/", meaning: "（習慣など）を身に付ける", options: ["理解する", "（習慣など）を身に付ける", "願望", "配達する"] },
  { id: "examine", word: "examine", kana: "/examine/", meaning: "を調べる", options: ["（物事の）側面", "品目、項目", "場所、用地", "を調べる"] },
  { id: "score", word: "score", kana: "/score/", meaning: "（試合、テストで）（点）をとる", options: ["を捨てる", "を台無しにする", "嫉妬深い", "（試合、テストで）（点）をとる"] },
  { id: "judge", word: "judge", kana: "/judge/", meaning: "を判断する", options: ["を想像する", "を判断する", "精神を集中する", "任命する"] },
  { id: "select", word: "select", kana: "/select/", meaning: "を選び出す", options: ["信じられない", "を選び出す", "逮捕する", "賛成する"] },
  { id: "divide", word: "divide", kana: "/divide/", meaning: "を分ける", options: ["形式ばらない", "を分ける", "（ワールドワイド）ウェブ", "を持続させる"] },
  { id: "distinguish", word: "distinguish", kana: "/distinguish/", meaning: "を区別する", options: ["関係のある", "（車などが通った）跡", "意見を求める", "を区別する"] },
  { id: "graduate", word: "graduate", kana: "/graduate/", meaning: "卒業する", options: ["沈む", "卒業する", "きっと～だと思う", "障壁"] },
  { id: "shift", word: "shift", kana: "/shift/", meaning: "（位置、方針など）を変える", options: ["言語", "～と違って", "をかく", "（位置、方針など）を変える"] },
  { id: "hide", word: "hide", kana: "/hide/", meaning: "を隠す", options: ["年１回の", "列", "耳が聞こえない", "を隠す"] },
  { id: "mix", word: "mix", kana: "/mix/", meaning: "を混ぜる", options: ["を混ぜる", "愚かな", "依存する", "を閉める"] },
  { id: "fix", word: "fix", kana: "/fix/", meaning: "を修理する", options: ["を修理する", "隣人、近所の人", "を拒む", "積む"] },
  { id: "display", word: "display", kana: "/display/", meaning: "を示す", options: ["（時間など）を充てる", "を示す", "（仕事など）を割り当てる", "（場所など）を探す、捜索する"] },
  { id: "define", word: "define", kana: "/define/", meaning: "を定義する", options: ["言語", "哲学", "育てる", "を定義する"] },
  { id: "invent", word: "invent", kana: "/invent/", meaning: "を発明する", options: ["運賃", "（喜怒哀楽の）感情", "を発明する", "比率"] },
  { id: "vary", word: "vary", kana: "/vary/", meaning: "異なる、多様である", options: ["を上げる、（子供）を育てる", "適度な", "を満足させる", "異なる、多様である"] },
  { id: "expand", word: "expand", kana: "/expand/", meaning: "を拡大する", options: ["攻撃的な", "楽しませる", "（物質的、精神的）利益", "を拡大する"] },
  { id: "evolve", word: "evolve", kana: "/evolve/", meaning: "進化する、発展する", options: ["（注意など）をそらす", "を説得する", "進化する、発展する", "を調査する"] },
  { id: "confuse", word: "confuse", kana: "/confuse/", meaning: "を混同する", options: ["休止する", "呼吸する", "を混同する", "を分ける"] },
  { id: "consume", word: "consume", kana: "/consume/", meaning: "を消費する", options: ["言葉による", "準備する", "を消費する", "即座の"] },
  { id: "compete", word: "compete", kana: "/compete/", meaning: "競う", options: ["いくぶん", "じっと見つめる", "極端な", "競う"] },
  { id: "repeat", word: "repeat", kana: "/repeat/", meaning: "を繰り返す", options: ["を拡大する", "即座の", "明らかな", "を繰り返す"] },
  { id: "repair", word: "repair", kana: "/repair/", meaning: "を修理する", options: ["頻繁な", "を修理する", "規模", "率直な"] },
  { id: "remind", word: "remind", kana: "/remind/", meaning: "に思い出させる", options: ["貿易", "経歴", "に思い出させる", "複雑な"] },
  { id: "refuse", word: "refuse", kana: "/refuse/", meaning: "を拒む", options: ["を振る", "を拒む", "厄介な，ぎこちない", "小作農"] },
  { id: "reject", word: "reject", kana: "/reject/", meaning: "を拒絶する", options: ["殺害する", "理論", "（料理の）材料", "を拒絶する"] },
  { id: "deny", word: "deny", kana: "/deny/", meaning: "を否定する", options: ["我慢する", "を否定する", "程度", "方法、行儀、作法"] },
  { id: "destroy", word: "destroy", kana: "/destroy/", meaning: "を破壊する", options: ["我慢強い", "輝く", "男の", "を破壊する"] },
  { id: "audience", word: "audience", kana: "/audience/", meaning: "観衆、聴衆", options: ["残酷な", "全体の", "観衆、聴衆", "熱狂，熱中"] },
  { id: "race", word: "race", kana: "/race/", meaning: "民族、人種", options: ["違反する", "民族、人種", "陪審", "をいとわない"] },
  { id: "conflict", word: "conflict", kana: "/conflict/", meaning: "争い", options: ["主題、テーマ", "請求書、勘定（書）", "存在する", "争い"] },
  { id: "debate", word: "debate", kana: "/debate/", meaning: "論争", options: ["現代の", "を発見する", "論争", "自殺"] },
  { id: "struggle", word: "struggle", kana: "/struggle/", meaning: "懸命の努力、奮闘", options: ["遺伝子", "目に見える", "普通の", "懸命の努力、奮闘"] },
  { id: "strategy", word: "strategy", kana: "/strategy/", meaning: "戦略", options: ["戦略", "（問題）に取り組む、（人）に演説する", "を稼ぐ", "原子力の、核の"] },
  { id: "progress", word: "progress", kana: "/progress/", meaning: "進歩", options: ["我慢する", "進歩", "相手、敵", "不平を言う"] },
  { id: "principle", word: "principle", kana: "/principle/", meaning: "原則、原理", options: ["場面", "好奇心の強い", "原則、原理", "残念なことに"] },
  { id: "element", word: "element", kana: "/element/", meaning: "要素", options: ["要素", "を雇う", "を比べる", "装飾する"] },
  { id: "origin", word: "origin", kana: "/origin/", meaning: "起源", options: ["不利（な点）", "産業", "起源", "懸命の努力、奮闘"] },
  { id: "birth", word: "birth", kana: "/birth/", meaning: "出産", options: ["暴力的な", "（車などが通った）跡", "をまき散らす", "出産"] },
  { id: "ancestor", word: "ancestor", kana: "/ancestor/", meaning: "祖先", options: ["（外国からの）移住", "洞察（力）", "読み書きの能力", "祖先"] },
  { id: "cell", word: "cell", kana: "/cell/", meaning: "細胞", options: ["（喜怒哀楽の）感情", "（物、体の一部）に損害を与える", "細胞", "を繰り返す"] },
  { id: "gene", word: "gene", kana: "/gene/", meaning: "遺伝子", options: ["上がる、昇る", "を選び出す", "遺伝子", "民族の、人種の"] },
  { id: "scene", word: "scene", kana: "/scene/", meaning: "場面", options: ["特有の", "原因", "知恵", "場面"] },
  { id: "trend", word: "trend", kana: "/trend/", meaning: "傾向", options: ["傾向", "微小な", "即座の", "崇拝"] },
  { id: "traffic", word: "traffic", kana: "/traffic/", meaning: "交通（量）", options: ["（サービスに対する）料金", "（人）に（物・事）を提供する", "交通（量）", "湿気のある"] },
  { id: "track", word: "track", kana: "/track/", meaning: "（車などが通った）跡", options: ["を生産する", "（車などが通った）跡", "を想像する", "ささやく"] },
  { id: "series", word: "series", kana: "/series/", meaning: "連続", options: ["競う", "知恵", "政策、方針", "連続"] },
  { id: "context", word: "context", kana: "/context/", meaning: "状況", options: ["適切な", "生物（学）の", "（人）を夢中にさせる", "状況"] },
  { id: "background", word: "background", kana: "/background/", meaning: "（景色、事件などの）背景", options: ["おしゃべりをする", "をいとわない", "（景色、事件などの）背景", "あくびをする"] },
  { id: "basis", word: "basis", kana: "/basis/", meaning: "基準", options: ["基準", "つかむ", "広大な", "（料理の）材料"] },
  { id: "status", word: "status", kana: "/status/", meaning: "地位、身分", options: ["犠牲", "（日常の）食事", "地位、身分", "連続、（連続するものの）順番"] },
  { id: "volunteer", word: "volunteer", kana: "/volunteer/", meaning: "ボランティア", options: ["を予測する", "中立の", "ボランティア", "結合する"] },
  { id: "staff", word: "staff", kana: "/staff/", meaning: "スタッフ、職員", options: ["生態系", "日課、決まりきった仕事", "スタッフ、職員", "を縫いつける"] },
  { id: "duty", word: "duty", kana: "/duty/", meaning: "義務", options: ["本物の", "（人）に無理やりさせる", "敏感な", "義務"] },
  { id: "labor", word: "labor", kana: "/labor/", meaning: "労働", options: ["労働", "高貴な", "を避ける", "を反映する、を反射する"] },
  { id: "reward", word: "reward", kana: "/reward/", meaning: "褒美", options: ["正当化する", "を（滅亡の）危険にさらす", "応答する", "褒美"] },
  { id: "aim", word: "aim", kana: "/aim/", meaning: "目的", options: ["民族の、人種の", "目的", "問題", "（景色、事件などの）背景"] },
  { id: "fun", word: "fun", kana: "/fun/", meaning: "楽しみ、おもしろいこと（人）", options: ["邪悪な", "楽しみ、おもしろいこと（人）", "を測る", "（人）に（金など）を借りている、おかげである"] },
  { id: "crowd", word: "crowd", kana: "/crowd/", meaning: "群衆", options: ["雰囲気", "分厚い", "群衆", "同時に起こる"] },
  { id: "revolution", word: "revolution", kana: "/revolution/", meaning: "革命", options: ["を許す", "革命", "（人）に（物・事）を提供する", "革新"] },
  { id: "poverty", word: "poverty", kana: "/poverty/", meaning: "貧困", options: ["実験", "解雇する", "貧困", "を持ち上げる"] },
  { id: "consequence", word: "consequence", kana: "/consequence/", meaning: "結果", options: ["続く", "ローン、貸付金", "結果", "賃金"] },
  { id: "sequence", word: "sequence", kana: "/sequence/", meaning: "連続、（連続するものの）順番", options: ["深い悲しみ", "減る", "連続、（連続するものの）順番", "に似ている"] },
  { id: "complex", word: "complex", kana: "/complex/", meaning: "複雑な", options: ["バイリンガルの，2言語を話す", "繁盛する；繁殖する", "複雑な", "を開発する"] },
  { id: "complicated", word: "complicated", kana: "/complicated/", meaning: "複雑な", options: ["を説得する", "成長する", "引用する", "複雑な"] },
  { id: "false", word: "FALSE", kana: "/false/", meaning: "誤った", options: ["誤った", "じっと見つめる", "を開発する", "を避ける"] },
  { id: "alternative", word: "alternative", kana: "/alternative/", meaning: "代替の", options: ["を発表する", "代替の", "避難（所）", "それにもかかわらず"] },
  { id: "extreme", word: "extreme", kana: "/extreme/", meaning: "極端な", options: ["熱", "極端な", "引用する", "情熱"] },
  { id: "ideal", word: "ideal", kana: "/ideal/", meaning: "理想的な", options: ["薬", "言語", "手術", "理想的な"] },
  { id: "primary", word: "primary", kana: "/primary/", meaning: "最も重要な", options: ["を混ぜる", "楽観的な", "最も重要な", "を消費する"] },
  { id: "worth", word: "worth", kana: "/worth/", meaning: "価値のある", options: ["つかむ", "価値のある", "を扱う、を治療する", "巨大な、莫大な"] },
  { id: "obvious", word: "obvious", kana: "/obvious/", meaning: "明らかな", options: ["（将来の）展望", "明らかな", "引きずる", "勝利"] },
  { id: "legal", word: "legal", kana: "/legal/", meaning: "法律（上）の", options: ["純粋な", "現在の", "きつい", "法律（上）の"] },
  { id: "commercial", word: "commercial", kana: "/commercial/", meaning: "商業的な、営利的な", options: ["宝物", "（人）に（物）を（求めに応じて）与える", "思い切って行く", "商業的な、営利的な"] },
  { id: "artificial", word: "artificial", kana: "/artificial/", meaning: "人工の", options: ["著者", "楽しませる", "人工の", "を調査する"] },
  { id: "chemical", word: "chemical", kana: "/chemical/", meaning: "化学の", options: ["化学の", "経験する", "愚かな", "を当惑させる、に恥ずかしい思いをさせる"] },
  { id: "biological", word: "biological", kana: "/biological/", meaning: "生物（学）の", options: ["道徳（上）の", "生物（学）の", "耐える", "を調査する"] },
  { id: "former", word: "former", kana: "/former/", meaning: "元の", options: ["元の", "準備する", "教育", "争い"] },
  { id: "mobile", word: "mobile", kana: "/mobile/", meaning: "（物が）可動［移動］式の", options: ["（心理）療法", "（物が）可動［移動］式の", "避けられない", "（人）を手伝う"] },
  { id: "straight", word: "straight", kana: "/straight/", meaning: "まっすぐな", options: ["まっすぐな", "それにもかかわらず", "を無視する", "（…に）順応する(to)"] },
  { id: "regular", word: "regular", kana: "/regular/", meaning: "定期的な", options: ["敵", "定期的な", "に知らせる", "熱"] },
  { id: "independent", word: "independent", kana: "/independent/", meaning: "（人が）自立した", options: ["（人が）自立した", "（芸術などが）最高水準の、典型的な", "醜い", "を取り除く"] },
  { id: "overseas", word: "overseas", kana: "/overseas/", meaning: "海外へ", options: ["減る、衰える", "ぶらつく，歩き回る", "海外へ", "を感動させる"] },
  { id: "unlike", word: "unlike", kana: "/unlike/", meaning: "～と違って", options: ["を主張する", "儀式", "～と違って", "を改革する、改善する"] },
  { id: "via", word: "via", kana: "/via/", meaning: "～媒介で", options: ["陳述", "を要求する", "～媒介で", "国内の"] },
  { id: "whereas", word: "whereas", kana: "/whereas/", meaning: "…だけれども", options: ["…だけれども", "基準", "ぶらつく，歩き回る", "を集める、拾い集める"] },
  { id: "perceive", word: "perceive", kana: "/perceive/", meaning: "を知覚する", options: ["傷", "産業", "大衆", "を知覚する"] },
  { id: "fascinate", word: "fascinate", kana: "/fascinate/", meaning: "を魅了する", options: ["（問題）に取り組む、（人）に演説する", "情け、慈悲", "を褒める", "を魅了する"] },
  { id: "bore", word: "bore", kana: "/bore/", meaning: "を退屈させる", options: ["文、（宣告された）刑", "を退屈させる", "地位、身分", "スタッフ、職員"] },
  { id: "disappoint", word: "disappoint", kana: "/disappoint/", meaning: "を失望させる", options: ["を失望させる", "正義", "開花する", "悲しみ"] },
  { id: "imply", word: "imply", kana: "/imply/", meaning: "それとなく言う", options: ["好奇心の強い", "見通し", "驚かせる", "それとなく言う"] },
  { id: "recommend", word: "recommend", kana: "/recommend/", meaning: "を勧める", options: ["相互に作用する", "を勧める", "道徳（上）の", "を発音する"] },
  { id: "demonstrate", word: "demonstrate", kana: "/demonstrate/", meaning: "を証明する", options: ["夜明け", "を分配する", "進歩", "を証明する"] },
  { id: "conclude", word: "conclude", kana: "/conclude/", meaning: "と結論づける", options: ["冷静な", "効率の良い", "多数の", "と結論づける"] },
  { id: "announce", word: "announce", kana: "/announce/", meaning: "を発表する", options: ["完全に", "を発表する", "収益", "王室の"] },
  { id: "appeal", word: "appeal", kana: "/appeal/", meaning: "心に訴える", options: ["漠然とした", "の特徴を述べる", "心に訴える", "に乗り遅れる"] },
  { id: "address", word: "address", kana: "/address/", meaning: "（問題）に取り組む、（人）に演説する", options: ["ボランティア", "対照", "（問題）に取り組む、（人）に演説する", "輝く"] },
  { id: "advertise", word: "advertise", kana: "/advertise/", meaning: "を宣伝する", options: ["交換する", "公正な、(数量などが)かなりの", "を宣伝する", "緊急の"] },
  { id: "invite", word: "invite", kana: "/invite/", meaning: "を招待する", options: ["あり得る、可能な", "概念", "を招待する", "人口"] },
  { id: "afford", word: "afford", kana: "/afford/", meaning: "を持つ余裕がある", options: ["話", "を持つ余裕がある", "増える", "従事する、を引き入れる"] },
  { id: "purchase", word: "purchase", kana: "/purchase/", meaning: "を購入する", options: ["装備する", "を購入する", "像、彫像", "栄える"] },
  { id: "participate", word: "participate", kana: "/participate/", meaning: "参加する", options: ["従う", "なまり、方言", "に値する", "参加する"] },
  { id: "belong", word: "belong", kana: "/belong/", meaning: "所属している、ものである", options: ["所属している、ものである", "引用する", "を発見する", "疲労"] },
  { id: "conduct", word: "conduct", kana: "/conduct/", meaning: "を行う", options: ["を計算する", "を行う", "を積み重ねる", "脳"] },
  { id: "behave", word: "behave", kana: "/behave/", meaning: "振る舞う", options: ["部分", "（芸術などが）最高水準の、典型的な", "に乗り遅れる", "振る舞う"] },
  { id: "operate", word: "operate", kana: "/operate/", meaning: "を操作する、手術を行う", options: ["相互の", "機会", "領土", "を操作する、手術を行う"] },
  { id: "organize", word: "organize", kana: "/organize/", meaning: "を主催する、準備する", options: ["集める、蓄積する", "中身", "感覚", "を主催する、準備する"] },
  { id: "host", word: "host", kana: "/host/", meaning: "を主催する", options: ["感覚", "勝利", "を主催する", "を完成させる"] },
  { id: "combine", word: "combine", kana: "/combine/", meaning: "を組み合わせる", options: ["殺害する", "を完成させる", "を組み合わせる", "と主張する"] },
  { id: "deliver", word: "deliver", kana: "/deliver/", meaning: "配達する", options: ["急な", "配達する", "を受け取る", "社会の"] },
  { id: "locate", word: "locate", kana: "/locate/", meaning: "を（場所に）置く", options: ["銀河", "（伝達などの）媒体", "を（場所に）置く", "を（公式に）禁止する"] },
  { id: "encounter", word: "encounter", kana: "/encounter/", meaning: "に（偶然）出会う", options: ["（習慣など）を身に付ける", "に（偶然）出会う", "（物質的、精神的）利益", "に対処する，を扱う"] },
  { id: "surround", word: "surround", kana: "/surround/", meaning: "を囲む", options: ["全体の", "（大きな音を立てて）衝突する", "の特徴を述べる", "を囲む"] },
  { id: "explore", word: "explore", kana: "/explore/", meaning: "を探検する", options: ["（人）を手伝う", "（試合、テストで）（点）をとる", "航海", "を探検する"] },
  { id: "stick", word: "stick", kana: "/stick/", meaning: "くっつく、固執する、を貼り付ける", options: ["を切り離す", "くっつく、固執する、を貼り付ける", "じっと見つめる", "を意図する、つもりでいる"] },
  { id: "strike", word: "strike", kana: "/strike/", meaning: "に当たる、（人）に印象を与える", options: ["～と違って", "を選び出す", "に当たる、（人）に印象を与える", "申し込む、を適用する"] },
  { id: "hurt", word: "hurt", kana: "/hurt/", meaning: "を痛める", options: ["輝く", "臨時の、一時的な", "を痛める", "嫌悪感を持たせる"] },
  { id: "bite", word: "bite", kana: "/bite/", meaning: "にかみつく", options: ["寛大な", "にかみつく", "を染める", "哲学"] },
  { id: "tear", word: "tear", kana: "/tear/", meaning: "を引き裂く", options: ["を引き裂く", "追いかける", "わな", "汚染"] },
  { id: "aid", word: "aid", kana: "/aid/", meaning: "を援助する", options: ["保険", "を援助する", "まいらせる", "情熱"] },
  { id: "press", word: "press", kana: "/press/", meaning: "を押す", options: ["わずかな", "を押す", "汗", "を決定する"] },
  { id: "burn", word: "burn", kana: "/burn/", meaning: "を燃やす", options: ["個人的な", "高価な", "を燃やす", "を抱きしめる、（申し出など）を受け入れる"] },
  { id: "flow", word: "flow", kana: "/flow/", meaning: "流れる", options: ["流れる", "を囲む", "誇張する", "計り知れない"] },
  { id: "preserve", word: "preserve", kana: "/preserve/", meaning: "を保存する", options: ["を保存する", "財産", "無限の", "大喜びさせる"] },
  { id: "borrow", word: "borrow", kana: "/borrow/", meaning: "を（無料で）借りる", options: ["伝染病", "使われていない、仕事がない", "を（無料で）借りる", "縮む"] },
  { id: "steal", word: "steal", kana: "/steal/", meaning: "を盗む", options: ["を盗む", "尊敬する", "被害者、犠牲者", "薬"] },
  { id: "escape", word: "escape", kana: "/escape/", meaning: "逃れる、脱出する、を免れる", options: ["を征服する", "を分ける", "逃れる、脱出する、を免れる", "快い、楽しい"] },
  { id: "neighbor", word: "neighbor", kana: "/neighbor/", meaning: "隣人、近所の人", options: ["危険（性）", "なまり、方言", "隣人、近所の人", "革命"] },
  { id: "household", word: "household", kana: "/household/", meaning: "世帯", options: ["世帯", "保険", "と矛盾する", "慈善事業"] },
  { id: "resident", word: "resident", kana: "/resident/", meaning: "居住者、住人", options: ["殺害する", "同情、共感", "を傷つける", "居住者、住人"] },
  { id: "vehicle", word: "vehicle", kana: "/vehicle/", meaning: "車、乗り物", options: ["車、乗り物", "冷蔵庫", "所属している、ものである", "を繰り返す"] },
  { id: "wheel", word: "wheel", kana: "/wheel/", meaning: "（自動車の）ハンドル", options: ["（自動車の）ハンドル", "段階", "を抱きしめる、（申し出など）を受け入れる", "前の"] },
  { id: "delay", word: "delay", kana: "/delay/", meaning: "遅れ", options: ["評判", "遅れ", "科学の", "取り扱いの難しい"] },
  { id: "fuel", word: "fuel", kana: "/fuel/", meaning: "燃料", options: ["時代", "燃料", "殺害する", "方法、行儀、作法"] },
  { id: "pollution", word: "pollution", kana: "/pollution/", meaning: "汚染", options: ["考え", "を含む", "汚染", "即座の"] },
  { id: "atmosphere", word: "atmosphere", kana: "/atmosphere/", meaning: "雰囲気", options: ["雰囲気", "きつい", "わくわくさせる", "（言葉など）を発する"] },
  { id: "electricity", word: "electricity", kana: "/electricity/", meaning: "電気", options: ["豊富な", "境界線、国境", "電気", "目の見えない"] },
  { id: "cancer", word: "cancer", kana: "/cancer/", meaning: "癌", options: ["を変装させる", "癌", "頂上", "計画"] },
  { id: "plague", word: "plague", kana: "/plague/", meaning: "疫病", options: ["連続", "最も重要な", "伝える", "疫病"] },
  { id: "threat", word: "threat", kana: "/threat/", meaning: "恐れ、予兆", options: ["を克服する", "恐れ、予兆", "を設計する", "定期的な"] },
  { id: "flood", word: "flood", kana: "/flood/", meaning: "洪水", options: ["法廷、裁判所", "洪水", "土壌、土", "秘書"] },
  { id: "earthquake", word: "earthquake", kana: "/earthquake/", meaning: "地震", options: ["ひも、糸", "地震", "を捕らえる", "を打ち負かす、（続けざまに）打つ"] },
  { id: "disaster", word: "disaster", kana: "/disaster/", meaning: "災害", options: ["ウイルス", "災害", "考え", "編集者"] },
  { id: "crisis", word: "crisis", kana: "/crisis/", meaning: "危機", options: ["危機", "使われていない、仕事がない", "中心的な", "を思いとどまらせる、を落胆させる"] },
  { id: "victim", word: "victim", kana: "/victim/", meaning: "被害者、犠牲者", options: ["被害者、犠牲者", "非難する", "昆虫", "を表現する"] },
  { id: "wealth", word: "wealth", kana: "/wealth/", meaning: "富、財産", options: ["象徴", "に警告する", "（…に）順応する(to)", "富、財産"] },
  { id: "fund", word: "fund", kana: "/fund/", meaning: "資金、基金", options: ["陪審", "極端な", "経験", "資金、基金"] },
  { id: "capital", word: "capital", kana: "/capital/", meaning: "資本", options: ["を（展覧会などに）展示する、（感情、兆候など）を示す", "苦い、つらい", "資本", "目的地"] },
  { id: "profit", word: "profit", kana: "/profit/", meaning: "収益", options: ["収益", "～の味がする", "概念", "を完成させる"] },
  { id: "talent", word: "talent", kana: "/talent/", meaning: "才能", options: ["才能", "会議", "技術", "できない"] },
  { id: "capacity", word: "capacity", kana: "/capacity/", meaning: "能力", options: ["借金", "能力", "（サービスに対する）料金", "労働"] },
  { id: "scholar", word: "scholar", kana: "/scholar/", meaning: "（主に人文系の）学者", options: ["生の", "と結婚する", "（主に人文系の）学者", "感覚"] },
  { id: "tradition", word: "tradition", kana: "/tradition/", meaning: "伝統", options: ["伝統", "訴える", "秘書", "を探し求める"] },
  { id: "literature", word: "literature", kana: "/literature/", meaning: "文学", options: ["ひも、糸", "文学", "を支持する", "光栄"] },
  { id: "lecture", word: "lecture", kana: "/lecture/", meaning: "講義、講演", options: ["を（きちんと）並べる、手はずを整える", "悲惨な出来事", "講義、講演", "無関心な"] },
  { id: "manner", word: "manner", kana: "/manner/", meaning: "方法、行儀、作法", options: ["を尊敬する", "を改革する、改善する", "革命", "方法、行儀、作法"] },
  { id: "symbol", word: "symbol", kana: "/symbol/", meaning: "象徴", options: ["を伝達する", "厄介な，ぎこちない", "被害者、犠牲者", "象徴"] },
  { id: "analysis", word: "analysis", kana: "/analysis/", meaning: "分析", options: ["分析", "続く", "請求書、勘定（書）", "固執する、しつこく続ける"] },
  { id: "version", word: "version", kana: "/version/", meaning: "…版", options: ["（政治的、社会的）運動、活動", "…版", "（将来の）展望", "解雇する"] },
  { id: "perspective", word: "perspective", kana: "/perspective/", meaning: "観点", options: ["楽しみ、おもしろいこと（人）", "精神を集中する", "式典、儀式", "観点"] },
  { id: "vision", word: "vision", kana: "/vision/", meaning: "（将来の）展望", options: ["を伝達する", "個人的な", "装置", "（将来の）展望"] },
  { id: "sight", word: "sight", kana: "/sight/", meaning: "見えること", options: ["外部の", "あくびをする", "ごみ", "見えること"] },
  { id: "insight", word: "insight", kana: "/insight/", meaning: "洞察（力）", options: ["延期する", "困難、苦労", "洞察（力）", "純粋な"] },
  { id: "bilingual", word: "bilingual", kana: "/bilingual/", meaning: "バイリンガルの，2言語を話す", options: ["身体の", "バイリンガルの，2言語を話す", "に直面する、（危険などが）の身に迫る", "を付ける、愛着を抱いている"] },
  { id: "capable", word: "capable", kana: "/capable/", meaning: "能力がある", options: ["厄介な，ぎこちない", "あえてする、する勇気がある", "絶望", "能力がある"] },
  { id: "willing", word: "willing", kana: "/willing/", meaning: "をいとわない", options: ["ひどい", "きちんとした", "をいとわない", "場所、用地"] },
  { id: "eager", word: "eager", kana: "/eager/", meaning: "熱望して", options: ["（問題、困難、機会などが）生じる", "熱望して", "を調べる", "と結論づける"] },
  { id: "amazing", word: "amazing", kana: "/amazing/", meaning: "驚くほどの", options: ["（アンケートによる意識などの）調査", "驚くほどの", "使い方", "苦しむ"] },
  { id: "calm", word: "calm", kana: "/calm/", meaning: "冷静な", options: ["わくわくさせる", "精神の", "冷静な", "多くの(部分から成る)"] },
  { id: "quiet", word: "quiet", kana: "/quiet/", meaning: "静かな", options: ["静かな", "出産", "罪悪感のある、有罪の", "極めて重要な"] },
  { id: "senior", word: "senior", kana: "/senior/", meaning: "高齢者の、（地位などが）上級の", options: ["高齢者の、（地位などが）上級の", "水準、基準", "ちらりと見えること", "を身に着けている"] },
  { id: "elderly", word: "elderly", kana: "/elderly/", meaning: "年配の", options: ["刑務所", "年配の", "尊厳", "見えること"] },
  { id: "firm", word: "firm", kana: "/firm/", meaning: "確固とした", options: ["最も重要な，第一の", "確固とした", "初期の", "上がる、昇る"] },
  { id: "severe", word: "severe", kana: "/severe/", meaning: "（痛みなどが）ひどい、厳しい", options: ["（痛みなどが）ひどい、厳しい", "わな", "高貴な", "を盗む"] },
  { id: "tough", word: "tough", kana: "/tough/", meaning: "困難な", options: ["困難な", "実験", "運命", "を選び取る、を摘む"] },
  { id: "rapid", word: "rapid", kana: "/rapid/", meaning: "急速な", options: ["必要な", "を信頼する", "苦い、つらい", "急速な"] },
  { id: "immediate", word: "immediate", kana: "/immediate/", meaning: "即座の", options: ["残酷な", "即座の", "辞める", "会議"] },
  { id: "vast", word: "vast", kana: "/vast/", meaning: "広大な", options: ["広大な", "を購入する", "避難", "利用する"] },
  { id: "enormous", word: "enormous", kana: "/enormous/", meaning: "巨大な、莫大な", options: ["すぐ近くの", "汚染", "巨大な、莫大な", "差別"] },
  { id: "broad", word: "broad", kana: "/broad/", meaning: "広範囲な", options: ["内気な、恥ずかしがりの", "広範囲な", "理解する", "をかき回す、呼び起こす"] },
  { id: "narrow", word: "narrow", kana: "/narrow/", meaning: "（幅が）狭い", options: ["（幅が）狭い", "連続、（連続するものの）順番", "話", "叫ぶ"] },
  { id: "tiny", word: "tiny", kana: "/tiny/", meaning: "とても小さな", options: ["とても小さな", "をそれとわかる", "折り畳む", "成長する"] },
  { id: "efficient", word: "efficient", kana: "/efficient/", meaning: "効率の良い", options: ["効率の良い", "借金", "気づいて", "を埋める"] },
  { id: "constant", word: "constant", kana: "/constant/", meaning: "絶え間ない", options: ["を主催する", "繁栄", "を変装させる", "絶え間ない"] },
  { id: "nearby", word: "nearby", kana: "/nearby/", meaning: "すぐ近くの", options: ["正しい", "を輸出する", "能力", "すぐ近くの"] },
  { id: "distant", word: "distant", kana: "/distant/", meaning: "遠い", options: ["進歩", "遠い", "心地よい、快適な", "（人）を夢中にさせる"] },
  { id: "insist", word: "insist", kana: "/insist/", meaning: "断固要求する", options: ["断固要求する", "を設立する", "主要な", "に入る"] },
  { id: "intend", word: "intend", kana: "/intend/", meaning: "を意図する、つもりでいる", options: ["乳児", "にかみつく", "を意図する、つもりでいる", "意見を求める"] },
  { id: "inspire", word: "inspire", kana: "/inspire/", meaning: "を奮起させる", options: ["を動揺させる", "を分配する", "を奮起させる", "最近"] },
  { id: "emphasize", word: "emphasize", kana: "/emphasize/", meaning: "を強調する、力説する", options: ["技能、技術", "平易な", "著者", "を強調する、力説する"] },
  { id: "propose", word: "propose", kana: "/propose/", meaning: "を提案する", options: ["に似ている", "を説明する、を例証する", "を提案する", "連続、（連続するものの）順番"] },
  { id: "persuade", word: "persuade", kana: "/persuade/", meaning: "を説得する", options: ["に知らせる", "それにもかかわらず", "を説得する", "水平線、地平線"] },
  { id: "convince", word: "convince", kana: "/convince/", meaning: "に納得させる", options: ["元の", "に納得させる", "出来事", "修正する"] },
  { id: "admit", word: "admit", kana: "/admit/", meaning: "を（事実と）認める", options: ["とても小さな", "妥協する", "を（事実と）認める", "余分の"] },
  { id: "favor", word: "favor", kana: "/favor/", meaning: "に賛成する、を好む", options: ["断固要求する", "に賛成する、を好む", "優しい", "を達成する"] },
  { id: "excuse", word: "excuse", kana: "/excuse/", meaning: "を大目に見る、の言い訳をする", options: ["に（色、服などが）似合う、に都合がよい", "を大目に見る、の言い訳をする", "論理", "機能"] },
  { id: "interpret", word: "interpret", kana: "/interpret/", meaning: "を解釈する", options: ["概念", "を埋める", "を襲う、攻撃する", "を解釈する"] },
  { id: "translate", word: "translate", kana: "/translate/", meaning: "を翻訳する", options: ["をさらす", "利用できる、入手できる", "投げかける", "を翻訳する"] },
  { id: "concentrate", word: "concentrate", kana: "/concentrate/", meaning: "精神を集中する", options: ["観衆、聴衆", "敵", "精神を集中する", "地域社会"] },
  { id: "criticize", word: "criticize", kana: "/criticize/", meaning: "を非難する", options: ["障壁", "優れている", "を非難する", "根本的な"] },
  { id: "blame", word: "blame", kana: "/blame/", meaning: "を（～のことで）責める(for)、を（～の）せいにする(on)", options: ["を（～のことで）責める(for)、を（～の）せいにする(on)", "品目、項目", "結局（は）", "跳ぶ"] },
  { id: "oppose", word: "oppose", kana: "/oppose/", meaning: "に反対する", options: ["信頼", "を要求する", "に反対する", "を蓄える"] },
  { id: "inform", word: "inform", kana: "/inform/", meaning: "に知らせる", options: ["基本の", "に知らせる", "哲学", "施設"] },
  { id: "grant", word: "grant", kana: "/grant/", meaning: "（人）に（物）を（求めに応じて）与える", options: ["（人）に（物）を（求めに応じて）与える", "柔軟な", "十分な", "快い、楽しい"] },
  { id: "obtain", word: "obtain", kana: "/obtain/", meaning: "を得る", options: ["を得る", "を混ぜる", "質", "率直な"] },
  { id: "transform", word: "transform", kana: "/transform/", meaning: "を変える", options: ["を引き裂く", "手荷物", "を変える", "困難"] },
  { id: "alter", word: "alter", kana: "/alter/", meaning: "を変える", options: ["音", "を変える", "を（～のことで）責める(for)、を（～の）せいにする(on)", "を混同する"] },
  { id: "arrange", word: "arrange", kana: "/arrange/", meaning: "を（きちんと）並べる、手はずを整える", options: ["気が進まない", "福祉", "高価な", "を（きちんと）並べる、手はずを整える"] },
  { id: "interact", word: "interact", kana: "/interact/", meaning: "相互に作用する", options: ["～の味がする", "を分ける", "相互に作用する", "を持つ余裕がある"] },
  { id: "handle", word: "handle", kana: "/handle/", meaning: "（問題など）を処理する", options: ["性格", "状況、事情", "行動する", "（問題など）を処理する"] },
  { id: "extend", word: "extend", kana: "/extend/", meaning: "を延長する", options: ["仮説", "札", "固体の、しっかりした", "を延長する"] },
  { id: "settle", word: "settle", kana: "/settle/", meaning: "定住する、を決める", options: ["いくぶん", "市長", "（国家などの）経済", "定住する、を決める"] },
  { id: "contribute", word: "contribute", kana: "/contribute/", meaning: "貢献する、を寄付する", options: ["連続、（連続するものの）順番", "傾向がある", "叫ぶ", "貢献する、を寄付する"] },
  { id: "construct", word: "construct", kana: "/construct/", meaning: "を建設する", options: ["価値", "を建設する", "任命する", "積極的な"] },
  { id: "consist", word: "consist", kana: "/consist/", meaning: "成る、（本質が）ある", options: ["低い", "顧客", "成る、（本質が）ある", "境界（線）"] },
  { id: "suit", word: "suit", kana: "/suit/", meaning: "に（色、服などが）似合う、に都合がよい", options: ["頼る", "勇気", "に（色、服などが）似合う、に都合がよい", "古代の"] },
  { id: "tie", word: "tie", kana: "/tie/", meaning: "を結びつける", options: ["を共同で使う", "を結びつける", "に補償する", "を雇う"] },
  { id: "differ", word: "differ", kana: "/differ/", meaning: "異なる", options: ["意見", "を結びつける", "要素", "異なる"] },
  { id: "hate", word: "hate", kana: "/hate/", meaning: "をひどく嫌う、憎む", options: ["郊外", "最終的な", "をひどく嫌う、憎む", "会議"] },
  { id: "dislike", word: "dislike", kana: "/dislike/", meaning: "を嫌う", options: ["完全に", "対照", "を嫌う", "を尊敬する"] },
  { id: "disagree", word: "disagree", kana: "/disagree/", meaning: "意見が合わない", options: ["押しつける", "意見が合わない", "交換する", "を抱く、思いつく"] },
  { id: "regret", word: "regret", kana: "/regret/", meaning: "を後悔する、を残念に思う", options: ["を襲う、攻撃する", "秘書", "知恵", "を後悔する、を残念に思う"] },
  { id: "employ", word: "employ", kana: "/employ/", meaning: "を雇用する、を（手段などに）用いる", options: ["を雇用する、を（手段などに）用いる", "を認める", "わな", "心配して、切望して"] },
  { id: "hire", word: "hire", kana: "/hire/", meaning: "を雇う", options: ["を治す、癒す", "世帯", "目的地", "を雇う"] },
  { id: "absorb", word: "absorb", kana: "/absorb/", meaning: "（人）を夢中にさせる", options: ["（人）を夢中にさせる", "仮説", "理解する", "要因、要素"] },
  { id: "expose", word: "expose", kana: "/expose/", meaning: "をさらす", options: ["練習", "をさらす", "を限定する", "勇気"] },
  { id: "breathe", word: "breathe", kana: "/breathe/", meaning: "呼吸する", options: ["呼吸する", "を怠る", "広大な", "の特徴を述べる"] },
  { id: "root", word: "root", kana: "/root/", meaning: "起源、ルーツ", options: ["恐れて", "を特定する", "起源、ルーツ", "厳しい"] },
  { id: "immigration", word: "immigration", kana: "/immigration/", meaning: "（外国からの）移住", options: ["正当化する", "を混ぜる", "計画", "（外国からの）移住"] },
  { id: "tribe", word: "tribe", kana: "/tribe/", meaning: "部族", options: ["を当惑させる", "場合", "を移す", "部族"] },
  { id: "landscape", word: "landscape", kana: "/landscape/", meaning: "風景", options: ["風景", "自分勝手な", "寛大な", "料金"] },
  { id: "agriculture", word: "agriculture", kana: "/agriculture/", meaning: "農業", options: ["重要でない", "縮む", "農業", "に納得させる"] },
  { id: "soil", word: "soil", kana: "/soil/", meaning: "土壌、土", options: ["土壌、土", "できない", "を集める、拾い集める", "真剣な、本気の"] },
  { id: "mine", word: "mine", kana: "/mine/", meaning: "鉱山", options: ["激しい、強烈な", "議会", "鉱山", "重大な"] },
  { id: "mass", word: "mass", kana: "/mass/", meaning: "大衆", options: ["断固要求する", "大衆", "を大目に見る、の言い訳をする", "（人）に無理やりさせる"] },
  { id: "quarter", word: "quarter", kana: "/quarter/", meaning: "四分の一", options: ["承諾、同意", "を付ける、愛着を抱いている", "四分の一", "同情、共感"] },
  { id: "era", word: "era", kana: "/era/", meaning: "時代", options: ["を制限する", "用心、注意", "時代", "規律、しつけ"] },
  { id: "circumstance", word: "circumstance", kana: "/circumstance/", meaning: "状況、事情", options: ["状況、事情", "似ている", "論争", "奪う"] },
  { id: "phenomenon", word: "phenomenon", kana: "/phenomenon/", meaning: "現象", options: ["めったに…ない", "現象", "を嫌う", "（男女の）性"] },
  { id: "custom", word: "custom", kana: "/custom/", meaning: "（社会の）慣習", options: ["折り畳む", "（社会の）慣習", "（料理の）材料", "鉱山"] },
  { id: "religion", word: "religion", kana: "/religion/", meaning: "宗教", options: ["をやめる", "連続、（連続するものの）順番", "宗教", "量"] },
  { id: "civilization", word: "civilization", kana: "/civilization/", meaning: "文明", options: ["熱", "文明", "を修理する", "を抱く、思いつく"] },
  { id: "universe", word: "universe", kana: "/universe/", meaning: "宇宙", options: ["宇宙", "そのうえ、さらに", "商業的な、営利的な", "出席している、現在の"] },
  { id: "diversity", word: "diversity", kana: "/diversity/", meaning: "多様性", options: ["戦略", "飢えに苦しむ、渇望する", "多様性", "依存する"] },
  { id: "trait", word: "trait", kana: "/trait/", meaning: "（人の性格などの）特性，特徴", options: ["ささやく", "乳児", "咳をする", "（人の性格などの）特性，特徴"] },
  { id: "review", word: "review", kana: "/review/", meaning: "批評、再検討", options: ["うなずく", "奪う", "批評、再検討", "見地"] },
  { id: "occasion", word: "occasion", kana: "/occasion/", meaning: "場合、時", options: ["場合、時", "まいらせる", "追いかける", "引用する"] },
  { id: "campaign", word: "campaign", kana: "/campaign/", meaning: "（政治的、社会的）運動、活動", options: ["予報", "気づいて", "（政治的、社会的）運動、活動", "をひどく嫌う、憎む"] },
  { id: "board", word: "board", kana: "/board/", meaning: "委員会、重役会", options: ["と推定する", "（人の性格などの）特性，特徴", "を発表する", "委員会、重役会"] },
  { id: "facility", word: "facility", kana: "/facility/", meaning: "施設", options: ["を消費する", "施設", "賃金", "に値する"] },
  { id: "court", word: "court", kana: "/court/", meaning: "法廷、裁判所", options: ["法廷、裁判所", "大衆", "即時の", "を意図する、つもりでいる"] },
  { id: "trial", word: "trial", kana: "/trial/", meaning: "裁判", options: ["裁判", "典型的な", "農業", "（人）にあいさつする"] },
  { id: "laboratory", word: "laboratory", kana: "/laboratory/", meaning: "研究所、実験室", options: ["を消費する", "研究所、実験室", "豪華な、雄大な", "絶対的な"] },
  { id: "instrument", word: "instrument", kana: "/instrument/", meaning: "道具、機器", options: ["願望", "栄養摂取", "に祝いの言葉を述べる", "道具、機器"] },
  { id: "instruction", word: "instruction", kana: "/instruction/", meaning: "指示", options: ["乳児", "（人の性格などの）特性，特徴", "裸の", "指示"] },
  { id: "document", word: "document", kana: "/document/", meaning: "書類", options: ["書類", "ごみ", "確信して", "市長"] },
  { id: "target", word: "target", kana: "/target/", meaning: "目標", options: ["跳ぶ", "目標", "に補償する", "光栄"] },
  { id: "outcome", word: "outcome", kana: "/outcome/", meaning: "結果", options: ["に賛成する、を好む", "を救う", "結果", "回復する"] },
  { id: "muscle", word: "muscle", kana: "/muscle/", meaning: "筋肉", options: ["繁栄", "を主催する", "筋肉", "進化する、発展する"] },
  { id: "wage", word: "wage", kana: "/wage/", meaning: "賃金", options: ["賃金", "違反する", "我慢する", "頼る"] },
  { id: "gender", word: "gender", kana: "/gender/", meaning: "（男女の）性", options: ["（男女の）性", "社会の", "教授", "を蓄える"] },
  { id: "confidence", word: "confidence", kana: "/confidence/", meaning: "自信", options: ["勇気", "集める、蓄積する", "自信", "状態、状況"] },
  { id: "credit", word: "credit", kana: "/credit/", meaning: "信用", options: ["をかく", "信用", "寛大な", "熱"] },
  { id: "conscious", word: "conscious", kana: "/conscious/", meaning: "意識して、自覚して", options: ["わずかな", "を大目に見る、の言い訳をする", "意識して、自覚して", "を探し求める"] },
  { id: "anxious", word: "anxious", kana: "/anxious/", meaning: "心配して、切望して", options: ["を設立する", "心配して、切望して", "ちらりと見る", "境界線、国境"] },
  { id: "asleep", word: "asleep", kana: "/asleep/", meaning: "眠って", options: ["眠って", "さえぎる", "極端な", "民族、人種"] },
  { id: "alive", word: "alive", kana: "/alive/", meaning: "生きている", options: ["政府", "革命", "折り畳む", "生きている"] },
  { id: "alike", word: "alike", kana: "/alike/", meaning: "似ている", options: ["ひも、糸", "薬", "似ている", "心地よい、快適な"] },
  { id: "excellent", word: "excellent", kana: "/excellent/", meaning: "秀でている", options: ["（位置、方針など）を変える", "と述べる、言う", "時代", "秀でている"] },
  { id: "odd", word: "odd", kana: "/odd/", meaning: "奇妙な", options: ["分厚い", "を(大量に)製造する", "奇妙な", "錯覚"] },
  { id: "sensitive", word: "sensitive", kana: "/sensitive/", meaning: "敏感な", options: ["危険（性）", "あり得る、可能な", "敏感な", "急ぐ"] },
  { id: "sensible", word: "sensible", kana: "/sensible/", meaning: "賢明な", options: ["広大な", "賢明な", "軽くたたく", "洞察（力）"] },
  { id: "violent", word: "violent", kana: "/violent/", meaning: "暴力的な", options: ["邪悪な", "暴力的な", "定期的な", "即時の"] },
  { id: "military", word: "military", kana: "/military/", meaning: "軍（隊）の、軍事の", options: ["を熱心に勧める", "完全に", "まったく異なる", "軍（隊）の、軍事の"] },
  { id: "nuclear", word: "nuclear", kana: "/nuclear/", meaning: "原子力の、核の", options: ["商人", "つかむ", "原子力の、核の", "曲げる"] },
  { id: "contemporary", word: "contemporary", kana: "/contemporary/", meaning: "現代の", options: ["を満たす", "解決する", "冷蔵庫", "現代の"] },
  { id: "elementary", word: "elementary", kana: "/elementary/", meaning: "初等（教育）の", options: ["一時停止する", "徐々の", "初等（教育）の", "を満足させる"] },
  { id: "annual", word: "annual", kana: "/annual/", meaning: "年１回の", options: ["年１回の", "栄光", "を（滅亡の）危険にさらす", "夜明け"] },
  { id: "chief", word: "chief", kana: "/chief/", meaning: "第一の、主要な", options: ["好奇心の強い", "第一の、主要な", "多数の", "真剣な、本気の"] },
  { id: "actual", word: "actual", kana: "/actual/", meaning: "実際の", options: ["を集中させる", "実際の", "を行う", "任命する"] },
  { id: "virtual", word: "virtual", kana: "/virtual/", meaning: "仮想の", options: ["を疑わしいと思う、ではないと思う", "を計算する", "群衆", "仮想の"] },
  { id: "numerous", word: "numerous", kana: "/numerous/", meaning: "多数の", options: ["苦い、つらい", "体温", "をなんとかやり遂げる、をうまく扱う", "多数の"] },
  { id: "multiple", word: "multiple", kana: "/multiple/", meaning: "多くの(部分から成る)", options: ["を動揺させる", "方言", "多くの(部分から成る)", "思い切って行く"] },
  { id: "widespread", word: "widespread", kana: "/widespread/", meaning: "広範囲にわたる", options: ["鉱山", "を尊敬する", "静かな", "広範囲にわたる"] },
  { id: "sufficient", word: "sufficient", kana: "/sufficient/", meaning: "十分な", options: ["違反する", "を試みる", "哲学", "十分な"] },
  { id: "empty", word: "empty", kana: "/empty/", meaning: "空の", options: ["伝言、メッセージ", "を招待する", "有能な", "空の"] },
  { id: "confirm", word: "confirm", kana: "/confirm/", meaning: "を裏付ける、(本当だと)確認する", options: ["市長", "を裏付ける、(本当だと)確認する", "楽しみ、おもしろいこと（人）", "豪華な、雄大な"] },
  { id: "illustrate", word: "illustrate", kana: "/illustrate/", meaning: "を説明する、を例証する", options: ["いじめる", "概念", "を説明する、を例証する", "持ち物、材料"] },
  { id: "spell", word: "spell", kana: "/spell/", meaning: "（語）をつづる", options: ["巨大な", "実際の", "（語）をつづる", "完全に"] },
  { id: "bother", word: "bother", kana: "/bother/", meaning: "を困らせる", options: ["連続、（連続するものの）順番", "仮想の", "（時間など）を充てる", "を困らせる"] },
  { id: "annoy", word: "annoy", kana: "/annoy/", meaning: "をいらいらさせる、悩ます", options: ["を達成する", "をいらいらさせる、悩ます", "問題", "崇拝"] },
  { id: "disturb", word: "disturb", kana: "/disturb/", meaning: "を邪魔する", options: ["一般的な", "病気", "を邪魔する", "考え"] },
  { id: "discourage", word: "discourage", kana: "/discourage/", meaning: "を思いとどまらせる、を落胆させる", options: ["願望", "を思いとどまらせる、を落胆させる", "を輸出する", "部分"] },
  { id: "embarrass", word: "embarrass", kana: "/embarrass/", meaning: "を当惑させる、に恥ずかしい思いをさせる", options: ["を当惑させる、に恥ずかしい思いをさせる", "一時停止する", "積む", "組合"] },
  { id: "frighten", word: "frighten", kana: "/frighten/", meaning: "を怖がらせる", options: ["傷", "を怖がらせる", "時代", "広範囲な"] },
  { id: "puzzle", word: "puzzle", kana: "/puzzle/", meaning: "を当惑させる", options: ["を当惑させる", "と矛盾する", "に異議を唱える", "浅はかな"] },
  { id: "upset", word: "upset", kana: "/upset/", meaning: "を動揺させる", options: ["委員会", "恥じて", "したがって", "を動揺させる"] },
  { id: "stimulate", word: "stimulate", kana: "/stimulate/", meaning: "を刺激する", options: ["（農）作物", "品目、項目", "祖先", "を刺激する"] },
  { id: "beat", word: "beat", kana: "/beat/", meaning: "を打ち負かす、（続けざまに）打つ", options: ["を打ち負かす、（続けざまに）打つ", "めったに…ない", "苦しむ", "進歩"] },
  { id: "blow", word: "blow", kana: "/blow/", meaning: "（風が）吹く", options: ["資金、基金", "熱帯（地方）の", "（風が）吹く", "守る"] },
  { id: "injure", word: "injure", kana: "/injure/", meaning: "を傷つける", options: ["を思いとどまらせる、を落胆させる", "を傷つける", "観点", "を購入する"] },
  { id: "cure", word: "cure", kana: "/cure/", meaning: "を治す", options: ["残り、息", "を我慢する", "を治す", "できない"] },
  { id: "recover", word: "recover", kana: "/recover/", meaning: "回復する", options: ["並外れた", "気づいて", "回復する", "投資する"] },
  { id: "overcome", word: "overcome", kana: "/overcome/", meaning: "を克服する", options: ["に乗り遅れる", "従事する、を引き入れる", "を克服する", "伝統"] },
  { id: "quit", word: "quit", kana: "/quit/", meaning: "をやめる", options: ["信じられない", "隠す", "民族、人種", "をやめる"] },
  { id: "transfer", word: "transfer", kana: "/transfer/", meaning: "を移す", options: ["を囲む", "（物や時間の）長さ", "を移す", "表面"] },
  { id: "transport", word: "transport", kana: "/transport/", meaning: "を輸送する", options: ["ちらりと見えること", "を産出する、（利益など）を生む、屈する", "を輸送する", "大陸"] },
  { id: "export", word: "export", kana: "/export/", meaning: "を輸出する", options: ["を輸出する", "迅速な", "提出する", "を（引っ張って）伸ばす、広げる"] },
  { id: "import", word: "import", kana: "/import/", meaning: "を輸入する", options: ["を輸入する", "（文章の）一節", "に反対する", "を無視する"] },
  { id: "invest", word: "invest", kana: "/invest/", meaning: "投資する", options: ["恐れて", "使命、任務", "海軍", "投資する"] },
  { id: "investigate", word: "investigate", kana: "/investigate/", meaning: "を調査する", options: ["思索する", "投げかける", "（長期的な）気候", "を調査する"] },
  { id: "manufacture", word: "manufacture", kana: "/manufacture/", meaning: "を(大量に)製造する", options: ["を(大量に)製造する", "（伝達などの）媒体", "を混同する", "（物や時間の）長さ"] },
  { id: "react", word: "react", kana: "/react/", meaning: "反応する", options: ["一般的な", "知識", "反応する", "を明らかにする、暴露する"] },
  { id: "award", word: "award", kana: "/award/", meaning: "（人）に（賞など）を授与する", options: ["（人）に（賞など）を授与する", "額縁", "適切な", "を購入する"] },
  { id: "ban", word: "ban", kana: "/ban/", meaning: "を（公式に）禁止する", options: ["を限定する", "を（公式に）禁止する", "苦しむ", "をさらす"] },
  { id: "prohibit", word: "prohibit", kana: "/prohibit/", meaning: "を禁止する", options: ["影響、効果", "を禁止する", "醜い", "労働"] },
  { id: "forbid", word: "forbid", kana: "/forbid/", meaning: "を禁じる", options: ["を禁じる", "場所、用地", "熱中して", "自慢する"] },
  { id: "abandon", word: "abandon", kana: "/abandon/", meaning: "を捨てる", options: ["を捨てる", "を保護する", "空いている", "会社"] },
  { id: "freeze", word: "freeze", kana: "/freeze/", meaning: "凍る", options: ["凍る", "仮説", "叫び声をあげる", "修正する"] },
  { id: "lift", word: "lift", kana: "/lift/", meaning: "を持ち上げる", options: ["を解決する", "を持ち上げる", "を出版する", "科学技術"] },
  { id: "hang", word: "hang", kana: "/hang/", meaning: "を掛ける", options: ["減る", "準備する", "宝物", "を掛ける"] },
  { id: "shake", word: "shake", kana: "/shake/", meaning: "を振る", options: ["理解する", "を振る", "収穫", "を（きちんと）並べる、手はずを整える"] },
  { id: "stretch", word: "stretch", kana: "/stretch/", meaning: "を（引っ張って）伸ばす、広げる", options: ["書類", "（心理）療法", "初等（教育）の", "を（引っ張って）伸ばす、広げる"] },
  { id: "lay", word: "lay", kana: "/lay/", meaning: "を置く、敷く", options: ["を置く、敷く", "を開発する", "異質の", "を取り替える"] },
  { id: "stare", word: "stare", kana: "/stare/", meaning: "じっと見つめる", options: ["じっと見つめる", "投げかける", "方言", "会社"] },
  { id: "gaze", word: "gaze", kana: "/gaze/", meaning: "見つめる", options: ["なぞ", "青白い", "見つめる", "を延長する"] },
  { id: "capture", word: "capture", kana: "/capture/", meaning: "を捕らえる", options: ["（位置、方針など）を変える", "を退屈させる", "を捕らえる", "を設計する"] },
  { id: "breed", word: "breed", kana: "/breed/", meaning: "を繁殖させる、飼育する、（動物が）子を産む", options: ["ぎゅっとつかむ,理解する", "を繁殖させる、飼育する、（動物が）子を産む", "を当惑させる、に恥ずかしい思いをさせる", "隣人、近所の人"] },
  { id: "mammal", word: "mammal", kana: "/mammal/", meaning: "哺乳類、哺乳動物", options: ["（対戦相手）を負かす", "収穫", "おじぎする", "哺乳類、哺乳動物"] },
  { id: "ape", word: "ape", kana: "/ape/", meaning: "類人猿", options: ["質", "類人猿", "大胆な", "を当惑させる、に恥ずかしい思いをさせる"] },
  { id: "insect", word: "insect", kana: "/insect/", meaning: "昆虫", options: ["を試みる", "を（きちんと）並べる、手はずを整える", "昆虫", "豊富な"] },
  { id: "infant", word: "infant", kana: "/infant/", meaning: "乳児", options: ["伝統", "乳児", "（物が）可動［移動］式の", "（伝達などの）媒体"] },
  { id: "organ", word: "organ", kana: "/organ/", meaning: "臓器", options: ["手がかり", "反感を持った、敵意のある", "原子力の、核の", "臓器"] },
  { id: "web", word: "web", kana: "/web/", meaning: "（ワールドワイド）ウェブ", options: ["伝言、メッセージ", "（農）作物", "（総）量、体積、容積", "（ワールドワイド）ウェブ"] },
  { id: "fossil", word: "fossil", kana: "/fossil/", meaning: "化石", options: ["（車などが通った）跡", "化石", "を計算する", "信頼"] },
  { id: "battle", word: "battle", kana: "/battle/", meaning: "戦闘", options: ["戦闘", "源", "谷", "を選び取る、を摘む"] },
  { id: "enemy", word: "enemy", kana: "/enemy/", meaning: "敵", options: ["を組み合わせる", "水平線、地平線", "海の", "敵"] },
  { id: "weapon", word: "weapon", kana: "/weapon/", meaning: "兵器、武器", options: ["を勧める", "兵器、武器", "著者", "超える"] },
  { id: "arm", word: "arm", kana: "/arm/", meaning: "腕、武器、兵器", options: ["に出席する", "小作農", "腕、武器、兵器", "（人）に無理やりさせる"] },
  { id: "army", word: "army", kana: "/army/", meaning: "陸軍", options: ["陸軍", "（苦痛など）を和らげる、（不安など）を減らす", "を主催する、準備する", "殺害する"] },
  { id: "navy", word: "navy", kana: "/navy/", meaning: "海軍", options: ["仮説", "法律（上）の", "搾取する", "海軍"] },
  { id: "border", word: "border", kana: "/border/", meaning: "境界線、国境", options: ["装備する", "をまき散らす", "境界線、国境", "内部の"] },
  { id: "barrier", word: "barrier", kana: "/barrier/", meaning: "障壁", options: ["を出版する", "障壁", "を輸入する", "理解する"] },
  { id: "philosophy", word: "philosophy", kana: "/philosophy/", meaning: "哲学", options: ["離婚", "協力、共同", "（伝達などの）媒体", "哲学"] },
  { id: "psychology", word: "psychology", kana: "/psychology/", meaning: "心理学", options: ["迅速な", "（景色、事件などの）背景", "心理学", "に祝いの言葉を述べる"] },
  { id: "alarm", word: "alarm", kana: "/alarm/", meaning: "警報（機）；目覚まし時計", options: ["めったに…ない", "警報（機）；目覚まし時計", "さえぎる", "へり"] },
  { id: "harm", word: "harm", kana: "/harm/", meaning: "害", options: ["（将来の）展望", "害", "を生産する", "勇敢な"] },
  { id: "depression", word: "depression", kana: "/depression/", meaning: "うつ病、不景気", options: ["（大）企業", "うつ病、不景気", "張り詰めた", "まっすぐな"] },
  { id: "disadvantage", word: "disadvantage", kana: "/disadvantage/", meaning: "不利（な点）", options: ["を改革する、改善する", "不利（な点）", "醜い", "伝言、メッセージ"] },
  { id: "shortage", word: "shortage", kana: "/shortage/", meaning: "不足", options: ["不足", "理解する", "指示", "を押す"] },
  { id: "stock", word: "stock", kana: "/stock/", meaning: "在庫品", options: ["連続、（連続するものの）順番", "地震", "（人）を夢中にさせる", "在庫品"] },
  { id: "loan", word: "loan", kana: "/loan/", meaning: "ローン、貸付金", options: ["ローン、貸付金", "先駆者", "痛み、骨折り、苦労", "を認める"] },
  { id: "budget", word: "budget", kana: "/budget/", meaning: "予算（案）", options: ["儀式", "を克服する", "予算（案）", "頻繁な"] },
  { id: "innovation", word: "innovation", kana: "/innovation/", meaning: "革新", options: ["革新", "を繁殖させる、飼育する、（動物が）子を産む", "静かな", "を動揺させる"] },
  { id: "union", word: "union", kana: "/union/", meaning: "組合", options: ["避難（所）", "得意客", "組合", "おしゃべりをする"] },
  { id: "unit", word: "unit", kana: "/unit/", meaning: "（最小）単位", options: ["永続的な", "（最小）単位", "やせた", "航海"] },
  { id: "material", word: "material", kana: "/material/", meaning: "材料、原料", options: ["材料、原料", "部門、分野", "を確保する", "裸の"] },
  { id: "substance", word: "substance", kana: "/substance/", meaning: "物質", options: ["物質", "前の", "正確な", "褒美"] },
  { id: "stuff", word: "stuff", kana: "/stuff/", meaning: "持ち物、材料", options: ["異質の", "持ち物、材料", "を傷つける", "きちんとした"] },
  { id: "proportion", word: "proportion", kana: "/proportion/", meaning: "割合", options: ["反応する", "合理的な", "精神の", "割合"] },
  { id: "edge", word: "edge", kana: "/edge/", meaning: "へり", options: ["その土地の、地元の", "へり", "原子", "と述べる、言う"] },
  { id: "code", word: "code", kana: "/code/", meaning: "規範；暗号", options: ["緊急（事態）", "を受け取る", "全体の", "規範；暗号"] },
  { id: "mystery", word: "mystery", kana: "/mystery/", meaning: "なぞ", options: ["なぞ", "商人", "粗い", "会社"] },
  { id: "curious", word: "curious", kana: "/curious/", meaning: "好奇心の強い", options: ["通勤[通学]する", "特徴", "好奇心の強い", "ためらう、躊躇する"] },
  { id: "strict", word: "strict", kana: "/strict/", meaning: "厳しい", options: ["厳しい", "イメージ、印象", "じっと見つめる", "話"] },
  { id: "frank", word: "frank", kana: "/frank/", meaning: "率直な", options: ["目撃者", "率直な", "育てる", "道具、機器"] },
  { id: "polite", word: "polite", kana: "/polite/", meaning: "丁寧な", options: ["を雇用する、を（手段などに）用いる", "いじめる", "丁寧な", "（車などが通った）跡"] },
  { id: "aggressive", word: "aggressive", kana: "/aggressive/", meaning: "攻撃的な", options: ["従来の、ありきたりの", "攻撃的な", "嫉妬深い", "を怖がらせる"] },
  { id: "accurate", word: "accurate", kana: "/accurate/", meaning: "正確な", options: ["苦い、つらい", "正確な", "流ちょうな", "をさらす"] },
  { id: "exact", word: "exact", kana: "/exact/", meaning: "正確な", options: ["道（筋）", "さえぎる", "明確な", "正確な"] },
  { id: "proper", word: "proper", kana: "/proper/", meaning: "適切な", options: ["（人）を夢中にさせる", "適切な", "だます", "おじぎする"] },
  { id: "brief", word: "brief", kana: "/brief/", meaning: "短時間の", options: ["短時間の", "影響", "逃れる、脱出する、を免れる", "雰囲気"] },
  { id: "extraordinary", word: "extraordinary", kana: "/extraordinary/", meaning: "並外れた", options: ["（対戦相手）を負かす", "並外れた", "残り、息", "境界（線）"] },
  { id: "flexible", word: "flexible", kana: "/flexible/", meaning: "柔軟な", options: ["を調べる", "柔軟な", "（男女の）性", "正しい"] },
  { id: "pleasant", word: "pleasant", kana: "/pleasant/", meaning: "快い、楽しい", options: ["快い、楽しい", "即座の", "を打ち負かす、（続けざまに）打つ", "をまねる"] },
  { id: "comfortable", word: "comfortable", kana: "/comfortable/", meaning: "心地よい、快適な", options: ["適切な", "根本的な", "とてつもない", "心地よい、快適な"] },
  { id: "stable", word: "stable", kana: "/stable/", meaning: "安定した", options: ["安定した", "合理的な", "を示す", "に安心させる"] },
  { id: "thick", word: "thick", kana: "/thick/", meaning: "分厚い", options: ["福祉", "分厚い", "恐れ、予兆", "薬"] },
  { id: "thin", word: "thin", kana: "/thin/", meaning: "やせた", options: ["だます", "普通の", "やせた", "を決定する"] },
  { id: "abstract", word: "abstract", kana: "/abstract/", meaning: "抽象的な", options: ["痛み、骨折り、苦労", "の特徴を述べる", "抽象的な", "（空間、時間的に）離れて"] },
  { id: "concrete", word: "concrete", kana: "/concrete/", meaning: "具体的な", options: ["隣人、近所の人", "を持つ余裕がある", "具体的な", "を経営する"] },
  { id: "absolute", word: "absolute", kana: "/absolute/", meaning: "絶対的な", options: ["を（事実と）認める", "絶対的な", "源", "注ぐ"] },
  { id: "prime", word: "prime", kana: "/prime/", meaning: "最も重要な，第一の", options: ["（物、体の一部）に損害を与える", "文学", "を変装させる", "最も重要な，第一の"] },
  { id: "vital", word: "vital", kana: "/vital/", meaning: "極めて重要な", options: ["伝える", "逃れる、脱出する、を免れる", "気前のよい", "極めて重要な"] },
  { id: "contrary", word: "contrary", kana: "/contrary/", meaning: "相反する", options: ["したがって", "相反する", "燃料", "投げかける"] },
  { id: "regardless", word: "regardless", kana: "/regardless/", meaning: "気にかけない", options: ["気にかけない", "ひどい", "に値する", "電気"] },
  { id: "permit", word: "permit", kana: "/permit/", meaning: "許可する", options: ["手による", "許可する", "自慢する", "を探検する"] },
  { id: "suspect", word: "suspect", kana: "/suspect/", meaning: "ではないかと思う", options: ["（所定の）位置、場所、立場", "ではないかと思う", "回復する", "年１回の"] },
  { id: "pursue", word: "pursue", kana: "/pursue/", meaning: "を追求する、（仕事など）に従事する", options: ["（人）に（物）を（求めに応じて）与える", "（行事など）を祝う", "を追求する、（仕事など）に従事する", "利用、入手"] },
  { id: "pretend", word: "pretend", kana: "/pretend/", meaning: "ふりをする", options: ["真剣な、本気の", "行動する", "ふりをする", "を混ぜる"] },
  { id: "calculate", word: "calculate", kana: "/calculate/", meaning: "を計算する", options: ["飢えに苦しむ、渇望する", "空白の", "を（～のことで）責める(for)、を（～の）せいにする(on)", "を計算する"] },
  { id: "guarantee", word: "guarantee", kana: "/guarantee/", meaning: "を保証する、確約する", options: ["曲がりくねる", "を保証する、確約する", "を扱う、を治療する", "確信して、ある程度の"] },
  { id: "acknowledge", word: "acknowledge", kana: "/acknowledge/", meaning: "を認める", options: ["有能な", "遅れ", "を認める", "を失望させる"] },
  { id: "impress", word: "impress", kana: "/impress/", meaning: "を感動させる", options: ["意見が合わない", "結果", "ぜいたく（品）", "を感動させる"] },
  { id: "urge", word: "urge", kana: "/urge/", meaning: "を熱心に勧める", options: ["を付ける、愛着を抱いている", "をそれとわかる", "を熱心に勧める", "宇宙"] },
  { id: "convey", word: "convey", kana: "/convey/", meaning: "を伝達する", options: ["質", "と主張する", "を伝達する", "～媒介で"] },
  { id: "celebrate", word: "celebrate", kana: "/celebrate/", meaning: "（行事など）を祝う", options: ["（行事など）を祝う", "卒業する", "腕、武器、兵器", "危機"] },
  { id: "admire", word: "admire", kana: "/admire/", meaning: "感嘆する", options: ["解雇する", "訴える", "感嘆する", "応答する"] },
  { id: "devote", word: "devote", kana: "/devote/", meaning: "（時間など）を充てる", options: ["意識して、自覚して", "寄付する", "相反する", "（時間など）を充てる"] },
  { id: "dominate", word: "dominate", kana: "/dominate/", meaning: "を支配する、統治する", options: ["性格", "を支配する、統治する", "反対する", "稲妻"] },
  { id: "eliminate", word: "eliminate", kana: "/eliminate/", meaning: "を取り除く", options: ["相手、敵", "を取り除く", "を発表する", "章"] },
  { id: "restrict", word: "restrict", kana: "/restrict/", meaning: "を制限する", options: ["苦い、つらい", "（国家などの）経済", "海の", "を制限する"] },
  { id: "isolate", word: "isolate", kana: "/isolate/", meaning: "を切り離す", options: ["抗議する", "を切り離す", "並外れた", "論題、話題"] },
  { id: "endanger", word: "endanger", kana: "/endanger/", meaning: "を（滅亡の）危険にさらす", options: ["を身に着けている", "を（滅亡の）危険にさらす", "修正する", "を弱める"] },
  { id: "secure", word: "secure", kana: "/secure/", meaning: "を確保する", options: ["反対する", "比率", "（最小）単位", "を確保する"] },
  { id: "reserve", word: "reserve", kana: "/reserve/", meaning: "を予約する", options: ["相反する", "を予約する", "を共同で使う", "編集者"] },
  { id: "possess", word: "possess", kana: "/possess/", meaning: "（性質・能力など）を持っている", options: ["（性質・能力など）を持っている", "残念なこと", "最も重要な，第一の", "絶対的な"] },
  { id: "launch", word: "launch", kana: "/launch/", meaning: "を始める", options: ["縛る", "ボランティア", "変化のない", "を始める"] },
  { id: "detect", word: "detect", kana: "/detect/", meaning: "を見つける、検出する", options: ["自信", "雰囲気", "撃つ", "を見つける、検出する"] },
  { id: "reverse", word: "reverse", kana: "/reverse/", meaning: "を逆転させる、転換する", options: ["（男女の）性", "を逆転させる、転換する", "を維持する、を主張する", "敏感な"] },
  { id: "convert", word: "convert", kana: "/convert/", meaning: "を変える", options: ["を処分する", "悲観的な", "を変える", "楽しみ、おもしろいこと（人）"] },
  { id: "hurry", word: "hurry", kana: "/hurry/", meaning: "急ぐ", options: ["急ぐ", "微妙な", "を完成させる", "観衆、聴衆"] },
  { id: "rush", word: "rush", kana: "/rush/", meaning: "急いで行く", options: ["複雑な", "に（偶然）出会う", "災害", "急いで行く"] },
  { id: "roll", word: "roll", kana: "/roll/", meaning: "転がる", options: ["転がる", "（心理）療法", "無限の", "安定した"] },
  { id: "crash", word: "crash", kana: "/crash/", meaning: "（大きな音を立てて）衝突する", options: ["交通（量）", "式典、儀式", "（大きな音を立てて）衝突する", "分析"] },
  { id: "bury", word: "bury", kana: "/bury/", meaning: "を埋める", options: ["台無しにする", "を埋める", "急速な", "借金"] },
  { id: "dig", word: "dig", kana: "/dig/", meaning: "を掘る", options: ["率直な", "を掘る", "極めて重要な", "の重さがある、の重さを量る"] },
  { id: "attach", word: "attach", kana: "/attach/", meaning: "を付ける、愛着を抱いている", options: ["敏感な", "を付ける、愛着を抱いている", "卒業する", "満たす"] },
  { id: "melt", word: "melt", kana: "/melt/", meaning: "（熱で）溶ける", options: ["（熱で）溶ける", "元の", "等しい、平等な", "薬"] },
  { id: "accompany", word: "accompany", kana: "/accompany/", meaning: "と一緒に行く", options: ["を禁じる", "沸かす", "めったに…ない", "と一緒に行く"] },
  { id: "assist", word: "assist", kana: "/assist/", meaning: "（人）を手伝う", options: ["構成する", "前の", "（人）を手伝う", "選挙"] },
  { id: "cope", word: "cope", kana: "/cope/", meaning: "（うまく）対処する", options: ["氷河", "を処分する", "（うまく）対処する", "稲妻"] },
  { id: "lend", word: "lend", kana: "/lend/", meaning: "（人）に（物）を貸す", options: ["伝説", "（人）に（物）を貸す", "役に立つ", "心地よい、快適な"] },
  { id: "rent", word: "rent", kana: "/rent/", meaning: "を賃借りする", options: ["請求書、勘定（書）", "飢饉", "を賃借りする", "手段"] },
  { id: "owe", word: "owe", kana: "/owe/", meaning: "（人）に（金など）を借りている、おかげである", options: ["成る、（本質が）ある", "地上", "（人）に（金など）を借りている、おかげである", "観点"] },
  { id: "apologize", word: "apologize", kana: "/apologize/", meaning: "謝る", options: ["に補償する", "謝る", "を裏付ける、(本当だと)確認する", "秘書"] },
  { id: "forgive", word: "forgive", kana: "/forgive/", meaning: "（人の罪など）を許す", options: ["（人の罪など）を許す", "引きずる", "出来事", "身体の"] },
  { id: "tongue", word: "tongue", kana: "/tongue/", meaning: "言語", options: ["に到着する", "掃く", "勇気", "言語"] },
  { id: "dialect", word: "dialect", kana: "/dialect/", meaning: "方言", options: ["論理", "を持つ余裕がある", "方言", "残念なことに"] },
  { id: "accent", word: "accent", kana: "/accent/", meaning: "なまり、方言", options: ["（物質的、精神的）利益", "なまり、方言", "境界（線）", "外部の"] },
  { id: "colony", word: "colony", kana: "/colony/", meaning: "植民（地）", options: ["すぐ近くの", "植民（地）", "隠す", "迅速な"] },
  { id: "grain", word: "grain", kana: "/grain/", meaning: "穀物", options: ["穀物", "人間の", "抱きしめる", "広範囲な"] },
  { id: "harvest", word: "harvest", kana: "/harvest/", meaning: "収穫", options: ["崩壊する、倒れる", "収穫", "着実な", "（広大な）地域"] },
  { id: "ingredient", word: "ingredient", kana: "/ingredient/", meaning: "（料理の）材料", options: ["楽しみ、おもしろいこと（人）", "（料理の）材料", "見えること", "装備する"] },
  { id: "portion", word: "portion", kana: "/portion/", meaning: "部分、（食べ物の）一人前", options: ["沸かす", "を掘る", "部分、（食べ物の）一人前", "特有の"] },
  { id: "hunger", word: "hunger", kana: "/hunger/", meaning: "飢え", options: ["見地", "結合する", "投票", "飢え"] },
  { id: "obesity", word: "obesity", kana: "/obesity/", meaning: "肥満", options: ["を抱く、思いつく", "肥満", "役割", "を（引っ張って）伸ばす、広げる"] },
  { id: "burden", word: "burden", kana: "/burden/", meaning: "（精神的）負担、重荷", options: ["建築（学）", "ユーモア", "装飾する", "（精神的）負担、重荷"] },
  { id: "emergency", word: "emergency", kana: "/emergency/", meaning: "緊急（事態）", options: ["を導く", "緊急（事態）", "観点", "理論"] },
  { id: "debt", word: "debt", kana: "/debt/", meaning: "借金", options: ["争い", "（うまく）対処する", "を思い出す", "借金"] },
  { id: "contract", word: "contract", kana: "/contract/", meaning: "契約", options: ["を移す", "巨大な", "じっと見つめる", "契約"] },
  { id: "client", word: "client", kana: "/client/", meaning: "得意客", options: ["を持続させる", "得意客", "類人猿", "理由"] },
  { id: "therapy", word: "therapy", kana: "/therapy/", meaning: "（心理）療法", options: ["おじぎする", "つかむ", "腕、武器、兵器", "（心理）療法"] },
  { id: "physician", word: "physician", kana: "/physician/", meaning: "内科医、医師", options: ["手段", "を怠る", "内科医、医師", "縮む"] },
  { id: "democracy", word: "democracy", kana: "/democracy/", meaning: "民主主義", options: ["宗教", "伝染病", "民主主義", "予期する"] },
  { id: "election", word: "election", kana: "/election/", meaning: "選挙", options: ["劣った", "選挙", "笑わせる", "威信、名声"] },
  { id: "vote", word: "vote", kana: "/vote/", meaning: "投票", options: ["投票", "才能", "困難な", "典型的な"] },
  { id: "candidate", word: "candidate", kana: "/candidate/", meaning: "候補者", options: ["疫病", "候補者", "基本の", "人工の"] },
  { id: "minister", word: "minister", kana: "/minister/", meaning: "大臣", options: ["賢明な", "手段", "を変える", "大臣"] },
  { id: "conference", word: "conference", kana: "/conference/", meaning: "会議", options: ["流れる", "目に見える", "時代", "会議"] },
  { id: "ceremony", word: "ceremony", kana: "/ceremony/", meaning: "式典、儀式", options: ["候補者", "式典、儀式", "選挙", "群衆"] },
  { id: "institution", word: "institution", kana: "/institution/", meaning: "機関、制度", options: ["機関、制度", "地上", "遠い", "世代"] },
  { id: "corporation", word: "corporation", kana: "/corporation/", meaning: "（大）企業", options: ["褒美", "を集中させる", "（大）企業", "多様（性）"] },
  { id: "cooperation", word: "cooperation", kana: "/cooperation/", meaning: "協力、共同", options: ["を励ます", "誤った", "信頼", "協力、共同"] },
  { id: "authority", word: "authority", kana: "/authority/", meaning: "当局", options: ["名声", "当局", "きっと～だと思う", "説明する"] },
  { id: "theme", word: "theme", kana: "/theme/", meaning: "主題、テーマ", options: ["異なる", "手による", "楽しみ、おもしろいこと（人）", "主題、テーマ"] },
  { id: "notion", word: "notion", kana: "/notion/", meaning: "考え", options: ["威信、名声", "むしろ、かなり", "人間の", "考え"] },
  { id: "hypothesis", word: "hypothesis", kana: "/hypothesis/", meaning: "仮説", options: ["環境", "仮説", "懸命の努力、奮闘", "曲げる"] },
  { id: "discipline", word: "discipline", kana: "/discipline/", meaning: "規律、しつけ", options: ["規律、しつけ", "を治す、癒す", "商人", "列"] },
  { id: "route", word: "route", kana: "/route/", meaning: "道（筋）", options: ["道（筋）", "（課された）任務、仕事", "物質", "を信頼する"] },
  { id: "routine", word: "routine", kana: "/routine/", meaning: "日課、決まりきった仕事", options: ["使われていない、仕事がない", "を思いとどまらせる、を落胆させる", "をかく", "日課、決まりきった仕事"] },
  { id: "destination", word: "destination", kana: "/destination/", meaning: "目的地", options: ["引退する", "犯罪", "目的地", "ごみ"] },
  { id: "domestic", word: "domestic", kana: "/domestic/", meaning: "国内の", options: ["無限の", "返事を出す", "類人猿", "国内の"] },
  { id: "ethnic", word: "ethnic", kana: "/ethnic/", meaning: "民族の、人種の", options: ["…だけれども", "民族の、人種の", "を身に着けている", "ひどい"] },
  { id: "alien", word: "alien", kana: "/alien/", meaning: "異質の", options: ["四分の一", "を反映する、を反射する", "最も重要な", "異質の"] },
  { id: "visible", word: "visible", kana: "/visible/", meaning: "目に見える", options: ["好ましくない、消極的な", "目に見える", "（考え、方針）を採用する", "を捨てる"] },
  { id: "verbal", word: "verbal", kana: "/verbal/", meaning: "言葉による", options: ["したがって、その結果", "準備する", "傷", "言葉による"] },
  { id: "fundamental", word: "fundamental", kana: "/fundamental/", meaning: "基本の", options: ["を観察する", "基本の", "高価な", "迅速な"] },
  { id: "conventional", word: "conventional", kana: "/conventional/", meaning: "従来の、ありきたりの", options: ["後で", "才能", "従来の、ありきたりの", "（空間、時間的に）離れて"] },
  { id: "relevant", word: "relevant", kana: "/relevant/", meaning: "関係のある", options: ["策略、いたずら", "割引", "応答する", "関係のある"] },
  { id: "rational", word: "rational", kana: "/rational/", meaning: "合理的な", options: ["無礼な", "合理的な", "侮辱する", "（性質・能力など）を持っている"] },
  { id: "precise", word: "precise", kana: "/precise/", meaning: "正確な", options: ["正確な", "群衆", "消えていく", "用心、注意"] },
  { id: "principal", word: "principal", kana: "/principal/", meaning: "主要な", options: ["段階", "主要な", "明確な", "（心理）療法"] },
  { id: "crucial", word: "crucial", kana: "/crucial/", meaning: "重大な", options: ["（主に人文系の）学者", "遺伝子", "重大な", "快い、楽しい"] },
  { id: "permanent", word: "permanent", kana: "/permanent/", meaning: "永続的な", options: ["永続的な", "異なる、多様である", "きっと～だと思う", "実験"] },
  { id: "intense", word: "intense", kana: "/intense/", meaning: "激しい、強烈な", options: ["熱望して", "卒業する", "激しい、強烈な", "搾取する"] },
  { id: "equivalent", word: "equivalent", kana: "/equivalent/", meaning: "相当する", options: ["(生）ごみ", "（物質的、精神的）利益", "相当する", "書類"] },
  { id: "frequent", word: "frequent", kana: "/frequent/", meaning: "頻繁な", options: ["頻繁な", "抱きしめる", "（うまく）対処する", "共通の"] },
  { id: "sudden", word: "sudden", kana: "/sudden/", meaning: "急な", options: ["を命ずる", "栄光", "急な", "ひどい"] },
  { id: "temporary", word: "temporary", kana: "/temporary/", meaning: "臨時の、一時的な", options: ["（会、団体、人）に加わる", "記憶（力）", "郊外", "臨時の、一時的な"] },
  { id: "internal", word: "internal", kana: "/internal/", meaning: "内部の", options: ["徹底的な", "を(大量に)製造する", "ことわざ", "内部の"] },
  { id: "external", word: "external", kana: "/external/", meaning: "外部の", options: ["を尋ねる", "外部の", "世界", "巨大な、莫大な"] },
  { id: "distinct", word: "distinct", kana: "/distinct/", meaning: "まったく異なる", options: ["まったく異なる", "固執する、しつこく続ける", "粗い", "広範囲にわたる"] },
  { id: "extinct", word: "extinct", kana: "/extinct/", meaning: "絶滅した", options: ["絶滅した", "（…に）順応する(to)", "（人）に無理やりさせる", "観衆、聴衆"] },
  { id: "exhausted", word: "exhausted", kana: "/exhausted/", meaning: "疲れ果てた", options: ["を満足させる", "疲れ果てた", "不足", "を結びつける"] },
  { id: "evil", word: "evil", kana: "/evil/", meaning: "邪悪な", options: ["邪悪な", "情熱", "を繰り返す", "田園の、田舎の"] },
  { id: "greet", word: "greet", kana: "/greet/", meaning: "（人）にあいさつする", options: ["世界", "（人）にあいさつする", "を大目に見る、の言い訳をする", "政治の"] },
  { id: "chat", word: "chat", kana: "/chat/", meaning: "おしゃべりをする", options: ["境界線、国境", "おしゃべりをする", "必要な", "指示"] },
  { id: "remark", word: "remark", kana: "/remark/", meaning: "と述べる、言う", options: ["と述べる、言う", "を設計する", "を集中させる", "（はっきりと）理解する"] },
  { id: "command", word: "command", kana: "/command/", meaning: "を命ずる", options: ["を命ずる", "固体の、しっかりした", "を供給する", "積む"] },
  { id: "utter", word: "utter", kana: "/utter/", meaning: "（言葉など）を発する", options: ["規範；暗号", "（ワールドワイド）ウェブ", "原子力の、核の", "（言葉など）を発する"] },
  { id: "declare", word: "declare", kana: "/declare/", meaning: "を宣言する", options: ["教育", "理解する", "を宣言する", "傾向がある"] },
  { id: "pronounce", word: "pronounce", kana: "/pronounce/", meaning: "を発音する", options: ["を発音する", "戦闘", "腕、武器、兵器", "思い切って行く"] },
  { id: "correspond", word: "correspond", kana: "/correspond/", meaning: "一致する、（手紙などで）連絡を取り合う", options: ["絶望", "利用できる、入手できる", "一致する、（手紙などで）連絡を取り合う", "驚くほどの"] },
  { id: "imitate", word: "imitate", kana: "/imitate/", meaning: "をまねる", options: ["をまねる", "起源、ルーツ", "話", "を含む"] },
  { id: "resemble", word: "resemble", kana: "/resemble/", meaning: "に似ている", options: ["革新", "注ぐ", "心地よい、快適な", "に似ている"] },
  { id: "exhibit", word: "exhibit", kana: "/exhibit/", meaning: "を（展覧会などに）展示する、（感情、兆候など）を示す", options: ["（仕事など）を割り当てる", "を（展覧会などに）展示する、（感情、兆候など）を示す", "を予約する", "所属している、ものである"] },
  { id: "distribute", word: "distribute", kana: "/distribute/", meaning: "を分配する", options: ["犠牲", "用心、注意", "を分配する", "予報"] },
  { id: "attribute", word: "attribute", kana: "/attribute/", meaning: "（結果）を（～の）せい[おかげ]と考える(on)", options: ["に思い出させる", "（結果）を（～の）せい[おかげ]と考える(on)", "つかむ", "解決する"] },
  { id: "evaluate", word: "evaluate", kana: "/evaluate/", meaning: "を評価する", options: ["押しつける", "王室の", "予算（案）", "を評価する"] },
  { id: "assess", word: "assess", kana: "/assess/", meaning: "を評価する", options: ["（サービスに対する）料金", "遺伝子", "罰する", "を評価する"] },
  { id: "deserve", word: "deserve", kana: "/deserve/", meaning: "に値する", options: ["（性質・能力など）を持っている", "明らかな", "に値する", "わずかな"] },
  { id: "weigh", word: "weigh", kana: "/weigh/", meaning: "の重さがある、の重さを量る", options: ["を刺激する", "絶え間ない", "対照", "の重さがある、の重さを量る"] },
  { id: "strengthen", word: "strengthen", kana: "/strengthen/", meaning: "を強くする", options: ["耳が聞こえない", "を治す、癒す", "を強くする", "搾取する"] },
  { id: "weaken", word: "weaken", kana: "/weaken/", meaning: "を弱める", options: ["を弱める", "を予測する", "爆発する", "ぜいたく（品）"] },
  { id: "approve", word: "approve", kana: "/approve/", meaning: "賛成する", options: ["賛成する", "音", "品目、項目", "寛大な"] },
  { id: "assign", word: "assign", kana: "/assign/", meaning: "（仕事など）を割り当てる", options: ["氷河", "秀でている", "（仕事など）を割り当てる", "（料理の）材料"] },
  { id: "sustain", word: "sustain", kana: "/sustain/", meaning: "を持続させる", options: ["を持続させる", "を見なす", "ボランティア", "を逆転させる、転換する"] },
  { id: "accomplish", word: "accomplish", kana: "/accomplish/", meaning: "を成し遂げる", options: ["を成し遂げる", "民主主義", "優先事項", "を熱心に勧める"] },
  { id: "relieve", word: "relieve", kana: "/relieve/", meaning: "（苦痛など）を和らげる、（不安など）を減らす", options: ["敏感な", "遺伝子", "十分な", "（苦痛など）を和らげる、（不安など）を減らす"] },
  { id: "frustrate", word: "frustrate", kana: "/frustrate/", meaning: "に不満を抱かせる", options: ["に不満を抱かせる", "（ワールドワイド）ウェブ", "（喜怒哀楽の）感情", "困難"] },
  { id: "scare", word: "scare", kana: "/scare/", meaning: "を怖がらせる", options: ["率直な", "を怖がらせる", "を調べる", "文明"] },
  { id: "resist", word: "resist", kana: "/resist/", meaning: "を我慢する", options: ["を我慢する", "（人）にあいさつする", "瞬間", "家畜"] },
  { id: "protest", word: "protest", kana: "/protest/", meaning: "抗議する", options: ["伝染病", "抗議する", "をまき散らす", "を禁じる"] },
  { id: "shut", word: "shut", kana: "/shut/", meaning: "を閉める", options: ["（見て）明らかな、見たところ?らしい", "を閉める", "を振る", "を雇用する、を（手段などに）用いる"] },
  { id: "defeat", word: "defeat", kana: "/defeat/", meaning: "（対戦相手）を負かす", options: ["楽観的な", "（行政などの）地区", "（対戦相手）を負かす", "受動的な"] },
  { id: "neglect", word: "neglect", kana: "/neglect/", meaning: "を怠る", options: ["～の味がする", "墓", "を怠る", "を捕らえる"] },
  { id: "retire", word: "retire", kana: "/retire/", meaning: "引退する", options: ["傾向がある", "規律、しつけ", "出来事", "引退する"] },
  { id: "reform", word: "reform", kana: "/reform/", meaning: "を改革する、改善する", options: ["と一緒に行く", "を改革する、改善する", "もう少しで", "を雇用する、を（手段などに）用いる"] },
  { id: "collapse", word: "collapse", kana: "/collapse/", meaning: "崩壊する、倒れる", options: ["授業料", "曲がりくねる", "栄光", "崩壊する、倒れる"] },
  { id: "ruin", word: "ruin", kana: "/ruin/", meaning: "を台無しにする", options: ["を台無しにする", "政治の", "使命、任務", "（風が）吹く"] },
  { id: "sink", word: "sink", kana: "/sink/", meaning: "沈む", options: ["粗い", "（日常の）食事", "沈む", "（問題、困難、機会などが）生じる"] },
  { id: "pile", word: "pile", kana: "/pile/", meaning: "を積み重ねる", options: ["臨時の、一時的な", "正当化する", "を積み重ねる", "航海"] },
  { id: "derive", word: "derive", kana: "/derive/", meaning: "を得る、引き出す、由来する", options: ["進化する、発展する", "をつなぐ", "を得る、引き出す、由来する", "を入浴させる"] },
  { id: "yield", word: "yield", kana: "/yield/", meaning: "を産出する、（利益など）を生む、屈する", options: ["提出する", "収益", "を産出する、（利益など）を生む、屈する", "福祉"] },
  { id: "occupy", word: "occupy", kana: "/occupy/", meaning: "を占める、を占領する", options: ["秀でている", "を占める、を占領する", "根本的な", "運命"] },
  { id: "wrap", word: "wrap", kana: "/wrap/", meaning: "を包む", options: ["を包む", "満たす", "を消化する", "を盗む"] },
  { id: "embrace", word: "embrace", kana: "/embrace/", meaning: "を抱きしめる、（申し出など）を受け入れる", options: ["崩壊する、倒れる", "をつなぐ", "を強調する、力説する", "を抱きしめる、（申し出など）を受け入れる"] },
  { id: "length", word: "length", kana: "/length/", meaning: "（物や時間の）長さ", options: ["気づいて", "（物や時間の）長さ", "相互に作用する", "を当惑させる、に恥ずかしい思いをさせる"] },
  { id: "height", word: "height", kana: "/height/", meaning: "高度", options: ["高度", "手段", "凍る", "を拒絶する"] },
  { id: "volume", word: "volume", kana: "/volume/", meaning: "（総）量、体積、容積", options: ["尊厳", "（総）量、体積、容積", "を邪魔する", "を（無料で）借りる"] },
  { id: "sum", word: "sum", kana: "/sum/", meaning: "金額", options: ["金額", "場合、時", "～と違って", "並外れた"] },
  { id: "frame", word: "frame", kana: "/frame/", meaning: "額縁", options: ["誤った", "（はっきりと）理解する", "額縁", "を付ける、愛着を抱いている"] },
  { id: "boundary", word: "boundary", kana: "/boundary/", meaning: "境界（線）", options: ["を（場所に）置く", "ごみ", "浅はかな", "境界（線）"] },
  { id: "district", word: "district", kana: "/district/", meaning: "（行政などの）地区", options: ["冷静な", "意見が合わない", "を処分する", "（行政などの）地区"] },
  { id: "territory", word: "territory", kana: "/territory/", meaning: "領土", options: ["ありそうな", "奇妙な", "商業的な、営利的な", "領土"] },
  { id: "square", word: "square", kana: "/square/", meaning: "正方形", options: ["会社", "正方形", "後で", "依存する"] },
  { id: "empire", word: "empire", kana: "/empire/", meaning: "帝国", options: ["自由な", "を勧める", "帝国", "疲れ果てた"] },
  { id: "heritage", word: "heritage", kana: "/heritage/", meaning: "（文化、自然）遺産", options: ["病気", "（文化、自然）遺産", "を当惑させる", "懸命の努力、奮闘"] },
  { id: "fee", word: "fee", kana: "/fee/", meaning: "料金", options: ["を探検する", "緊急の", "家具", "料金"] },
  { id: "discount", word: "discount", kana: "/discount/", meaning: "割引", options: ["相互の", "知識", "四分の一", "割引"] },
  { id: "charity", word: "charity", kana: "/charity/", meaning: "慈善事業", options: ["を移す", "余分の", "慈善事業", "を観察する"] },
  { id: "mission", word: "mission", kana: "/mission/", meaning: "使命、任務", options: ["差別", "引退する", "使命、任務", "（定期）収入"] },
  { id: "proffecion", word: "proffecion", kana: "/proffecion/", meaning: "（専門的な）職業", options: ["（専門的な）職業", "適切な", "温暖な", "を尋ねる"] },
  { id: "slave", word: "slave", kana: "/slave/", meaning: "奴隷", options: ["台無しにする", "役に立つ", "奴隷", "に反対する"] },
  { id: "witness", word: "witness", kana: "/witness/", meaning: "目撃者", options: ["調和する", "地理、地理学", "目撃者", "を産出する、（利益など）を生む、屈する"] },
  { id: "incident", word: "incident", kana: "/incident/", meaning: "出来事", options: ["財産", "無罪の", "出来事", "を燃やす"] },
  { id: "insurance", word: "insurance", kana: "/insurance/", meaning: "保険", options: ["厄介な，ぎこちない", "（問題）に取り組む、（人）に演説する", "民族の、人種の", "保険"] },
  { id: "welfare", word: "welfare", kana: "/welfare/", meaning: "福祉", options: ["福祉", "を区別する", "を知覚する", "内科医、医師"] },
  { id: "treasure", word: "treasure", kana: "/treasure/", meaning: "宝物", options: ["現代の", "をうらやむ", "宝物", "汗"] },
  { id: "leisure", word: "leisure", kana: "/leisure/", meaning: "余暇", options: ["嫉妬深い", "余暇", "経歴", "搾取する"] },
  { id: "priority", word: "priority", kana: "/priority/", meaning: "優先事項", options: ["を妨げる", "裸の", "を雇用する、を（手段などに）用いる", "優先事項"] },
  { id: "reputation", word: "reputation", kana: "/reputation/", meaning: "評判", options: ["（長期的な）気候", "思い切って行く", "を持続させる", "評判"] },
  { id: "honor", word: "honor", kana: "/honor/", meaning: "光栄", options: ["言葉による", "（人）にあいさつする", "勇敢な", "光栄"] },
  { id: "statue", word: "statue", kana: "/statue/", meaning: "像、彫像", options: ["像、彫像", "虫歯、衰退、荒廃", "飢えに苦しむ、渇望する", "鉱山"] },
  { id: "architecture", word: "architecture", kana: "/architecture/", meaning: "建築（学）", options: ["建築（学）", "記憶（力）", "まっすぐな", "巨大な、莫大な"] },
  { id: "logic", word: "logic", kana: "/logic/", meaning: "論理", options: ["に思い出させる", "を許す", "見たところ", "論理"] },
  { id: "mechanism", word: "mechanism", kana: "/mechanism/", meaning: "仕組み", options: ["をかき回す、呼び起こす", "仕組み", "仮説", "を捕らえる"] },
  { id: "clue", word: "clue", kana: "/clue/", meaning: "手がかり", options: ["経験", "手がかり", "浅い", "時代"] },
  { id: "means", word: "means", kana: "/means/", meaning: "手段", options: ["（長期的な）気候", "見込み", "手段", "を(大量に)製造する"] },
  { id: "trap", word: "trap", kana: "/trap/", meaning: "わな", options: ["わな", "敵", "遅れ", "を（展覧会などに）展示する、（感情、兆候など）を示す"] },
  { id: "trick", word: "trick", kana: "/trick/", meaning: "策略、いたずら", options: ["を購入する", "策略、いたずら", "成る、（本質が）ある", "具体的な"] },
  { id: "guard", word: "guard", kana: "/guard/", meaning: "警戒；護衛者", options: ["を（公式に）禁止する", "警戒；護衛者", "問題", "を抱く、思いつく"] },
  { id: "innocent", word: "innocent", kana: "/innocent/", meaning: "無罪の", options: ["身体の", "（人）を手伝う", "無罪の", "祖先"] },
  { id: "guilty", word: "guilty", kana: "/guilty/", meaning: "罪悪感のある、有罪の", options: ["救急車", "（性質・能力など）を持っている", "罪悪感のある、有罪の", "転がる"] },
  { id: "rude", word: "rude", kana: "/rude/", meaning: "無礼な", options: ["を身に着けている", "を翻訳する", "無礼な", "迅速な"] },
  { id: "shy", word: "shy", kana: "/shy/", meaning: "内気な、恥ずかしがりの", options: ["中身", "概念", "崇拝", "内気な、恥ずかしがりの"] },
  { id: "liberal", word: "liberal", kana: "/liberal/", meaning: "寛大な", options: ["土壌、土", "規模", "寛大な", "伝染病"] },
  { id: "stupid", word: "stupid", kana: "/stupid/", meaning: "愚かな", options: ["愚かな", "頂上", "を設計する", "軽くたたく"] },
  { id: "reluctant", word: "reluctant", kana: "/reluctant/", meaning: "気が進まない", options: ["を傷つける", "気が進まない", "元気づける", "を裏付ける、(本当だと)確認する"] },
  { id: "generous", word: "generous", kana: "/generous/", meaning: "気前のよい", options: ["効率の良い", "奪う", "気前のよい", "を引きつける"] },
  { id: "modest", word: "modest", kana: "/modest/", meaning: "控えめな", options: ["控えめな", "消えていく", "凍る", "とても小さな"] },
  { id: "lonely", word: "lonely", kana: "/lonely/", meaning: "（孤独で）寂しい", options: ["あくびをする", "自慢する", "（発達、変化の）段階", "（孤独で）寂しい"] },
  { id: "pure", word: "pure", kana: "/pure/", meaning: "純粋な", options: ["を決定する", "生態系", "第一の、主要な", "純粋な"] },
  { id: "grand", word: "grand", kana: "/grand/", meaning: "豪華な、雄大な", options: ["統計", "豪華な、雄大な", "（車などが通った）跡", "と主張する"] },
  { id: "adequate", word: "adequate", kana: "/adequate/", meaning: "十分な", options: ["十分な", "の向きを変える", "（時間など）を充てる", "それとなく言う"] },
  { id: "apparent", word: "apparent", kana: "/apparent/", meaning: "（見て）明らかな、見たところ?らしい", options: ["注意深い", "心配する", "（見て）明らかな、見たところ?らしい", "～の味がする"] },
  { id: "classic", word: "classic", kana: "/classic/", meaning: "（芸術などが）最高水準の、典型的な", options: ["能力がある", "（芸術などが）最高水準の、典型的な", "深い悲しみ", "戦略"] },
  { id: "remote", word: "remote", kana: "/remote/", meaning: "遠く離れた", options: ["（社会の）慣習", "遠く離れた", "を傷つける", "頼る"] },
  { id: "solid", word: "solid", kana: "/solid/", meaning: "固体の、しっかりした", options: ["一時停止する", "を要求する", "固体の、しっかりした", "困難"] },
  { id: "raw", word: "raw", kana: "/raw/", meaning: "生の", options: ["章", "生の", "定期的な", "気にかけない"] },
  { id: "plain", word: "plain", kana: "/plain/", meaning: "平易な", options: ["平易な", "精神を集中する", "妥協する", "を切り離す"] },
  { id: "primitive", word: "primitive", kana: "/primitive/", meaning: "原始の", options: ["境界（線）", "生の", "原始の", "愚かな"] },
  { id: "steady", word: "steady", kana: "/steady/", meaning: "着実な", options: ["気づいて", "車、乗り物", "着実な", "同僚"] },
  { id: "slight", word: "slight", kana: "/slight/", meaning: "わずかな", options: ["を（滅亡の）危険にさらす", "いじめる", "微妙な", "わずかな"] },
  { id: "subtle", word: "subtle", kana: "/subtle/", meaning: "微妙な", options: ["微妙な", "科学技術", "追いつく", "楽観的な"] },
  { id: "delight", word: "delight", kana: "/delight/", meaning: "大喜びさせる", options: ["必要不可欠な", "原始の", "（所定の）位置、場所、立場", "大喜びさせる"] },
  { id: "entertain", word: "entertain", kana: "/entertain/", meaning: "楽しませる", options: ["化石", "額縁", "楽しませる", "に祝いの言葉を述べる"] },
  { id: "fulfill", word: "fulfill", kana: "/fulfill/", meaning: "満たす", options: ["伝記", "懸命の努力、奮闘", "熱", "満たす"] },
  { id: "cheer", word: "cheer", kana: "/cheer/", meaning: "元気づける", options: ["元気づける", "仮想の", "文明", "警戒；護衛者"] },
  { id: "amuse", word: "amuse", kana: "/amuse/", meaning: "笑わせる", options: ["返事を出す", "笑わせる", "活動的な", "を切り離す"] },
  { id: "anticipate", word: "anticipate", kana: "/anticipate/", meaning: "予期する", options: ["予期する", "～のにおいがする", "を開発する", "（事が）起こる、たまたまする"] },
  { id: "confront", word: "confront", kana: "/confront/", meaning: "立ちはだかる", options: ["使い方", "反対する", "立ちはだかる", "さえぎる"] },
  { id: "undergo", word: "undergo", kana: "/undergo/", meaning: "経験する", options: ["むしろ、かなり", "を蓄える", "経験する", "同情、共感"] },
  { id: "exceed", word: "exceed", kana: "/exceed/", meaning: "超える", options: ["横たわる、うそをつく", "超える", "研究所、実験室", "減る"] },
  { id: "overwhelm", word: "overwhelm", kana: "/overwhelm/", meaning: "まいらせる", options: ["応答する", "を調べる", "まいらせる", "を比べる"] },
  { id: "shoot", word: "shoot", kana: "/shoot/", meaning: "撃つ", options: ["深い悲しみ", "撃つ", "分類する", "連続、（連続するものの）順番"] },
  { id: "murder", word: "murder", kana: "/murder/", meaning: "殺害する", options: ["著者", "を克服する", "相続する", "殺害する"] },
  { id: "rob", word: "rob", kana: "/rob/", meaning: "奪う", options: ["奪う", "規範；暗号", "熱狂，熱中", "を経営する"] },
  { id: "deprive", word: "deprive", kana: "/deprive/", meaning: "奪う", options: ["奪う", "恐怖（心）", "勝利", "（考え、方針）を採用する"] },
  { id: "rid", word: "rid", kana: "/rid/", meaning: "を取り除く", options: ["罰する", "被害者、犠牲者", "に知らせる", "を取り除く"] },
  { id: "interrupt", word: "interrupt", kana: "/interrupt/", meaning: "さえぎる", options: ["相反する", "さえぎる", "を当惑させる", "機能する"] },
  { id: "interfere", word: "interfere", kana: "/interfere/", meaning: "邪魔する", options: ["期間", "邪魔する", "を関連づける", "特別の"] },
  { id: "bully", word: "bully", kana: "/bully/", meaning: "いじめる", options: ["いじめる", "をありがたく思う、を正しく認証（評価）する", "自信", "を（滅亡の）危険にさらす"] },
  { id: "defend", word: "defend", kana: "/defend/", meaning: "守る", options: ["守る", "低い", "従事する、を引き入れる", "目撃者"] },
  { id: "rescue", word: "rescue", kana: "/rescue/", meaning: "を救う", options: ["乗組員", "（長期的な）気候", "を救う", "撃つ"] },
  { id: "accuse", word: "accuse", kana: "/accuse/", meaning: "非難する", options: ["非難する", "を奮起させる", "（行政などの）地区", "主題、テーマ"] },
  { id: "sue", word: "sue", kana: "/sue/", meaning: "訴える", options: ["訴える", "を移す", "わかりにくい", "を発見する"] },
  { id: "wander", word: "wander", kana: "/wander/", meaning: "ぶらつく，歩き回る", options: ["古代の", "ぶらつく，歩き回る", "成長する", "内部の"] },
  { id: "chase", word: "chase", kana: "/chase/", meaning: "追いかける", options: ["列", "を調節する", "民族の、人種の", "追いかける"] },
  { id: "arrest", word: "arrest", kana: "/arrest/", meaning: "逮捕する", options: ["相当する", "逮捕する", "賢明な", "苦い、つらい"] },
  { id: "submit", word: "submit", kana: "/submit/", meaning: "提出する", options: ["詩", "を支配する、統治する", "提出する", "凍る"] },
  { id: "punish", word: "punish", kana: "/punish/", meaning: "罰する", options: ["修正する", "罰する", "休止する", "中心的な"] },
  { id: "resolve", word: "resolve", kana: "/resolve/", meaning: "解決する", options: ["解決する", "攻撃的な", "好況、ブーム", "革命"] },
  { id: "justify", word: "justify", kana: "/justify/", meaning: "正当化する", options: ["を尊敬する", "正当化する", "を変える", "期間"] },
  { id: "restore", word: "restore", kana: "/restore/", meaning: "修復する", options: ["規模", "起源", "修復する", "を改善する"] },
  { id: "modify", word: "modify", kana: "/modify/", meaning: "修正する", options: ["日課、決まりきった仕事", "を傷つける", "搾取する", "修正する"] },
  { id: "impose", word: "impose", kana: "/impose/", meaning: "押しつける", options: ["授業料", "押しつける", "を（きちんと）並べる、手はずを整える", "わかりにくい"] },
  { id: "compose", word: "compose", kana: "/compose/", meaning: "構成する", options: ["定期的な", "を達成する", "広範囲にわたる", "構成する"] },
  { id: "classify", word: "classify", kana: "/classify/", meaning: "分類する", options: ["を修理する", "分類する", "恐れて", "経歴"] },
  { id: "substitute", word: "substitute", kana: "/substitute/", meaning: "代わりに使う", options: ["機関、制度", "代わりに使う", "やせた", "を持続させる"] },
  { id: "shrink", word: "shrink", kana: "/shrink/", meaning: "縮む", options: ["要素", "成功する、継承する", "見地", "縮む"] },
  { id: "lean", word: "lean", kana: "/lean/", meaning: "寄りかかる", options: ["寄りかかる", "普及する、勝る", "逮捕する", "軽くたたく"] },
  { id: "fold", word: "fold", kana: "/fold/", meaning: "折り畳む", options: ["論題、話題", "折り畳む", "を発見する", "意見が合わない"] },
  { id: "load", word: "load", kana: "/load/", meaning: "積む", options: ["を当惑させる", "最近の", "単に", "積む"] },
  { id: "pour", word: "pour", kana: "/pour/", meaning: "注ぐ", options: ["連続", "雰囲気", "注ぐ", "満たす"] },
  { id: "float", word: "float", kana: "/float/", meaning: "浮かぶ", options: ["美徳", "割引", "実際の", "浮かぶ"] },
  { id: "shine", word: "shine", kana: "/shine/", meaning: "輝く", options: ["輝く", "ウイルス", "苦しむ", "困難、苦労"] },
  { id: "editor", word: "editor", kana: "/editor/", meaning: "編集者", options: ["搾取する", "を開発する", "義務", "編集者"] },
  { id: "poetry", word: "poetry", kana: "/poetry/", meaning: "詩", options: ["使い方", "遠い", "本能", "詩"] },
  { id: "usage", word: "usage", kana: "/usage/", meaning: "使い方", options: ["を満足させる", "普通の", "悲しみ", "使い方"] },
  { id: "sector", word: "sector", kana: "/sector/", meaning: "部門、分野", options: ["を怒らせる", "不平を言う", "部門、分野", "目的地"] },
  { id: "span", word: "span", kana: "/span/", meaning: "期間", options: ["を思いとどまらせる、を落胆させる", "注ぐ", "錯覚", "期間"] },
  { id: "literacy", word: "literacy", kana: "/literacy/", meaning: "読み書きの能力", options: ["きつい", "を説明する、を例証する", "読み書きの能力", "（大きな音を立てて）衝突する"] },
  { id: "symptom", word: "symptom", kana: "/symptom/", meaning: "症状", options: ["症状", "と連絡する", "自殺", "を巻き込む"] },
  { id: "phase", word: "phase", kana: "/phase/", meaning: "段階", options: ["を購入する", "めったに…ない", "段階", "を告白する"] },
  { id: "surgery", word: "surgery", kana: "/surgery/", meaning: "手術", options: ["神聖な", "手術", "を支配する、統治する", "を隠す"] },
  { id: "virus", word: "virus", kana: "/virus/", meaning: "ウイルス", options: ["デジタル(方式)の", "破裂する", "避難（所）", "ウイルス"] },
  { id: "poisen", word: "poisen", kana: "/poisen/", meaning: "毒", options: ["育てる", "を伝達する", "を観察する", "毒"] },
  { id: "protein", word: "protein", kana: "/protein/", meaning: "タンパク質", options: ["会議", "タンパク質", "を援助する", "呼吸する"] },
  { id: "liquid", word: "liquid", kana: "/liquid/", meaning: "液体", options: ["神話", "対照", "液体", "男の"] },
  { id: "oxygen", word: "oxygen", kana: "/oxygen/", meaning: "酸素", options: ["次に続く、に従う", "体温", "酸素", "恥じて"] },
  { id: "globe", word: "globe", kana: "/globe/", meaning: "世界", options: ["を掛ける", "世界", "を稼ぐ", "昆虫"] },
  { id: "pole", word: "pole", kana: "/pole/", meaning: "極(地)", options: ["完全に", "急ぐ", "極(地)", "いじめる"] },
  { id: "valley", word: "valley", kana: "/valley/", meaning: "谷", options: ["崩壊する、倒れる", "谷", "を混同する", "丁寧な"] },
  { id: "conservation", word: "conservation", kana: "/conservation/", meaning: "(環境)保護", options: ["いらいらさせる", "（結果）を（～の）せい[おかげ]と考える(on)", "自分勝手な", "(環境)保護"] },
  { id: "channel", word: "channel", kana: "/channel/", meaning: "伝達経路", options: ["無限の", "伝達経路", "を雇用する、を（手段などに）用いる", "を賃借りする"] },
  { id: "glacier", word: "glacier", kana: "/glacier/", meaning: "氷河", options: ["氷河", "を（滅亡の）危険にさらす", "を征服する", "葬式"] },
  { id: "pioneer", word: "pioneer", kana: "/pioneer/", meaning: "先駆者", options: ["先駆者", "腕、武器、兵器", "高貴な", "尊厳"] },
  { id: "prospect", word: "prospect", kana: "/prospect/", meaning: "見込み", options: ["慣れさせる", "を囲む", "見込み", "（芸術などが）最高水準の、典型的な"] },
  { id: "enthusiasm", word: "enthusiasm", kana: "/enthusiasm/", meaning: "熱狂，熱中", options: ["文学", "一般的な", "熱狂，熱中", "陸軍"] },
  { id: "passion", word: "passion", kana: "/passion/", meaning: "情熱", options: ["装備する", "を主催する、準備する", "信頼", "情熱"] },
  { id: "fortune", word: "fortune", kana: "/fortune/", meaning: "財産", options: ["革命", "財産", "連続、（連続するものの）順番", "装飾する"] },
  { id: "obstacle", word: "obstacle", kana: "/obstacle/", meaning: "障害（物）", options: ["ぎゅっとつかむ,理解する", "同情、共感", "障害（物）", "目に見える"] },
  { id: "prejudice", word: "prejudice", kana: "/prejudice/", meaning: "偏見", options: ["偏見", "を証明する", "を怠る", "侮辱する"] },
  { id: "justice", word: "justice", kana: "/justice/", meaning: "正義", options: ["正義", "考え", "投資する", "湿気のある"] },
  { id: "opponent", word: "opponent", kana: "/opponent/", meaning: "相手、敵", options: ["相手、敵", "基準", "材料、原料", "従来の、ありきたりの"] },
  { id: "sacrifice", word: "sacrifice", kana: "/sacrifice/", meaning: "犠牲", options: ["水平線、地平線", "犠牲", "（風が）吹く", "固執する、しつこく続ける"] },
  { id: "fault", word: "fault", kana: "/fault/", meaning: "責任", options: ["を浸す", "責任", "わくわくさせる", "相反する"] },
  { id: "prison", word: "prison", kana: "/prison/", meaning: "刑務所", options: ["真剣な、本気の", "その土地の、地元の", "刑務所", "締め出す"] },
  { id: "shelter", word: "shelter", kana: "/shelter/", meaning: "避難（所）", options: ["言葉による", "邪悪な", "避難（所）", "空の"] },
  { id: "committee", word: "committee", kana: "/committee/", meaning: "委員会", options: ["乱用する", "委員会", "を伝達する", "世代"] },
  { id: "ritual", word: "ritual", kana: "/ritual/", meaning: "儀式", options: ["儀式", "快い、楽しい", "を打ち負かす、（続けざまに）打つ", "おじぎする"] },
  { id: "mature", word: "mature", kana: "/mature/", meaning: "大人になった", options: ["危険（性）", "ぎゅっとつかむ,理解する", "段階", "大人になった"] },
  { id: "moderate", word: "moderate", kana: "/moderate/", meaning: "適度な", options: ["急な", "列", "適度な", "規律、しつけ"] },
  { id: "neutral", word: "neutral", kana: "/neutral/", meaning: "中立の", options: ["を産出する、（利益など）を生む、屈する", "を輸送する", "超える", "中立の"] },
  { id: "optimistic", word: "optimistic", kana: "/optimistic/", meaning: "楽観的な", options: ["を処分する", "を観察する", "楽観的な", "心に訴える"] },
  { id: "pessimistic", word: "pessimistic", kana: "/pessimistic/", meaning: "悲観的な", options: ["破裂する", "悲観的な", "を予期する、と思う", "形状、（記入）用紙"] },
  { id: "radical", word: "radical", kana: "/radical/", meaning: "根本的な", options: ["場所、用地", "を解釈する", "熱中して", "根本的な"] },
  { id: "rough", word: "rough", kana: "/rough/", meaning: "粗い", options: ["そのうえ、さらに", "生態系", "粗い", "（所定の）位置、場所、立場"] },
  { id: "smooth", word: "smooth", kana: "/smooth/", meaning: "滑らかな", options: ["を分配する", "褒美", "滑らかな", "部分、（食べ物の）一人前"] },
  { id: "fluent", word: "fluent", kana: "/fluent/", meaning: "流ちょうな", options: ["流ちょうな", "注意する、注目する", "機能する", "機会"] },
  { id: "casual", word: "casual", kana: "/casual/", meaning: "形式ばらない", options: ["合理的な", "形式ばらない", "を痛める", "覚えている"] },
  { id: "instant", word: "instant", kana: "/instant/", meaning: "即時の", options: ["（将来の）展望", "即時の", "悲惨な出来事", "豊富な"] },
  { id: "incredible", word: "incredible", kana: "/incredible/", meaning: "信じられない", options: ["不足", "生の", "信じられない", "をまねる"] },
  { id: "genuine", word: "genuine", kana: "/genuine/", meaning: "本物の", options: ["本物の", "（時間、金銭など）を節約する", "勝つ", "を明らかにする、暴露する"] },
  { id: "precious", word: "precious", kana: "/precious/", meaning: "貴重な", options: ["貴重な", "を設立する", "そのうえ", "消えていく"] },
  { id: "prominent", word: "prominent", kana: "/prominent/", meaning: "重要な", options: ["に思い出させる", "重要な", "に関係する、を心配させる", "粗い"] },
  { id: "blind", word: "blind", kana: "/blind/", meaning: "目の見えない", options: ["を伝達する", "を集める、拾い集める", "（生物の）種", "目の見えない"] },
  { id: "deaf", word: "deaf", kana: "/deaf/", meaning: "耳が聞こえない", options: ["に（偶然）出会う", "を埋める", "（男女の）性", "耳が聞こえない"] },
  { id: "harsh", word: "harsh", kana: "/harsh/", meaning: "厳しい", options: ["咳をする", "厳しい", "傷", "（芸術などが）最高水準の、典型的な"] },
  { id: "prompt", word: "prompt", kana: "/prompt/", meaning: "迅速な", options: ["どうにかして", "を変える", "痛み、骨折り、苦労", "迅速な"] },
  { id: "inevitable", word: "inevitable", kana: "/inevitable/", meaning: "避けられない", options: ["手がかり", "を発見する", "避けられない", "金額"] },
  { id: "marine", word: "marine", kana: "/marine/", meaning: "海の", options: ["を象徴する、を代表する", "海の", "徹底的な", "出来事"] },
  { id: "tropical", word: "tropical", kana: "/tropical/", meaning: "熱帯（地方）の", options: ["水準、基準", "意識して、自覚して", "を隠す", "熱帯（地方）の"] },
  { id: "arctic", word: "Arctic", kana: "/arctic/", meaning: "北極の", options: ["北極の", "日課、決まりきった仕事", "変化のない", "価値のある"] },
  { id: "forecast", word: "forecast", kana: "/forecast/", meaning: "予報", options: ["を押す", "予報", "優秀さ、長所", "刑務所"] },
  { id: "speculate", word: "speculate", kana: "/speculate/", meaning: "思索する", options: ["思索する", "丁寧な", "敏感な", "定住する、を決める"] },
  { id: "bet", word: "bet", kana: "/bet/", meaning: "きっと～だと思う", options: ["年齢", "きっと～だと思う", "訴える", "（事が）起こる、たまたまする"] },
  { id: "quote", word: "quote", kana: "/quote/", meaning: "引用する", options: ["引用する", "最も重要な，第一の", "を制限する", "航海"] },
  { id: "consult", word: "consult", kana: "/consult/", meaning: "意見を求める", options: ["局面", "意見を求める", "虫歯、衰退、荒廃", "を明らかにする、暴露する"] },
  { id: "dispute", word: "dispute", kana: "/dispute/", meaning: "に異議を唱える", options: ["に異議を唱える", "できない", "熱狂，熱中", "（行事など）を祝う"] },
  { id: "accumulate", word: "accumulate", kana: "/accumulate/", meaning: "集める、蓄積する", options: ["集める、蓄積する", "をありがたく思う、を正しく認証（評価）する", "を取り除く", "を編む"] },
  { id: "grasp", word: "grasp", kana: "/grasp/", meaning: "ぎゅっとつかむ,理解する", options: ["情熱", "救急車", "興味", "ぎゅっとつかむ,理解する"] },
  { id: "grip", word: "grip", kana: "/grip/", meaning: "をしっかり握る", options: ["なぞ", "に不満を抱かせる", "遠い", "をしっかり握る"] },
  { id: "seize", word: "seize", kana: "/seize/", meaning: "つかむ", options: ["予定で、締め切りの", "つかむ", "おしゃべりをする", "耳が聞こえない"] },
  { id: "comprehend", word: "comprehend", kana: "/comprehend/", meaning: "理解する", options: ["財産", "論題、話題", "柔軟な", "理解する"] },
  { id: "constitute", word: "constitute", kana: "/constitute/", meaning: "構成する", options: ["目の見えない", "構成する", "したがって、その結果", "（物事の）側面"] },
  { id: "reinforce", word: "reinforce", kana: "/reinforce/", meaning: "強化する", options: ["ごみ", "～媒介で", "強化する", "を襲う、攻撃する"] },
  { id: "resort", word: "resort", kana: "/resort/", meaning: "訴える", options: ["を取り除く", "訴える", "事業", "言及する"] },
  { id: "donate", word: "donate", kana: "/donate/", meaning: "寄付する", options: ["一時停止する", "軽くたたく", "寄付する", "完全に"] },
  { id: "obey", word: "obey", kana: "/obey/", meaning: "従う", options: ["従う", "海軍", "を大目に見る、の言い訳をする", "困難"] },
  { id: "dedicate", word: "dedicate", kana: "/dedicate/", meaning: "ささげる", options: ["直接の", "ささげる", "（定期）収入", "動機"] },
  { id: "transmit", word: "transmit", kana: "/transmit/", meaning: "伝える", options: ["願望", "古代の", "伝える", "収穫"] },
  { id: "equip", word: "equip", kana: "/equip/", meaning: "装備する", options: ["手術", "内科医、医師", "範囲", "装備する"] },
  { id: "bind", word: "bind", kana: "/bind/", meaning: "縛る", options: ["縛る", "品目、項目", "を強く望む", "確信して"] },
  { id: "pose", word: "pose", kana: "/pose/", meaning: "投げかける", options: ["掃く", "必要不可欠な", "タンパク質", "投げかける"] },
  { id: "pause", word: "pause", kana: "/pause/", meaning: "休止する", options: ["運賃", "（車などが通った）跡", "休止する", "先駆者"] },
  { id: "hesitate", word: "hesitate", kana: "/hesitate/", meaning: "ためらう、躊躇する", options: ["場合、時", "増える", "ささげる", "ためらう、躊躇する"] },
  { id: "split", word: "split", kana: "/split/", meaning: "分割する", options: ["減る、衰える", "どうにかして", "分割する", "を侵略する、に侵攻する"] },
  { id: "bend", word: "bend", kana: "/bend/", meaning: "曲げる", options: ["情熱", "曲げる", "分厚い", "機会"] },
  { id: "tap", word: "tap", kana: "/tap/", meaning: "軽くたたく", options: ["（物質的、精神的）利益", "軽くたたく", "汗", "ばかげた"] },
  { id: "boil", word: "boil", kana: "/boil/", meaning: "沸かす", options: ["沸かす", "に到着する", "賃金", "の向きを変える"] },
  { id: "bow", word: "bow", kana: "/bow/", meaning: "おじぎする", options: ["候補者", "持ち物、材料", "おじぎする", "流ちょうな"] },
  { id: "conceal", word: "conceal", kana: "/conceal/", meaning: "隠す", options: ["勇敢な", "大陸", "隠す", "を調節する"] },
  { id: "dispose", word: "dispose", kana: "/dispose/", meaning: "を処分する", options: ["を満たす", "態度", "を処分する", "を大目に見る、の言い訳をする"] },
  { id: "cheat", word: "cheat", kana: "/cheat/", meaning: "だます", options: ["を治す、癒す", "だます", "気づいて", "と一緒に行く"] },
  { id: "distract", word: "distract", kana: "/distract/", meaning: "（注意など）をそらす", options: ["（注意など）をそらす", "段階", "逃れる、脱出する、を免れる", "本物の"] },
  { id: "exclude", word: "exclude", kana: "/exclude/", meaning: "締め出す", options: ["危険（性）", "を約束する", "締め出す", "ことわざ"] },
  { id: "astonish", word: "astonish", kana: "/astonish/", meaning: "驚かせる", options: ["原因", "（物事の）側面", "義務", "驚かせる"] },
  { id: "thrill", word: "thrill", kana: "/thrill/", meaning: "わくわくさせる", options: ["わくわくさせる", "原因", "気づく", "液体"] },
  { id: "leap", word: "leap", kana: "/leap/", meaning: "跳ぶ", options: ["回復する", "跳ぶ", "楽しみ、おもしろいこと（人）", "優しい"] },
  { id: "postpone", word: "postpone", kana: "/postpone/", meaning: "延期する", options: ["純粋な", "（伝達などの）媒体", "祖先", "延期する"] },
  { id: "dismiss", word: "dismiss", kana: "/dismiss/", meaning: "解雇する", options: ["伝統", "札", "（熱で）溶ける", "解雇する"] },
  { id: "resign", word: "resign", kana: "/resign/", meaning: "辞める", options: ["辞める", "退く", "額縁", "頭の良い"] },
  { id: "withdraw", word: "withdraw", kana: "/withdraw/", meaning: "退く", options: ["控えめな", "退く", "大喜びさせる", "頂上"] },
  { id: "fade", word: "fade", kana: "/fade/", meaning: "消えていく", options: ["撃つ", "（研究、話などの）主題", "を強調する、力説する", "消えていく"] },
  { id: "vanish", word: "vanish", kana: "/vanish/", meaning: "消え失せる", options: ["消え失せる", "引き受ける", "を浸す", "（人）に無理やりさせる"] },
  { id: "continent", word: "continent", kana: "/continent/", meaning: "大陸", options: ["大陸", "気づく", "殺害する", "進歩"] },
  { id: "geography", word: "geography", kana: "/geography/", meaning: "地理、地理学", options: ["を怠る", "毒", "わくわくさせる", "地理、地理学"] },
  { id: "ecology", word: "ecology", kana: "/ecology/", meaning: "生態系", options: ["生態系", "妥協する", "軌道", "後で"] },
  { id: "inhabitant", word: "inhabitant", kana: "/inhabitant/", meaning: "住民", options: ["安定した", "住民", "相当する", "わくわくさせる"] },
  { id: "suburb", word: "suburb", kana: "/suburb/", meaning: "郊外", options: ["郊外", "委員会", "を修理する", "反応する"] },
  { id: "furniture", word: "furniture", kana: "/furniture/", meaning: "家具", options: ["低い", "を刺激する", "（人）を夢中にさせる", "家具"] },
  { id: "refrigerator", word: "refrigerator", kana: "/refrigerator/", meaning: "冷蔵庫", options: ["育てる", "冷蔵庫", "似ている", "高価な"] },
  { id: "garbage", word: "garbage", kana: "/garbage/", meaning: "(生）ごみ", options: ["を明らかにする、暴露する", "正確な", "(生）ごみ", "銀河"] },
  { id: "trash", word: "trash", kana: "/trash/", meaning: "ごみ", options: ["ごみ", "を試みる", "を拡大する", "をつなぐ"] },
  { id: "litter", word: "litter", kana: "/litter/", meaning: "(公共の場での)ごみ", options: ["10年間", "生きている", "(公共の場での)ごみ", "をうらやむ"] },
  { id: "trace", word: "trace", kana: "/trace/", meaning: "名残；（通った）跡", options: ["名残；（通った）跡", "横たわる、うそをつく", "を変装させる", "一般的な"] },
  { id: "row", word: "row", kana: "/row/", meaning: "列", options: ["（位置、方針など）を変える", "初等（教育）の", "を無視する", "列"] },
  { id: "core", word: "core", kana: "/core/", meaning: "核心、中心", options: ["核心、中心", "田園の、田舎の", "心理学", "運賃"] },
  { id: "orbit", word: "orbit", kana: "/orbit/", meaning: "軌道", options: ["軌道", "元気づける", "を強調する、力説する", "を消費する"] },
  { id: "galaxy", word: "galaxy", kana: "/galaxy/", meaning: "銀河", options: ["教育", "銀河", "相反する", "航海"] },
  { id: "myth", word: "myth", kana: "/myth/", meaning: "神話", options: ["神話", "読み書きの能力", "連続", "10年間"] },
  { id: "faith", word: "faith", kana: "/faith/", meaning: "信頼", options: ["多様性", "信頼", "気づいて", "害"] },
  { id: "wisdom", word: "wisdom", kana: "/wisdom/", meaning: "知恵", options: ["を集める、拾い集める", "を混ぜる", "知恵", "資金、基金"] },
  { id: "obligation", word: "obligation", kana: "/obligation/", meaning: "義務", options: ["義務", "固体の、しっかりした", "問題", "感謝している"] },
  { id: "privilege", word: "privilege", kana: "/privilege/", meaning: "特典、特権", options: ["を征服する", "満たす", "特典、特権", "問題"] },
  { id: "discrimination", word: "discrimination", kana: "/discrimination/", meaning: "差別", options: ["伝達経路", "主題、テーマ", "差別", "好ましくない、消極的な"] },
  { id: "ambition", word: "ambition", kana: "/ambition/", meaning: "願望", options: ["平易な", "願望", "を調節する", "（社会の）慣習"] },
  { id: "illusion", word: "illusion", kana: "/illusion/", meaning: "錯覚", options: ["錯覚", "（文章の）一節", "…だけれども", "被害者、犠牲者"] },
  { id: "instinct", word: "instinct", kana: "/instinct/", meaning: "本能", options: ["に反対する", "本能", "の特徴を述べる", "超える"] },
  { id: "shame", word: "shame", kana: "/shame/", meaning: "残念なこと", options: ["残念なこと", "考え", "（うまく）対処する", "（会、団体、人）に加わる"] },
  { id: "humor", word: "humor", kana: "/humor/", meaning: "ユーモア", options: ["経歴", "ユーモア", "を行う", "（うまく）対処する"] },
  { id: "courage", word: "courage", kana: "/courage/", meaning: "勇気", options: ["を（公式に）禁止する", "（精神的）負担、重荷", "を振る", "勇気"] },
  { id: "sympathy", word: "sympathy", kana: "/sympathy/", meaning: "同情、共感", options: ["利用する", "離婚", "同情、共感", "従事する、を引き入れる"] },
  { id: "tragedy", word: "tragedy", kana: "/tragedy/", meaning: "悲惨な出来事", options: ["を引きつける", "量", "悲惨な出来事", "を雇う"] },
  { id: "fate", word: "fate", kana: "/fate/", meaning: "運命", options: ["を弱める", "運命", "正しい", "完全に"] },
  { id: "destiny", word: "destiny", kana: "/destiny/", meaning: "運命", options: ["運命", "を保護する", "（課された）任務、仕事", "締め出す"] },
  { id: "abuse", word: "abuse", kana: "/abuse/", meaning: "乱用する", options: ["を信じる", "変化のない", "乱用する", "（大きな音を立てて）衝突する"] },
  { id: "wound", word: "wound", kana: "/wound/", meaning: "傷", options: ["傷", "を出版する", "社会の", "その土地の、地元の"] },
  { id: "fever", word: "fever", kana: "/fever/", meaning: "熱", options: ["～の味がする", "状況、事情", "即時の", "熱"] },
  { id: "infection", word: "infection", kana: "/infection/", meaning: "伝染病", options: ["伝染病", "を破壊する", "急な", "と結論づける"] },
  { id: "brave", word: "brave", kana: "/brave/", meaning: "勇敢な", options: ["を繰り返す", "勇敢な", "を産出する、（利益など）を生む、屈する", "法廷、裁判所"] },
  { id: "brilliant", word: "brilliant", kana: "/brilliant/", meaning: "すばらしい", options: ["（人）に無理やりさせる", "広大な", "すばらしい", "を怠る"] },
  { id: "gentle", word: "gentle", kana: "/gentle/", meaning: "優しい", options: ["優しい", "傾向", "相続する", "を調査する"] },
  { id: "noble", word: "noble", kana: "/noble/", meaning: "高貴な", options: ["姿を消す", "高貴な", "を援助する", "反応する"] },
  { id: "royal", word: "royal", kana: "/royal/", meaning: "王室の", options: ["（見て）明らかな、見たところ?らしい", "動機", "穀物", "王室の"] },
  { id: "sacred", word: "sacred", kana: "/sacred/", meaning: "神聖な", options: ["神聖な", "潜在的な", "厳しい", "注意深い"] },
  { id: "holy", word: "holy", kana: "/holy/", meaning: "神聖な", options: ["神聖な", "きつい", "（人）に（金など）を借りている、おかげである", "スタッフ、職員"] },
  { id: "decent", word: "decent", kana: "/decent/", meaning: "きちんとした", options: ["主題、テーマ", "確固とした", "きちんとした", "【名】天文学"] },
  { id: "grateful", word: "grateful", kana: "/grateful/", meaning: "感謝している", options: ["感謝している", "を思い出す", "寛大な", "（物、体の一部）に損害を与える"] },
  { id: "fond", word: "fond", kana: "/fond/", meaning: "好む", options: ["遅れ", "好む", "を盗む", "妥協する"] },
  { id: "selfish", word: "selfish", kana: "/selfish/", meaning: "自分勝手な", options: ["高価な", "自分勝手な", "を治す、癒す", "感謝している"] },
  { id: "awkward", word: "awkward", kana: "/awkward/", meaning: "厄介な，ぎこちない", options: ["異なる", "ばかげた", "振る舞う", "厄介な，ぎこちない"] },
  { id: "awful", word: "awful", kana: "/awful/", meaning: "ひどい", options: ["警報（機）；目覚まし時計", "国内の", "有利な点", "ひどい"] },
  { id: "ultimate", word: "ultimate", kana: "/ultimate/", meaning: "最終的な", options: ["じっと見つめる", "生物（学）の", "最終的な", "を援助する"] },
  { id: "dynamic", word: "dynamic", kana: "/dynamic/", meaning: "活動的な", options: ["活動的な", "呼吸する", "を含む", "機能する"] },
  { id: "tremendous", word: "tremendous", kana: "/tremendous/", meaning: "とてつもない", options: ["とてつもない", "慣れさせる", "（車などが通った）跡", "練習"] },
  { id: "abundant", word: "abundant", kana: "/abundant/", meaning: "豊富な", options: ["豊富な", "葬式", "労働", "地震"] },
  { id: "dull", word: "dull", kana: "/dull/", meaning: "退屈な", options: ["災害", "国内の", "投げかける", "退屈な"] },
  { id: "urgent", word: "urgent", kana: "/urgent/", meaning: "緊急の", options: ["を含む", "（言葉など）を発する", "を表現する", "緊急の"] },
  { id: "spare", word: "spare", kana: "/spare/", meaning: "余分の", options: ["開花する", "男の", "余分の", "飢饉"] },
  { id: "tight", word: "tight", kana: "/tight/", meaning: "きつい", options: ["神話", "酸素", "きつい", "見つめる"] },
  { id: "shallow", word: "shallow", kana: "/shallow/", meaning: "浅い", options: ["を集める、拾い集める", "の重さがある、の重さを量る", "疫病", "浅い"] },
  { id: "superficial", word: "superficial", kana: "/superficial/", meaning: "浅はかな", options: ["10億", "抽象的な", "を評価する", "浅はかな"] },
  { id: "whisper", word: "whisper", kana: "/whisper/", meaning: "ささやく", options: ["残り、息", "ささやく", "即時の", "を抱きしめる、（申し出など）を受け入れる"] },
  { id: "yell", word: "yell", kana: "/yell/", meaning: "叫ぶ", options: ["叫ぶ", "正義", "絶望", "提出する"] },
  { id: "scream", word: "scream", kana: "/scream/", meaning: "叫び声をあげる", options: ["へり", "叫び声をあげる", "人間の", "大陸"] },
  { id: "nod", word: "nod", kana: "/nod/", meaning: "うなずく", options: ["うなずく", "（涙）を流す", "人工の", "関係のある"] },
  { id: "swallow", word: "swallow", kana: "/swallow/", meaning: "飲み込む", options: ["飲み込む", "領土", "を限定する", "勇敢な"] },
  { id: "yawn", word: "yawn", kana: "/yawn/", meaning: "あくびをする", options: ["準備する", "あくびをする", "空いている", "伝言、メッセージ"] },
  { id: "cough", word: "cough", kana: "/cough/", meaning: "咳をする", options: ["を制限する", "咳をする", "最高の、最大の", "陸軍"] },
  { id: "hug", word: "hug", kana: "/hug/", meaning: "抱きしめる", options: ["個人的な", "抱きしめる", "委員会、重役会", "返事を出す"] },
  { id: "sweep", word: "sweep", kana: "/sweep/", meaning: "掃く", options: ["掃く", "豪華な、雄大な", "最も重要な，第一の", "人間の"] },
  { id: "polish", word: "polish", kana: "/polish/", meaning: "磨く", options: ["磨く", "役割", "似ている", "出産"] },
  { id: "decorate", word: "decorate", kana: "/decorate/", meaning: "装飾する", options: ["装飾する", "夜明け", "を維持する、を主張する", "（政治的な）運動"] },
  { id: "shed", word: "shed", kana: "/shed/", meaning: "（涙）を流す", options: ["を反映する、を反射する", "流ちょうな", "不平を言う", "（涙）を流す"] },
  { id: "drag", word: "drag", kana: "/drag/", meaning: "引きずる", options: ["を（展覧会などに）展示する、（感情、兆候など）を示す", "疫病", "引きずる", "事業"] },
  { id: "spoil", word: "spoil", kana: "/spoil/", meaning: "台無しにする", options: ["台無しにする", "遠い", "に影響する", "結局（は）"] },
  { id: "burst", word: "burst", kana: "/burst/", meaning: "破裂する", options: ["方法、道", "（結果）を（～の）せい[おかげ]と考える(on)", "破裂する", "率直な"] },
  { id: "explode", word: "explode", kana: "/explode/", meaning: "爆発する", options: ["代わりに使う", "を台無しにする", "爆発する", "技能、技術"] },
  { id: "compromise", word: "compromise", kana: "/compromise/", meaning: "妥協する", options: ["政策、方針", "有能な", "妥協する", "を励ます"] },
  { id: "exaggerate", word: "exaggerate", kana: "/exaggerate/", meaning: "誇張する", options: ["誇張する", "褒美", "中身", "隣人、近所の人"] },
  { id: "exploit", word: "exploit", kana: "/exploit/", meaning: "搾取する", options: ["を持ち上げる", "を痛める", "搾取する", "をうらやむ"] },
  { id: "utilize", word: "utilize", kana: "/utilize/", meaning: "利用する", options: ["利用する", "陸軍", "（金）を支払う", "を避ける"] },
  { id: "irritate", word: "irritate", kana: "/irritate/", meaning: "いらいらさせる", options: ["を感動させる", "いらいらさせる", "沈む", "押しつける"] },
  { id: "insult", word: "insult", kana: "/insult/", meaning: "侮辱する", options: ["とてつもない", "侮辱する", "資源", "裁判"] },
  { id: "deceive", word: "deceive", kana: "/deceive/", meaning: "だます", options: ["資金、基金", "を解釈する", "要因、要素", "だます"] },
  { id: "violate", word: "violate", kana: "/violate/", meaning: "違反する", options: ["敵", "違反する", "積む", "奪う"] },
  { id: "disgust", word: "disgust", kana: "/disgust/", meaning: "嫌悪感を持たせる", options: ["顧客", "を怖がらせる", "要因、要素", "嫌悪感を持たせる"] },
  { id: "endure", word: "endure", kana: "/endure/", meaning: "我慢する", options: ["中身", "液体", "我慢する", "に警告する"] },
  { id: "tolerate", word: "tolerate", kana: "/tolerate/", meaning: "耐える", options: ["耐える", "重要な", "の向きを変える", "見つめる"] },
  { id: "suspend", word: "suspend", kana: "/suspend/", meaning: "一時停止する", options: ["機能", "丁寧な", "覚えている", "一時停止する"] },
  { id: "cease", word: "cease", kana: "/cease/", meaning: "やめる", options: ["違反する", "災害", "比率", "やめる"] },
  { id: "appoint", word: "appoint", kana: "/appoint/", meaning: "任命する", options: ["を生産する", "任命する", "記事", "規律、しつけ"] },
  { id: "undertake", word: "undertake", kana: "/undertake/", meaning: "引き受ける", options: ["にかみつく", "思い切って行く", "交換する", "引き受ける"] },
  { id: "overtake", word: "overtake", kana: "/overtake/", meaning: "追いつく", options: ["（ごく）近い", "を抱きしめる、（申し出など）を受け入れる", "施設", "追いつく"] },
  { id: "proceed", word: "proceed", kana: "/proceed/", meaning: "移る", options: ["機関、制度", "を改革する、改善する", "移る", "を支持する"] },
  { id: "commute", word: "commute", kana: "/commute/", meaning: "通勤[通学]する", options: ["困難", "を減らす", "通勤[通学]する", "重大な"] },
  { id: "flourish", word: "flourish", kana: "/flourish/", meaning: "繁盛する；繁殖する", options: ["構造", "正義", "繁盛する；繁殖する", "増える"] },
  { id: "thrive", word: "thrive", kana: "/thrive/", meaning: "栄える", options: ["人工の", "（物、体の一部）に損害を与える", "規律、しつけ", "栄える"] },
  { id: "venture", word: "venture", kana: "/venture/", meaning: "思い切って行く", options: ["思い切って行く", "を主催する", "（熱で）溶ける", "を得る、引き出す、由来する"] },
  { id: "accustom", word: "accustom", kana: "/accustom/", meaning: "慣れさせる", options: ["慣れさせる", "領土", "を大目に見る、の言い訳をする", "種類"] },
  { id: "rear", word: "rear", kana: "/rear/", meaning: "育てる", options: ["（発達、変化の）段階", "沈む", "育てる", "大陸"] },
  { id: "inherit", word: "inherit", kana: "/inherit/", meaning: "相続する", options: ["を振る", "いらいらさせる", "相続する", "引退する"] },
  { id: "blossom", word: "blossom", kana: "/blossom/", meaning: "開花する", options: ["を輸出する", "（所定の）位置、場所、立場", "従来の、ありきたりの", "開花する"] },
  { id: "esteem", word: "esteem", kana: "/esteem/", meaning: "尊敬する", options: ["原始の", "（語）をつづる", "尊敬する", "押しつける"] },
  { id: "merchant", word: "merchant", kana: "/merchant/", meaning: "商人", options: ["貴重な", "商人", "（人）を手伝う", "なぞ"] },
  { id: "fare", word: "fare", kana: "/fare/", meaning: "運賃", options: ["規模", "勝利", "崩壊する、倒れる", "運賃"] },
  { id: "voyage", word: "voyage", kana: "/voyage/", meaning: "航海", options: ["言葉による", "章", "航海", "局面"] },
  { id: "crew", word: "crew", kana: "/crew/", meaning: "乗組員", options: ["元の", "説明する", "乗組員", "境界（線）"] },
  { id: "luggage", word: "luggage", kana: "/luggage/", meaning: "手荷物", options: ["見地", "（社会の）慣習", "優先事項", "手荷物"] },
  { id: "horizon", word: "horizon", kana: "/horizon/", meaning: "水平線、地平線", options: ["水平線、地平線", "そうでなければ、それ以外は", "隠す", "規律、しつけ"] },
  { id: "lightning", word: "lightning", kana: "/lightning/", meaning: "稲妻", options: ["知能の高い、聡明な", "稲妻", "流れる", "を上げる、（子供）を育てる"] },
  { id: "dawn", word: "dawn", kana: "/dawn/", meaning: "夜明け", options: ["だます", "多くの(部分から成る)", "夜明け", "を証明する"] },
  { id: "astronomy", word: "astronomy", kana: "/astronomy/", meaning: "【名】天文学", options: ["【名】天文学", "正当化する", "資本", "湿気のある"] },
  { id: "statistics", word: "statistics", kana: "/statistics/", meaning: "統計", options: ["へり", "妥協する", "と連絡する", "統計"] },
  { id: "dimension", word: "dimension", kana: "/dimension/", meaning: "局面", options: ["を完成させる", "保険", "局面", "デジタル(方式)の"] },
  { id: "faculty", word: "faculty", kana: "/faculty/", meaning: "才能", options: ["をまき散らす", "才能", "要素", "を開発する"] },
  { id: "scheme", word: "scheme", kana: "/scheme/", meaning: "計画", options: ["植民（地）", "原因", "に賛成する、を好む", "計画"] },
  { id: "viewpoint", word: "viewpoint", kana: "/viewpoint/", meaning: "見地", options: ["見地", "を約束する", "葬式", "をやめる"] },
  { id: "output", word: "output", kana: "/output/", meaning: "生産高", options: ["軍（隊）の、軍事の", "影響", "残酷な", "生産高"] },
  { id: "outlook", word: "outlook", kana: "/outlook/", meaning: "見通し", options: ["を要求する", "注意する、注目する", "空いている", "見通し"] },
  { id: "tuition", word: "tuition", kana: "/tuition/", meaning: "授業料", options: ["授業料", "すばらしい", "に納得させる", "源"] },
  { id: "proverb", word: "proverb", kana: "/proverb/", meaning: "ことわざ", options: ["質", "巨大な", "特別の", "ことわざ"] },
  { id: "biography", word: "biography", kana: "/biography/", meaning: "伝記", options: ["伝記", "ぜいたく（品）", "を閉める", "好む"] },
  { id: "narrative", word: "narrative", kana: "/narrative/", meaning: "話", options: ["嫌悪感を持たせる", "話", "比率", "安定した"] },
  { id: "chapter", word: "chapter", kana: "/chapter/", meaning: "章", options: ["章", "直接の", "内科医、医師", "義務"] },
  { id: "string", word: "string", kana: "/string/", meaning: "ひも、糸", options: ["ひも、糸", "内部の", "関連、つながり", "に思い出させる"] },
  { id: "tag", word: "tag", kana: "/tag/", meaning: "札", options: ["札", "を比べる", "委員会", "（農）作物"] },
  { id: "peasant", word: "peasant", kana: "/peasant/", meaning: "小作農", options: ["徹底的な", "動機", "投資する", "小作農"] },
  { id: "livestock", word: "livestock", kana: "/livestock/", meaning: "家畜", options: ["を繁殖させる、飼育する、（動物が）子を産む", "家畜", "目撃者", "を褒める"] },
  { id: "famine", word: "famine", kana: "/famine/", meaning: "飢饉", options: ["意思を通じ合う", "収穫", "我慢強い", "飢饉"] },
  { id: "fatigue", word: "fatigue", kana: "/fatigue/", meaning: "疲労", options: ["咳をする", "前進する", "（印など）をつける", "疲労"] },
  { id: "motive", word: "motive", kana: "/motive/", meaning: "動機", options: ["質", "…だけれども", "を比べる", "動機"] },
  { id: "sweat", word: "sweat", kana: "/sweat/", meaning: "汗", options: ["汗", "小作農", "虫歯、衰退、荒廃", "楽しみ、おもしろいこと（人）"] },
  { id: "peer", word: "peer", kana: "/peer/", meaning: "同僚", options: ["統計", "（人の罪など）を許す", "から?奪する、取り去る", "同僚"] },
  { id: "glance", word: "glance", kana: "/glance/", meaning: "ちらりと見る", options: ["状況", "世帯", "ちらりと見る", "貢献する、を寄付する"] },
  { id: "glimpse", word: "glimpse", kana: "/glimpse/", meaning: "ちらりと見えること", options: ["を支配する、統治する", "固体の、しっかりした", "を懇願する、請う", "ちらりと見えること"] },
  { id: "luxury", word: "luxury", kana: "/luxury/", meaning: "ぜいたく（品）", options: ["形状、（記入）用紙", "ぜいたく（品）", "特別の", "きちんとした"] },
  { id: "prosperity", word: "prosperity", kana: "/prosperity/", meaning: "繁栄", options: ["繁栄", "精神を集中する", "態度", "スタッフ、職員"] },
  { id: "fame", word: "fame", kana: "/fame/", meaning: "名声", options: ["見えること", "国民", "名声", "を発明する"] },
  { id: "keen", word: "keen", kana: "/keen/", meaning: "熱中して", options: ["機関、制度", "熱中して", "その代わりに", "縮む"] },
  { id: "inclined", word: "inclined", kana: "/inclined/", meaning: "（…し）たいと思う(to do)", options: ["（…し）たいと思う(to do)", "を判断する", "民主主義", "（人の罪など）を許す"] },
  { id: "competent", word: "competent", kana: "/competent/", meaning: "有能な", options: ["有能な", "連続", "を身に着けている", "被害者、犠牲者"] },
  { id: "superior", word: "superior", kana: "/superior/", meaning: "優れている", options: ["威信、名声", "ウイルス", "場所、用地", "優れている"] },
  { id: "inferior", word: "inferior", kana: "/inferior/", meaning: "劣った", options: ["（行事など）を祝う", "劣った", "相反する", "要因、要素"] },
  { id: "cruel", word: "cruel", kana: "/cruel/", meaning: "残酷な", options: ["組合", "跳ぶ", "を調べる", "残酷な"] },
  { id: "indifferent", word: "indifferent", kana: "/indifferent/", meaning: "無関心な", options: ["に出席する", "を強くする", "残酷な", "無関心な"] },
  { id: "ashamed", word: "ashamed", kana: "/ashamed/", meaning: "恥じて", options: ["スタッフ、職員", "を産出する、（利益など）を生む、屈する", "巨大な", "恥じて"] },
  { id: "bold", word: "bold", kana: "/bold/", meaning: "大胆な", options: ["（会、団体、人）に加わる", "大胆な", "（うまく）対処する", "陪審"] },
  { id: "ridiculous", word: "ridiculous", kana: "/ridiculous/", meaning: "ばかげた", options: ["心、精神", "適度な", "消えていく", "ばかげた"] },
  { id: "ugly", word: "ugly", kana: "/ugly/", meaning: "醜い", options: ["ウイルス", "生の", "信頼", "醜い"] },
  { id: "pale", word: "pale", kana: "/pale/", meaning: "青白い", options: ["急な", "熱中して", "青白い", "自由な"] },
  { id: "male", word: "male", kana: "/male/", meaning: "男の", options: ["おじぎする", "宇宙", "男の", "記憶（力）"] },
  { id: "manual", word: "manual", kana: "/manual/", meaning: "手による", options: ["主要な", "好ましくない、消極的な", "愚かな", "手による"] },
  { id: "mutual", word: "mutual", kana: "/mutual/", meaning: "相互の", options: ["図", "相互の", "結果", "具体的な"] },
  { id: "delicate", word: "delicate", kana: "/delicate/", meaning: "取り扱いの難しい", options: ["を結びつける", "美徳", "絶滅した", "取り扱いの難しい"] },
  { id: "deliberate", word: "deliberate", kana: "/deliberate/", meaning: "故意の", options: ["を思いとどまらせる、を落胆させる", "故意の", "公正な、(数量などが)かなりの", "世帯"] },
  { id: "gradual", word: "gradual", kana: "/gradual/", meaning: "徐々の", options: ["定住する、を決める", "昆虫", "指示", "徐々の"] },
  { id: "loose", word: "loose", kana: "/loose/", meaning: "緩い", options: ["特有の", "輝く", "緩い", "引用する"] },
  { id: "bitter", word: "bitter", kana: "/bitter/", meaning: "苦い、つらい", options: ["目撃者", "を成し遂げる", "辞める", "苦い、つらい"] },
  { id: "mild", word: "mild", kana: "/mild/", meaning: "温暖な", options: ["普及する、勝る", "温暖な", "編集者", "裸の"] },
  { id: "dense", word: "dense", kana: "/dense/", meaning: "密集した", options: ["笑わせる", "返事を出す", "を探し求める", "密集した"] },
  { id: "tense", word: "tense", kana: "/tense/", meaning: "張り詰めた", options: ["張り詰めた", "民主主義", "構成する", "を上げる、（子供）を育てる"] },
  { id: "conceive", word: "conceive", kana: "/conceive/", meaning: "を抱く、思いつく", options: ["汗", "を抱く、思いつく", "似ている", "広大な"] },
  { id: "confess", word: "confess", kana: "/confess/", meaning: "を告白する", options: ["を告白する", "をひどく嫌う、憎む", "を輸送する", "ありそうな"] },
  { id: "conform", word: "conform", kana: "/conform/", meaning: "従う", options: ["を持つ余裕がある", "従う", "（広大な）地域", "と主張する"] },
  { id: "offend", word: "offend", kana: "/offend/", meaning: "を怒らせる", options: ["離婚", "を意図する、つもりでいる", "を（事実と）認める", "を怒らせる"] },
  { id: "envy", word: "envy", kana: "/envy/", meaning: "をうらやむ", options: ["財産", "空白の", "をうらやむ", "経験する"] },
  { id: "boast", word: "boast", kana: "/boast/", meaning: "自慢する", options: ["を分離する", "初期の", "知能の高い、聡明な", "自慢する"] },
  { id: "dare", word: "dare", kana: "/dare/", meaning: "あえてする、する勇気がある", options: ["熱帯（地方）の", "覚えている", "あえてする、する勇気がある", "手による"] },
  { id: "confine", word: "confine", kana: "/confine/", meaning: "を限定する", options: ["疫病", "を限定する", "を占める、を占領する", "珍しい、まれな"] },
  { id: "contradict", word: "contradict", kana: "/contradict/", meaning: "と矛盾する", options: ["気前のよい", "を邪魔する", "所属している、ものである", "と矛盾する"] },
  { id: "compensate", word: "compensate", kana: "/compensate/", meaning: "に補償する", options: ["脳", "を励ます", "粗い", "に補償する"] },
  { id: "coincide", word: "coincide", kana: "/coincide/", meaning: "同時に起こる", options: ["具体的な", "同時に起こる", "を消費する", "目に見える"] },
  { id: "assure", word: "assure", kana: "/assure/", meaning: "に安心させる", options: ["に安心させる", "立ちはだかる", "無罪の", "公正な、(数量などが)かなりの"] },
  { id: "attain", word: "attain", kana: "/attain/", meaning: "を達成する", options: ["戻る、帰る", "（最小）単位", "を達成する", "（アンケートによる意識などの）調査"] },
  { id: "inquire", word: "inquire", kana: "/inquire/", meaning: "を尋ねる", options: ["委員会", "を尋ねる", "（時間など）を充てる", "を宣伝する"] },
  { id: "invade", word: "invade", kana: "/invade/", meaning: "を侵略する、に侵攻する", options: ["を信じる", "の特徴を述べる", "を侵略する、に侵攻する", "を嫌う"] },
  { id: "conquer", word: "conquer", kana: "/conquer/", meaning: "を征服する", options: ["場面", "相続する", "資金、基金", "を征服する"] },
  { id: "persist", word: "persist", kana: "/persist/", meaning: "固執する、しつこく続ける", options: ["現象", "詳細（な情報）", "固執する、しつこく続ける", "初等（教育）の"] },
  { id: "last", word: "last", kana: "/last/", meaning: "続く", options: ["引用する", "極(地)", "を奮起させる", "続く"] },
  { id: "surrender", word: "surrender", kana: "/surrender/", meaning: "を引き渡す", options: ["地理、地理学", "青白い", "を引き渡す", "観衆、聴衆"] },
  { id: "betray", word: "betray", kana: "/betray/", meaning: "を裏切る、を漏らす", options: ["伝言、メッセージ", "確信して", "を押す", "を裏切る、を漏らす"] },
  { id: "strain", word: "strain", kana: "/strain/", meaning: "をぴんと張る、を痛める", options: ["記事", "永続的な", "をぴんと張る、を痛める", "大陸"] },
  { id: "refrain", word: "refrain", kana: "/refrain/", meaning: "控える", options: ["章", "控える", "（広大な）地域", "を修理する"] },
  { id: "scatter", word: "scatter", kana: "/scatter/", meaning: "をまき散らす", options: ["をまき散らす", "道徳（上）の", "危険（性）", "を懇願する、請う"] },
  { id: "spill", word: "spill", kana: "/spill/", meaning: "をこぼす", options: ["ことわざ", "繁盛する；繁殖する", "異なる", "をこぼす"] },
  { id: "prevail", word: "prevail", kana: "/prevail/", meaning: "普及する、勝る", options: ["最近", "中身", "普及する、勝る", "心配する"] },
  { id: "starve", word: "starve", kana: "/starve/", meaning: "飢えに苦しむ、渇望する", options: ["飢えに苦しむ、渇望する", "賛成する", "賢明な", "を魅了する"] },
  { id: "digest", word: "digest", kana: "/digest/", meaning: "を消化する", options: ["民主主義", "正当な証拠のある、有効な", "（仕事など）を割り当てる", "を消化する"] },
  { id: "disguise", word: "disguise", kana: "/disguise/", meaning: "を変装させる", options: ["洞察（力）", "を変装させる", "あり得る、可能な", "（発達、変化の）段階"] },
  { id: "strip", word: "strip", kana: "/strip/", meaning: "から?奪する、取り去る", options: ["だます", "から?奪する、取り去る", "運命", "確固とした"] },
  { id: "scratch", word: "scratch", kana: "/scratch/", meaning: "をかく", options: ["を持ち上げる", "氷河", "うなずく", "をかく"] },
  { id: "bathe", word: "bathe", kana: "/bathe/", meaning: "を入浴させる", options: ["を入浴させる", "自慢する", "価値のある", "進化する、発展する"] },
  { id: "soak", word: "soak", kana: "/soak/", meaning: "を浸す", options: ["謝る", "を浸す", "投票", "食欲、欲求"] },
  { id: "stir", word: "stir", kana: "/stir/", meaning: "をかき回す、呼び起こす", options: ["起源、ルーツ", "国民", "必要な", "をかき回す、呼び起こす"] },
  { id: "wind", word: "wind", kana: "/wind/", meaning: "曲がりくねる", options: ["伝統", "心、精神", "活動的な", "曲がりくねる"] },
  { id: "heal", word: "heal", kana: "/heal/", meaning: "を治す、癒す", options: ["を付ける、愛着を抱いている", "分類する", "証拠", "を治す、癒す"] },
  { id: "knit", word: "knit", kana: "/knit/", meaning: "を編む", options: ["家畜", "戦略", "元の", "を編む"] },
  { id: "sew", word: "sew", kana: "/sew/", meaning: "を縫いつける", options: ["精神の", "を縫いつける", "夜明け", "（物、体の一部）に損害を与える"] },
  { id: "dye", word: "dye", kana: "/dye/", meaning: "を染める", options: ["巨大な、莫大な", "原子力の、核の", "異質の", "を染める"] },
  { id: "beg", word: "beg", kana: "/beg/", meaning: "を懇願する、請う", options: ["を身に着けている", "を征服する", "を懇願する、請う", "表面"] },
  { id: "pray", word: "pray", kana: "/pray/", meaning: "祈る", options: ["祈る", "定期的な", "反応する", "を限定する"] },
  { id: "congratulate", word: "congratulate", kana: "/congratulate/", meaning: "に祝いの言葉を述べる", options: ["に祝いの言葉を述べる", "乱用する", "熱望して", "を明らかにする、暴露する"] },
  { id: "summit", word: "summit", kana: "/summit/", meaning: "頂上", options: ["環境", "頂上", "貿易", "刑務所"] },
  { id: "mayor", word: "mayor", kana: "/mayor/", meaning: "市長", options: ["を集中させる", "（喜怒哀楽の）感情", "所属している、ものである", "市長"] },
  { id: "secretary", word: "secretary", kana: "/secretary/", meaning: "秘書", options: ["秘書", "（政治的な）運動", "を保存する", "姿を消す"] },
  { id: "council", word: "council", kana: "/council/", meaning: "議会", options: ["飢えに苦しむ、渇望する", "議会", "あり得る、可能な", "地域社会"] },
  { id: "panel", word: "panel", kana: "/panel/", meaning: "委員会", options: ["絶対的な", "に（色、服などが）似合う、に都合がよい", "委員会", "程度"] },
  { id: "jury", word: "jury", kana: "/jury/", meaning: "陪審", options: ["自由な", "（課された）任務、仕事", "陪審", "を拒む"] },
  { id: "quarrel", word: "quarrel", kana: "/quarrel/", meaning: "口論", options: ["栄養摂取", "（問題など）を処理する", "じっと見つめる", "口論"] },
  { id: "divorce", word: "divorce", kana: "/divorce/", meaning: "離婚", options: ["離婚", "期間、（専門）用語", "を浪費する", "恐れ、予兆"] },
  { id: "thief", word: "thief", kana: "/thief/", meaning: "泥棒", options: ["追いつく", "泥棒", "いじめる", "率直な"] },
  { id: "refuge", word: "refuge", kana: "/refuge/", meaning: "避難", options: ["を維持する、を主張する", "施設", "避難", "自慢する"] },
  { id: "mercy", word: "mercy", kana: "/mercy/", meaning: "情け、慈悲", options: ["研究所、実験室", "瞬間", "生きている", "情け、慈悲"] },
  { id: "caution", word: "caution", kana: "/caution/", meaning: "用心、注意", options: ["用心、注意", "余分の", "確固とした", "を当惑させる"] },
  { id: "pity", word: "pity", kana: "/pity/", meaning: "残念なこと", options: ["残念なこと", "形、体調", "整然とした、きれいにしてある", "を判断する"] },
  { id: "sorrow", word: "sorrow", kana: "/sorrow/", meaning: "悲しみ", options: ["を産出する、（利益など）を生む、屈する", "群衆", "悲しみ", "商人"] },
  { id: "grief", word: "grief", kana: "/grief/", meaning: "深い悲しみ", options: ["方法、行儀、作法", "を縫いつける", "深い悲しみ", "爆発する"] },
  { id: "despair", word: "despair", kana: "/despair/", meaning: "絶望", options: ["光栄", "絶望", "つかむ", "割合"] },
  { id: "suicide", word: "suicide", kana: "/suicide/", meaning: "自殺", options: ["～媒介で", "ことわざ", "見えること", "自殺"] },
  { id: "ambulance", word: "ambulance", kana: "/ambulance/", meaning: "救急車", options: ["を感動させる", "を設立する", "特別の", "救急車"] },
  { id: "funeral", word: "funeral", kana: "/funeral/", meaning: "葬式", options: ["像、彫像", "外部の", "豪華な、雄大な", "葬式"] },
  { id: "grave", word: "grave", kana: "/grave/", meaning: "墓", options: ["墓", "搾取する", "ためらう、躊躇する", "（苦痛など）を和らげる、（不安など）を減らす"] },
  { id: "virtue", word: "virtue", kana: "/virtue/", meaning: "美徳", options: ["（精神的）負担、重荷", "を限定する", "を熱心に勧める", "美徳"] },
  { id: "legend", word: "legend", kana: "/legend/", meaning: "伝説", options: ["を繁殖させる、飼育する、（動物が）子を産む", "（孤独で）寂しい", "伝説", "表面"] },
  { id: "prestige", word: "prestige", kana: "/prestige/", meaning: "威信、名声", options: ["神話", "を測る", "争い", "威信、名声"] },
  { id: "glory", word: "glory", kana: "/glory/", meaning: "栄光", options: ["凍る", "を（公式に）禁止する", "誇張する", "栄光"] },
  { id: "dignity", word: "dignity", kana: "/dignity/", meaning: "尊厳", options: ["規則", "好む", "尊厳", "を輸入する"] },
  { id: "worship", word: "worship", kana: "/worship/", meaning: "崇拝", options: ["を強く望む", "崇拝", "よく知っている", "ひどい"] },
  { id: "criterion", word: "criterion", kana: "/criterion/", meaning: "基準", options: ["を我慢する", "広範囲にわたる", "基準", "温暖な"] },
  { id: "consent", word: "consent", kana: "/consent/", meaning: "承諾、同意", options: ["承諾、同意", "冷蔵庫", "慈善事業", "をいとわない"] },
  { id: "triumph", word: "triumph", kana: "/triumph/", meaning: "勝利", options: ["勝利", "を拒絶する", "貧困", "方法、行儀、作法"] },
  { id: "circulation", word: "circulation", kana: "/circulation/", meaning: "血行、発行部数", options: ["血行、発行部数", "思い切って行く", "を思い出す", "そうでなければ、それ以外は"] },
  { id: "merit", word: "merit", kana: "/merit/", meaning: "優秀さ、長所", options: ["車、乗り物", "交通（量）", "優秀さ、長所", "年齢"] },
  { id: "appetite", word: "appetite", kana: "/appetite/", meaning: "食欲、欲求", options: ["食欲、欲求", "編集者", "無礼な", "へり"] },
  { id: "nutrition", word: "nutrition", kana: "/nutrition/", meaning: "栄養摂取", options: ["任命する", "栄養摂取", "説明する", "縮む"] },
  { id: "decay", word: "decay", kana: "/decay/", meaning: "虫歯、衰退、荒廃", options: ["範囲", "恐れて", "障害（物）", "虫歯、衰退、荒廃"] },
  { id: "atom", word: "atom", kana: "/atom/", meaning: "原子", options: ["と矛盾する", "原子", "（料理の）材料", "無罪の"] },
  { id: "boom", word: "boom", kana: "/boom/", meaning: "好況、ブーム", options: ["を編む", "退く", "好況、ブーム", "を尊敬する"] },
  { id: "valid", word: "valid", kana: "/valid/", meaning: "正当な証拠のある、有効な", options: ["見たところ", "静かな", "正当な証拠のある、有効な", "隠す"] },
  { id: "due", word: "due", kana: "/due/", meaning: "予定で、締め切りの", options: ["社会の", "利用、入手", "予定で、締め切りの", "を勧める"] },
  { id: "vacant", word: "vacant", kana: "/vacant/", meaning: "空いている", options: ["を結びつける", "空いている", "冷静な", "（発達、変化の）段階"] },
  { id: "bare", word: "bare", kana: "/bare/", meaning: "裸の", options: ["着実な", "を減らす", "裸の", "10年間"] },
  { id: "naked", word: "naked", kana: "/naked/", meaning: "裸の", options: ["裸の", "（車などが通った）跡", "を置く、敷く", "超える"] },
  { id: "obscure", word: "obscure", kana: "/obscure/", meaning: "わかりにくい", options: ["秘書", "土壌、土", "(環境)保護", "わかりにくい"] },
  { id: "peculiar", word: "peculiar", kana: "/peculiar/", meaning: "特有の", options: ["装飾する", "特有の", "相互の", "(公共の場での)ごみ"] },
  { id: "tidy", word: "tidy", kana: "/tidy/", meaning: "整然とした、きれいにしてある", options: ["整然とした、きれいにしてある", "練習", "能力", "撃つ"] },
  { id: "minute", word: "minute", kana: "/minute/", meaning: "微小な", options: ["を受け取る", "近づく", "微小な", "残念なことに"] },
  { id: "vague", word: "vague", kana: "/vague/", meaning: "漠然とした", options: ["部分", "動機", "勝利", "漠然とした"] },
  { id: "steep", word: "steep", kana: "/steep/", meaning: "急な", options: ["急な", "を計算する", "障壁", "おしゃべりをする"] },
  { id: "humid", word: "humid", kana: "/humid/", meaning: "湿気のある", options: ["を裏付ける、(本当だと)確認する", "嫌悪感を持たせる", "湿気のある", "品目、項目"] },
  { id: "earnest", word: "earnest", kana: "/earnest/", meaning: "真剣な、本気の", options: ["状況、事情", "真剣な、本気の", "に言及する", "像、彫像"] },
  { id: "absurd", word: "absurd", kana: "/absurd/", meaning: "ばかげた", options: ["を象徴する、を代表する", "をしっかり握る", "を説明する、を例証する", "ばかげた"] },
  { id: "hostile", word: "hostile", kana: "/hostile/", meaning: "反感を持った、敵意のある", options: ["重大な", "反感を持った、敵意のある", "商人", "バイリンガルの，2言語を話す"] },
  { id: "idle", word: "idle", kana: "/idle/", meaning: "使われていない、仕事がない", options: ["縛る", "使われていない、仕事がない", "威信、名声", "着実な"] },
  { id: "jealous", word: "jealous", kana: "/jealous/", meaning: "嫉妬深い", options: ["を促進する", "定期的な", "嫉妬深い", "寛大な"] },
  { id: "loyal", word: "loyal", kana: "/loyal/", meaning: "忠実な", options: ["忠実な", "を満たす", "理由", "たとえ何を…しても、たとえ何が…であろうと"] },
  { id: "supreme", word: "supreme", kana: "/supreme/", meaning: "最高の、最大の", options: ["を（展覧会などに）展示する、（感情、兆候など）を示す", "最高の、最大の", "具体的な", "強化する"] },
  { id: "infinite", word: "infinite", kana: "/infinite/", meaning: "無限の", options: ["追いつく", "無限の", "即時の", "横たわる、うそをつく"] },
  { id: "static", word: "static", kana: "/static/", meaning: "変化のない", options: ["口論", "血行、発行部数", "変化のない", "心に訴える"] },
  { id: "thorough", word: "thorough", kana: "/thorough/", meaning: "徹底的な", options: ["を決定する", "（人の罪など）を許す", "徹底的な", "予定で、締め切りの"] },
  { id: "immense", word: "immense", kana: "/immense/", meaning: "計り知れない", options: ["差別", "を弱める", "頻繁な", "計り知れない"] }
];

const sections = [
  { id: 1, title: "基礎を固める", note: "よく使う動詞と基本語", units: ["基本動詞", "日常の名詞", "かんたんな形容詞"] },
  { id: 2, title: "会話を広げる", note: "考えを伝えるための言葉", units: ["気持ちを表す", "つながりの言葉", "学校と社会"] },
  { id: 3, title: "読解に強くなる", note: "長文で出会うキーワード", units: ["抽象語", "論理の言葉", "アカデミック語彙"] }
];

const badges = [
  { id: "first-step", name: "FIRST STEP", note: "はじめのレッスン", kind: "achievement" },
  { id: "seven-days", name: "7 DAYS", note: "7日連続記録", kind: "achievement" },
  { id: "focus", name: "FOCUS", note: "集中のしるし", kind: "capsule" },
  { id: "sakura-star", name: "SAKURA STAR", note: "春色のしるし", kind: "capsule" },
  { id: "thirty-days", name: "30 DAYS", note: "30日連続記録", kind: "achievement" },
  { id: "century", name: "100 DAYS", note: "100日連続記録", kind: "achievement" },
  { id: "word-hunter", name: "WORD HUNTER", note: "30語を学習", kind: "achievement" },
  { id: "perfect-five", name: "PERFECT FIVE", note: "5問連続正解", kind: "achievement" },
  { id: "night-owl", name: "NIGHT OWL", note: "夜のレッスン", kind: "achievement" },
  { id: "streak-maker", name: "STREAK MAKER", note: "14日連続記録", kind: "achievement" },
  { id: "polyglot", name: "POLYGLOT", note: "100語を学習", kind: "achievement" },
  { id: "tango-legend", name: "TANGO LEGEND", note: "レベル20到達", kind: "achievement" }
];

const themes = [
  { id: "midnight", name: "MIDNIGHT", swatch: "#806fff", gradient: "linear-gradient(135deg,#0b0d19,#28244f 48%,#4d3d9a)", desc: "深い夜のパープル" },
  { id: "sakura", name: "SAKURA GLASS", swatch: "#f487b3", gradient: "linear-gradient(135deg,#351729,#9b416e 46%,#ffb4c9)", desc: "やわらかな桜色" },
  { id: "ocean", name: "OCEAN GLASS", swatch: "#41b3ff", gradient: "linear-gradient(135deg,#071625,#075a8f 48%,#39e0d2)", desc: "澄んだ水面の青" },
  { id: "aurora", name: "AURORA", swatch: "#63e9a8", gradient: "linear-gradient(135deg,#071e22,#147a68 45%,#bbf56e)", desc: "静かな光のグリーン" },
  { id: "ember", name: "EMBER", swatch: "#ff8a5b", gradient: "linear-gradient(135deg,#26110d,#8a3425 48%,#ffc05c)", desc: "熱を帯びた夕暮れ" },
  { id: "lavender", name: "LAVENDER HAZE", swatch: "#c59bff", gradient: "linear-gradient(135deg,#17112d,#6545a2 50%,#e6c8ff)", desc: "夢のような薄紫" },
  { id: "forest", name: "FOREST", swatch: "#7cdb8b", gradient: "linear-gradient(135deg,#071a16,#1c6146 48%,#b7e879)", desc: "深い森の静けさ" },
  { id: "mono", name: "MONOCHROME", swatch: "#e6e9f2", gradient: "linear-gradient(135deg,#11131a,#515867 50%,#f1f3f8)", desc: "静かな白黒" }
];

const leagues = [
  { id: "quartz", name: "クォーツリーグ", short: "クォーツ", minXP: 0, color: "#d8dde7" },
  { id: "amethyst", name: "アメジストリーグ", short: "アメジスト", minXP: 300, color: "#b67cf1" },
  { id: "sapphire", name: "サファイアリーグ", short: "サファイア", minXP: 800, color: "#55b8ff" },
  { id: "emerald", name: "エメラルドリーグ", short: "エメラルド", minXP: 1600, color: "#5be0a4" },
  { id: "ruby", name: "ルビーリーグ", short: "ルビー", minXP: 3000, color: "#ff7185" },
  { id: "diamond", name: "ダイヤモンドリーグ", short: "ダイヤモンド", minXP: 5000, color: "#d6f7ff" }
];
function currentLeague() { const xp = Number(state.weeklyXP || state.xp || 0); return leagues.reduce((current, league) => xp >= league.minXP ? league : current, leagues[0]); }
function avatarMarkup(id, label = "", image = "") { return `<span class="avatar avatar-custom avatar-photo" aria-label="${escapeHTML(label || "プロフィール写真")}"><img src="${escapeHTML(image || "./user.png")}" alt="" /></span>`; }

const todayKey = () => new Date().toISOString().slice(0, 10);
const cleanInitialName = (name) => /^(ミナト|みなと|minato)$/i.test(String(name || "").trim()) ? "TANGO USER" : (name || "TANGO USER");
function currentWeekKey(dateKey = todayKey()) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
const defaultState = () => ({
  version: VERSION,
  xp: 0,
  level: 1,
  coin: 0,
  hp: 5,
  hpUpdatedAt: Date.now(),
  combo: 0,
  streak: 0,
  weeklyXP: 0,
  lastStudyDate: null,
  lastLessonStampDate: null,
  streakHistory: [],
  completedLessons: [],
  words: {},
  savedWords: [],
  difficultWords: [],
  daily: { date: todayKey(), lessons: 0, words: 0, saved: 0 },
  ownedThemes: ["midnight", "sakura", "ocean", "aurora", "ember", "lavender", "forest", "mono"],
  equippedTheme: "midnight",
  items: { hpStock: 1, streakKeep: 1 },
  ownedBadges: [],
  equippedBadges: [],
  history: [],
  weeklyChallenge: { week: currentWeekKey(), studyDays: [], claimed: false },
  studyGarden: { growth: 0, lastDay: null },
  profile: { name: "TANGO USER", email: "", publicId: "", avatarId: "aqua", loggedIn: false },
  settings: { dark: false, sound: true, lightUiMigration: true },
  ui: { view: "home", modal: null, rankingTab: "weekly", authTab: "login", auto: false, socialTab: "global", selectedGroup: "", hubTab: "profile" },
  social: { friends: [], following: [], followers: [], groups: [], selectedProfile: null }
});

function mergeState(saved) {
  const fresh = defaultState();
  if (!saved || typeof saved !== "object") return fresh;
  return {
    ...fresh, ...saved,
    hp: Math.max(0, Math.min(30, Number(saved.hp ?? fresh.hp))),
    hpUpdatedAt: Number(saved.hpUpdatedAt || Date.now()),
    daily: { ...fresh.daily, ...(saved.daily || {}) },
    streakHistory: Array.isArray(saved.streakHistory) ? saved.streakHistory.slice(-90) : fresh.streakHistory,
    items: { ...fresh.items, ...(saved.items || {}) },
    profile: { ...fresh.profile, ...(saved.profile || {}), name: cleanInitialName(saved.profile?.name) },
    settings: { ...fresh.settings, ...(saved.settings || {}), dark: saved.settings?.lightUiMigration ? Boolean(saved.settings.dark) : false, lightUiMigration: true },
    weeklyChallenge: { ...fresh.weeklyChallenge, ...(saved.weeklyChallenge || {}) },
    studyGarden: { ...fresh.studyGarden, ...(saved.studyGarden || {}) },
    ui: { ...fresh.ui, ...(saved.ui || {}), modal: null, view: ["profile", "friends", "collection"].includes(saved.ui?.view) ? "community" : (saved.ui?.view || "home"), hubTab: saved.ui?.hubTab || (["profile", "friends", "collection"].includes(saved.ui?.view) ? saved.ui.view : "profile") },
    social: { ...fresh.social, ...(saved.social || {}) },
    ownedThemes: [...new Set([...(saved.ownedThemes || []), ...fresh.ownedThemes])],
    ownedBadges: [...new Set(saved.ownedBadges || [])],
    equippedBadges: saved.equippedBadges || fresh.equippedBadges
  };
}

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const row = document.cookie.split("; ").find(v => v.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : null;
}
function setCookie(name, value, days = 365) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${secure}`;
}
function deleteCookie(name) { document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`; }
function readStateCookie() {
  try {
    const count = Number(getCookie(`${COOKIE_KEY}_count`) || 0);
    if (!count) return null;
    let raw = "";
    for (let i = 0; i < count; i++) raw += getCookie(`${COOKIE_KEY}_${i}`) || "";
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeStateCookie(value) {
  const raw = JSON.stringify(value);
  const previous = Number(getCookie(`${COOKIE_KEY}_count`) || 0);
  const chunks = [];
  for (let i = 0; i < raw.length; i += COOKIE_CHUNK) chunks.push(raw.slice(i, i + COOKIE_CHUNK));
  chunks.forEach((chunk, i) => setCookie(`${COOKIE_KEY}_${i}`, chunk));
  setCookie(`${COOKIE_KEY}_count`, String(chunks.length));
  for (let i = chunks.length; i < previous; i++) deleteCookie(`${COOKIE_KEY}_${i}`);
}
function loadState() {
  const cookieState = readStateCookie();
  if (cookieState) return mergeState(cookieState);
  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (legacy) { const migrated = mergeState(legacy); writeStateCookie(migrated); return migrated; }
  } catch {}
  return defaultState();
}
let state = loadState();
let learning = null;
let feverTimer = null;
let autoTimer = null;
function recoverHP(now = Date.now()) {
  const last = Number(state.hpUpdatedAt || now);
  if (state.hp >= 30) { state.hpUpdatedAt = now; return false; }
  const recovered = Math.floor(Math.max(0, now - last) / 3600000);
  if (!recovered) return false;
  state.hp = Math.min(30, state.hp + recovered);
  state.hpUpdatedAt = last + recovered * 3600000;
  if (state.hp === 30) state.hpUpdatedAt = now;
  return true;
}
recoverHP();
setInterval(() => { if (recoverHP()) { persist(); if (state.ui.view === "home") renderApp(); } }, 60000);

function persist({ sync = true } = {}) {
  state.version = VERSION;
  writeStateCookie(state);
  if (sync && firebaseUser && !applyingRemoteState) scheduleCloudSync();
}
function makeSevenDigitId() { return String(Math.floor(1000000 + Math.random() * 9000000)); }
async function ensurePublicId() {
  if (state.profile.publicId && /^\d{7}$/.test(state.profile.publicId)) return state.profile.publicId;
  let candidate = makeSevenDigitId();
  if (firebaseDb) {
    for (let i = 0; i < 4; i++) {
      try { const hit = await firebaseDb.collection("leaderboard").where("publicId", "==", candidate).limit(1).get(); if (!hit.empty) candidate = makeSevenDigitId(); else break; } catch { break; }
    }
  }
  state.profile.publicId = candidate;
  writeStateCookie(state);
  return candidate;
}
function cloudPayload() {
  const copy = JSON.parse(JSON.stringify(state));
  copy.ui = { ...copy.ui, modal: null };
  copy.profile = { ...copy.profile, loggedIn: true, email: firebaseUser?.email || copy.profile.email };
  return copy;
}
function scheduleCloudSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => pushCloudState().catch(() => {}), 900);
}
async function pushCloudState() {
  if (!firebaseDb || !firebaseUser) return false;
  syncStatus = { state: "syncing", message: "同期中" };
  try {
    await firebaseDb.collection("users").doc(firebaseUser.uid).set({ state: cloudPayload(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    syncStatus = { state: "synced", message: "同期済み" };
  } catch (error) {
    syncStatus = { state: "local", message: "端末に保存中" };
    console.warn("TANGO user sync unavailable", error?.code || error);
    return false;
  }
  try { await upsertLeaderboard(); } catch (error) { console.warn("TANGO leaderboard sync unavailable", error?.code || error); }
  return true;
}

async function upsertLeaderboard() {
  if (!firebaseDb || !firebaseUser) return false;
  await ensurePublicId();
  const ref = firebaseDb.collection("leaderboard").doc(firebaseUser.uid);
  const existing = await ref.get();
  const payload = { uid: firebaseUser.uid, publicId: state.profile.publicId, displayName: state.profile.name || "表示名未設定", avatarId: state.profile.avatarId || "aqua", avatarImage: state.profile.avatarImage || "", weeklyXP: Number(state.weeklyXP || 0), todayXP: Number(state.daily?.date === todayKey() ? state.daily.words * 2 : 0), streak: Number(state.streak || 0), streakHistory: state.streakHistory || [], lastStudyDate: state.lastStudyDate || null, groupIds: (state.social?.groups || []).map(g => g.id), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  if (!existing.exists) payload.heartsReceived = 0;
  await ref.set(payload, { merge: true });
  return true;
}
async function loadLeaderboard() {
  if (!firebaseDb || !firebaseUser) { leaderboardState = { loading: false, rows: [], error: "" }; renderApp(); return; }
  leaderboardState = { loading: true, rows: [], error: "" }; renderApp();
  try {
    const tab = state.ui.rankingTab || "weekly";
    const field = tab === "today" ? "todayXP" : tab === "streak" ? "streak" : "weeklyXP";
    let query = firebaseDb.collection("leaderboard");
    if (state.ui.socialTab === "friends") {
      const ids = [firebaseUser.uid, ...(state.social?.friends || []).map(f => f.uid)].slice(0, 10);
      query = ids.length ? query.where("uid", "in", ids) : query.where("uid", "==", firebaseUser.uid);
    } else if (state.ui.socialTab === "group" && state.ui.selectedGroup) {
      query = query.where("groupIds", "array-contains", state.ui.selectedGroup);
    }
    const snap = await query.orderBy(field, "desc").limit(12).get();
    leaderboardState = { loading: false, rows: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })), error: "" };
  } catch (error) {
    try {
      const fallback = await query.limit(30).get();
      const rows = fallback.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0)).slice(0, 12);
      leaderboardState = { loading: false, rows, error: "" };
    } catch {
      leaderboardState = { loading: false, rows: [], error: "ランキングを読み込めませんでした。" };
    }
  }
  renderApp();
} 
async function loadSocial() {
  if (!firebaseDb || !firebaseUser) return;
  try {
    const friends = await firebaseDb.collection("users").doc(firebaseUser.uid).collection("friends").get();
    state.social.friends = friends.docs.map(d => ({ id: d.id, ...d.data() }));
    const following = await firebaseDb.collection("users").doc(firebaseUser.uid).collection("following").get();
    state.social.following = following.docs.map(d => ({ id: d.id, ...d.data() }));
    const groups = await firebaseDb.collection("groups").where("memberUids", "array-contains", firebaseUser.uid).limit(20).get();
    state.social.groups = groups.docs.map(d => ({ id: d.id, ...d.data() }));
    persist({ sync: false });
  } catch {}
}
async function loadFriendProfile(uid) {
  if (!firebaseDb || !firebaseUser) { toast("プロフィールを見るにはログインしてください。", "bad"); return; }
  const snap = await firebaseDb.collection("leaderboard").doc(uid).get();
  if (!snap.exists) { toast("そのユーザーは見つかりませんでした。", "bad"); return; }
  const following = await firebaseDb.collection("users").doc(firebaseUser.uid).collection("following").doc(uid).get();
  state.social.selectedProfile = { uid, ...snap.data(), isFollowing: following.exists };
  state.ui.modal = "friend-profile"; renderApp();
}
async function followUser(uid, displayName = "未設定") {
  if (!firebaseDb || !firebaseUser || uid === firebaseUser.uid) return;
  const followingRef = firebaseDb.collection("users").doc(firebaseUser.uid).collection("following").doc(uid);
  const followerRef = firebaseDb.collection("users").doc(uid).collection("followers").doc(firebaseUser.uid);
  const already = state.social.following.some(f => f.uid === uid);
  if (already) {
    await followingRef.delete(); await followerRef.delete();
    state.social.following = state.social.following.filter(f => f.uid !== uid);
    if (state.social.selectedProfile) state.social.selectedProfile.isFollowing = false;
    toast("フォローを解除しました");
  } else {
    const item = { uid, displayName, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await followingRef.set(item); await followerRef.set({ uid: firebaseUser.uid, displayName: state.profile.name || "表示名未設定", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    state.social.following.push({ uid, displayName });
    if (state.social.selectedProfile) state.social.selectedProfile.isFollowing = true;
    toast("フォローしました", "good");
  }
  persist({ sync: false }); renderApp();
}
async function sendHeart(uid) {
  if (!firebaseDb || !firebaseUser || uid === firebaseUser.uid) return;
  const heartRef = firebaseDb.collection("users").doc(uid).collection("hearts").doc(firebaseUser.uid);
  if ((await heartRef.get()).exists) { toast("このユーザーにはハートを送信済みです。", "normal"); return; }
  const batch = firebaseDb.batch();
  batch.set(heartRef, { fromUid: firebaseUser.uid, fromName: state.profile.name || "表示名未設定", sentAt: firebase.firestore.FieldValue.serverTimestamp() });
  batch.set(firebaseDb.collection("leaderboard").doc(uid), { heartsReceived: firebase.firestore.FieldValue.increment(1) }, { merge: true });
  await batch.commit();
  if (state.social.selectedProfile) state.social.selectedProfile.heartsReceived = Number(state.social.selectedProfile.heartsReceived || 0) + 1;
  renderApp(); toast("ハートをプレゼントしたよ", "good");
}
async function addFriendByUid(publicId) {
  if (!firebaseDb || !firebaseUser) { toast("フレンド機能を使うにはログインしてください", "bad"); return; }
  const clean = publicId.trim();
  if (!/^\d{7}$/.test(clean)) { toast("ユーザーIDを入力してください", "bad"); return; }
  const result = await firebaseDb.collection("leaderboard").where("publicId", "==", clean).limit(1).get();
  if (result.empty) { toast("一致するユーザーIDは見つかりませんでした", "bad"); return; }
  const doc = result.docs[0]; const data = doc.data();
  if (doc.id === firebaseUser.uid) { toast("自分自身は追加できません", "bad"); return; }
  await firebaseDb.collection("users").doc(firebaseUser.uid).collection("friends").doc(doc.id).set({ uid: doc.id, publicId: clean, displayName: data.displayName || "表示名未設定", addedAt: firebase.firestore.FieldValue.serverTimestamp() });
  await followUser(doc.id, data.displayName || "未設定");
  await loadSocial(); state.ui.modal = null; renderApp(); toast("フレンドに追加しました", "good");
}
async function createGroup(name, type = "personal", parentPublicId = "") {
  if (!firebaseDb || !firebaseUser) { toast("グループ機能を使うにはログインしてください", "bad"); return; }
  const clean = name.trim(); if (!clean) { toast("グループ名を入力してください", "bad"); return; }
  if (!["personal", "school"].includes(type)) type = "personal";
  let parentGroupId = "";
  if (type === "school" && parentPublicId.trim()) {
    const parentSnap = await firebaseDb.collection("groups").where("publicId", "==", parentPublicId.trim()).limit(1).get();
    if (parentSnap.empty) { toast("メインの学校グループが見つかりません", "bad"); return; }
    parentGroupId = parentSnap.docs[0].id;
  }
  let publicId = makeSevenDigitId();
  for (let i = 0; i < 4; i++) { try { const hit = await firebaseDb.collection("groups").where("publicId", "==", publicId).limit(1).get(); if (!hit.empty) publicId = makeSevenDigitId(); else break; } catch { break; } }
  const groupData = { publicId, name: clean, type, parentGroupId, ownerUid: firebaseUser.uid, memberUids: [firebaseUser.uid] };
  const ref = await firebaseDb.collection("groups").add({ ...groupData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  state.social.groups = [...(state.social.groups || []).filter(g => g.id !== ref.id), { id: ref.id, ...groupData }];
  state.ui.selectedGroup = ref.id; persist({ sync: false }); renderApp();
  loadSocial().catch(() => {}); loadLeaderboard().catch(() => {}); toast(`グループを作成しました　ID: ${publicId}`, "good");
}
async function joinGroup(publicId) {
  if (!firebaseDb || !firebaseUser) { toast("グループ機能を使うにはログインしてください", "bad"); return; }
  const clean = publicId.trim(); if (!/^\d{7}$/.test(clean)) { toast("グループIDを入力してください", "bad"); return; }
  const result = await firebaseDb.collection("groups").where("publicId", "==", clean).limit(1).get();
  if (result.empty) { toast("そのグループIDは見つかりませんでした", "bad"); return; }
  const doc = result.docs[0]; const existingMembers = doc.data().memberUids || [];
  if (existingMembers.includes(firebaseUser.uid)) { toast("すでに参加しているグループです。", "normal"); return; }
  await doc.ref.update({ memberUids: firebase.firestore.FieldValue.arrayUnion(firebaseUser.uid) });
  const joined = { id: doc.id, ...doc.data(), memberUids: [...existingMembers, firebaseUser.uid] };
  state.social.groups = [...(state.social.groups || []).filter(g => g.id !== doc.id), joined];
  state.ui.selectedGroup = doc.id; persist({ sync: false }); renderApp(); loadSocial().catch(() => {}); loadLeaderboard().catch(() => {}); toast("グループに参加しました", "good");
}
async function pullCloudState() {
  if (!firebaseDb || !firebaseUser) return false;
  try {
    const ref = firebaseDb.collection("users").doc(firebaseUser.uid);
    const snap = await ref.get();
    if (!snap.exists || !snap.data()?.state) { await pushCloudState(); return false; }
    applyingRemoteState = true;
    state = mergeState(snap.data().state);
    state.profile.loggedIn = true; state.profile.email = firebaseUser.email || state.profile.email;
    writeStateCookie(state); renderApp(); return true;
  } catch (error) {
    syncStatus = { state: "local", message: "端末に保存中" };
    console.warn("TANGO cloud restore unavailable", error?.code || error);
    return false;
  } finally { applyingRemoteState = false; }
}

function initFirebase() {
  if (!isFirebaseConfigured() || !window.firebase) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebaseAuth = firebase.auth(); firebaseDb = firebase.firestore();
    firebaseAuth.onAuthStateChanged(async user => {
      firebaseUser = user || null;
      if (user) {
        state.profile.loggedIn = true; state.profile.email = user.email || ""; state.profile.name = cleanInitialName(user.displayName || state.profile.name || "TANGO USER"); await ensurePublicId(); writeStateCookie(state);
        try { await pullCloudState(); await upsertLeaderboard(); await loadSocial(); renderApp(); toast(syncStatus.state === "synced" ? "学習データを同期しました。" : "ログインしました。端末の学習データを保持しています。", syncStatus.state === "synced" ? "good" : "normal"); } catch { renderApp(); toast("ログインしました。学習データは端末に保存されています。", "normal"); }
        if (state.ui.view === "ranking") loadLeaderboard();
      } else if (state.profile.loggedIn) { state.profile.loggedIn = false; state.profile.email = ""; writeStateCookie(state); renderApp(); }
    });
  } catch { firebaseAuth = firebaseDb = null; }
}
function resetDailyIfNeeded() {
  if (state.daily.date !== todayKey()) state.daily = { date: todayKey(), lessons: 0, words: 0, saved: 0 };
}
function levelRemaining() { return Math.max(0, 500 - state.xp); }
function levelProgress() { return Math.min(100, (state.xp / 500) * 100); }
function totalCompleted() { return state.completedLessons.length; }
function isUnlocked() { return true; }
function mastery(wordId) { return state.words[wordId]?.mastery ?? 0; }
function masteryText(score) {
  if (score <= 20) return "NEW";
  if (score <= 40) return "LEARNING";
  if (score <= 70) return "GOOD";
  if (score <= 90) return "STRONG";
  return "MASTERED";
}
function wordFontSize(word) {
  return Math.max(26, Math.min(60, Math.round(600 / Math.max(1, word.length))));
}
function escapeHTML(s = "") { return String(s).replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c])); }
function badgeName(id) { return badges.find(b => b.id === id)?.name || "BADGE"; }
function toast(message, kind = "normal") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) { stack = document.createElement("div"); stack.className = "toast-stack"; document.body.append(stack); }
  const el = document.createElement("div");
  el.className = `toast ${kind === "good" ? "good" : kind === "bad" ? "bad" : ""}`;
  const symbol = kind === "good" ? icons.check : kind === "bad" ? icons.info : icons.spark;
  el.innerHTML = `<span class="toast-icon">${symbol}</span><span>${escapeHTML(message)}</span>`;
  stack.append(el);
  setTimeout(() => el.remove(), 2850);
}
function haptic(pattern = 10) { if (navigator.vibrate) navigator.vibrate(pattern); }
function tone(type = "good") {
  if (!state.settings.sound || !window.AudioContext && !window.webkitAudioContext) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = type === "fever" ? 659 : type === "bad" ? 180 : 470;
    gain.gain.setValueAtTime(.04, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + (type === "fever" ? .22 : .12));
    osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + (type === "fever" ? .22 : .12));
  } catch { /* audio is optional */ }
}
function navHtml(active) {
  const items = [["home", "ホーム", "home"], ["path", "学習", "learn"], ["ranking", "ランキング", "rank"], ["community", "マイページ・仲間", "user"]];
  return `<nav class="bottom-nav" aria-label="メインナビゲーション">${items.map(([id, label, ico]) => `<button class="nav-item ${active === id ? "active" : ""}" data-nav="${id}" aria-label="${label}">${icons[ico]}<span>${label}</span></button>`).join("")}</nav>`;
}
function topBar(title, action = "") { return `<header class="top-bar"><button class="icon-btn" data-nav="home" aria-label="ホームに戻る">${icons.back}</button><h1>${title}</h1>${action || `<span style="width:44px"></span>`}</header>`; }

function recordWeeklyChallengeStudy(dateKey) {
  const week = currentWeekKey(dateKey);
  if (state.weeklyChallenge.week !== week) state.weeklyChallenge = { week, studyDays: [], claimed: false };
  if (!state.weeklyChallenge.studyDays.includes(dateKey)) state.weeklyChallenge.studyDays.push(dateKey);
  if (!state.weeklyChallenge.claimed && state.weeklyChallenge.studyDays.length >= 3) {
    state.weeklyChallenge.claimed = true;
    state.coin += 50;
    toast("週3日チャレンジ達成！ 50コインを獲得しました", "good");
    tone("fever"); haptic([18, 35, 18]);
  }
}

function renderHome() {
  if (state.weeklyChallenge.week !== currentWeekKey()) state.weeklyChallenge = { week: currentWeekKey(), studyDays: [], claimed: false };
  const dailyTarget = 10;
  const dailyWords = state.daily.date === todayKey() ? Number(state.daily.words || 0) : 0;
  const dailyPercent = Math.min(100, Math.round(dailyWords / dailyTarget * 100));
  const gardenGrowth = Math.max(0, Number(state.studyGarden.growth || 0));
  const garden = gardenGrowth >= 14 ? ["🌸", "花が咲きました", ""] : gardenGrowth >= 7 ? ["🌳", "木が大きく育っています", ""] : gardenGrowth >= 3 ? ["🌿", "葉っぱが増えてきました", ""] : gardenGrowth >= 1 ? ["🌱", "芽が出ました！", ""] : ["🌱", "種をまきました", "今日の学習で芽を育てよう"];
  const gardenNext = gardenGrowth < 3 ? 3 : gardenGrowth < 7 ? 7 : gardenGrowth < 14 ? 14 : gardenGrowth + 7;
  const canStudy = state.hp > 0;
  const hpAction = state.items.hpStock > 0 ? `<button class="recovery-link" data-action="use-hp">回復ストックを使う</button>` : `<button class="recovery-link" data-action="capsule-info">HPの回復方法を見る</button>`;
  const canDraw = state.coin >= 100;
  return `<main class="screen home-screen">
    <header class="home-header"><div class="brand"><span class="brand-mark">T</span><span>TANGO</span></div><div class="header-actions">${canDraw ? `<button class="gacha-ready-btn" data-action="capsule-menu" aria-label="ガチャを引く">✦ ガチャを引く</button>` : ""}<button class="icon-btn" data-action="theme" aria-label="${state.settings.dark ? "ライトモード" : "ダークモード"}">${state.settings.dark ? icons.sun : icons.moon}</button><button class="icon-btn home-profile-btn" data-action="profile" aria-label="マイページ">${avatarMarkup(state.profile.avatarId, state.profile.name, state.profile.avatarImage)}</button></div></header>
    ${firebaseUser ? "" : `<button class="home-login-cta" data-action="login"><span class="login-cta-mark">G</span><span><b>Google / Apple でログイン</b><small>学習データを保存して、別の端末でも続ける</small></span>${icons.arrow}</button>`}
    <div class="home-mini-stats" aria-label="学習ステータス"><span>Lv <b>${state.level}</b></span><span>✦ <b>${state.streak}</b>日</span><span>${icons.heart} <b>${state.hp}</b>/30</span><span>${icons.coin} <b>${state.coin}</b></span></div>
    <section class="today-progress" aria-label="今日の学習進捗"><div class="today-progress-copy"><h2>今日の学習進捗</h2><strong>${dailyPercent}%<small> · ${Math.min(dailyWords, dailyTarget)} / ${dailyTarget}語</small></strong></div><div class="today-progress-track" role="progressbar" aria-label="今日の学習進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${dailyPercent}"><i style="width:${dailyPercent}%"></i></div></section>
    <section class="dashboard-welcome"><span class="eyebrow">${firebaseUser ? "今日もおかえりなさい" : "TANGO DAILY PRACTICE"}</span><h1>${escapeHTML(state.profile.name ? `こんにちは、${state.profile.name}さん` : "今日も一歩ずつ")}</h1></section>
    <section class="study-garden-card ${gardenGrowth ? "growing" : "seed"}"><span class="garden-plant" aria-hidden="true">${garden[0]}</span><div class="garden-copy"><span class="eyebrow">まいにちの学びの木 · ${gardenGrowth}日</span><h2>${garden[1]}</h2><p>${gardenGrowth ? `次の成長まであと ${gardenNext - gardenGrowth}日` : garden[2]}</p></div><span class="garden-sun" aria-hidden="true">☀</span></section>
    <section class="dashboard-lesson ${canStudy ? "" : "needs-hp"}"><div class="dashboard-lesson-copy"><span class="lesson-tag">今日の学習</span><h2>${canStudy ? "今日の10語を学ぼう" : "HPを回復しましょう"}</h2>${!canStudy ? `<p>時間経過で回復するか、回復ストックを使えます。</p>` : ""}</div>${canStudy ? `<button class="primary-btn dashboard-start" data-start="1-1">学習を始める <span>${icons.arrow}</span></button>` : `<div class="dashboard-hp-actions"><button class="primary-btn dashboard-start" disabled>HP回復後に学習を始める</button>${hpAction}</div>`}</section>
  </main>`;
}
function renderPath() {
  const unitCount = Math.ceil(vocab.length / 10);
  const nodes = Array.from({length: unitCount}, (_, i) => { const start = i * 10; const done = state.completedLessons.includes(i); const due = vocab.slice(start, start + 10).filter(reviewDue).length; const x = [50, 72, 84, 72, 50, 28, 16, 28][i % 8]; return `<div class="lesson-path-node ${done ? "complete" : ""}" style="--node-x:${x}%;--node-y:${i * 112 + 12}px"><button class="unit-node-button ${done ? "complete" : ""}" data-start="unit-${i + 1}" aria-label="UNIT ${i + 1}・${start + 1}から${Math.min(start + 10, vocab.length)}語"><span class="unit-node-icon">${done ? icons.check : "✦"}</span><b>UNIT ${String(i + 1).padStart(2, "0")}</b><small>${start + 1}–${Math.min(start + 10, vocab.length)}語${due ? ` · 復習 ${due}` : ""}</small></button></div>`; });
  const points = nodes.map((_, i) => ({ x: [150, 216, 252, 216, 150, 84, 48, 84][i % 8], y: i * 112 + 52 }));
  const road = points.map((point, i) => { if (!i) return `M ${point.x} ${point.y}`; const previous = points[i - 1]; return `C ${previous.x} ${previous.y + 38}, ${point.x} ${point.y - 38}, ${point.x} ${point.y}`; }).join(" ");
  const height = Math.max(220, unitCount * 112 + 30);
  return `<main class="screen unit-path-screen">${topBar("学習ユニット", `<span class="chip violet">${totalCompleted()} / ${unitCount}</span>`)}<section class="unit-path-hero"><div class="eyebrow">VOCABULARY PATH</div><h2>一歩ずつ、単語の道を進もう</h2><p>好きなレッスンを選んで、ゴールまで進もう。</p></section><section class="lesson-path" style="--path-height:${height}px"><svg class="lesson-road" viewBox="0 0 300 ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${road}" /></svg>${nodes.join("")}</section></main>`;
}
function renderCollection() {
  const theme = themes.find(t => t.id === state.equippedTheme) || themes[0];
  return `<main class="screen collection-screen">${topBar("コレクション", `<button class="icon-btn" data-nav="profile" aria-label="設定">${icons.gear}</button>`)}<section class="collection-hero-new"><div><span class="eyebrow">COLLECTION</span><h1>集めて、着せ替えしよう！</h1><p>テーマとバッジで、自分の学習空間をつくろう。</p></div><div class="collection-total"><b>${state.ownedThemes.length + state.ownedBadges.length}</b><small>ITEMS</small></div></section><section class="collection-summary"><div><b>${state.ownedThemes.length}</b><span>THEMES</span></div><div><b>${state.ownedBadges.length}</b><span>BADGES</span></div><div><b>${state.history.length}</b><span>RECENT</span></div></section><section class="collection-section-new"><div class="section-head"><h2 class="section-title">装備中のテーマ</h2><span class="eyebrow">${theme.name}</span></div><div class="active-theme-preview-new" style="--theme-gradient:${theme.gradient}"><div class="theme-swatch"></div><div><b>${theme.name}</b><small>${theme.desc}</small></div><span>✓</span></div><button class="outline-btn collection-wide-action" data-nav="profile">テーマを変更する ${icons.arrow}</button></section><section class="collection-section-new"><div class="section-head"><h2 class="section-title">バッジ</h2><button class="text-link" data-action="badges">編集 ${icons.arrow}</button></div><div class="badge-grid-new">${badges.map(item => { const owned = state.ownedBadges.includes(item.id); const equipped = state.equippedBadges.includes(item.id); return `<button class="badge-card-new ${owned ? "owned" : "locked"} ${equipped ? "equipped" : ""}" data-action="badges"><span>${owned ? icons.spark : icons.lock}</span><b>${badgeName(item.id)}</b><small>${equipped ? "装備中" : owned ? "獲得済み" : "未獲得"}</small></button>`; }).join("")}</div></section><section class="collection-section-new"><div class="section-head"><h2 class="section-title">最近の獲得</h2><span class="eyebrow">HISTORY</span></div>${state.history.length ? `<div class="collection-history">${state.history.slice(0,4).map(item => `<div><span>${icons.spark}</span><b>${escapeHTML(item.name)}</b><small>${item.date}</small></div>`).join("")}</div>` : `<div class="empty-note">ガチャや達成報酬でアイテムを獲得できます。</div>`}</section></main>`;
}
function streakHistoryStrip(history = []) { const labels = ["月", "火", "水", "木", "金", "土", "日"]; const now = new Date(); const day = (now.getDay() + 6) % 7; const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(now.getDate() - day); return labels.map((label,i) => { const date = new Date(monday); date.setDate(monday.getDate()+i); const key = date.toISOString().slice(0,10); return `<span class="friend-streak-day ${history.includes(key) ? "done" : ""} ${key === todayKey() ? "today" : ""}"><b>${label}</b><i>${history.includes(key) ? "✓" : ""}</i></span>`; }).join(""); }
function renderFriendStreakModal() { const friends = state.social.friends || []; const active = friends.filter(f => f.lastStudyDate === todayKey()).length; return `<div class="modal-backdrop" data-close-modal><section class="modal friend-streak-detail" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">FRIEND STREAK</div><h2>一緒に続ける</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><div class="streak-team-hero"><div><span class="eyebrow">YOUR STREAK</span><strong>🔥 ${state.streak}日</strong><small>今日達成したフレンド ${active}人</small></div><span class="team-streak-mark">∞</span></div><p class="modal-sub">フレンドと同じ日に学習すると、相手の連続記録も確認できます。プロフィールからフォローやハートも送れます。</p><div class="friend-streak-detail-list">${friends.length ? friends.map(f => `<button class="friend-streak-detail-row" data-action="view-friend" data-user-id="${escapeHTML(f.uid)}"><span class="friend-streak-avatar">${(f.displayName || "? ").slice(0,1)}</span><span><b>${escapeHTML(f.displayName || "表示名未設定")}</b><small>🔥 ${Number(f.streak || 0)}日連続 · ${f.lastStudyDate === todayKey() ? "今日達成" : "未達成"}</small><em>${streakHistoryStrip(f.streakHistory || [])}</em></span><strong>${f.lastStudyDate === todayKey() ? "✓" : "—"}</strong></button>`).join("") : `<div class="empty-note">フレンドを追加すると、ここで連続記録を共有できます。</div>`}</div><button class="primary-btn" data-action="close-modal">閉じる</button></section></div>`; }
function renderRanking() {
  if (!firebaseUser) return `<main class="screen">${topBar("ランキング")}<section class="path-intro"><div class="eyebrow">RANKING</div><h2>学習仲間と競おう。</h2><p>ログインすると、週間・今日・連続記録のランキングを表示します。</p><button class="primary-btn small" data-action="login" style="margin-top:16px;width:100%">ログイン ${icons.arrow}</button></section></main>`;
  const tabs = [["weekly", "週間"], ["today", "今日"], ["streak", "連続"]];
  const metric = state.ui.rankingTab === "today" ? "todayXP" : state.ui.rankingTab === "streak" ? "streak" : "weeklyXP";
  const rows = leaderboardState.rows || [];
  return `<main class="screen ranking-screen">${topBar("ランキング")}<div class="segmented">${tabs.map(([id, label]) => `<button class="${state.ui.rankingTab === id ? "active" : ""}" data-rank-tab="${id}">${label}</button>`).join("")}</div><section class="ranking-list">${leaderboardState.loading ? `<div class="empty-note">ランキングを読み込み中…</div>` : leaderboardState.error ? `<div class="empty-note">${escapeHTML(leaderboardState.error)} <button class="text-link" data-action="reload-ranking">再読み込み</button></div>` : rows.length ? rows.map((row, index) => `<div class="rank-row ${row.uid === firebaseUser.uid ? "mine" : ""}"><b class="rank-place">${index + 1}</b><span class="rank-name">${escapeHTML(row.displayName || "表示名未設定")}</span><strong>${Number(row[metric] || 0)}${metric === "streak" ? "日" : " XP"}</strong></div>`).join("") : `<div class="empty-note">まだランキングデータがありません。学習するとここに表示されます。</div>`}</section></main>`;
}
function renderFriends() {
  if (!firebaseUser) return `<main class="screen">${topBar("フレンド")}<section class="path-intro"><div class="eyebrow">FRIENDS</div><h2>一緒に続けよう。</h2><p>ログインすると、相手のプロフィールを見たり、フォロー・ハート・ランキングバトルを楽しめます。</p><button class="primary-btn small" data-action="login" style="margin-top:16px;width:100%">ログイン ${icons.arrow}</button></section><div class="empty-note">ログイン後にフレンドを追加できます。</div></main>`;
  return `<main class="screen">${topBar("フレンド", `<button class="icon-btn" data-action="social-settings" aria-label="フレンド管理">${icons.user}</button>`)}<section class="friends-hero"><div class="eyebrow">FRIENDS</div><h2>学習仲間と競う。</h2><p>プロフィール、フォロー、ハート、ランキングバトルをここから。</p></section><section class="my-user-id-card"><div><span class="eyebrow">MY USER ID</span><strong>${escapeHTML(state.profile.publicId || "発行中")}</strong><small>この7桁IDを友だちに共有して追加してもらえます。</small></div><button class="outline-btn small" data-action="copy-user-id">コピー</button></section><section class="social-block friends-add"><h3>フレンドを追加</h3><form id="friend-form"><input name="friendUid" required placeholder="7桁のユーザーID" /><button class="primary-btn small" type="submit">追加</button></form></section><button class="friend-streak-panel" data-action="friend-streak"><div><span class="eyebrow">FRIEND STREAK</span><strong>一緒に続ける</strong><small>今日学習したフレンド ${state.social.friends.filter(f => f.lastStudyDate === todayKey()).length}人 · 詳細を見る</small></div><span class="friend-streak-fire">🔥</span></button><section class="friends-section"><div class="section-head"><h2 class="section-title">フレンド</h2><span class="eyebrow">${state.social.friends.length} PEOPLE</span></div>${state.social.friends.length ? `<div class="social-list">${state.social.friends.map(f => `<button class="friend-row friend-row-streak" data-action="view-friend" data-user-id="${escapeHTML(f.uid)}"><span>${escapeHTML(f.displayName || "表示名未設定")}<small>🔥 ${Number(f.streak || 0)}日連続${f.lastStudyDate === todayKey() ? " · 今日達成" : ""}</small></span><small>プロフィールを見る</small></button>`).join("")}</div>` : `<div class="empty-note">まだフレンドはいません。ユーザーIDで追加できます。</div>`}</section><section class="friends-section"><div class="section-head"><h2 class="section-title">バトル</h2><span class="eyebrow">RANKING</span></div><button class="outline-btn" data-action="friend-battle" style="width:100%">フレンドランキングを見る ${icons.arrow}</button></section></main>`;
}
function renderProfile() {
  const profileAvatar = avatarMarkup(state.profile.avatarId, state.profile.name, state.profile.avatarImage);
  return `<main class="screen profile-screen">${topBar("マイページ", `<button class="primary-btn small" data-action="edit-profile">編集</button>`)}<section class="profile-hero-new"><div class="profile-avatar-wrap">${profileAvatar}<button class="avatar-edit-dot" data-action="edit-profile" aria-label="プロフィール画像を変更">＋</button></div><div class="profile-identity"><span class="eyebrow">${firebaseUser ? "ACCOUNT CONNECTED" : "LOCAL PROFILE"}</span><h1>${escapeHTML(cleanInitialName(state.profile.name))}</h1><p>${firebaseUser ? escapeHTML(state.profile.email || "TANGO Account") : "ログインしてデータを同期"}</p>${state.profile.publicId ? `<small class="public-id">ID <b>${escapeHTML(state.profile.publicId)}</b></small>` : ""}</div></section><section class="profile-level-card"><div class="profile-level-number"><small>LEVEL</small><b>${state.level}</b></div><div class="profile-level-copy"><div><span>次のレベルまで</span><strong>${500 - state.xp} XP</strong></div><div class="profile-level-progress"><i style="width:${levelProgress()}%"></i></div><small>${state.xp} / 500 XP</small></div></section><section class="profile-stat-grid"><div><b>${state.streak}</b><span>STREAK</span></div><div><b>${state.weeklyXP}</b><span>WEEKLY XP</span></div><div><b>${state.coin}</b><span>COINS</span></div><div><b>${state.ownedBadges.length}</b><span>BADGES</span></div></section><section class="profile-section-new"><div class="section-head"><h2 class="section-title">プロフィールを整える</h2></div><div class="profile-action-grid"><button data-action="edit-profile"><span>${icons.user}</span><b>プロフィール編集</b><small>表示名・画像・ID</small></button><button data-action="badges"><span>${icons.spark}</span><b>バッジを編集</b><small>${state.equippedBadges.length} / 3 装備中</small></button><button data-action="share"><span>${icons.share}</span><b>プロフィール共有</b><small>学習状況を共有</small></button><button data-nav="collection"><span>${icons.spark}</span><b>コレクション</b><small>テーマとアイテム</small></button></div></section><section class="settings-group"><h2>ACCOUNT</h2><div class="settings-list"><button class="setting-row" data-action="${firebaseUser ? "logout" : "login"}"><span class="setting-icon">${icons.user}</span><strong>${firebaseUser ? "ログアウト" : "ログイン / 会員登録"}</strong><span>${firebaseUser ? "接続中" : "データ同期"}</span>${icons.chevron}</button></div></section><section class="settings-group"><h2>SETTINGS</h2><div class="settings-list"><div class="setting-row theme-setting"><span class="setting-icon">${state.settings.dark ? icons.moon : icons.sun}</span><div class="setting-copy"><strong>テーマ</strong><span>${state.settings.dark ? "カラーテーマ" : "ライト"}</span></div><select class="theme-select" data-theme-select aria-label="テーマを選択">${themes.map(theme => `<option value="${theme.id}" ${state.equippedTheme === theme.id ? "selected" : ""}>${theme.name}</option>`).join("")}</select></div><div class="setting-row"><span class="setting-icon">${icons.volume}</span><strong>サウンド & Haptics</strong><button class="toggle ${state.settings.sound ? "on" : ""}" data-action="sound" aria-label="サウンド切替"><i></i></button></div></div></section> </main>`;
}
function renderCommunity() {
  const tab = ["profile", "friends", "collection"].includes(state.ui.hubTab) ? state.ui.hubTab : "profile";
  const page = tab === "friends" ? renderFriends() : tab === "collection" ? renderCollection() : renderProfile();
  const content = page.replace(/^<main[^>]*>/, "").replace(/<\/main>$/, "").replace(/<header class="top-bar">[\s\S]*?<\/header>/, "");
  const actions = tab === "profile" ? `<button class="primary-btn small" data-action="edit-profile">編集</button>` : tab === "friends" ? `<button class="icon-btn" data-action="social-settings" aria-label="フレンド管理">${icons.gear}</button>` : "";
  const tabs = [["profile", "プロフィール"], ["friends", "フレンド"], ["collection", "コレクション"]];
  return `<main class="screen community-screen">${topBar("マイページ", actions)}<nav class="hub-tabs" aria-label="マイページメニュー">${tabs.map(([id, label]) => `<button class="${tab === id ? "active" : ""}" data-hub-tab="${id}" aria-current="${tab === id ? "page" : "false"}">${label}</button>`).join("")}</nav><div class="hub-content">${content}</div></main>`;
}

function renderModal() {
  const modal = state.ui.modal;
  if (!modal) return "";
  if (modal === "login") {
    return `<div class="modal-backdrop" data-close-modal><section class="modal oauth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div class="oauth-brand"><span class="brand-mark">T</span></div><button class="icon-btn oauth-close" data-action="close-modal" aria-label="閉じる">${icons.close}</button><div class="oauth-heading"><span class="eyebrow">YOUR LEARNING, IN SYNC</span><h2 id="auth-title">TANGOにログイン</h2><p>学習の記録を保存して、どの端末からでも続けよう。</p></div><div class="oauth-options"><button class="oauth-btn google" data-auth-provider="google" ${!isFirebaseConfigured() ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.42-.18-2.09H12v3.95h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.25c1.9-1.75 2.97-4.33 2.97-7.43Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.25-2.55c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H3.05v2.63A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.87A6 6 0 0 1 6.1 12c0-.65.11-1.28.31-1.87V7.5H3.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.05 4.5l3.36-2.63Z"/><path fill="#EA4335" d="M12 6.03c1.47 0 2.79.5 3.83 1.52l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.36 2.63c.79-2.35 2.99-4.1 5.59-4.1Z"/></svg><span>Googleで続ける</span></button><button class="oauth-btn apple" data-auth-provider="apple" ${!isFirebaseConfigured() ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.12c.02 2.26 1.98 3.01 2 3.02-.02.05-.31 1.07-1.03 2.12-.62.9-1.27 1.79-2.29 1.8-1 .02-1.33-.58-2.49-.58s-1.52.56-2.47.6c-.98.04-1.73-.97-2.36-1.87-1.28-1.86-2.26-5.25-.94-7.54a3.64 3.64 0 0 1 3.06-1.86c.96-.02 1.87.65 2.47.65.59 0 1.7-.8 2.87-.68.49.02 1.87.2 2.76 1.5-.07.05-1.65.97-1.63 2.84ZM14.49 5.9a3.4 3.4 0 0 0 .8-2.43 3.47 3.47 0 0 0-2.25 1.15 3.2 3.2 0 0 0-.82 2.35 2.9 2.9 0 0 0 2.27-1.07Z"/></svg><span>Appleで続ける</span></button></div><p class="oauth-privacy">GoogleまたはAppleの認証を使います。パスワードをTANGOに入力する必要はありません。</p>${isFirebaseConfigured() ? "" : `<p class="oauth-setup-note">ログイン機能がまだ設定されていません。</p>`}</section></div>`;
  }
  if (modal === "edit-profile") return `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">PROFILE</div><h2>プロフィールを編集</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><p class="modal-sub">表示名はランキングにも表示されます。メールアドレスから自動で名前を作ることはありません。</p>${state.profile.publicId ? `<div class="public-id-card">あなたのユーザーID <b>${escapeHTML(state.profile.publicId)}</b><small>フレンド追加にこの7桁IDを使います。</small></div>` : ""}<form id="profile-form"><div class="field"><label for="display-name">表示名</label><input id="display-name" name="displayName" maxlength="20" required value="${escapeHTML(state.profile.name || "TANGO USER")}" /></div><div class="photo-upload-row">${avatarMarkup(state.profile.avatarId, state.profile.name, state.profile.avatarImage)}<div><label class="upload-btn" for="avatar-file-input">プロフィール写真を選ぶ</label><input id="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden /><small>端末内に保存。最大256pxに自動調整します。</small></div></div><button class="text-link remove-photo" type="button" data-action="reset-avatar-photo">デフォルト写真に戻す</button><button class="primary-btn" type="submit">保存する ${icons.arrow}</button></form><button class="outline-btn" data-action="badges" style="width:100%;margin-top:10px">バッジを編集</button></section></div>`;
  if (modal === "badges") {
    return `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">PROFILE BADGES</div><h2>バッジを選ぶ</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><p class="modal-sub">プロフィールには最大3個まで装備できます。</p><div class="badge-options">${badges.map(b => { const owned = state.ownedBadges.includes(b.id); const active = state.equippedBadges.includes(b.id); return `<button class="badge-choice ${active ? "active" : ""}" data-badge="${b.id}" ${owned ? "" : "disabled"}>${active ? "● " : "○ "}${b.name}<br><span style="color:var(--muted);font-family:var(--font)">${owned ? b.note : "未獲得"}</span></button>`; }).join("")}</div></section></div>`;
  }
  if (modal === "friend-profile") { const profile = state.social.selectedProfile || {}; return `<div class="modal-backdrop" data-close-modal><section class="modal friend-profile-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">USER PROFILE</div><h2>プロフィール</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><div class="friend-profile-card">${avatarMarkup(profile.avatarId, profile.displayName, profile.avatarImage)}<h3>${escapeHTML(profile.displayName || "表示名未設定")}</h3><p class="muted">ID: ${escapeHTML(profile.publicId || profile.uid || "")}</p><div class="friend-mini-stats"><span><b>${Number(profile.weeklyXP || 0)}</b>WEEKLY XP</span><span><b>${Number(profile.streak || 0)}</b>STREAK</span><span><b>${Number(profile.heartsReceived || 0)}</b>HEARTS</span></div></div><div class="friend-actions"><button class="primary-btn" data-action="toggle-follow" data-user-id="${escapeHTML(profile.uid || "")}" data-user-name="${escapeHTML(profile.displayName || "表示名未設定")}">${profile.isFollowing ? "フォロー中" : "フォローする"}</button><button class="outline-btn" data-action="send-heart" data-user-id="${escapeHTML(profile.uid || "")}">♡ ハートを贈る</button><button class="outline-btn" data-action="friend-battle">ランキングで競う ${icons.arrow}</button></div></section></div>`; }
  if (modal === "social-settings") return `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">SOCIAL BATTLE</div><h2>フレンドとグループ</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><p class="modal-sub">相手のプロフィールを見て、フォロー・ハート・ランキングバトルを楽しめます。</p><div class="social-block"><h3>フレンドを追加</h3><form id="friend-form"><input name="friendUid" required placeholder="7桁のユーザーID" /><button class="primary-btn small" type="submit">追加</button></form><div class="social-list">${state.social.friends.length ? state.social.friends.map(f => `<button class="friend-row" data-action="view-friend" data-user-id="${escapeHTML(f.uid)}"><span>${escapeHTML(f.displayName || "表示名未設定")}</span><small>ID ${escapeHTML(f.publicId || f.uid)}</small></button>`).join("") : "フレンドはまだいません。"}</div></div><div class="social-block"><h3>グループを作成</h3><form id="group-form"><input name="groupName" maxlength="30" required placeholder="例：2年A組" /><select name="groupType" aria-label="グループ種別"><option value="personal">個人向け</option><option value="school">学校向け</option></select><input name="parentGroupId" inputmode="numeric" pattern="\d{7}" placeholder="学校内グループのみ：親グループID" /><button class="primary-btn small" type="submit">作成</button></form><h3>参加中のグループ</h3><div class="social-list">${state.social.groups.length ? state.social.groups.map(g => `<button class="group-choice ${state.ui.selectedGroup === g.id ? "selected" : ""}" data-select-group="${g.id}"><span>${escapeHTML(g.name)}<small>${g.type === "school" ? "学校" : "個人"} · ID ${escapeHTML(g.publicId || "未設定")}</small></span><small>${g.memberUids?.length || 0}人</small></button>`).join("") : "参加中のグループはありません。"}</div><form id="join-group-form"><input name="groupId" required placeholder="7桁のグループIDで参加" /><button class="outline-btn" type="submit">参加</button></form></div></section></div>`;
  if (modal === "missions") {
    const dailyItems = [{ label: "レッスンを完了", current: Math.min(1, state.daily.lessons), target: 1, reward: "+20 XP" }, { label: "単語を3語学習", current: Math.min(3, state.daily.words), target: 3, reward: "+10 COIN" }, { label: "単語を保存 / 苦手登録", current: Math.min(1, state.daily.saved), target: 1, reward: "+5 XP" }];
    const dailyDone = dailyItems.filter(item => item.current >= item.target).length;
    const monthlyDone = Math.min(20, (state.completedLessons || []).length);
    const monthlyPercent = Math.round(monthlyDone / 20 * 100);
    return `<div class="modal-backdrop" data-close-modal><section class="modal mission-detail-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">MISSION CENTER</div><h2>ミッション</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><div class="mission-detail-hero"><div><span class="eyebrow">TODAY'S PROGRESS</span><h3>${dailyDone} / ${dailyItems.length} 完了</h3><p>毎日の小さな達成を積み重ねよう。</p></div><strong class="mission-detail-percent">${Math.round(dailyDone / dailyItems.length * 100)}%</strong></div><section class="mission-detail-section"><div class="mission-detail-title"><h3>DAILY</h3><span class="eyebrow">リセット 00:00</span></div>${dailyItems.map(item => `<div class="mission-task"><span class="mission-task-check ${item.current >= item.target ? "done" : ""}">${item.current >= item.target ? "✓" : ""}</span><span><b>${item.label}</b><small>${item.current} / ${item.target} · ${item.reward}</small></span><i><em style="width:${Math.min(100, Math.round(item.current / item.target * 100))}%"></em></i></div>`).join("")}</section><section class="mission-detail-section monthly"><div class="mission-detail-title"><h3>MONTHLY</h3><b>${monthlyPercent}%</b></div><p>今月のレッスン達成数に応じて、マイルストーン報酬を獲得できます。</p><div class="monthly-milestones"><span class="${monthlyDone >= 5 ? "reached" : ""}">5 LESSONS</span><span class="${monthlyDone >= 10 ? "reached" : ""}">10 LESSONS</span><span class="${monthlyDone >= 20 ? "reached" : ""}">20 LESSONS</span></div><div class="mini-progress"><i style="width:${monthlyPercent}%"></i></div><small>${monthlyDone} / 20 LESSONS</small></section><button class="primary-btn" data-action="close-modal">ホームに戻る ${icons.arrow}</button></section></div>`;
  }
  if (modal === "capsule-info" || modal === "capsule-menu") return `<div class="modal-backdrop" data-close-modal><section class="modal capsule-menu-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">TANGO LUCKY CAPSULE</div><h2>今日の運だめし</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><div class="capsule-stage"><span class="capsule-orbit orbit-one">✦</span><span class="capsule-orbit orbit-two">✧</span><div class="capsule-big">${icons.spark}</div><span class="capsule-confetti confetti-one">✦</span><span class="capsule-confetti confetti-two">●</span><span class="capsule-confetti confetti-three">✧</span></div><div class="capsule-wallet"><span>あなたのコイン</span><strong>◉ ${state.coin}</strong></div><p class="capsule-menu-copy">学習でもらったコインでカプセルをひとつ開けよう。HPやコレクションアイテムが当たるよ。</p><div class="capsule-prize-preview">${capsuleRewards.map(item => `<div class="capsule-prize-chip"><span>${item.name.startsWith("HP") ? "💗" : item.name.includes("バッジ") ? "🏅" : "🎁"}</span><b>${escapeHTML(item.name)}</b><small>${item.probability}%</small></div>`).join("")}</div><button class="primary-btn capsule-draw-btn" data-action="capsule-draw" ${state.coin < 100 ? "disabled" : ""}>${state.coin >= 100 ? "100コインで回す　✦" : `あと ${100 - state.coin} コインで回せる`}</button><p class="capsule-fairness">1回100コイン · 排出確率は合計100%</p></section></div>`;
  if (modal === "friend-streak-details") return renderFriendStreakModal();
  if (modal.startsWith("streak:")) { const value = Number(modal.slice(7)) || state.streak; return `<div class="modal-backdrop streak-backdrop"><section class="streak-modal" role="dialog" aria-modal="true">${streakStampMarkup(value)}<button class="primary-btn" data-action="close-streak">連続記録を確認する ${icons.arrow}</button></section></div>`; }
  if (modal === "data") return `<div class="modal-backdrop" data-close-modal><section class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="eyebrow">LOCAL DATA</div><h2>この端末に保存中</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">${icons.close}</button></div><p class="modal-sub">XP、コイン、HP、単語ごとの習熟度、苦手・保存語、進捗、ミッション、テーマ、バッジ、週間XP、設定はこのブラウザのCookieに保存されています。</p><div class="firebase-note">アプリの更新時にデータが壊れないよう、保存データにはバージョンを持たせています。ブラウザのサイトデータを削除すると、端末内のデータも削除されます。</div></section></div>`;
  if (modal.startsWith("capsule:")) {
    const prize = modal.slice(8);
    return `<div class="modal-backdrop" data-close-modal><section class="modal capsule-result" role="dialog" aria-modal="true"><span class="result-confetti">✦　✧　✦</span><div class="eyebrow">CAPSULE OPENED!</div><div class="capsule-visual pop">${icons.spark}</div><span class="capsule-result-label">今回のアイテム</span><h3>${escapeHTML(prize)}</h3><p>いい引き！コレクションに追加したよ。</p><button class="primary-btn" data-action="close-modal">受け取って戻る ${icons.arrow}</button></section></div>`;
  }
  return "";
}

function renderApp() {
  resetDailyIfNeeded();
  clearAuto();
  const active = state.ui.view;
  document.body.dataset.theme = state.settings.dark ? state.equippedTheme : "light";
  const main = active === "home" ? renderHome() : active === "path" ? renderPath() : active === "ranking" ? renderRanking() : active === "community" ? renderCommunity() : renderProfile();
  app.innerHTML = `<div class="app-shell">${main}${navHtml(active)}${renderModal()}</div>`;
  persist();
}

function parseLessonIndex(id) {
  const unit = String(id).match(/^unit-(\d+)$/);
  if (unit) return Number(unit[1]) - 1;
  const nums = String(id).split("-").map(Number);
  if (nums.length === 3 && nums.every(Number.isFinite)) return (nums[0] - 1) * 9 + (nums[1] - 1) * 3 + (nums[2] - 1);
  return 0;
}
function reviewDue(word) { const d = state.words[word.id]; return Boolean(d && d.nextReviewAt && d.nextReviewAt <= Date.now()); }
function dueReviewWords() { return vocab.filter(reviewDue).sort((a,b) => scoreForReview(b) - scoreForReview(a)); }
function chooseLessonWords(lessonIndex) {
  const unitWords = vocab.slice(Math.max(0, lessonIndex) * 10, Math.max(0, lessonIndex) * 10 + 10);
  return unitWords.slice().sort(() => Math.random() - 0.5);
}
function chooseReviewWords() {
  const due = dueReviewWords();
  if (due.length) return due.slice(0, 5);
  return vocab.slice().sort((a, b) => scoreForReview(b) - scoreForReview(a)).slice(0, 5);
}
function questionMode() { return learning?.questionModes?.[learning.index] || "recall"; }
function makeEnglishOptions(word) {
  const distractors = vocab.filter(item => item.id !== word.id).slice();
  for (let i = distractors.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [distractors[i], distractors[j]] = [distractors[j], distractors[i]]; }
  const options = [word, ...distractors.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return options;
}
function scoreForReview(word) {
  const d = state.words[word.id] || {}; const elapsed = d.lastSeen ? Math.min(50, Math.floor((Date.now() - d.lastSeen) / 86400000) * 7) : 20;
  const dueBoost = reviewDue(word) ? 70 : 0;
  return dueBoost + (100 - (d.mastery ?? 0)) + (d.wrong || 0) * 20 + (state.difficultWords.includes(word.id) ? 38 : 0) + (state.savedWords.includes(word.id) ? 8 : 0) + elapsed;
}
function reviewLabel(word) { const d = state.words[word.id]; if (!d) return "NEW · 入試頻出"; if (reviewDue(word)) return "DUE · 思い出す時間"; return "REVIEW · もう一度定着"; }
function startLearning(id) {
  if (state.hp <= 0) { toast(state.items.hpStock > 0 ? "HPを回復してから始めましょう。" : "HPがありません。コインガチャで回復アイテムを手に入れましょう。", "bad"); return; }
  const lessonIndex = id === "review" ? -1 : parseLessonIndex(id);
  if (lessonIndex >= 0 && !isUnlocked(lessonIndex)) { toast("このLESSONはまだ未解放です。", "bad"); return; }
  const words = id === "review" ? chooseReviewWords() : chooseLessonWords(lessonIndex);
  learning = { id, lessonIndex, words, index: 0, revealed: false, testAnswered: false, auto: false, completed: false, spaced: words.some(word => reviewDue(word)), questionModes: words.map((_, i) => ["recall", "meaning-select", "spelling"][i % 3]), englishOptions: words.map(makeEnglishOptions), spellingCorrect: false };
  state.ui.view = "learn"; state.ui.modal = null; renderLearning();
}
function currentWord() { return learning?.words[learning.index]; }
function isTest() { return questionMode() !== "recall"; }
function renderLearning() {
  if (!learning) { state.ui.view = "home"; renderApp(); return; }
  document.body.dataset.theme = state.settings.dark ? state.equippedTheme : "light";
  const word = currentWord(); const test = isTest(); const progress = ((learning.index) / learning.words.length) * 100;
  const nextWord = learning.words[learning.index + 1];
  const nextMode = learning.questionModes?.[learning.index + 1] || "recall";
  const nextModeLabel = nextMode === "spelling" ? "英単語を書く問題" : nextMode === "meaning-select" ? "日本語から選ぶ問題" : "意味を思い出す問題";
  const nextPreview = nextWord ? `<div class="next-word-preview" aria-hidden="true"><small>NEXT · ${String(learning.index + 2).padStart(2, "0")}</small><strong>次の問題</strong><span class="next-preview-mask">● ● ● ● ●</span><small>${nextModeLabel}</small></div>` : "";
  const saved = state.savedWords.includes(word.id); const difficult = state.difficultWords.includes(word.id);
  const currentCard = test ? `<div class="current-test-card">${renderQuickTest(word)}</div>` : `<div class="word-card" id="word-card"><div class="word-count">QUESTION ${String(learning.index + 1).padStart(2, "0")} / ${learning.words.length}</div><div class="word-english" id="word-text" style="font-size:${wordFontSize(word.word)}px">${word.word}</div><div class="word-phonetic">${word.kana}</div><div class="tap-hint" id="tap-hint">${learning.revealed ? "上へスワイプで覚えた、下へスワイプで復習。" : `<span class="tap-dot"></span>まず意味を思い出してからタップ`}</div><div class="translation-wrap ${learning.revealed ? "show" : ""}" id="translation"><div class="translation-label">MEANING · RETRIEVAL FEEDBACK</div><div class="translation">${word.meaning}</div></div></div><div class="swipe-guide ${learning.revealed ? "show" : ""}" id="swipe-guide"><span class="no">↓ 覚えていない</span><span class="yes">↑ 覚えた</span></div>`;
  const wordStage = `${nextPreview}${currentCard}`;
  const lessonLabel = learning.lessonIndex < 0 ? "復習" : `レッスン · ${learning.words.length}語`;
  const actionRail = test ? "" : `<aside class="action-rail" aria-label="学習アクション"><div class="action-stack"><button class="action-orb" data-learn-action="pronounce" aria-label="発音">${icons.volume}</button><span>発音</span></div><div class="action-stack"><button class="action-orb ${saved ? "active" : ""}" data-learn-action="save" aria-label="保存">${icons.bookmark}</button><span>保存</span></div><div class="action-stack"><button class="action-orb ${difficult ? "active" : ""}" data-learn-action="difficult" aria-label="苦手">${icons.flag}</button><span>苦手</span></div><div class="action-stack"><button class="action-orb" data-learn-action="skip" aria-label="スキップ">${icons.skip}</button><span>スキップ</span></div><div class="action-stack"><button class="action-orb ${learning.auto ? "active" : ""}" data-learn-action="auto" aria-label="自動">${icons.auto}</button><span>自動</span></div><div class="action-stack"><button class="action-orb" data-learn-action="detail" aria-label="詳細">${icons.info}</button><span>詳細</span></div></aside>`;
  app.innerHTML = `<div class="app-shell learn-screen"><main class="screen learn-screen"><header class="learn-top"><button class="icon-btn" data-action="exit-learn" aria-label="学習を終了">${icons.close}</button><div class="learn-progress"><small>${lessonLabel}</small><div class="progress-rail"><div class="progress-bar" style="--progress:${progress}%"></div></div><span class="question-mode-label">${test ? (questionMode() === "spelling" ? "英単語を書く" : "日本語から選ぶ") : "意味を思い出す"}</span></div><button class="icon-btn" data-action="learn-info" aria-label="学習情報">${icons.info}</button></header><div class="learn-meta"><span>${reviewLabel(word)} · ${mastery(word.id)}%</span><span class="combo">${state.combo ? `${state.combo} COMBO` : ""}</span></div>${state.fever ? `<div class="fever-banner show" id="fever">${icons.spark} FEVER · XP ×2 · ${state.feverSeconds || 20}s</div>` : ""}<div class="word-stage ${test ? "test-stage" : ""}" id="word-stage">${wordStage}</div>${actionRail}${!test ? `<div class="learn-actions"><button class="learn-answer no" id="no-answer" ${learning.revealed ? "" : "disabled"}>わからない・覚えていない</button><button class="learn-answer yes" id="yes-answer" ${learning.revealed ? "" : "disabled"}>覚えた ↑</button></div>` : ""}</main></div>`;
  persist();
  setupLearningEvents();
  if (learning.auto && !test) scheduleAuto();
}
function renderQuickTest(word) {
  const letters = ["A", "B", "C", "D"];
  const mode = questionMode();
  if (mode === "spelling") return `<section class="quick-test spelling-test"><div class="test-label">WRITE IT</div><h2 class="spelling-prompt">${word.meaning}</h2><p>英単語を入力して答えよう</p><form id="spelling-form" autocomplete="off"><label class="visually-hidden" for="spelling-answer">英単語</label><input id="spelling-answer" name="answer" type="text" autocapitalize="none" spellcheck="false" autocomplete="off" placeholder="英単語を入力" required /><button class="primary-btn spelling-submit" type="submit">答えを確認</button></form><button class="test-dont-know" data-action="dont-know">わからない</button><div id="test-result" class="test-result" aria-live="polite"></div></section>`;
  const options = learning.englishOptions[learning.index] || makeEnglishOptions(word);
  return `<section class="quick-test meaning-select-test"><div class="test-label">日本語から選ぶ</div><h2 class="meaning-prompt">${escapeHTML(word.meaning)}</h2><p>この意味に合う英単語は？</p><div class="answers">${options.map((option, i) => `<button class="answer-btn" data-test-answer="${i}"><span class="answer-letter">${letters[i]}</span><strong>${escapeHTML(option.word)}</strong></button>`).join("")}</div><button class="test-dont-know" data-action="dont-know">わからない</button><div id="test-result" class="test-result" aria-live="polite"></div></section>`;
}
function setupLearningEvents() {
  const stage = document.querySelector("#word-stage");
  if (!stage || isTest()) return;
  let startY = 0; let deltaY = 0; let moved = false; let pointerId = null;
  stage.addEventListener("pointerdown", e => { startY = e.clientY; deltaY = 0; moved = false; pointerId = e.pointerId; });
  stage.addEventListener("pointermove", e => {
    if (e.pointerId !== pointerId) return;
    deltaY = e.clientY - startY; if (Math.abs(deltaY) > 12) moved = true;
    const card = document.querySelector("#word-card");
    if (learning?.revealed && card) {
      card.dataset.swipeDirection = deltaY < 0 ? "up" : "down";
      card.style.setProperty("--swipe-progress", String(Math.min(1, Math.abs(deltaY) / 100)));
    }
  });
  const finishPointer = e => {
    if (e.pointerId !== pointerId) return;
    if (!learning) return;
    if (learning.revealed && Math.abs(deltaY) > 54) { animateSwipe(deltaY < 0); pointerId = null; return; }
    if (!moved && !learning.revealed) revealCurrent();
    const card = document.querySelector("#word-card");
    if (card) { delete card.dataset.swipeDirection; card.style.removeProperty("--swipe-progress"); }
    pointerId = null;
  };
  stage.addEventListener("pointerup", finishPointer);
  stage.addEventListener("pointercancel", finishPointer);
  document.querySelector("#yes-answer")?.addEventListener("click", () => animateSwipe(true));
  document.querySelector("#no-answer")?.addEventListener("click", () => animateSwipe(false));
}
function revealCurrent() {
  if (!learning || learning.revealed || isTest()) return;
  learning.revealed = true;
  document.querySelector("#translation")?.classList.add("show");
  const hint = document.querySelector("#tap-hint"); if (hint) hint.textContent = "覚えたら上へ。わからない単語は下へスワイプ。";
  document.querySelector("#swipe-guide")?.classList.add("show");
  document.querySelector("#yes-answer")?.removeAttribute("disabled"); document.querySelector("#no-answer")?.removeAttribute("disabled");
  haptic(8);
}
function animateSwipe(known) {
  if (!learning || !learning.revealed) return;
  const card = document.querySelector("#word-card");
  if (card) card.classList.add(known ? "is-out-up" : "is-out-down");
  setTimeout(() => applyAnswer(known), 290);
}
function updateWordData(word, known) {
  const existing = state.words[word.id] || { mastery: 0, correct: 0, wrong: 0, lastSeen: 0, intervalDays: 0 };
  const intervals = [1, 3, 7, 14, 30];
  existing.mastery = Math.max(0, Math.min(100, existing.mastery + (known ? 16 : -12)));
  existing.correct += known ? 1 : 0; existing.wrong += known ? 0 : 1; existing.lastSeen = Date.now();
  existing.intervalDays = known ? intervals[Math.min(intervals.length - 1, Math.max(0, Number(existing.intervalDaysIndex || 0)))] : 0.5;
  existing.intervalDaysIndex = known ? Math.min(intervals.length - 1, Number(existing.intervalDaysIndex || 0) + 1) : 0;
  existing.nextReviewAt = Date.now() + existing.intervalDays * 86400000;
  existing.lastResult = known ? "remembered" : "forgot";
  state.words[word.id] = existing;
}
function addRewards(known) {
  const beforeCapsules = Math.floor(state.coin / 100);
  const multiplier = state.fever ? 2 : 1;
  const xpGain = (known ? 10 : 3) * multiplier; const coinGain = (known ? 5 : 1) * multiplier;
  state.xp += xpGain; state.coin += coinGain; state.weeklyXP += xpGain;
  while (state.xp >= 500) { state.xp -= 500; state.level += 1; toast(`Lv ${state.level} にアップ！`, "good"); }
  const afterCapsules = Math.floor(state.coin / 100);
  if (afterCapsules > beforeCapsules) toast("ガチャを1回引けます", "good");
  if (known) {
    state.combo += 1; tone("good"); haptic(12);
    if (state.combo > 0 && state.combo % 7 === 0) startFever();
  } else {
    state.combo = 0; state.hp = Math.max(0, state.hp - 1); state.hpUpdatedAt = Date.now(); state.fever = false; clearFever(); tone("bad"); haptic([15, 35, 15]);
  }
}
function startFever() {
  state.fever = true; state.feverSeconds = 20; tone("fever"); toast("FEVER TIME — XPとCoinが2倍！", "good");
  clearFever();
  feverTimer = setInterval(() => { if (!state.fever) return clearFever(); state.feverSeconds -= 1; const banner = document.querySelector("#fever"); if (banner) banner.innerHTML = `${icons.spark} FEVER · XP ×2 · ${state.feverSeconds}s`; if (state.feverSeconds <= 0) { state.fever = false; clearFever(); toast("Fever Time 終了。", "normal"); } persist(); }, 1000);
}
function clearFever() { if (feverTimer) { clearInterval(feverTimer); feverTimer = null; } }
function clearAuto() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } }
function scheduleAuto() { clearAuto(); autoTimer = setTimeout(() => { if (!learning || !learning.auto || isTest()) return; if (!learning.revealed) revealCurrent(); autoTimer = setTimeout(() => { if (learning?.auto) animateSwipe(true); }, 1050); }, 900); }
function applyAnswer(known) {
  if (!learning) return;
  const word = currentWord(); updateWordData(word, known); addRewards(known); state.daily.words += 1; if (!known && state.hp === 0) toast("HPがなくなりました。ホームで回復できます。", "bad"); persist();
  learning.index += 1; learning.revealed = false; learning.testAnswered = false;
  if (learning.index >= learning.words.length) return finishLearning();
  renderLearning();
}
function testAnswer(choice) {
  if (!learning || learning.testAnswered) return;
  const word = currentWord(); const mode = questionMode(); const correct = mode === "meaning-select" ? learning.englishOptions[learning.index]?.[choice]?.id === word.id : word.options[choice] === word.meaning; learning.testAnswered = true;
  document.querySelectorAll("[data-test-answer]").forEach(btn => { const index = Number(btn.dataset.testAnswer); const isCorrect = mode === "meaning-select" ? learning.englishOptions[learning.index]?.[index]?.id === word.id : word.options[index] === word.meaning; btn.disabled = true; if (isCorrect) btn.classList.add("correct"); else if (index === choice) btn.classList.add("wrong"); });
  const result = document.querySelector("#test-result"); if (result) { result.className = `test-result ${correct ? "good" : "bad"}`; result.textContent = correct ? "正解！ この調子。" : `おしい。正解は「${word.meaning}」。`; }
  setTimeout(() => applyAnswer(correct), 850);
}
function checkSpelling(event) {
  event.preventDefault();
  if (!learning || learning.testAnswered || questionMode() !== "spelling") return;
  const word = currentWord();
  const input = document.querySelector("#spelling-answer");
  const button = document.querySelector(".spelling-submit");
  const result = document.querySelector("#test-result");
  const correct = String(input?.value || "").trim().toLocaleLowerCase() === word.word.toLocaleLowerCase();
  learning.testAnswered = true; learning.spellingCorrect = correct;
  if (input) input.disabled = true;
  if (button) { button.disabled = true; button.textContent = "判定しました"; }
  document.querySelector(".test-dont-know")?.setAttribute("disabled", "");
  if (result) { result.className = `test-result ${correct ? "good" : "bad"}`; result.textContent = correct ? "正解！自分で書けました。" : `おしい。正解は「${word.word}」。次で取り返そう。`; }
  if (correct) { tone("good"); haptic(12); } else { tone("bad"); haptic(10); }
  setTimeout(() => applyAnswer(correct), 1100);
}
function dontKnowTestAnswer() {
  if (!learning || learning.testAnswered) return;
  learning.testAnswered = true;
  document.querySelectorAll("[data-test-answer], #spelling-answer, .spelling-submit, .test-dont-know").forEach(el => { el.disabled = true; });
  const result = document.querySelector("#test-result");
  if (result) { result.className = "test-result bad"; result.textContent = `正解は「${currentWord().word}」 · 次の問題へ進みます`; }
  tone("bad"); haptic(10);
  setTimeout(() => applyAnswer(false), 500);
}
function streakStampMarkup(streak) {
  const labels = ["月", "火", "水", "木", "金", "土", "日"];
  const now = new Date(); const day = (now.getDay() + 6) % 7; const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(now.getDate() - day);
  const days = labels.map((label, i) => { const date = new Date(monday); date.setDate(monday.getDate() + i); const key = date.toISOString().slice(0,10); return { label, key, done: (state.streakHistory || []).includes(key), today: key === todayKey() }; });
  return `<div class="streak-stamp"><div class="streak-celebration"><span class="streak-success-mark">${icons.check}</span><div><span class="eyebrow">TODAY COMPLETE</span><h2>今日の学習、完了！</h2></div></div><div class="streak-count-card"><span class="streak-flame">✦</span><strong>${streak}</strong><span>日連続</span><p><b>${escapeHTML(state.profile.name || "TANGO USER")}</b>さんの記録が続いています。</p></div><div class="streak-week">${days.map(d => `<div class="streak-day ${d.done ? "done" : ""} ${d.today ? "today" : ""}"><span>${d.label}</span><b>${d.done ? "✓" : ""}</b></div>`).join("")}</div><p class="streak-encouragement">次の1日も、短い学習から。</p></div>`;
}
function finishLearning() {
  clearAuto(); clearFever();
  state.fever = false;
  const wasLesson = learning.lessonIndex >= 0; const completedIndex = learning.lessonIndex;
  const newLesson = wasLesson && !state.completedLessons.includes(completedIndex);
  if (newLesson) { state.completedLessons.push(completedIndex); state.completedLessons.sort((a,b) => a-b); state.daily.lessons += 1; }
  const today = todayKey();
  if (state.lastStudyDate !== today) {
    const oldDate = state.lastStudyDate;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    if (oldDate && oldDate !== yesterday) { if (state.items.streakKeep > 0) { state.items.streakKeep -= 1; toast("Streak Keep が今日をつなぎました。", "good"); } else state.streak = 1; }
    else state.streak += 1;
    state.lastStudyDate = today;
    state.streakHistory = [...new Set([...(state.streakHistory || []), today])].slice(-90);
    recordWeeklyChallengeStudy(today);
    if (state.studyGarden.lastDay !== today) { state.studyGarden.growth = Number(state.studyGarden.growth || 0) + 1; state.studyGarden.lastDay = today; }
  }
  if (newLesson && !state.ownedBadges.includes("first-step")) state.ownedBadges.push("first-step");
  toast(newLesson ? "レッスン完了。今日の目標を達成！" : wasLesson ? "学習完了。記録を更新しました！" : "復習完了。学びの木が育ちました！", "good");
  const showStamp = wasLesson && state.lastLessonStampDate !== today;
  if (wasLesson) state.lastLessonStampDate = today;
  state.ui.modal = showStamp ? `streak:${state.streak}` : null;
  state.ui.view = "home"; learning = null; persist(); renderApp();
}
function learnAction(action) {
  if (!learning) return;
  const word = currentWord();
  if (action === "pronounce") { const utterance = new SpeechSynthesisUtterance(word.word); utterance.lang = "en-US"; utterance.rate = .85; speechSynthesis.cancel(); speechSynthesis.speak(utterance); haptic(7); }
  if (action === "save" || action === "difficult") { const key = action === "save" ? "savedWords" : "difficultWords"; const item = state[key]; const on = item.includes(word.id); state[key] = on ? item.filter(id => id !== word.id) : [...item, word.id]; if (!on) { state.daily.saved += 1; toast(action === "save" ? "保存しました。" : "苦手リストに入れました。", "good"); } persist(); renderLearning(); }
  if (action === "skip") { toast("スキップしました。あとでまた出会えます。", "normal"); learning.index += 1; learning.revealed = false; if (learning.index >= learning.words.length) finishLearning(); else renderLearning(); }
  if (action === "auto") { learning.auto = !learning.auto; toast(learning.auto ? "自動送りをオンにしました。" : "自動送りをオフにしました。"); renderLearning(); }
  if (action === "detail") { toast(`${word.word} · 習熟度 ${mastery(word.id)}%（${masteryText(mastery(word.id))}）`); }
}
const capsuleRewards = [
  { name: "HP +3", probability: 25, grant: () => { state.hp = Math.min(30, state.hp + 3); state.hpUpdatedAt = Date.now(); } },
  { name: "HP +5", probability: 20, grant: () => { state.hp = Math.min(30, state.hp + 5); state.hpUpdatedAt = Date.now(); } },
  { name: "HP回復ストック", probability: 15, grant: () => state.items.hpStock += 1 },
  { name: "Streak Keep", probability: 10, grant: () => state.items.streakKeep += 1 },
  { name: "FOCUS バッジ", probability: 15, grant: () => addBadge("focus") },
  { name: "SAKURA STAR バッジ", probability: 15, grant: () => addBadge("sakura-star") }
];
function pickCapsuleReward() { const point = Math.random() * 100; let cursor = 0; return capsuleRewards.find(item => { cursor += item.probability; return point < cursor; }) || capsuleRewards[capsuleRewards.length - 1]; }
function useCapsule() {
  if (state.coin < 100) { toast("ガチャには100コイン必要です。", "bad"); return; }
  state.coin -= 100; const award = pickCapsuleReward(); award.grant(); state.history.unshift({ name: award.name, date: new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date()) }); state.history = state.history.slice(0, 8); state.ui.modal = `capsule:${award.name}`; tone("fever"); haptic(18); persist(); renderApp();
}
function addTheme(theme) { if (!state.ownedThemes.includes(theme)) state.ownedThemes.push(theme); }
function addBadge(badge) { if (!state.ownedBadges.includes(badge)) state.ownedBadges.push(badge); }
function toggleBadge(id) {
  const active = state.equippedBadges.includes(id);
  if (active) state.equippedBadges = state.equippedBadges.filter(b => b !== id);
  else { if (state.equippedBadges.length >= 3) { toast("バッジは3個まで選択できます", "bad"); return; } state.equippedBadges.push(id); }
  persist(); renderApp();
}
function shareProfile() {
  const text = `TANGO｜Lv ${state.level} · ${state.streak} day streak\n${state.equippedBadges.map(badgeName).join(" · ") || "Badgeを集め中"}`;
  if (navigator.share) navigator.share({ title: "TANGO", text }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("共有用テキストをコピーしました。", "good")).catch(() => toast(text));
  else toast(text);
}
async function saveProfile(form) {
  const formData = new FormData(form);
  const displayName = String(formData.get("displayName") || "").trim();
  if (!displayName) { toast("表示名を入力してください。", "bad"); return; }
  state.profile.name = displayName;
  persist({ sync: false });
  state.ui.modal = null; renderApp();
  let cloudUpdated = false;
  if (firebaseUser) {
    try { if (firebaseUser.updateProfile) await firebaseUser.updateProfile({ displayName }); cloudUpdated = true; } catch (error) { console.warn("TANGO profile auth update unavailable", error?.code || error); }
    try { if (firebaseDb) { await ensurePublicId(); await upsertLeaderboard(); cloudUpdated = true; } } catch (error) { console.warn("TANGO profile leaderboard update unavailable", error?.code || error); }
  }
  persist(); toast(cloudUpdated ? "プロフィールを更新しました。" : "プロフィールを端末に保存しました。クラウド同期は後で再試行します。", cloudUpdated ? "good" : "normal");
}
async function handleOAuthSignIn(providerName) {
  if (!isFirebaseConfigured() || !firebaseAuth) { toast("ログイン機能が設定されていません。", "bad"); return; }
  const provider = providerName === "apple" ? new firebase.auth.OAuthProvider("apple.com") : new firebase.auth.GoogleAuthProvider();
  if (providerName === "apple") { provider.addScope("email"); provider.addScope("name"); provider.setCustomParameters({ locale: "ja" }); }
  try {
    if (window.matchMedia("(max-width: 700px)").matches) await firebaseAuth.signInWithRedirect(provider);
    else await firebaseAuth.signInWithPopup(provider);
    state.ui.modal = null; renderApp();
  } catch (error) {
    if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error?.code)) return;
    if (error?.code === "auth/popup-blocked") { try { await firebaseAuth.signInWithRedirect(provider); } catch { toast("ログイン画面を開けませんでした。", "bad"); } return; }
    const messages = {
      "auth/account-exists-with-different-credential": "このメールアドレスは別のログイン方法で登録されています。",
      "auth/operation-not-allowed": `${providerName === "apple" ? "Apple" : "Google"}ログインがFirebaseで有効になっていません。`,
      "auth/unauthorized-domain": "このサイトのドメインがFirebaseの承認済みドメインに登録されていません。",
      "auth/popup-blocked": "ログイン画面がブロックされました。ポップアップを許可してもう一度お試しください。"
    };
    toast(messages[error?.code] || "ログインできませんでした。時間をおいて再度お試しください。", "bad");
  }
}

// App-wide event delegation
function copyUserId() { const id = state.profile.publicId; if (!id) { toast("ユーザーIDを準備しています。", "normal"); return; } if (navigator.clipboard) navigator.clipboard.writeText(id).then(() => toast("ユーザーIDをコピーしました。", "good")).catch(() => toast(id)); else toast(id); }
function resizeAvatarFile(file) { return new Promise((resolve, reject) => { if (!file || !file.type.startsWith("image/")) return reject(new Error("image required")); const reader = new FileReader(); reader.onerror = reject; reader.onload = () => { const image = new Image(); image.onerror = reject; image.onload = () => { const max = 256, scale = Math.min(1, max / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", .82)); }; image.src = reader.result; }; reader.readAsDataURL(file); }); }
async function handleAvatarFile(file) { try { state.profile.avatarImage = await resizeAvatarFile(file); persist({ sync: false }); state.ui.modal = "edit-profile"; renderApp(); toast("プロフィール写真を読み込みました。保存すると反映されます。", "good"); } catch { toast("画像を読み込めませんでした。JPG・PNG・WebPを選択してください。", "bad"); } }
async function handleLogout() { try { if (firebaseAuth) await firebaseAuth.signOut(); } catch (error) { console.warn("TANGO logout unavailable", error?.code || error); } firebaseUser = null; state.profile.loggedIn = false; state.profile.email = ""; syncStatus = { state: "local", message: "端末に保存中" }; persist({ sync: false }); renderApp(); toast("ログアウトしました。", "normal"); }
window.addEventListener("click", event => {
  const target = event.target.closest("button, [data-close-modal]"); if (!target) return;
  if (target.hasAttribute("data-close-modal") && event.target === target) { state.ui.modal = null; renderApp(); return; }
  if (target.dataset.nav) {
    const requested = target.dataset.nav;
    if (["profile", "friends", "collection"].includes(requested)) { state.ui.view = "community"; state.ui.hubTab = requested; }
    else state.ui.view = requested;
    state.ui.modal = null; renderApp();
    if (requested === "ranking") loadLeaderboard();
    if (requested === "friends" || (requested === "community" && state.ui.hubTab === "friends")) loadSocial();
    return;
  }
  if (target.dataset.hubTab) { state.ui.hubTab = target.dataset.hubTab; renderApp(); if (state.ui.hubTab === "friends") loadSocial(); return; }
  if (target.dataset.start) { startLearning(target.dataset.start); return; }
  if (target.dataset.rankTab) { state.ui.rankingTab = target.dataset.rankTab; loadLeaderboard(); return; }
  if (target.dataset.action === "reload-ranking") { loadLeaderboard(); return; }
  if (target.dataset.action === "toggle-password") { const input = document.querySelector("#password"); if (input) { const show = input.type === "password"; input.type = show ? "text" : "password"; target.textContent = show ? "非表示" : "表示"; } return; }
  if (target.dataset.socialTab) { state.ui.socialTab = target.dataset.socialTab; if (target.dataset.socialTab !== "group") loadLeaderboard(); else renderApp(); return; }
  if (target.dataset.selectGroup) { state.ui.selectedGroup = target.dataset.selectGroup; state.ui.modal = null; loadLeaderboard(); return; }
  if (target.dataset.themeSelect) return;
  if (target.dataset.authProvider) { target.disabled = true; target.classList.add("loading"); handleOAuthSignIn(target.dataset.authProvider).finally(() => { target.disabled = false; target.classList.remove("loading"); }); return; }
  if (target.dataset.badge) { toggleBadge(target.dataset.badge); return; }
  if (target.dataset.equipTheme) { state.equippedTheme = target.dataset.equipTheme; state.settings.dark = true; persist(); renderApp(); toast(`${themes.find(t => t.id === state.equippedTheme)?.name} を装備しました。`, "good"); return; }
  if (target.dataset.testAnswer !== undefined) { testAnswer(Number(target.dataset.testAnswer)); return; }
  if (target.dataset.action === "dont-know") { dontKnowTestAnswer(); return; }
  if (target.dataset.learnAction) { learnAction(target.dataset.learnAction); return; }
  const action = target.dataset.action;
  if (!action) return;
  if (action === "theme") { state.settings.dark = !state.settings.dark; persist(); renderApp(); }
  if (action === "profile") { state.ui.view = "community"; state.ui.hubTab = "profile"; renderApp(); }
  if (action === "login") { state.ui.modal = "login"; renderApp(); }
  if (action === "logout") { handleLogout(); }
  if (action === "edit-profile") { state.ui.modal = "edit-profile"; renderApp(); }
  if (action === "copy-user-id") copyUserId();
  if (action === "reset-avatar-photo") { state.profile.avatarImage = ""; persist({ sync: false }); state.ui.modal = "edit-profile"; renderApp(); toast("user.png に戻しました。", "good"); }
  if (action === "social-settings") { state.ui.modal = "social-settings"; renderApp(); }
  if (action === "view-friend") { loadFriendProfile(target.dataset.userId).catch(() => toast("プロフィールを読み込めませんでした。", "bad")); }
  if (action === "toggle-follow") { followUser(target.dataset.userId, target.dataset.userName).catch(() => toast("フォローを更新できませんでした。", "bad")); }
  if (action === "send-heart") { sendHeart(target.dataset.userId).catch(() => toast("ハートを送れませんでした。", "bad")); }
  if (action === "friend-battle") { state.ui.modal = null; state.ui.view = "ranking"; state.ui.socialTab = "friends"; renderApp(); loadLeaderboard(); }
  if (action === "badges") { state.ui.modal = "badges"; renderApp(); }
  if (action === "data-info") { state.ui.modal = "data"; renderApp(); }
  if (action === "missions") { state.ui.modal = "missions"; renderApp(); }
  if (action === "capsule-info") { state.ui.modal = "capsule-info"; renderApp(); }
  if (action === "friend-streak") { state.ui.modal = "friend-streak-details"; renderApp(); }
  if (action === "close-modal" || action === "close-streak") { state.ui.modal = null; renderApp(); }
  if (action === "share") shareProfile();
  if (action === "sound") { state.settings.sound = !state.settings.sound; persist(); renderApp(); toast(state.settings.sound ? "サウンドをオンにしました。" : "サウンドをオフにしました。"); }
  if (action === "capsule" || action === "capsule-menu") { state.ui.modal = "capsule-menu"; renderApp(); }
  if (action === "capsule-draw") useCapsule();
  if (action === "use-hp") { if (state.items.hpStock > 0 && state.hp < 30) { state.items.hpStock -= 1; state.hp = Math.min(30, state.hp + 1); persist(); renderApp(); toast("HPを1回復しました。", "good"); } }
  if (action === "exit-learn") { clearAuto(); clearFever(); learning = null; state.ui.view = "home"; renderApp(); }
  if (action === "learn-info") toast("タップで意味を表示。覚えたら上へ、復習したいときは下へスワイプ。");
});
window.addEventListener("submit", event => { if (event.target.id === "profile-form") { event.preventDefault(); saveProfile(event.target).catch(() => toast("プロフィールを更新できませんでした。", "bad")); } if (event.target.id === "friend-form") { event.preventDefault(); addFriendByUid(String(new FormData(event.target).get("friendUid") || "")).catch(() => toast("フレンドを追加できませんでした。", "bad")); } if (event.target.id === "group-form") { event.preventDefault(); createGroup(String(new FormData(event.target).get("groupName") || ""), String(new FormData(event.target).get("groupType") || "personal"), String(new FormData(event.target).get("parentGroupId") || "")).catch(() => toast("グループを作成できませんでした。", "bad")); } if (event.target.id === "join-group-form") { event.preventDefault(); joinGroup(String(new FormData(event.target).get("groupId") || "")).catch(() => toast("グループに参加できませんでした。", "bad")); } });
window.addEventListener("submit", event => { if (event.target.id === "spelling-form") checkSpelling(event); });
window.addEventListener("change", event => { if (event.target.matches("[data-theme-select]")) { state.equippedTheme = event.target.value; state.settings.dark = true; persist(); renderApp(); toast(`${themes.find(t => t.id === state.equippedTheme)?.name || "テーマ"} に変更しました。`, "good"); } if (event.target.id === "avatar-file-input") handleAvatarFile(event.target.files?.[0]); });
window.addEventListener("keydown", event => { if (event.key === "Escape" && state.ui.modal) { state.ui.modal = null; renderApp(); } });

initFirebase();
renderApp();
