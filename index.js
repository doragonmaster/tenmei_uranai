const express = require('express');
const app = express();
app.use(express.json());

const states = {};

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const events = req.body.events;
  
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMessage = event.message.text;
      const replyToken = event.replyToken;
      
      if (!states[userId]) states[userId] = { step: 'start' };
      const state = states[userId];
      
      if (state.step === 'start' || userMessage === '鑑定') {
        states[userId] = { step: 'waiting_name' };
        await sendReply(replyToken, '🔮 天命鑑定へようこそ！\n\nまずお名前（漢字）を教えてください。');
        
      } else if (state.step === 'waiting_name') {
        states[userId].name = userMessage;
        states[userId].step = 'waiting_birth';
        await sendReply(replyToken, `${userMessage}さん、ありがとうございます✨\n\n次に生年月日を教えてください。\n（例：1975年12月27日）`);
        
      } else if (state.step === 'waiting_birth') {
        states[userId].birth = userMessage;
        states[userId].step = 'waiting_time';
        await sendReply(replyToken, `承りました🌙\n\n生まれた時刻はわかりますか？\n（例：午前1時30分）\nわからない場合は「不明」と送ってください。`);
        
      } else if (state.step === 'waiting_time') {
        const { name, birth } = states[userId];
        states[userId].step = 'done';
        await sendReply(replyToken, '✨ ただいま星々に問いかけています...\n\n鑑定結果は1〜2分後にお届けします🔮');
        generateAndPush(userId, name, birth, userMessage);
        
      } else if (state.step === 'done') {
        if (userMessage === '鑑定') {
          states[userId] = { step: 'waiting_name' };
          await sendReply(replyToken, '🔮 天命鑑定へようこそ！\n\nまずお名前（漢字）を教えてください。');
        } else {
          await sendReply(replyToken, '🔮 もう一度鑑定する場合は「鑑定」と送ってください。');
        }
      }
    }
  }
});

async function generateAndPush(userId, name, birth, time) {
  try {
    const reading = await generateReading(name, birth, time);
    await pushMessage(userId, reading);
  } catch (e) {
    await pushMessage(userId, '申し訳ございません。エラーが発生しました。「鑑定」と送り直してください。');
  }
}

async function sendReply(replyToken, text) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] })
  });
}

async function pushMessage(userId, text) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_TOKEN}`
    },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] })
  });
}

async function generateReading(name, birth, time) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'あなたは神秘的で深みのある占い師AIです。数秘術・九星気学・西洋占星術・姓名判断を組み合わせて総合鑑定を行います。LINEで読みやすいよう適度に改行を入れて800字程度で。',
      messages: [{ role: 'user', content: `名前：${name}\n生年月日：${birth}\n生まれ時刻：${time}\nこの方の総合占い鑑定をお願いします。` }]
    })
  });
  const data = await response.json();
  return data.content[0].text;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
