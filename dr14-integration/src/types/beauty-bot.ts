// BeautyBot TypeScript types

export interface ThreadsPost {
  title: string;
  body: string;
  hashtags: string[];
  cta: string;
  engagement_question: string;
  topic: string;
  format: string;
  estimated_reach: string;
  best_post_time: string;
}

export interface GeneratePostRequest {
  topic?: string;
  subtopic?: string;
  post_format?: string;
  tone?: string;
  custom_notes?: string;
}

export interface GenerateWeeklyRequest {
  week_offset?: number;
}

export interface PublishResult {
  success: boolean;
  post_id?: string;
  error?: string;
  published_at: string;
  url?: string;
}

export interface PostHistoryItem {
  id: string;
  post_id: string;
  title: string;
  topic: string;
  published_at: string;
  success: boolean;
  error?: string;
  full_text?: string;
  created_at: string;
}

export interface ThreadsAccount {
  connected: boolean;
  user_id?: string;
  username?: string;
  token_expires_at?: string;
  today_count: number;
  remaining: number;
}

export const BEAUTY_TOPICS: Record<string, { subtopics: string[]; keywords: string[] }> = {
  玻尿酸: {
    subtopics: ['臉部填充', '淚溝', '蘋果肌', '嘴唇豐唇', '鼻型雕塑'],
    keywords: ['玻尿酸', 'HA填充', '微整形', '自然美', '立即見效'],
  },
  肉毒桿菌: {
    subtopics: ['除皺', '國字臉瘦臉', '抬頭紋', '眉間紋', '魚尾紋'],
    keywords: ['肉毒桿菌', 'Botox', '除皺針', '瘦臉針', '不動聲色美'],
  },
  雷射療程: {
    subtopics: ['皮秒雷射', '飛梭雷射', '淨膚雷射', '脈衝光', 'CO2雷射'],
    keywords: ['雷射', '斑點', '膚質提升', '痘疤', '嫩白'],
  },
  水光針: {
    subtopics: ['全臉補水', '頸部保養', '手部嫩白', '私密保養'],
    keywords: ['水光針', '深層補水', '玻璃肌', '光澤感', '肌膚回春'],
  },
  埋線拉提: {
    subtopics: ['臉部拉提', '頸部緊緻', '眉尾拉提', '蘋果肌重塑'],
    keywords: ['埋線', '拉提', '緊緻', '不老神器', '童顏密碼'],
  },
  醫美保養: {
    subtopics: ['術後保養', '防曬重要性', '醫美前後注意事項', '保養品推薦'],
    keywords: ['醫美保養', '術後照護', '醫美小知識', '保養秘訣', '護膚心得'],
  },
  體雕塑身: {
    subtopics: ['冷凍溶脂', '音波拉皮', '海芙超音波', '立塑'],
    keywords: ['體雕', '溶脂', '緊緻曲線', '身材管理', '非侵入式'],
  },
  植髮生髮: {
    subtopics: ['FUE植髮', 'PRP生長因子', '髮際線調整', '禿頭改善'],
    keywords: ['植髮', '生髮', '髮量', '自信再現', '頭皮健康'],
  },
};

export const POST_FORMATS: Record<string, string> = {
  知識分享: '專業科普，建立信任感，軟性導流',
  'Q&A問答': '解答常見疑問，互動率高',
  前後對比: '視覺衝擊，吸引分享',
  迷思破解: '打破錯誤觀念，彰顯專業',
  選擇指南: '幫助讀者決策，提高轉換率',
  心得分享: '第一人稱口吻，增加真實感',
  限時優惠: '製造緊迫感，直接導購',
  季節話題: '結合時事節氣，提升相關性',
};

export const WEEKLY_SCHEDULE: Record<number, { theme: string; format: string; tone: string }> = {
  0: { theme: '玻尿酸', format: '知識分享', tone: '專業教育' },
  1: { theme: '雷射療程', format: 'Q&A問答', tone: '親切解答' },
  2: { theme: '肉毒桿菌', format: '迷思破解', tone: '專業破解' },
  3: { theme: '埋線拉提', format: '選擇指南', tone: '決策輔助' },
  4: { theme: '水光針', format: '心得分享', tone: '真實口碑' },
  5: { theme: '體雕塑身', format: '前後對比', tone: '視覺震撼' },
  6: { theme: '醫美保養', format: '季節話題', tone: '輕鬆互動' },
};
