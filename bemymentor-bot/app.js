require('dotenv').config();
const { App } = require('@slack/bolt');
const { Pool } = require('pg');
const crypto = require('crypto'); // Necessário para calcular o SHA-256

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// Configurações da API de Validação (adicione ao seu .env depois)
const VALIDADOR_API_URL = process.env.VALIDADOR_API_URL || 'https://api.exemplo.local/v1';
const VALIDADOR_TOKEN = process.env.VALIDADOR_TOKEN;

// --- NORMALIZAÇÃO DE TEXTO (acentos, maiúsculas) ---
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const DIAS_SEMANA = {
  segunda: 'segunda', terca: 'terça', quarta: 'quarta', quinta: 'quinta',
  sexta: 'sexta', sabado: 'sábado', domingo: 'domingo'
};

// Aceita "terça", "terca", "Terça-feira", "SABADO"... e devolve o nome canônico com acento
function identificarDia(texto) {
  const chave = normalizar(texto).replace(/-?feira$/, '');
  return DIAS_SEMANA[chave] || null;
}

// --- FUNÇÕES DE ESTADO E DB ---
async function setState(userId, step, payload = {}) {
  await db.query(
    `INSERT INTO user_state (slack_user_id, step, payload_temp) VALUES ($1, $2, $3)
     ON CONFLICT (slack_user_id) DO UPDATE SET step = $2, payload_temp = $3`,
    [userId, step, JSON.stringify(payload)]
  );
}

async function getState(userId) {
  const res = await db.query('SELECT step, payload_temp FROM user_state WHERE slack_user_id = $1', [userId]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

async function clearState(userId) {
  await db.query(`UPDATE user_state SET step = 'idle', payload_temp = '{}' WHERE slack_user_id = $1`, [userId]);
}

async function updateRequestStatus(requestId, status) {
  const res = await db.query('UPDATE mentorship_requests SET status = $1 WHERE id = $2 RETURNING *', [status, requestId]);
  return res.rows[0];
}

// --- FASE 6: AGENDAMENTO DO ÁUDIO ---
async function scheduleAudioReminder(request) {
  const remindAt = new Date(Date.now() + 60 * 1000); 
  await db.query('UPDATE mentorship_requests SET remind_at = $1 WHERE id = $2', [remindAt, request.id]);
  console.log(`Lembrete agendado para a request ${request.id}.`);
}

// --- COMANDOS (CADASTRAR E BUSCAR) ---
app.command('/mentor-cadastrar', async ({ ack, body, client }) => {
  await ack();
  const subjects = await db.query('SELECT id, name FROM subjects');
  await setState(body.user_id, 'aguardando_materias');
  const lista = subjects.rows.map(s => `${s.id} - ${s.name}`).join('\n');
  await client.chat.postMessage({ channel: body.user_id, text: `Olá! Escolha as matérias:\n\n${lista}\n\nDigite os IDs (ex: 1, 2).` });
});

const materiasBusca = [
  { comando: '/mentor-programacao', nome: 'Programação' },
  { comando: '/mentor-matematica', nome: 'Matemática' },
  { comando: '/mentor-design', nome: 'Design/UX' },
  { comando: '/mentor-negocios', nome: 'Negócios' },
  { comando: '/mentor-lideranca', nome: 'Liderança' },
  { comando: '/mentor-outras', nome: 'Outras' }
];

materiasBusca.forEach(materia => {
  app.command(materia.comando, async ({ ack, body, client }) => {
    await ack();
    const query = `
      SELECT m.id, m.name, array_agg(DISTINCT ms.weekday) as weekdays
      FROM mentors m JOIN mentor_subjects msub ON m.id = msub.mentor_id
      JOIN subjects s ON msub.subject_id = s.id JOIN mentor_slots ms ON m.id = ms.mentor_id
      WHERE LOWER(s.name) = LOWER($1) GROUP BY m.id, m.name
    `;
    const res = await db.query(query, [materia.nome]);
    const mentors = res.rows;
    if (mentors.length === 0) {
      await client.chat.postMessage({ channel: body.user_id, text: `Não há mentores para ${materia.nome}.` });
      return;
    }
    await setState(body.user_id, 'escolhendo_mentor', { subject: materia.nome });
    const listText = mentors.map(m => `${m.id} - ${m.name} - dias: ${m.weekdays.join(', ')}`).join('\n');
    await client.chat.postMessage({ channel: body.user_id, text: `Mentores:\n\n${listText}\n\nDigite o ID desejado.` });
  });
});

// --- MENSAGENS E FLUXOS ---
app.message(async ({ message, client }) => {
  if (message.bot_id) return;
  const state = await getState(message.user);
  if (!state || state.step === 'idle') return;

  if (state.step === 'aguardando_materias') {
    // Aceita IDs (1, 2) ou nomes com/sem acento (Matemática, matematica, design)
    const subjectsRes = await db.query('SELECT id, name FROM subjects');
    const ids = [];
    for (const item of message.text.split(/[,\n;]/).map(t => t.trim()).filter(Boolean)) {
      let subject;
      if (/^\d+$/.test(item)) {
        subject = subjectsRes.rows.find(sub => sub.id === parseInt(item));
      } else {
        const alvo = normalizar(item);
        subject = subjectsRes.rows.find(sub => {
          const nome = normalizar(sub.name);
          return nome === alvo || nome.split('/').includes(alvo);
        });
      }
      if (subject && !ids.includes(subject.id)) ids.push(subject.id);
    }
    if (ids.length === 0) {
      await client.chat.postMessage({ channel: message.channel, text: 'Não reconheci nenhuma matéria. Digite os IDs ou os nomes (ex: 1, Matemática).' });
      return;
    }
    let mentorRes = await db.query('SELECT id FROM mentors WHERE slack_user_id = $1', [message.user]);
    if (mentorRes.rows.length === 0) {
      const userInfo = await client.users.info({ user: message.user });
      mentorRes = await db.query('INSERT INTO mentors (slack_user_id, name) VALUES ($1, $2) RETURNING id', [message.user, userInfo.user.real_name]);
    }
    const mentorId = mentorRes.rows[0].id;
    for (let subjectId of ids) await db.query('INSERT INTO mentor_subjects (mentor_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [mentorId, subjectId]);
    await setState(message.user, 'aguardando_horarios');
    await client.chat.postMessage({ channel: message.channel, text: 'Matérias guardadas! Agora envie os seus horários (ex: terça 13)' });
    return;
  }

  if (state.step === 'aguardando_horarios') {
    const linhas = message.text.split('\n');
    const mentorRes = await db.query('SELECT id FROM mentors WHERE slack_user_id = $1', [message.user]);
    let successCount = 0;
    for (let linha of linhas) {
      const partes = linha.trim().split(/\s+/);
      if (partes.length === 2) {
        const dia = identificarDia(partes[0]);
        const hora = parseInt(partes[1]);
        if (dia && !isNaN(hora)) {
          await db.query('INSERT INTO mentor_slots (mentor_id, weekday, hour) VALUES ($1, $2, $3)', [mentorRes.rows[0].id, dia, hora]);
          successCount++;
        }
      }
    }
    if (successCount === 0) {
      await client.chat.postMessage({ channel: message.channel, text: 'Formato inválido.' }); return;
    }
    await clearState(message.user);
    await client.chat.postMessage({ channel: message.channel, text: 'Cadastro concluído!' }); return;
  }

  if (state.step === 'escolhendo_mentor') {
    const mentorId = parseInt(message.text.trim());
    const res = await db.query('SELECT id, weekday, hour FROM mentor_slots WHERE mentor_id = $1 ORDER BY weekday, hour', [mentorId]);
    if (res.rows.length === 0) return;
    await setState(message.user, 'escolhendo_horario', { ...state.payload_temp, mentorId, slots: res.rows });
    const slotsText = res.rows.map((s, i) => `${i} - ${s.weekday} às ${s.hour}h`).join('\n');
    await client.chat.postMessage({ channel: message.channel, text: `Horários:\n\n${slotsText}\n\nDigite o número do horário.` }); return;
  }

  if (state.step === 'escolhendo_horario') {
    const slot = state.payload_temp.slots[parseInt(message.text.trim())];
    if (!slot) return;
    const resSubject = await db.query('SELECT id FROM subjects WHERE LOWER(name) = LOWER($1)', [state.payload_temp.subject]);
    
    const insertRes = await db.query(
      `INSERT INTO mentorship_requests (mentee_slack_id, mentor_id, subject_id, weekday, hour, status) VALUES ($1, $2, $3, $4, $5, 'pendente') RETURNING id`,
      [message.user, state.payload_temp.mentorId, resSubject.rows[0].id, slot.weekday, slot.hour]
    );
    await clearState(message.user);
    await client.chat.postMessage({ channel: message.channel, text: 'Solicitação enviada!' });

    const mentorDbRes = await db.query('SELECT slack_user_id FROM mentors WHERE id = $1', [state.payload_temp.mentorId]);
    const menteeInfo = await client.users.info({ user: message.user });
    
    await client.chat.postMessage({
      channel: mentorDbRes.rows[0].slack_user_id,
      text: `Nova solicitação`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*${menteeInfo.user.real_name}* pediu mentoria de *${state.payload_temp.subject}*\n${slot.weekday} às ${slot.hour}h` } },
        { type: 'actions', elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Confirmar' }, style: 'primary', action_id: 'confirm_request', value: String(insertRes.rows[0].id) },
          { type: 'button', text: { type: 'plain_text', text: 'Recusar' }, style: 'danger', action_id: 'reject_request', value: String(insertRes.rows[0].id) },
        ]},
      ],
    });
  }
});

// --- AÇÕES BOTÕES ---
app.action('confirm_request', async ({ ack, body, client, action }) => {
  await ack();
  const request = await updateRequestStatus(action.value, 'confirmada');
  await client.chat.update({ channel: body.channel.id, ts: body.message.ts, text: 'Confirmada', blocks: [] });
  await client.chat.postMessage({ channel: request.mentee_slack_id, text: `Mentoria confirmada para ${request.weekday} às ${request.hour}h.` });
  
  await scheduleAudioReminder(request); 
});

app.action('reject_request', async ({ ack, body, client, action }) => {
  await ack();
  const request = await updateRequestStatus(action.value, 'recusada');
  await client.chat.update({ channel: body.channel.id, ts: body.message.ts, text: 'Recusada', blocks: [] });
  await client.chat.postMessage({ channel: request.mentee_slack_id, text: `Mentoria recusada.` });
});

// --- INTEGRAÇÃO API: RECEBER ÁUDIO E ENVIAR PARA VALIDAÇÃO ---
app.event('file_shared', async ({ event, client }) => {
  const res = await db.query(`
    SELECT mr.id as request_id, mr.subject_id, mr.mentor_id, mr.mentee_slack_id, s.name as subject_name
    FROM mentorship_requests mr 
    JOIN mentors m ON mr.mentor_id = m.id
    JOIN subjects s ON mr.subject_id = s.id
    WHERE m.slack_user_id = $1 AND mr.status = 'aguardando_audio' LIMIT 1
  `, [event.user_id]);

  if (res.rows.length === 0) return;
  const requestData = res.rows[0];
  
  await client.chat.postMessage({ channel: event.user_id, text: 'Áudio recebido! A iniciar o envio seguro para a IA de validação...' });

  try {
    // 1. Download do Slack
    const fileInfo = await client.files.info({ file: event.file_id });
    const slackFileRes = await fetch(fileInfo.file.url_private_download, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    });
    const fileBuffer = await slackFileRes.arrayBuffer();
    const fileBufferNode = Buffer.from(fileBuffer);

    // 2. Hashes e Metadados
    const sha256 = crypto.createHash('sha256').update(fileBufferNode).digest('hex');
    const sizeBytes = fileBufferNode.length;

    // 3. Passo 1 da API: Ticket de Upload
    const uploadTicketRes = await fetch(`${VALIDADOR_API_URL}/uploads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${VALIDADOR_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: fileInfo.file.name,
        content_type: 'audio/mpeg', // O contrato permite mpeg, mp4, wav, ogg, webm
        size_bytes: sizeBytes,
        sha256: sha256
      })
    });
    
    if (!uploadTicketRes.ok) throw new Error(`Falha /uploads: ${uploadTicketRes.status}`);
    const ticket = await uploadTicketRes.json();

    // 4. Passo 2 da API: Upload dos bytes para o Bucket
    await fetch(ticket.upload_url, {
      method: ticket.upload_method,
      headers: ticket.upload_headers || {},
      body: fileBufferNode
    });

    // 5. Passo 3 da API: Criar Verificação
    const verificationRes = await fetch(`${VALIDADOR_API_URL}/verifications`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${VALIDADOR_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_id: ticket.upload_id,
        session_id: `req_${requestData.request_id}`, // Chave de negócio opaca
        declared_topic: requestData.subject_name,
        mentor_id: `mentor_${requestData.mentor_id}`,
        mentee_id: `mentee_${requestData.mentee_slack_id}`,
        scheduled_duration_minutes: 60,
        consent: {
          mentor_consented_at: new Date().toISOString(),
          mentee_consented_at: new Date().toISOString(),
          policy_version: "1.0"
        }
      })
    });

    if (!verificationRes.ok) throw new Error(`Falha /verifications: ${verificationRes.status}`);
    const verificationData = await verificationRes.json();

    // 6. Atualizar a base de dados
    await db.query(`INSERT INTO session_audio (request_id, file_url, received_at, qa_status, verification_id) VALUES ($1, $2, now(), 'em_processamento', $3)`, 
      [requestData.request_id, fileInfo.file.url_private_download, verificationData.verification_id]);
    await db.query(`UPDATE mentorship_requests SET status = 'em_validacao' WHERE id = $1`, [requestData.request_id]);

    await client.chat.postMessage({ channel: event.user_id, text: 'Áudio enviado com sucesso! A análise baseada em IA demora alguns minutos. Será notificado assim que o laudo estiver concluído.' });

  } catch (error) {
    console.error("Erro no pipeline de áudio:", error);
    await client.chat.postMessage({ channel: event.user_id, text: 'Ocorreu um erro ao comunicar com o validador. Verifique o terminal para mais detalhes.' });
  }
});

// --- POLLING 1: LEMBRETE DE COBRANÇA DE ÁUDIO ---
setInterval(async () => {
  const due = await db.query(`
    SELECT mr.*, m.slack_user_id as mentor_slack_id FROM mentorship_requests mr
    JOIN mentors m ON mr.mentor_id = m.id
    WHERE mr.remind_at IS NOT NULL AND mr.status = 'confirmada'
  `);
  for (const request of due.rows) {
    await app.client.chat.postMessage({
      channel: request.mentor_slack_id,
      text: 'A sua mentoria já terminou! Por favor, mande o arquivo da mentoria aqui (.mp3 ou qualquer áudio).',
    });
    await db.query(`UPDATE mentorship_requests SET status = 'aguardando_audio', remind_at = NULL WHERE id = $1`, [request.id]);
  }
}, 10 * 1000);

// --- POLLING 2: VERIFICAR RESULTADOS DA IA ---
setInterval(async () => {
  const pending = await db.query(`
    SELECT sa.id, sa.request_id, sa.verification_id, m.slack_user_id as mentor_slack_id 
    FROM session_audio sa 
    JOIN mentorship_requests mr ON sa.request_id = mr.id
    JOIN mentors m ON mr.mentor_id = m.id 
    WHERE sa.qa_status = 'em_processamento' AND sa.verification_id IS NOT NULL
  `);

  for (const audio of pending.rows) {
    try {
      const res = await fetch(`${VALIDADOR_API_URL}/verifications/${audio.verification_id}`, {
        headers: { 'Authorization': `Bearer ${VALIDADOR_TOKEN}` }
      });
      
      if (!res.ok) continue;
      const data = await res.json();

      if (data.status === 'completed' || data.status === 'failed') {
        // 'review' ou 'rejected' resultarão em negada para simplificar no lado do cliente
        const finalStatus = data.report?.decision === 'approved' ? 'validada' : 'negada';
        
        await db.query(`UPDATE session_audio SET qa_status = $1 WHERE id = $2`, [finalStatus, audio.id]);
        await db.query(`UPDATE mentorship_requests SET status = $1 WHERE id = $2`, [finalStatus, audio.request_id]);

        const mensagemFinal = finalStatus === 'validada' 
          ? '🎉 Boas notícias! O laudo da IA aprovou a sua mentoria e as suas horas foram validadas!'
          : '⚠️ A validação da sua mentoria foi recusada ou encaminhada para revisão manual. Motivo: falta de evidências estruturais ou não aderência ao tema.';

        await app.client.chat.postMessage({ channel: audio.mentor_slack_id, text: mensagemFinal });
      }
    } catch (error) {
      console.error(`Erro ao consultar verificação ${audio.verification_id}:`, error);
    }
  }
}, 60 * 1000); // Roda a cada 60 segundos

(async () => {
  await app.start();
  console.log('BeMyMentor bot integrado com a API de validação!');
})();