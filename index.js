const express = require('express');
const app = express();
app.use(express.json());

const states = {};

app.get('/', (req, res) => {
  res.send('OK');
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const events = req.body.events || [];
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMessage = event.message.text;
        const replyToken = event.replyToken;
        if (!states[userId]) states[userId] = { step: 'start' };
        const state = states[userId];
        if (state.step === 'start' || userMessage === '\u9451\u5b9a') {
          states[userId] = { step: 'waiting_name' };
          await sendReply(replyToken, '\uD83D\uDD2E \u5929\u547D\u9451\u5b9a\u3078\u3088\u3046\u3053\u305d\uff01\n\n\u307e\u305a\u304a\u540d\u524d\uff08\u6f22\u5b57\uff09\u3092\u6559\u3048\u3066\u304f\u3060\u3055\u3044\u3002');
        } else if (state.step === 'waiting_name') {
          states[userId].name = userMessage;
          states[userId].step = 'waiting_birth';
          await sendReply(replyToken, userMessage + '\u3055\u3093\u3001\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059\u2728\n\n\u6b21\u306b\u751f\u5e74\u6708\u65e5\u3092\u6559\u3048\u3066\u304f\u3060\u3055\u3044\u3002\n\uff08\u4f8b\uff3a1975\u5e7412\u670827\u65e5\uff09');
        } else if (state.step === 'waiting_birth') {
          states[userId].birth = userMessage;
          states[userId].step = 'waiting_time';
          await sendReply(replyToken, '\u627f\u308a\u307e\u3057\u305f\uD83C\uDF19\n\n\u751f\u307e\u308c\u305f\u6642\u523b\u306f\u308f\u304b\u308a\u307e\u3059\u304b\uff1f\n\uff08\u4f8b\uff3a\u5348\u524d1\u6642\u3030\u5206\uff09\n\u308f\u304b\u3089\u306a\u3044\u5834\u5408\u306f\u300c\u4e0d\u660e\u300d\u3068\u9001\u3063\u3066\u304f\u3060\u3055\u3044\u3002');
        } else if (state.step === 'waiting_time') {
          const name = states[userId].name;
          const birth = states[userId].birth;
          states[userId].step = 'done';
          await sendReply(replyToken, '\u2728 \u305f\u3060\u3044\u307e\u661f\u3005\u306b\u554f\u3044\u304b\u3051\u3066\u3044\u307e\u3059...\n\n\u9451\u5b9a\u7d50\u679c\u306f1\uff5e2\u5206\u5f8c\u306b\u304a\u5c4a\u3051\u3057\u307e\u3059\uD83D\uDD2E');
          generateAndPush(userId, name, birth, userMessage);
        } else {
          if (userMessage === '\u9451\u5b9a') {
            states[userId] = { step: 'waiting_name' };
            await sendReply(replyToken, '\uD83D\uDD2E \u5929\u547D\u9451\u5b9a\u3078\u3088\u3046\u3053\u305d\uff01\n\n\u307e\u305a\u304a\u540d\u524d\uff08\u6f22\u5b57\uff09\u3092\u6559\u3048\u3066\u304f\u3060\u3055\u3044\u3002');
          } else {
            await sendReply(replyToken, '\uD83D\uDD2E \u3082\u3046\u4e00\u5ea6\u9451\u5b9a\u3059\u308b\u5834\u5408\u306f\u300c\u9451\u5b9a\u300d\u3068\u9001\u3063\u3066\u304f\u3060\u3055\u3044\u3002');
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
});

async function generateAndPush(userId, name, birth, time) {
  try {
    const reading = await generateReading(name, birth, time);
    await pushMessage(userId, reading);
  } catch (e) {
    console.error(e);
    await pushMessage(userId, '\u7533\u3057\u8a33\u3054\u3056\u3044\u307e\u305b\u3093\u3002\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f\u3002\u300c\u9451\u5b9a\u300d\u3068\u9001\u308a\u76f4\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
  }
}

async function sendReply(replyToken, text) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.LINE_TOKEN
    },
    body: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] })
  });
  const data = await res.json();
  console.log('sendReply:', JSON.stringify(data));
}

async function pushMessage(userId, text) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.LINE_TOKEN
    },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: text }] })
  });
  const data = await res.json();
  console.log('pushMessage:', JSON.stringify(data));
}

async function generateReading(name, birth, time) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5,
      max_tokens: 1000,
      system: 'You are a mystical fortune teller. Write a comprehensive fortune reading in Japanese using numerology, nine star ki, western astrology, and name analysis. Use line breaks for readability. About 800 characters.',
      messages: [{ role: 'user', content: 'Name: ' + name + ' Birth: ' + birth + ' Time: ' + time }]
    })
  });
  const data = await res.json();
  console.log('claude response:', JSON.stringify(data).substring(0, 200));
  return data.content[0].text;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
