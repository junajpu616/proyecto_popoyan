import React, { useEffect, useRef, useState } from 'react';
import { chatbotAsk, chatbotHistory, chatbotRemoteConversation, chatbotHistoryAll } from '../api/plantApi';
import { useLocation } from 'react-router-dom';

export default function ChatbotPage() {
  const [accessToken, setAccessToken] = useState('');
  const [question, setQuestion] = useState('');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.5);
  const [appName, setAppName] = useState('MyAppBot');

  const [messages, setMessages] = useState([]);            // conversación activa
  const [historyMessages, setHistoryMessages] = useState([]);  // historial local GLOBAL
  const [remoteMessages, setRemoteMessages] = useState([]);    // conversación remota (API)

  const [meta, setMeta] = useState({ remaining_calls: null, model: null });
  const [remoteMeta, setRemoteMeta] = useState({ remaining_calls: null, model: null });

  const [loading, setLoading] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [err, setErr] = useState('');
  const listRef = useRef(null);
  const [firstAsked, setFirstAsked] = useState(false);
  const location = useLocation();
  const canSendFirstParams = !firstAsked;

  const loadHistoryAll = async () => {
    setErr('');
    try {
      setLoadingHistory(true);
      const data = await chatbotHistoryAll();
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      setHistoryMessages(msgs);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Error al cargar historial local');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadHistoryByToken = async (tokenParam) => {
    setErr('');
    const token = (tokenParam || accessToken || '').trim();
    if (!token) return;
    try {
      const data = await chatbotHistory(token);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Error al cargar historial por token');
    }
  };

  const loadRemoteConversation = async (tokenParam) => {
    setErr('');
    const token = (tokenParam || accessToken || '').trim();
    if (!token) return;
    try {
      setLoadingRemote(true);
      const data = await chatbotRemoteConversation(token);
      setRemoteMessages(Array.isArray(data.messages) ? data.messages : []);
      setRemoteMeta({
        remaining_calls: data.remaining_calls ?? null,
        model: data.model_parameters?.model ?? null
      });
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Error al obtener conversación remota');
    } finally {
      setLoadingRemote(false);
    }
  };

  const groupConversations = (messages) => {
    const byToken = new Map();
    for (const m of messages) {
      const token = m.access_token || '—';
      if (!byToken.has(token)) byToken.set(token, []);
      byToken.get(token).push(m);
    }
    const convs = [];
    for (const [token, msgs] of byToken.entries()) {
      msgs.sort((a, b) => {
        const ta = new Date(a.created_at || a.created).getTime();
        const tb = new Date(b.created_at || b.created).getTime();
        if (ta !== tb) return ta - tb;
        const pa = a.type === 'question' ? 0 : 1;
        const pb = b.type === 'question' ? 0 : 1;
        return pa - pb;
      });
      const firstCreated = msgs.length ? new Date(msgs[0].created_at || msgs[0].created) : new Date(0);
      convs.push({ token, firstCreated, messages: msgs });
    }
    convs.sort((a, b) => a.firstCreated - b.firstCreated);
    return convs;
  };

  const fmt = (d) => {
    try { return new Date(d).toLocaleString(); } catch { return String(d); }
  };

  const Bubble = ({ m }) => (
    <div className={`d-flex ${m.type === 'question' ? 'justify-content-end' : 'justify-content-start'}`}>
      <div className={`p-2 rounded ${m.type === 'question' ? 'bg-primary text-white' : 'bg-light border'}`} style={{ maxWidth: '85%' }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
        <div className="text-muted small mt-1">
          {fmt(m.created_at || m.created || Date.now())}
          {m.access_token && <span className="ms-2 badge text-bg-light">Token: {m.access_token}</span>}
        </div>
      </div>
    </div>
  );

  const renderSeparatedHistory = () => {
    if (!historyMessages?.length) {
      return <div className="text-muted">No hay historial guardado.</div>;
    }

    const byToken = new Map();
    for (const m of historyMessages) {
      const token = m.access_token || '—';
      if (!byToken.has(token)) byToken.set(token, []);
      byToken.get(token).push(m);
    }

    const convs = [];
    for (const [token, msgs] of byToken.entries()) {
      msgs.sort((a, b) => {
        const ta = new Date(a.created_at || a.created).getTime();
        const tb = new Date(b.created_at || b.created).getTime();
        if (ta !== tb) return ta - tb;
        const pa = a.type === 'question' ? 0 : 1;
        const pb = b.type === 'question' ? 0 : 1;
        return pa - pb;
      });
      const firstCreated = msgs.length ? new Date(msgs[0].created_at || msgs[0].created) : new Date(0);
      convs.push({ token, firstCreated, messages: msgs });
    }

    convs.sort((a, b) => a.firstCreated - b.firstCreated);

    return (
      <div className="d-flex flex-column gap-3">
        {convs.map((conv, idx) => (
          <div key={`${conv.token}-${idx}`}>
            {/* Encabezado/Separador de conversación */}
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge text-bg-secondary">Conversación</span>
                <code>{conv.token}</code>
              </div>
              <div className="text-muted small">
                Inicio: {fmt(conv.firstCreated)}
              </div>
            </div>
            {/* Mensajes de la conversación */}
            <div className="d-flex flex-column gap-2">
              {conv.messages.map((m, i) => (
                <Bubble key={m.id || `${conv.token}-${i}`} m={m} />
              ))}
            </div>
            {/* Separador visual entre conversaciones */}
            {idx < convs.length - 1 && <hr className="mt-3 mb-0" />}
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tFromQuery = params.get('token');
    let t = tFromQuery;
    if (!t) {
      try {
        t = sessionStorage.getItem('chatbot_access_token') || '';
      } catch {}
    }
    if (t) {
      setAccessToken(t);
    }
    loadHistoryAll();
  }, [location.search]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendQuestion = async () => {
    const token = accessToken.trim();
    const q = question.trim();
    if (!token || !q) return;
    setLoading(true); setErr('');

    try {
      const optimistic = [...messages, { content: q, type: 'question', created_at: new Date().toISOString() }];
      setMessages(optimistic);
      setQuestion('');

      const payload = {
        question: q,
        ...(canSendFirstParams && prompt.trim() ? { prompt: prompt.trim() } : {}),
        ...(canSendFirstParams && typeof temperature === 'number' ? { temperature: Number(temperature) } : {}),
        ...(canSendFirstParams && appName.trim() ? { app_name: appName.trim() } : {})
      };

      const data = await chatbotAsk(token, payload);

      const apiMsgs = Array.isArray(data.messages) ? data.messages : [];
      const lastAnswer = apiMsgs.findLast ? apiMsgs.findLast(m => m.type === 'answer') : [...apiMsgs].reverse().find(m => m.type === 'answer');
      if (lastAnswer && lastAnswer.content) {
        setMessages(curr => [...curr, { content: lastAnswer.content, type: 'answer', created_at: lastAnswer.created || new Date().toISOString() }]);
      }

      setMeta({
        remaining_calls: data.remaining_calls ?? null,
        model: data.model_parameters?.model ?? null
      });

      await loadHistoryAll();

      if (!firstAsked) setFirstAsked(true);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Error al enviar pregunta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Chatbot de Plantas</h2>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label">Access Token de identificación</label>
              <input
                className="form-control"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Ej: 43igHic7zpYUYNA"
              />
            </div>
            {!firstAsked && (
              <>
                <div className="col-12 col-md-4">
                  <label className="form-label">Prompt (solo primera pregunta)</label>
                  <input
                    className="form-control"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Instrucciones para el bot"
                  />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label">Temperatura</label>
                  <input
                    type="number"
                    className="form-control"
                    step="0.1"
                    min="0"
                    max="2"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label">Nombre del Chat</label>
                  <input
                    className="form-control"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="MyAppBot"
                  />
                </div>
              </>
            )}
          </div>

          <div className="d-flex gap-2 mt-3 flex-wrap">
            <button className="btn btn-outline-secondary" onClick={loadHistoryAll} disabled={loadingHistory}>
              {loadingHistory ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Cargando historial...
                </>
              ) : 'Cargar historial local (todos)'}
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => loadRemoteConversation()}
              disabled={!accessToken.trim() || loadingRemote}
              title="Puede consumir 1 crédito en Plant.ID"
            >
              {loadingRemote ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Consultando API...
                </>
              ) : 'Obtener conversación remota (API)'}
            </button>
            {meta.remaining_calls !== null && (
              <span className="badge text-bg-light align-self-center">
                Llamadas restantes: {meta.remaining_calls} {meta.model ? `· Modelo: ${meta.model}` : ''}
              </span>
            )}
            {remoteMeta.remaining_calls !== null && (
              <span className="badge text-bg-info align-self-center">
                Restantes (API): {remoteMeta.remaining_calls} {remoteMeta.model ? `· Modelo: ${remoteMeta.model}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Conversación activa */}
      <div className="card shadow-sm mb-3">
        <div className="card-header">
          <strong>Conversación</strong>
        </div>
        <div className="card-body" style={{ height: '40vh', overflowY: 'auto' }} ref={listRef}>
          {messages.length === 0 ? (
            <div className="text-muted">No hay mensajes. Envía tu primera pregunta.</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {messages.map((m, idx) => <Bubble key={m.id || idx} m={m} />)}
            </div>
          )}
        </div>
        <div className="card-footer">
          <div className="input-group">
            <input
              className="form-control"
              placeholder="Escribe tu pregunta..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendQuestion()}
              disabled={!accessToken.trim() || loading}
            />
            <button className="btn btn-success" onClick={sendQuestion} disabled={!accessToken.trim() || !question.trim() || loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Enviando...
                </>
              ) : 'Enviar'}
            </button>
          </div>
          {err && <div className="alert alert-danger mt-2 mb-0">{err}</div>}
        </div>
      </div>

      {/* Historial local GLOBAL (separado por conversaciones) */}
      <div className="card shadow-sm mb-3">
        <div className="card-header">
          <strong>Historial local (todos los chats)</strong>
        </div>
        <div className="card-body" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
          {renderSeparatedHistory()}
        </div>
      </div>

      {/* Conversación remota (API) */}
      <div className="card shadow-sm">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Obtener conversación desde la API (solo de lectura) </strong>
        </div>
        <div className="card-body" style={{ maxHeight: '35vh', overflowY: 'auto' }}>
          {remoteMessages.length === 0 ? (
            <div className="text-muted">No se ha cargado la conversación remota.</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {remoteMessages.map((m, idx) => <Bubble key={m.id || idx} m={m} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}