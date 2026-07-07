/* ============================================================
   AI COACH MODULE — LFM-2.5-230M via Transformers.js + WebGPU
   ============================================================ */

const AICoachModule = (() => {
  let _initialized = false;
  let _generator = null;
  let _modelLoading = false;
  let _modelReady = false;
  let _modelError = null;
  let _pipeline = null;
  let _tokenizer = null;

  // Model config
  const MODEL_ID = 'LiquidAI/LFM2.5-230M-GGUF';

  const SUGGESTION_CHIPS = [
    'I feel exhausted after coding all day',
    'My eyes are bothering me',
    'How much should I stand today?',
    'I\'m stressed about deadlines',
    'My back hurts from sitting',
    'Help me build better habits',
    'What should I eat for my eyes?',
    'I need a quick stress relief',
  ];

  function init() {
    if (_initialized) return;
    _initialized = true;
    render();
  }

  async function _loadModel() {
    if (_modelLoading || _modelReady) return;
    _modelLoading = true;
    _updateLoadingState('Initializing AI engine...');

    try {
      // Dynamic import of custom WebGPU kernels
      const { Lfm2Mobile } = await import('../lib/lfm2_5.js');

      _updateLoadingState('Loading LFM-2.5-230M WebGPU kernels...');

      _generator = await Lfm2Mobile.load(MODEL_ID, {
        onProgress: (fraction) => {
          const pct = Math.round(fraction * 100);
          _updateLoadingState(`Loading model into memory... (${pct}%)`);
          _updateProgressBar(pct);
        }
      });
      
      await _generator.warmup();

      _modelReady = true;
      _modelLoading = false;
      _updateLoadingState('Model ready!');

      // Show ready state
      setTimeout(() => render(), 500);

    } catch (error) {
      console.error('Model loading failed:', error);
      _modelError = error.message;
      _modelLoading = false;
      _updateLoadingState(`Model failed to load. Using rule-based fallback.`);
      setTimeout(() => render(), 1000);
    }
  }

  function _updateLoadingState(message) {
    const statusEl = Utils.$('coachLoadingStatus');
    if (statusEl) statusEl.textContent = message;
  }

  function _updateProgressBar(pct) {
    const bar = Utils.$('coachProgressFill');
    if (bar) bar.style.width = pct + '%';
  }

  function _buildSystemPrompt() {
    const eye = Store.getEyeData();
    const mov = Store.getMovementData();
    const life = Store.getLifestyleData();
    const score = Store.getHealthScore();

    return `Context: Score: ${score}/100, Eye breaks: ${eye.breaksTaken || 0}, Stood: ${mov.standingMinutes || 0}m, Hydration: ${life.hydration || 0}.\nInstructions: Answer as a helpful health coach. Keep it very brief (1-2 sentences).`;
  }

  function _summarizeDiscomfort(msk) {
    if (!msk.discomfort) return 'none reported';
    const areas = Object.entries(msk.discomfort)
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}/10`);
    return areas.length > 0 ? areas.join(', ') : 'none reported';
  }

  async function sendMessage(text) {
    if (!text.trim()) return;

    // Add user message
    _addMessage('user', text);
    Store.addChatMessage({ role: 'user', content: text });

    const input = Utils.$('coachInput');
    if (input) input.value = '';

    // Create an empty bubble for the assistant to stream into
    const bubbleEl = _addEmptyMessage('coach');

    let response = '';

    if (_modelReady && _generator) {
      try {
        response = await _generateWithModel(text, bubbleEl);
      } catch (error) {
        console.error('Model generation failed:', error);
        response = "⚠️ **AI Engine Offline**\nThe local AI model failed to generate a response. Please ensure your device supports WebGPU and try refreshing the app.";
        if (window.marked) bubbleEl.innerHTML = marked.parse(response);
        else bubbleEl.textContent = response;
      }
    } else {
      response = _generateFallback(text);
      if (window.marked) bubbleEl.innerHTML = marked.parse(response);
      else bubbleEl.textContent = response;
    }

    Store.addChatMessage({ role: 'coach', content: response });
    _scrollToBottom();
  }

  async function _generateWithModel(userText, bubbleEl) {
    const eye = Store.getEyeData();
    const mov = Store.getMovementData();
    const life = Store.getLifestyleData();
    const score = Store.getHealthScore();

    // TRUE AGENTIC ORCHESTRATOR
    // The user correctly requested an efficient method rather than burning tokens on context.
    // 230M models fail at RAG and instruction-following. Instead, we use JS to determine 
    // the factual prefix, and only use the LLM to generate the conversational advice!
    const lowerText = userText.toLowerCase();
    let jsPrefix = "";
    let llmPrompt = "";

    if (lowerText.match(/(eye|vision|sight|blur|strain|bother)/)) {
        jsPrefix = `I notice you've taken ${eye.breaksTaken || 0} eye breaks today. `;
        llmPrompt = "The user's eyes are bothering them. Give them 1 short sentence of friendly advice about resting their eyes.";
    } else if (lowerText.match(/(stand|sit|back|posture|move|walk|hurt)/)) {
        jsPrefix = `I see you've stood for ${mov.standingMinutes || 0} minutes today. `;
        llmPrompt = "The user is asking about standing or posture. Give them 1 short sentence of friendly advice about moving around.";
    } else if (lowerText.match(/(stress|tired|exhaust|sleep|focus|deadline)/)) {
        jsPrefix = `Your health score is ${score}/100 and you've had ${life.hydration || 0} glasses of water. `;
        llmPrompt = "The user is stressed or tired. Give them 1 short sentence of encouraging advice.";
    } else if (lowerText.match(/(score|status|performance|stats|data|health)/)) {
        jsPrefix = `Your current health score is ${score}/100! `;
        llmPrompt = "The user asked about their health score. Give them 1 short sentence of encouragement.";
    } else {
        // Pure conversational fallback
        llmPrompt = `Answer this user conversationally in 1 short sentence: ${userText}`;
    }
    
    const messages = [
      { role: 'user', content: llmPrompt }
    ];

    try {
      // Seed the response with our deterministic fact
      let responseText = jsPrefix;
      
      const stream = await _generator.generate(messages, {
        maxNewTokens: 64, // Keep it fast and conversational
        temperature: 0.7,
        top_p: 0.9,
      });

      for await (const chunk of stream) {
        const cumulativeLLMText = typeof chunk === 'string' ? chunk : (chunk.text || '');
        responseText = jsPrefix + cumulativeLLMText;
        
        // Clean up prompt echoing if it happens
        let cleanText = responseText;
        if (cleanText.includes('Coach:')) {
           cleanText = cleanText.split('Coach:').pop().trim();
        }
        if (window.marked) {
            bubbleEl.innerHTML = marked.parse(cleanText);
        } else {
            bubbleEl.textContent = cleanText;
        }
        _scrollToBottom();
      }

      if (!responseText) {
        responseText = "⚠️ **Generation Error**\nThe model returned an empty response. Please try asking your question differently.";
        if (window.marked && bubbleEl) bubbleEl.innerHTML = marked.parse(responseText);
        else if (bubbleEl) bubbleEl.textContent = responseText;
      }
      return responseText;
    } catch (e) {
      throw e;
    }
  }

  function _generateFallback(text) {
    const lower = text.toLowerCase();
    const eye = Store.getEyeData();
    const mov = Store.getMovementData();
    const mental = Store.getMentalData();
    const life = Store.getLifestyleData();
    const settings = Store.getSettings();

    // Pattern-based responses
    if (lower.includes('tired') || lower.includes('exhaust') || lower.includes('fatigue')) {
      const suggestions = [];
      if ((mov.standingMinutes || 0) < 60) suggestions.push('increase your standing/movement time');
      if ((life.hydration || 0) < 4) suggestions.push('drink more water');
      if ((eye.breaksTaken || 0) < 3) suggestions.push('take more eye breaks');
      return `Fatigue from desk work is very common. I'd suggest you ${suggestions.length > 0 ? suggestions.join(', ') + '.' : 'take a 5-minute walk and stretch.'} Also consider whether you got enough sleep last night — consistent sleep is crucial for energy.`;
    }

    if (lower.includes('eye') || lower.includes('vision') || lower.includes('screen')) {
      return `For eye comfort, follow the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds. You've taken ${eye.breaksTaken || 0} breaks today. ${(eye.breaksTaken || 0) < 3 ? 'That\'s lower than ideal — try to take more breaks!' : 'That\'s good progress!'} Also ensure your monitor is at arm\'s length and eye level.`;
    }

    if (lower.includes('stand') || lower.includes('sit') || lower.includes('movement') || lower.includes('walk')) {
      const standing = mov.standingMinutes || 0;
      const goal = settings.standingGoal || 120;
      return `You've logged ${standing} minutes of standing/activity today (goal: ${goal} min). Expert guidance recommends starting at 2 hours/day and building to 4 hours. ${standing < goal / 2 ? 'Try standing for your next call or meeting!' : 'Great progress — keep breaking up your sitting time!'}`;
    }

    if (lower.includes('stress') || lower.includes('anxious') || lower.includes('overwhelm')) {
      return `I hear you — workplace stress is challenging. Try a quick box breathing exercise: breathe in for 4 counts, hold 4, breathe out 4, hold 4. Repeat 4 cycles. Your current stress level is ${mental.stress || 'not rated'}/10. Would you like me to guide you through a breathing exercise?`;
    }

    if (lower.includes('back') || lower.includes('neck') || lower.includes('shoulder') || lower.includes('pain') || lower.includes('hurt')) {
      return `Body discomfort from desk work is very common. I'd recommend: 1) Check your posture right now (spine neutral, shoulders relaxed), 2) Do some gentle stretches for the affected area, and 3) Ensure your monitor and keyboard are ergonomically positioned. If pain persists, please consult a healthcare professional.`;
    }

    if (lower.includes('burnout') || lower.includes('burnt out')) {
      return `Burnout is a serious concern. Some immediate steps: take a real break (not just scrolling), go outside for fresh air, and try a grounding exercise. Longer-term, consider setting firmer boundaries on work hours and scheduling regular recovery activities. If burnout persists, talking to a professional can help enormously.`;
    }

    if (lower.includes('eat') || lower.includes('food') || lower.includes('nutrition') || lower.includes('diet')) {
      return `For desk workers, focus on: staying well hydrated (you've had ${life.hydration || 0} glasses today), eating omega-3 rich foods for eye and brain health, and choosing whole grains for steady energy. Avoid heavy meals that cause afternoon crashes. Try including leafy greens for lutein and zeaxanthin — both great for eyes.`;
    }

    if (lower.includes('sleep') || lower.includes('insomnia') || lower.includes('rest')) {
      return `Good sleep hygiene is essential: stop screens 30-60 min before bed, keep your room cool and dark, and maintain a consistent schedule. Avoid caffeine after 2 PM. If you're winding down soon, try the body scan exercise in the Mental Health module — it helps release physical tension.`;
    }

    if (lower.includes('habit') || lower.includes('routine') || lower.includes('consistent')) {
      return `Building lasting habits works best with small, consistent steps. Start with one module focus this week — I'd suggest the one you score lowest on. Use the timers and check-ins to build routine. Remember: it takes about 66 days to form a habit, so be patient with yourself!`;
    }

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return `${Utils.greeting()}! I'm your wellness coach. I can help with eye care, movement guidance, stress management, posture tips, nutrition advice, and building healthy habits. What's on your mind? 😊`;
    }

    // Generic helpful response
    const score = Store.getHealthScore();
    return `Your health score is ${score}/100 today. ${score < 50 ? 'There\'s room for improvement!' : score < 75 ? 'You\'re doing well, keep it up!' : 'Excellent work today!'} I can help with eye breaks, movement goals, stress management, posture guidance, nutrition tips, or sleep hygiene. What would you like to focus on?`;
  }

  function _addMessage(role, content) {
    const bubble = _addEmptyMessage(role);
    if (!bubble) return;
    
    if (window.marked) {
      bubble.innerHTML = marked.parse(content);
    } else {
      bubble.textContent = content;
    }
  }

  function _addEmptyMessage(role) {
    const messagesEl = Utils.$('coachMessages');
    if (!messagesEl) return null;

    const bubble = Utils.createElement('div', {
      className: `chat__bubble chat__bubble--${role}`
    });

    const typing = messagesEl.querySelector('.chat__typing');
    if (typing) typing.remove();

    messagesEl.appendChild(bubble);
    _scrollToBottom();
    return bubble;
  }

  function _showTyping() {
    const messagesEl = Utils.$('coachMessages');
    if (!messagesEl) return;

    const typing = Utils.createElement('div', {
      className: 'chat__typing',
      innerHTML: '<div class="chat__typing-dot"></div><div class="chat__typing-dot"></div><div class="chat__typing-dot"></div>'
    });
    messagesEl.appendChild(typing);
    _scrollToBottom();
  }

  function _hideTyping() {
    const messagesEl = Utils.$('coachMessages');
    if (!messagesEl) return;
    const typing = messagesEl.querySelector('.chat__typing');
    if (typing) typing.remove();
  }

  function _scrollToBottom() {
    const messagesEl = Utils.$('coachMessages');
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function render() {
    const page = Utils.$('page-ai-coach');
    const history = Store.getChatHistory();

    page.innerHTML = `
      <div class="section-header" style="margin-bottom:var(--space-4);">
        <div>
          <h2>AI Health Coach</h2>
          <p style="font-size:var(--text-sm); color:var(--text-tertiary); margin-top:var(--space-1);">
            ${_modelReady ? '🟢 LFM-2.5-230M · On-Device AI' : _modelLoading ? '🟡 Loading model...' : '🔵 Rule-based · Click "Load AI" for on-device model'}
          </p>
        </div>
        <div class="section-header__actions">
          ${!_modelReady && !_modelLoading ? `
            <button class="btn btn--secondary btn--sm" onclick="AICoachModule.loadModel()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Load AI Model
            </button>
          ` : ''}
          <button class="btn btn--ghost btn--sm" onclick="AICoachModule.clearChat()">Clear Chat</button>
        </div>
      </div>

      <!-- Disclaimer -->
      <div class="disclaimer" style="margin-bottom:var(--space-4); font-size:var(--text-xs);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>This AI coach provides general wellness guidance only. It is not a medical professional. For health concerns, consult your doctor.</span>
      </div>

      ${_modelLoading ? `
        <div class="model-loading">
          <div class="spinner spinner--lg"></div>
          <div class="model-loading__progress" style="width:100%; max-width:400px;">
            <div class="progress"><div class="progress__fill" id="coachProgressFill" style="width:0%"></div></div>
          </div>
          <div class="model-loading__status" id="coachLoadingStatus">Initializing...</div>
        </div>
      ` : ''}

      <!-- Chat Interface -->
      <div class="chat card" style="padding:0; overflow:hidden;">
        <div class="chat__messages" id="coachMessages" style="padding:var(--space-6);">
          ${history.length === 0 ? `
            <div class="chat__bubble chat__bubble--coach">
              ${Utils.greeting()}! 👋 I'm your AI wellness coach. I can help you with eye care, movement goals, stress management, posture, nutrition, and building healthy desk-work habits. What would you like to focus on?
            </div>
            <div class="chat__bubble chat__bubble--system">
              Your health score: ${Store.getHealthScore()}/100
            </div>
          ` : history.map(m => `
            <div class="chat__bubble chat__bubble--${m.role}">${_escapeHTML(m.content)}</div>
          `).join('')}
        </div>

        <!-- Suggestion Chips -->
        <div class="chat__suggestions" style="padding:0 var(--space-6);">
          ${_getContextualSuggestions().map(s => `
            <span class="chip" onclick="AICoachModule.sendMessage('${_escapeAttr(s)}')" style="font-size:var(--text-xs);">${s}</span>
          `).join('')}
        </div>

        <!-- Input Area -->
        <div class="chat__input-area" style="padding:var(--space-4) var(--space-6);">
          <input type="text" class="input input--chat" id="coachInput" placeholder="Ask me anything about your health & productivity..."
                 style="flex:1;" onkeydown="if(event.key==='Enter')AICoachModule.sendMessage(this.value)">
          <button class="btn btn--primary btn--icon" onclick="AICoachModule.sendMessage(Utils.$('coachInput').value)" title="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;

    _scrollToBottom();
  }

  function _getContextualSuggestions() {
    // Pick 4 contextual suggestions
    const suggestions = [];
    const mov = Store.getMovementData();
    const mental = Store.getMentalData();
    const eye = Store.getEyeData();

    if ((mov.standingMinutes || 0) < 30) suggestions.push('How much should I stand today?');
    if ((mental.stress || 0) > 5) suggestions.push('I need a quick stress relief');
    if ((eye.breaksTaken || 0) < 2) suggestions.push('My eyes are bothering me');

    // Fill remaining with random suggestions
    const remaining = SUGGESTION_CHIPS.filter(s => !suggestions.includes(s));
    while (suggestions.length < 4 && remaining.length > 0) {
      const idx = Math.floor(Math.random() * remaining.length);
      suggestions.push(remaining.splice(idx, 1)[0]);
    }

    return suggestions.slice(0, 4);
  }

  function _escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function _escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  function loadModel() {
    render(); // Show loading state
    _loadModel();
  }

  function clearChat() {
    Store.clearChatHistory();
    render();
    Notifications.toast('Chat Cleared', 'Conversation history has been reset.', 'info');
  }

  function onShow() {
    render();
  }

  return { init, render, onShow, sendMessage, loadModel, clearChat };
})();
