module.exports = async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 요청 방식입니다. POST 요청만 지원합니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: '서버에 GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return res.status(400).json({ error: '분석할 이미지 URL(imageUrl)이 필요합니다.' });
    }

    // Cloudinary 등 외부 이미지 URL에서 이미지 데이터 가져오기
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return res.status(400).json({ error: '업로드된 이미지를 불러오는 데 실패했습니다.' });
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `당신은 사진의 감성과 스타일을 읽어내는 센스 있는 'AI 사진 분위기 분석가'입니다.
전달된 사진을 보고 전체적인 분위기와 스타일을 한국어로 분석해주세요.

[중요 분석 원칙]
1. 사진 속 사람의 신원(누구인지), 나이, 직업, 거주지 등 개인정보를 절대 추측하거나 단정하지 마세요.
2. 오직 사진에서 직접 눈으로 확인할 수 있는 시각적 요소(색상/색감, 배경, 의상/소품, 표정/포즈, 구도/채광)와 전체적인 분위기를 중심으로 분석해주세요.
3. 결과는 아래 JSON 형식으로만 응답해주세요.

[출력 항목 요구사항]
- moods: 사진을 표현하는 분위기 키워드 정확히 3개.
  - keyword: 핵심 분위기 키워드 (예: "따스한 햇살 감성", "청량한 하이틴 무드", "차분한 빈티지 시크")
  - wittyLabel: 해당 분위기를 재치 있고 재미있게 표현한 문구 (예: "솜사탕 한 스푼 녹인 달달함", "탄산수처럼 톡 쏘는 청량감")
  - percentage: 각 분위기의 비중을 나타내는 정수 퍼센트 (1~100 사이 숫자, 3개의 합이 100이 되도록 구성)
  - emoji: 분위기와 어울리는 이모지 1개
- oneLineReview: 사진에서 확인되는 색감, 배경, 의상, 표정, 구도와 전체적인 분위기를 종합한 센스 있는 AI 한줄평 (1~2문장)
- stylePoints: 사진에서 직접 확인한 시각적 분석 요약 (색감/조명, 배경/구도, 의상/표정 등 한눈에 보는 포인트 3가지 문자열 배열)
- hashtags: 사진과 찰떡같이 어울리는 감성 해시태그 정확히 4개 (각 태그 앞에 # 포함)`;

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            moods: {
              type: 'ARRAY',
              description: '사진을 표현하는 분위기 키워드 3개와 재미있는 퍼센트 표현',
              items: {
                type: 'OBJECT',
                properties: {
                  keyword: { type: 'STRING' },
                  wittyLabel: { type: 'STRING' },
                  percentage: { type: 'INTEGER' },
                  emoji: { type: 'STRING' },
                },
                required: ['keyword', 'wittyLabel', 'percentage', 'emoji'],
              },
            },
            oneLineReview: {
              type: 'STRING',
              description: '사진에 대한 AI 한줄평',
            },
            stylePoints: {
              type: 'ARRAY',
              description: '색상, 배경, 의상, 표정, 구도 중심의 시각적 포인트',
              items: { type: 'STRING' },
            },
            hashtags: {
              type: 'ARRAY',
              description: '사진과 어울리는 해시태그 4개',
              items: { type: 'STRING' },
            },
          },
          required: ['moods', 'oneLineReview', 'stylePoints', 'hashtags'],
        },
      },
    };

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let geminiData = null;
    let lastErrorText = '';

    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (geminiResponse.ok) {
        geminiData = await geminiResponse.json();
        break;
      } else {
        lastErrorText = await geminiResponse.text();
        // API 키 오류(400/403) 등은 즉시 중단
        if (geminiResponse.status === 400 || geminiResponse.status === 403) {
          break;
        }
      }
    }

    if (!geminiData) {
      console.error('Gemini API Error:', lastErrorText);
      return res.status(502).json({
        error: 'AI 사진 분석 요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
      });
    }

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(502).json({
        error: 'AI 응답 결과를 해석할 수 없습니다.',
      });
    }

    const parsedResult = JSON.parse(rawText);

    // 데이터 보정 (키워드 3개, 해시태그 4개 보장)
    const moods = Array.isArray(parsedResult.moods) ? parsedResult.moods.slice(0, 3) : [];
    const hashtags = Array.isArray(parsedResult.hashtags)
      ? parsedResult.hashtags.slice(0, 4).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
      : [];

    return res.status(200).json({
      imageUrl,
      moods,
      oneLineReview: parsedResult.oneLineReview || '',
      stylePoints: Array.isArray(parsedResult.stylePoints) ? parsedResult.stylePoints.slice(0, 3) : [],
      hashtags,
    });
  } catch (error) {
    console.error('Server Internal Error:', error);
    return res.status(500).json({
      error: '사진을 분석하는 중 서버 오류가 발생했습니다.',
    });
  }
};

