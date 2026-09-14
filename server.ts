import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const DEFAULT_SYSTEM_INSTRUCTION = `Ты — ведущий научный консультант по спутниковой навигации и орбитальным группировкам, старший научный сотрудник кафедры «Радиоэлектронные системы и комплексы» (РЭКС) НИУ «МЭИ».
Твой студент — Даниил Андреевич Филипченков (специальность 11.05.01 «Радиоэлектронные системы и комплексы»).
Тема его практики и научной работы: «Исследование и многопараметрическая оптимизация низкоорбитальной спутниковой навигационной системы (LEO PNT) на базе группировки Уокера».

Твои задачи:
1. Помогать студенту строить физически строгие и реалистичные математические модели спутниковой навигации (PNT - Positioning, Navigation, and Timing).
2. Объяснять баллистические и геодезические тонкости:
   - Влияние возмущений J2 (прецессия узлов и апсид).
   - Атмосферное торможение (drag) и падение высоты при h < 600 км.
   - Радиационные пояса Ван Аллена (Van Allen Belts) при h > 1100-1200 км (дозы радиации, ЭКБ space-grade rad-hard).
   - Перевод вектора "потребитель - спутник" из ECEF (WGS84) в местную топоцентрическую систему ENU (East-North-Up) для корректного разделения ошибок на горизонтальную (HDOP) и вертикальную (VDOP).
   - Влияние угла маски места (elevation mask) и доплеровских сдвигов (до 40-70 кГц на LEO).
   - Требования к автономному контролю целостности RAIM (Receiver Autonomous Integrity Monitoring): для обнаружения отказа нужно >= 5 спутников, для локализации и исключения (FDE) >= 6 спутников.
3. Помогать с формулировкой целевой функции (fitness function) и расчетом реальных затрат:
   - Стоимость запусков зависит в первую очередь от числа орбитальных плоскостей P (для каждой плоскости нужен отдельный пуск ракеты-носителя).
   - Стоимость спутников рассчитывается с учетом эффекта серийности (learning curve / кривой обучаемости).
   - Штрафы должны быть гладкими/квадратичными, с барьерами по доступности (Availability >= 99.9%) и точности (PDOP <= 3-4).
4. Обосновывать выбор численных методов оптимизации (генетические алгоритмы GA, рой частиц PSO, многокритериальная Парето-оптимизация NSGA-II) для отчета по практике в НИУ «МЭИ».
Отвечай структурированно, профессионально, с формулами (LaTeX/Markdown), математическими выкладками и фрагментами кода для MATLAB/Octave.`;

// API routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Gemini Multi-Turn Chat with Thinking Mode support
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const {
      messages,
      model = "gemini-3.5-flash",
      enableHighThinking = false,
      role = "supervisor",
      customSystemPrompt,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const ai = getAi();

    // Select chosen model:
    // 'gemini-3.1-pro-preview' for complex thinking tasks
    // 'gemini-3.5-flash' for general tasks
    // 'gemini-3.1-flash-lite' for fast responses
    let targetModel = model;
    if (enableHighThinking) {
      targetModel = "gemini-3.1-pro-preview";
    }

    let roleAddendum = "";
    if (role === "ballistics") {
      roleAddendum = "\nТы выступаешь в амплуа эксперта по небесной механике, возмущенному орбитальному движению, гравитационному потенциалу Земли J2/J3/J4, маневрам поддержания орбиты и баллистическому расчету запусков.";
    } else if (role === "avionics") {
      roleAddendum = "\nТы выступаешь в роли главного конструктора аппаратуры PNT: радионавигационные сигналы, генераторы псевдослучайных последовательностей, доплеровские сдвиги, бортовые водородные/рубидиевые стандарты частоты и радиолинии межспутниковой связи (ISL).";
    } else if (role === "economist") {
      roleAddendum = "\nТы выступаешь в амплуа системного аналитика и экономиста космических комплексов: модели оценки стоимости CAPEX/OPEX (модели NASA/ESA/ЦНИИмаш), стоимость пусков ракет «Союз-2.1б», «Ангара-А5», кривые обучаемости и штрафные функции.";
    }

    const systemInstruction = (customSystemPrompt || DEFAULT_SYSTEM_INSTRUCTION) + roleAddendum;

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const config: any = {
      systemInstruction,
    };

    if (enableHighThinking && targetModel === "gemini-3.1-pro-preview") {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
      // Note: Do not set maxOutputTokens when thinkingLevel is used!
    }

    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config,
    });

    const reply = response.text || "Извините, не удалось сформировать ответ.";

    res.json({
      reply,
      modelUsed: targetModel,
      hasThinking: enableHighThinking && targetModel === "gemini-3.1-pro-preview",
    });
  } catch (err: any) {
    console.error("Gemini Chat Error:", err);
    res.status(500).json({
      error: err.message || "Ошибка при обращении к нейросетевому ассистенту.",
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LEO PNT Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
