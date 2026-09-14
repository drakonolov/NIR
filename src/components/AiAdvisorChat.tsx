import React, { useState, useRef, useEffect } from 'react';
import { AdvisorMessage, AdvisorRole, WalkerConfig } from '../types';
import { Bot, Send, User, Sparkles, RefreshCw, GraduationCap, ChevronRight } from 'lucide-react';

interface AiAdvisorChatProps {
  config: WalkerConfig;
}

export const AiAdvisorChat: React.FC<AiAdvisorChatProps> = ({ config }) => {
  const [role, setRole] = useState<AdvisorRole>('supervisor');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: `Здравствуйте, Даниил Андреевич! Я ваш виртуальный научный консультант по направлению 11.05.01 «РЭКС» (НИУ «МЭИ»).
Мы проанализировали ваши текущие наработки: кинематику Уокера, расчет матрицы наблюдения $H$ и функцию стоимости.

Готов разобрать ключевые вопросы вашей научно-исследовательской практики:
1. **Баллистика**: почему при $h = 1493$ км критически важен учет поясов Ван Аллена;
2. **Радионавигация**: переход из ECEF в топоцентрический базис ENU для корректного разделения HDOP и VDOP;
3. **Экономика**: почему целевая функция $N \\times 10$ недостоверна и как перейти к расчету по пускам ракет $P \\times C_{\\text{РН}}$.

Задайте интересующий вас вопрос или выберите один из типовых вопросов ниже.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickQuestions = [
    'Как обосновать выбор генетического алгоритма перед комиссией на кафедре РЭКС?',
    'Почему высота 1493 км опасна и как радиация влияет на стоимость спутника?',
    'Как правильно рассчитать переход из ECEF в топоцентрическую систему ENU?',
    'Как учесть требование ICAO по целостности RAIM FDE в целевой функции?',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: AdvisorMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          role,
          config,
        }),
      });

      const data = await response.json();

      const botMsg: AdvisorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Не удалось получить ответ от научного консультанта.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: AdvisorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Произошла ошибка связи с сервером консультаций. Пожалуйста, повторите запрос.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col h-[650px]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Научный консультант (НИУ «МЭИ»)
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-500/30">
                Gemini 3.5 Flash + Thinking
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Помощь в теоретическом обосновании, написании разделов отчета и анализе уравнений.
            </p>
          </div>
        </div>

        {/* Role Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <span className="text-slate-500 text-[11px] px-1.5">Роль:</span>
          <button
            onClick={() => setRole('supervisor')}
            className={`px-2 py-1 rounded transition ${role === 'supervisor' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
          >
            Руководитель РЭКС
          </button>
          <button
            onClick={() => setRole('ballistics')}
            className={`px-2 py-1 rounded transition ${role === 'ballistics' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
          >
            Баллистик
          </button>
          <button
            onClick={() => setRole('avionics')}
            className={`px-2 py-1 rounded transition ${role === 'avionics' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
          >
            Радиоинженер
          </button>
          <button
            onClick={() => setRole('economist')}
            className={`px-2 py-1 rounded transition ${role === 'economist' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
          >
            Экономист
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3.5 my-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl p-3.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950/90 text-slate-200 border border-slate-800 shadow-md whitespace-pre-wrap'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1 opacity-70 text-[10px]">
                <span>{msg.role === 'user' ? 'Даниил (Студент МЭИ)' : 'Консультант кафедры'}</span>
                <span>{msg.timestamp}</span>
              </div>
              <div>{msg.content}</div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 italic bg-slate-950/60 p-2.5 rounded-lg w-fit border border-slate-800">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Консультант формулирует физико-математический ответ...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 pb-2 pt-1 border-t border-slate-800/80">
        {quickQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            className="flex items-center gap-1 text-[11px] bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-800 transition text-left"
          >
            <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>{q}</span>
          </button>
        ))}
      </div>

      {/* Input box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 pt-2 border-t border-slate-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Спросите консультанта об уравнениях движения, матрице H или оформлении отчета..."
          className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg flex items-center gap-1.5 text-xs font-semibold shadow transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Спросить</span>
        </button>
      </form>
    </div>
  );
};
