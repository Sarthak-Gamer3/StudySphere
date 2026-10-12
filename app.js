(() => {
  "use strict";
  const data = window.STUDY_DATA;
  const config = window.STUDY_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORE = "studysphere-v1";
  const defaultState = () => ({theme:"light",classLevel:"11",board:"CBSE",completed:[],saved:[],notes:[],quizHistory:[],minutes:0,activity:{},chat:[]});
  let state;
  try { state = {...defaultState(), ...JSON.parse(localStorage.getItem(STORE) || "{}")}; } catch { state = defaultState(); }
  const PAGE_FILES = {dashboard:"index.html",chapters:"chapters.html",quizzes:"quizzes.html",pyqs:"pyqs.html",notes:"notes.html",tutor:"tutor.html",progress:"progress.html",saved:"saved.html",settings:"settings.html"};
  const PAGE_VIEW = document.body.dataset.page || "dashboard";
  let currentView = PAGE_VIEW, stream = "all", activeQuiz = null, toastTimer = null;
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const subject = id => data.subjects.find(s => s.id === id) || {id,name:id,icon:"▤",tone:"lavender",stream:"all"};
  const chapter = id => data.chapters.find(c => c.id === id);
  let cloudUser = null, supabase = null, syncTimer = null;
  if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY && window.supabase?.createClient) {
    supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch(e) { console.warn("Could not save local progress", e); }
    updateStats();
    if (cloudUser && supabase) { clearTimeout(syncTimer); syncTimer=setTimeout(syncState,700); }
  };
  async function syncState() {
    if (!cloudUser || !supabase) return;
    const {error}=await supabase.from("study_progress").upsert({user_id:cloudUser.id,state:state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(error) { console.warn("StudySphere cloud sync failed",error.message); setAuthStatus("Cloud sync failed. Check the setup guide and database policy; your local progress is still saved."); }
    else setAuthStatus("Signed in. Your progress is synced to your account.");
  }
  function setAuthStatus(message){const el=$("#authStatus");if(el)el.textContent=message;}
  function openAuth(){ $("#authBackdrop").classList.remove("hidden"); }
  async function loadCloudState(){
    if(!cloudUser||!supabase)return;
    const {data:row,error}=await supabase.from("study_progress").select("state").eq("user_id",cloudUser.id).maybeSingle();
    if(error){setAuthStatus("Signed in, but cloud data could not load. Check the SQL/RLS setup.");return;}
    if(row?.state){state={...defaultState(),...row.state};try{localStorage.setItem(STORE,JSON.stringify(state));}catch{}}
    renderDashboard();renderChapters();renderQuizHistory();renderNotes();renderPyqs();renderProgress();renderSaved();
    if($("#boardSelect"))$("#boardSelect").value=state.board||"CBSE";
    setAuthStatus("Signed in. Your progress is ready on this device.");
  }
  async function refreshAuth(){
    if(!supabase){$("#accountButton").textContent="Set up cloud sync";setAuthStatus("Add your Supabase project URL and public anon key to config.js, then run the SQL in README.md.");return;}
    const {data}=await supabase.auth.getSession();cloudUser=data.session?.user||null;
    $("#accountButton").textContent=cloudUser?`Synced: ${cloudUser.email}`:"Sign in / Sync";
    $("#signOutButton").style.display=cloudUser?"inline-flex":"none";
    if(cloudUser)await loadCloudState();
  }
  async function authAction(mode){
    if(!supabase){setAuthStatus("Cloud sync is not configured yet. Follow the free Supabase setup in README.md.");return;}
    const email=$("#authEmail").value.trim(),password=$("#authPassword").value;
    setAuthStatus("Working…");
    const result=mode==="signup"?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
    if(result.error){setAuthStatus(result.error.message);return;}
    cloudUser=result.data.user||result.data.session?.user||null;
    if(mode==="signup"&&!result.data.session){setAuthStatus("Account created. Check your email to confirm, then sign in.");return;}
    await refreshAuth();await syncState();
  }
  function toast(message) { const el=$("#toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600); }
  function showView(view) {
    if (!PAGE_FILES[view]) view="dashboard";
    if (view !== PAGE_VIEW) { window.location.href = PAGE_FILES[view]; return; }
    if (!$("#view-"+view)) view="dashboard";
    currentView=view;
    $$(".view").forEach(el=>el.classList.toggle("active",el.id==="view-"+view));
    $$(".nav-item[data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
    $("#crumb").textContent=({dashboard:"Dashboard",chapters:"Chapters",quizzes:"Practice quizzes",pyqs:"PYQ library",notes:"Notes & revision",tutor:"Personal AI tutor",progress:"My progress",saved:"Saved items",settings:"Site settings"})[view]||"Dashboard";
    $("#sidebar").classList.remove("open");
    if(view==="progress") renderProgress();
    if(view==="saved") renderSaved();
    if(view==="notes") renderNotes();
    if(view==="pyqs") renderPyqs();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function renderSubjectOptions(select, includeAll=false) {
    if(!select) return;
    select.innerHTML=(includeAll?'<option value="all">All subjects</option>':'')+data.subjects.map(s=>`<option value="${safe(s.id)}">${safe(s.name)}</option>`).join("");
  }
  function subjectIcon(s) { return `<span class="subject-icon ${safe(s.tone)}">${safe(s.icon)}</span>`; }
  function renderDashboard() {
    const classPicker=$("#classSelect"); if(classPicker && classPicker.value!==String(state.classLevel)) classPicker.value=String(state.classLevel);
    if($("#boardSelect")) $("#boardSelect").value=state.board||"CBSE";
    const cls=Number(state.classLevel);
    const list=data.chapters.filter(c=>c.class===cls).slice(0,3);
    $("#continueList").innerHTML=list.map((c,i)=>{const s=subject(c.subject),done=state.completed.includes(c.id),pct=done?100:(state.activity[c.id]?.pct||[32,0,15][i]||0);return `<div class="continue-item" data-chapter="${safe(c.id)}">${subjectIcon(s)}<div class="continue-info"><strong>${safe(c.title)}</strong><small>${safe(s.name)} · ${c.minutes} min read</small></div><div class="continue-progress"><div class="progress-line"><i style="width:${pct}%"></i></div><small>${done?"Completed":pct?`${pct}% read`:"Not started"}</small></div><span class="continue-arrow">›</span></div>`}).join("");
    $("#subjectGrid").innerHTML=data.subjects.filter(s=>s.classes.includes(cls)).slice(0,8).map(s=>{const chapters=data.chapters.filter(c=>c.subject===s.id&&c.class===cls);return `<article class="subject-card" data-subject="${safe(s.id)}">${subjectIcon(s)}<strong>${safe(s.name)}</strong><p>${safe(s.description)}</p><div class="subject-foot"><span>${chapters.length} starter ${chapters.length===1?"chapter":"chapters"}</span><span>↗</span></div></article>`}).join("");
    renderChart();
  }
  function renderChart() {
    const days=["M","T","W","T","F","S","S"];
    $("#chartBars").innerHTML=days.map((d,i)=>{const key=dayKey(i),mins=Number(state.activity[key]||0),height=Math.min(100,mins/60*100);return `<div class="day-column"><div class="bar-wrap"><i class="day-bar ${i===6?"today":""}" style="height:${Math.max(3,height)}%"></i></div><small>${d}</small></div>`}).join("");
    const total=Object.values(state.activity).filter(v=>typeof v==="number").reduce((a,b)=>a+b,0);
    $("#weeklyTotal").textContent=`${total} min total`;
  }
  function dayKey(offset) { const d=new Date(); d.setDate(d.getDate()-(6-offset)); return d.toISOString().slice(0,10); }
  function updateStats() {
    const total=state.quizHistory.reduce((n,q)=>n+q.total,0),correct=state.quizHistory.reduce((n,q)=>n+q.score,0),accuracy=total?Math.round(correct/total*100):null;
    $("#studyMinutes").innerHTML=`${state.minutes} <small>min</small>`;
    $("#accuracyStat").innerHTML=`${accuracy===null?"—":accuracy}<small>%</small>`;
    $("#accuracyBar").style.width=(accuracy||0)+"%"; $("#accuracyLabel").textContent=accuracy===null?"Take a quiz":`${accuracy>=70?"Looking good":"Keep practising"}`;
    $("#completedStat").innerHTML=`${state.completed.length} <small>topics</small>`;
    $("#completedBar").style.width=Math.min(100,state.completed.length/10*100)+"%";
    $("#savedStat").innerHTML=`${state.saved.length+state.notes.length} <small>items</small>`;
  }
  function renderChapters() {
    const classPicker=$("#classSelect"); if(classPicker && classPicker.value!==String(state.classLevel)) classPicker.value=String(state.classLevel);
    const cls=Number(state.classLevel),subjectFilter=$("#subjectFilter").value||"all",query=($("#chapterSearch").value||"").trim().toLowerCase();
    const list=data.chapters.filter(c=>(c.class===cls)&&(stream==="all"||c.stream===stream)&&(subjectFilter==="all"||c.subject===subjectFilter)&&(!query||`${c.title} ${c.description} ${subject(c.subject).name}`.toLowerCase().includes(query)));
    $("#chapterGrid").innerHTML=list.length?list.map(c=>{const s=subject(c.subject),done=state.completed.includes(c.id),saved=state.saved.includes(c.id);return `<article class="chapter-card"><div class="chapter-top"><span class="chapter-tag">${safe(s.name.toUpperCase())} · CLASS ${c.class}</span><button class="bookmark-button ${saved?"saved":""}" data-save="${safe(c.id)}" aria-label="${saved?"Remove bookmark":"Save chapter"}">${saved?"♥":"♡"}</button></div><h3>${safe(c.title)}</h3><p>${safe(c.description)}</p><div class="chapter-meta"><span>◷ ${c.minutes} min · ${safe(c.level)}</span><button data-open-chapter="${safe(c.id)}">${done?"Review topic":"Learn topic"} →</button></div></article>`}).join(""):`<div class="panel empty-state">No chapters match these filters. Try another subject or search.</div>`;
  }
  function openChapter(id) {
    const c=chapter(id); if(!c)return; const s=subject(c.subject),done=state.completed.includes(id);
    $("#modalContent").innerHTML=`<div class="eyebrow">${safe(s.name.toUpperCase())} · CLASS ${c.class}</div><h2 id="modalTitle">${safe(c.title)}</h2><p>${safe(c.description)}</p><h3>Chapter explanation</h3><p>${safe(c.summary)}</p><h3>Key concepts and revision notes</h3><ul>${c.points.map(p=>`<li>${safe(p)}</li>`).join("")}</ul><h3>Apply the idea</h3><p>${safe(c.example)}</p><h3>Check your understanding</h3><ol><li>Explain the chapter's central idea in 3–5 sentences.</li><li>Write down five important terms and define each in your own words.</li><li>Try the NCERT in-text questions and exercises, then check your reasoning.</li></ol><p class="official-book-link"><a href="https://ncert.nic.in/textbook.php" target="_blank" rel="noopener">Open official NCERT textbooks ↗</a></p><div class="modal-actions"><button class="primary-button" id="markComplete">${done?"✓ Completed — mark incomplete":"Mark topic complete ✓"}</button><button class="secondary-button" id="askAboutChapter">Ask AI tutor ↗</button></div>`;
    $("#modalBackdrop").classList.remove("hidden");
    $("#markComplete").onclick=()=>{if(state.completed.includes(id))state.completed=state.completed.filter(x=>x!==id);else{state.completed.push(id);state.minutes+=c.minutes;state.activity[dayKey(6)]=(state.activity[dayKey(6)]||0)+c.minutes;}save();renderDashboard();renderChapters();$("#modalBackdrop").classList.add("hidden");toast(state.completed.includes(id)?"Topic marked complete!":"Completion removed.");};
    $("#askAboutChapter").onclick=()=>{ $("#modalBackdrop").classList.add("hidden");showView("tutor");sendPrompt(`Explain ${c.title} from Class ${c.class} ${s.name} in simple language. Include a short example and key points.`);};
  }
  function renderPyqs() {
    const cls=Number($("#pyqClass").value||state.classLevel),sub=$("#pyqSubject").value||"all",year=$("#pyqYear").value||"all";
    const list=data.pyqs.filter(p=>p.class===cls&&(sub==="all"||p.subject===sub)&&(year==="all"||String(p.year)===year));
    $("#pyqList").innerHTML=list.length?list.map(p=>`<article class="pyq-item"><div class="pyq-file">▧</div><div class="pyq-copy"><strong>${safe(p.title)}</strong><p>Class ${p.class} · ${safe(subject(p.subject).name)} · ${p.year}<br>${safe(p.detail)}</p></div><button data-pyq="${safe(p.subject)}">Practise topic</button></article>`).join(""):`<div class="panel empty-state">No sample items match those filters. Add verified papers in <code>data.js</code>.</div>`;
  }
  function renderQuizHistory() {
    const rows=state.quizHistory.slice().reverse().slice(0,6);
    $("#quizHistory").innerHTML=rows.length?rows.map(q=>`<div class="history-row"><span class="history-mark">✓</span><div class="history-copy"><strong>${safe(q.subjectName)} practice</strong><small>${safe(q.date)} · ${q.total} questions</small></div><span class="history-score">${Math.round(q.score/q.total*100)}%</span></div>`).join(""):`<div class="empty-state"><div class="empty-illustration">◷</div><strong>No quizzes yet</strong><p>Your attempts and scores will appear here.</p></div>`;
  }
  function startQuiz() {
    const sub=$("#quizSubject").value,questions=data.quizzes[sub]||data.quizzes.physics;
    activeQuiz={subject:sub,questions:questions.slice(0,5),index:0,answers:[],checked:false,score:0};
    $("#quizStage").classList.remove("hidden"); renderQuizQuestion(); $("#quizStage").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function renderQuizQuestion() {
    const q=activeQuiz.questions[activeQuiz.index],n=activeQuiz.index+1;
    $("#quizStage").innerHTML=`<div class="section-heading"><div><h3>${safe(subject(activeQuiz.subject).name)} · Quick quiz</h3><p>Question ${n} of ${activeQuiz.questions.length}</p></div><span class="week-pill">${Math.round((n-1)/activeQuiz.questions.length*100)}% COMPLETE</span></div><div class="tiny-bar" style="width:100%;height:5px;margin:14px 0"><i style="width:${n/activeQuiz.questions.length*100}%;display:block;height:100%;background:var(--purple)"></i></div><div class="quiz-question">${safe(q.q)}</div><div id="answerOptions">${q.options.map((opt,i)=>`<label class="answer-option" data-option="${i}"><input type="radio" name="quizAnswer" value="${i}" ${activeQuiz.answers[activeQuiz.index]===i?"checked":""} ${activeQuiz.checked?"disabled":""}><span>${safe(opt)}</span></label>`).join("")}</div><div id="quizFeedback">${activeQuiz.checked?`<div class="quiz-feedback">${activeQuiz.answers[activeQuiz.index]===q.answer?"✓ Correct!":"Not quite."} ${safe(q.why)}</div>`:""}</div><div class="modal-actions">${activeQuiz.checked?`<button class="primary-button" id="nextQuestion">${n===activeQuiz.questions.length?"See my result":"Next question →"}</button>`:`<button class="primary-button" id="checkAnswer">Check answer</button>`}<button class="secondary-button" id="exitQuiz">Exit quiz</button></div>`;
    $("#checkAnswer")?.addEventListener("click",()=>{const chosen=$('input[name="quizAnswer"]:checked');if(!chosen){toast("Choose an answer first.");return;}activeQuiz.answers[activeQuiz.index]=Number(chosen.value);activeQuiz.checked=true;if(Number(chosen.value)===q.answer)activeQuiz.score++;renderQuizQuestion();});
    $("#nextQuestion")?.addEventListener("click",()=>{if(activeQuiz.index<activeQuiz.questions.length-1){activeQuiz.index++;activeQuiz.checked=false;renderQuizQuestion();}else finishQuiz();});
    $("#exitQuiz")?.addEventListener("click",()=>{$("#quizStage").classList.add("hidden");activeQuiz=null;});
  }
  function finishQuiz() {
    const q={subject:activeQuiz.subject,subjectName:subject(activeQuiz.subject).name,score:activeQuiz.score,total:activeQuiz.questions.length,date:new Date().toLocaleDateString()};
    state.quizHistory.push(q);state.minutes+=5;state.activity[dayKey(6)]=(state.activity[dayKey(6)]||0)+5;save();activeQuiz=null;
    $("#quizStage").innerHTML=`<div class="empty-state"><div class="empty-illustration">✦</div><h2>Quiz complete!</h2><p>You scored <strong>${q.score} out of ${q.total}</strong> (${Math.round(q.score/q.total*100)}%). ${q.score===q.total?"Excellent work!":q.score>=3?"Nice effort — review the missed questions and try again.":"Every attempt teaches you something. Revisit the chapter and give it another go."}</p><div class="modal-actions" style="justify-content:center"><button class="primary-button" id="retryQuiz">Try again</button><button class="secondary-button" id="viewProgressBtn">See progress</button></div></div>`;
    $("#retryQuiz").onclick=startQuiz;$("#viewProgressBtn").onclick=()=>showView("progress");renderQuizHistory();renderChart();toast("Quiz result saved on this device.");
  }
  function renderNotes() {
    $("#notesList").innerHTML=state.notes.length?state.notes.slice().reverse().map(n=>`<div class="note-row"><span class="note-row-icon">✎</span><div class="note-row-copy"><strong>${safe(n.title||"Untitled note")}</strong><p>${safe(n.body)}</p><small>${safe(n.date)}</small></div><button data-delete-note="${safe(n.id)}" aria-label="Delete note">×</button></div>`).join(""):`<div class="empty-state">Your saved revision notes will appear here.</div>`;
  }
  function saveNote() {
    const title=$("#noteTitle").value.trim(),body=$("#noteBody").value.trim();if(!body){toast("Write a note before saving.");return;}
    state.notes.push({id:"note-"+Date.now(),title:title||"Untitled note",body,date:new Date().toLocaleDateString()});save();$("#noteTitle").value="";$("#noteBody").value="";$("#noteWordCount").textContent="0 words";renderNotes();toast("Note saved in your browser.");
  }
  function renderProgress() {
    const total=state.quizHistory.reduce((n,q)=>n+q.total,0),correct=state.quizHistory.reduce((n,q)=>n+q.score,0),accuracy=total?Math.round(correct/total*100):0;
    $("#progressOverview").innerHTML=`<div class="progress-metric"><span>Quiz accuracy</span><strong>${total?accuracy+"%":"—"}</strong><small>${total?`${correct} correct answers out of ${total}`:"Take your first quiz"}</small></div><div class="progress-metric"><span>Topics completed</span><strong>${state.completed.length}</strong><small>Keep building your knowledge</small></div><div class="progress-metric"><span>Study time</span><strong>${state.minutes}<small> min</small></strong><small>Recorded on this device</small></div>`;
    const hist=state.quizHistory.slice(-10);
    $("#performanceChart").innerHTML=hist.length?hist.map(q=>`<div class="performance-column"><strong>${Math.round(q.score/q.total*100)}%</strong><i style="height:${Math.max(3,q.score/q.total*100)}%"></i><small>${safe(q.subjectName.slice(0,8))}</small></div>`).join(""):`<div class="empty-state" style="width:100%">Take a quiz to start building your performance chart.</div>`;
    $("#completedTopics").innerHTML=state.completed.length?state.completed.map(id=>{const c=chapter(id);return c?`<div class="completed-row"><span class="check">✓</span><span>${safe(c.title)} <small style="color:var(--muted)">· ${safe(subject(c.subject).name)}</small></span><button class="text-button" data-open-chapter="${safe(c.id)}">Review →</button></div>`:""}).join(""):`<div class="empty-state">Completed topics will appear here when you mark a chapter as complete.</div>`;
  }
  function renderSaved() {
    const items=state.saved.map(id=>({type:"chapter",item:chapter(id)})).filter(x=>x.item).concat(state.notes.map(n=>({type:"note",item:n})));
    $("#savedList").innerHTML=items.length?items.map(({type,item})=>type==="chapter"?`<article class="saved-card">${subjectIcon(subject(item.subject))}<h3>${safe(item.title)}</h3><p>${safe(item.description)}</p><button data-open-chapter="${safe(item.id)}">Open chapter →</button></article>`:`<article class="saved-card"><span class="subject-icon lavender">✎</span><h3>${safe(item.title)}</h3><p>${safe(item.body)}</p><button data-view="notes">Open notes →</button></article>`).join(""):`<div class="panel empty-state"><div class="empty-illustration">♡</div><strong>Nothing saved yet</strong><p>Bookmark chapters or save notes to build your own study library.</p><button class="primary-button" data-view="chapters">Explore chapters →</button></div>`;
  }
  function addMessage(role,html) {
    const box=$("#chatMessages"),el=document.createElement("div");el.className=`chat-message ${role}`;
    el.innerHTML=`<div class="chat-avatar">${role==="assistant"?"✳":"S"}</div><div class="bubble">${html}</div>`;
    box.appendChild(el);box.scrollTop=box.scrollHeight;
  }
  function demoAnswer(message) {
    const m=message.toLowerCase(),found=data.chapters.find(c=>m.includes(c.title.toLowerCase())||m.includes(subject(c.subject).name.toLowerCase()));
    if(/quiz|practice question|test me/.test(m)) return "Let's practise! Here are 3 ways to check your understanding:\n\n1. Explain the key idea in one sentence.\n2. Give a real-life example.\n3. Write one question you still have.\n\nFor an automatically graded quiz, open **Practice quizzes** from the menu. This demo tutor does not generate new questions from a live AI model.";
    if(/revision|revision points|one-page|notes/.test(m)) return "Here's a simple revision method:\n\n• **Definition:** Write the core meaning in one sentence.\n• **Key points:** Keep 3–5 short bullets.\n• **Example:** Add one real-life example.\n• **Self-test:** Cover the notes and explain the topic aloud.\n\nFor a topic-specific explanation, include the exact chapter name and subject.";
    if(found) return `**${found.title} — in easy language**\n\n${found.summary}\n\n**Remember:**\n${found.points.map(p=>"• "+p).join("\n")}\n\n**Example:** ${found.example}\n\nThis is the built-in demo tutor using the site's sample study content. Connect a secure AI backend in Site settings for open-ended, AI-generated answers.`;
    if(/hello|hi\b|hey/.test(m)) return "Hi! 👋 Tell me your class, subject and topic, and I'll help you get started. In demo mode I can explain the sample chapters included in this website.";
    return "I'm currently in **demo mode**, so I can't generate a fresh AI answer to every question yet. I can show explanations for the sample chapters included here. Try a question like “Explain Laws of Motion” or connect a secure AI backend in Site settings to enable real AI responses directly inside this chat.";
  }
  function tutorContext() {
    return {
      class: (document.querySelector("#tutorClass")?.value || state.classLevel || "11"),
      stream: document.querySelector("#tutorStream")?.value || "science",
      subject: document.querySelector("#tutorSubject")?.value || "General help",
      board: document.querySelector("#tutorBoard")?.value || state.board || "CBSE / NCERT",
      mode: document.querySelector("#tutorMode")?.value || "teach"
    };
  }
  function demoAnswer(message) {
    return "**AI tutor is not connected yet.** Your question was received, but this website needs its secure AI backend to generate a fresh answer.\n\nOpen **Site settings → AI tutor connection** and follow `AI-SETUP.md` to connect the tutor. Once connected, it can help with Class 11 and 12 academic topics across Science, Commerce and Humanities.\n\nFor now, try the Chapters section for the sample lessons already included.";
  }
  async function sendPrompt(message) {
    message=(message||"").trim();if(!message)return;
    const context=tutorContext();
    addMessage("user",safe(message).replace(/\n/g,"<br>"));
    const chatInput=$("#chatInput");if(chatInput)chatInput.value="";
    const loading=document.createElement("div");loading.className="chat-message assistant";loading.innerHTML='<div class="chat-avatar">✳</div><div class="bubble">Thinking through your question…</div>';loading.id="chatLoading";$("#chatMessages").appendChild(loading);$("#chatMessages").scrollTop=$("#chatMessages").scrollHeight;
    state.chat.push({role:"user",content:message, message, date:Date.now(), context});
    try {
      let answer;
      if(config.AI_ENDPOINT) {
        const history=state.chat.slice(-12).filter(m=>m.role==="user"||m.role==="assistant").map(m=>({role:m.role,content:m.content||m.message||""}));
        const response=await fetch(config.AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message, class:context.class, stream:context.stream, subject:context.subject, board:context.board, mode:context.mode, history})});
        let payload={};try{payload=await response.json();}catch{}
        if(!response.ok)throw new Error(payload.error||"AI service returned an error");
        if(!payload.answer)throw new Error("AI response was missing an answer");
        answer=String(payload.answer);
      } else { await new Promise(resolve=>setTimeout(resolve,250)); answer=demoAnswer(message); }
      loading.remove();
      addMessage("assistant",safe(answer).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\n/g,"<br>"));
      state.chat.push({role:"assistant",content:answer,date:Date.now(),context});
    } catch(e) {
      loading.remove();
      const errorMessage=String(e.message||"");
      addMessage("assistant",safe(errorMessage.includes("Failed to fetch")?"I couldn't reach the AI service. Check your Worker URL, deployment and allowed-origin settings, then try again.":`The AI service could not answer this request: ${errorMessage}. Please try again shortly.`));
    }
    if(state.chat.length>30)state.chat=state.chat.slice(-30);save();
  }
  function doSearch(query) {
    const q=query.trim().toLowerCase();if(!q)return;
    const found=data.chapters.filter(c=>`${c.title} ${c.description} ${subject(c.subject).name}`.toLowerCase().includes(q));
    showView("chapters");$("#chapterSearch").value=query;renderChapters();
    if(!found.length)toast("No matching sample chapters. Try a subject name or broader term.");
  }
  function bindEvents() {
    document.addEventListener("click",e=>{
      const nav=e.target.closest("[data-view]");if(nav){e.preventDefault();showView(nav.dataset.view);return;}
      const open=e.target.closest("[data-open-chapter]");if(open){openChapter(open.dataset.openChapter);return;}
      const saveBtn=e.target.closest("[data-save]");if(saveBtn){const id=saveBtn.dataset.save;state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];save();renderChapters();toast(state.saved.includes(id)?"Chapter saved.":"Bookmark removed.");return;}
      const sub=e.target.closest("[data-subject]");if(sub){showView("chapters");$("#subjectFilter").value=sub.dataset.subject;renderChapters();return;}
      const pyq=e.target.closest("[data-pyq]");if(pyq){showView("quizzes");$("#quizSubject").value=pyq.dataset.pyq;toast("Choose Start quiz to practise this subject.");return;}
      const prompt=e.target.closest("[data-prompt]");if(prompt){showView("tutor");sendPrompt(prompt.dataset.prompt);return;}
      const del=e.target.closest("[data-delete-note]");if(del){state.notes=state.notes.filter(n=>n.id!==del.dataset.deleteNote);save();renderNotes();toast("Note deleted.");}
    });
    $$(".nav-item").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));
    $("#themeToggle").addEventListener("click",()=>{state.theme=state.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=state.theme;$("#themeIcon").textContent=state.theme==="dark"?"☀":"☾";save();});
    const classPicker=$("#classSelect");
    const changeClass=e=>{const next=String(e.target.value);if(!["11","12"].includes(next))return;state.classLevel=next;try{localStorage.setItem(STORE,JSON.stringify(state));}catch{};renderDashboard();renderChapters();renderPyqs();renderQuizHistory();toast(`Showing Class ${state.classLevel} content.`);};
    classPicker.addEventListener("change",changeClass); classPicker.addEventListener("input",changeClass);
    $("#boardSelect")?.addEventListener("change",e=>{state.board=e.target.value;save();toast(`Board preference set to ${state.board}. Verify each chapter against your official syllabus.`);});
    $("#accountButton")?.addEventListener("click",openAuth);
    $("#authClose")?.addEventListener("click",()=>$("#authBackdrop").classList.add("hidden"));
    $("#authBackdrop")?.addEventListener("click",e=>{if(e.target.id==="authBackdrop")$("#authBackdrop").classList.add("hidden");});
    $("#authForm")?.addEventListener("submit",e=>{e.preventDefault();authAction("signin");});
    $("#signUpButton")?.addEventListener("click",()=>authAction("signup"));
    $("#signOutButton")?.addEventListener("click",async()=>{if(supabase)await supabase.auth.signOut();cloudUser=null;$("#accountButton").textContent="Sign in / Sync";setAuthStatus("Signed out. Your local progress remains on this device.");});
    $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
    $("#streamFilter").addEventListener("click",e=>{const btn=e.target.closest("[data-stream]");if(!btn)return;stream=btn.dataset.stream;$$("button",$("#streamFilter")).forEach(b=>b.classList.toggle("selected",b===btn));renderChapters();});
    $("#subjectFilter").addEventListener("change",renderChapters);$("#chapterSearch").addEventListener("input",renderChapters);
    $("#globalSearch").addEventListener("keydown",e=>{if(e.key==="Enter")doSearch(e.target.value);});
    $("#globalSearch").addEventListener("focus",()=>{if(innerWidth<=600)$("#globalSearch").parentElement.classList.add("open");});
    document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#globalSearch").focus();}if(e.key==="Escape")$("#modalBackdrop").classList.add("hidden");});
    $("#dailyTip").addEventListener("click",()=>toast(["Try explaining a concept in your own words.","Take a short break after focused study.","Review yesterday's notes before starting a new topic.","Mistakes are useful clues about what to revise."][Math.floor(Math.random()*4)]));
    $("#startQuiz").addEventListener("click",startQuiz);
    $("#quizSubject").addEventListener("change",()=>{});
    $("#pyqClass").addEventListener("change",renderPyqs);$("#pyqSubject").addEventListener("change",renderPyqs);$("#pyqYear").addEventListener("change",renderPyqs);
    $("#saveNote").addEventListener("click",saveNote);$("#noteBody").addEventListener("input",()=>$("#noteWordCount").textContent=($("#noteBody").value.trim().match(/\S+/g)||[]).length+" words");
    $("#tutorClass")?.addEventListener("change",e=>{state.classLevel=e.target.value;save();});
    $("#tutorBoard")?.addEventListener("change",e=>{state.board=e.target.value;save();});
    $("#clearChat")?.addEventListener("click",()=>{state.chat=[];save();$("#chatMessages").innerHTML='<div class="chat-message assistant"><div class="chat-avatar">✳</div><div class="bubble"><strong>New chat started.</strong><p>Choose your class, stream and subject, then ask your question.</p></div></div>';});
    $("#chatForm").addEventListener("submit",e=>{e.preventDefault();sendPrompt($("#chatInput").value);});
    $("#chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#chatForm").requestSubmit();}});
    $("#modalClose").addEventListener("click",()=>$("#modalBackdrop").classList.add("hidden"));$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")$("#modalBackdrop").classList.add("hidden");});
    $("#clearData").addEventListener("click",()=>{if(confirm("Clear all StudySphere progress, saved notes, quiz history and theme preference from this browser?")){localStorage.removeItem(STORE);state=defaultState();document.documentElement.dataset.theme="light";$("#themeIcon").textContent="☾";renderDashboard();renderChapters();renderNotes();renderQuizHistory();renderProgress();renderSaved();save();toast("Local study data cleared.");}});
    $("#privacyLink").addEventListener("click",e=>{e.preventDefault();if(config.PRIVACY_URL)window.open(config.PRIVACY_URL,"_blank","noopener");else{showView("settings");toast("Add your own privacy policy before collecting user data or running ads.");}});
  }
  function init() {
    document.documentElement.dataset.theme=state.theme==="dark"?"dark":"light";$("#themeIcon").textContent=state.theme==="dark"?"☀":"☾";
    renderSubjectOptions($("#subjectFilter"),true);renderSubjectOptions($("#quizSubject"));renderSubjectOptions($("#pyqSubject"),true);
    $("#subjectFilter").value="all";$("#pyqSubject").value="all";
    renderDashboard();renderChapters();renderQuizHistory();renderNotes();renderPyqs();updateStats();bindEvents();
    if($("#tutorClass"))$("#tutorClass").value=String(state.classLevel||"11");
    if($("#tutorBoard"))$("#tutorBoard").value=state.board==="CBSE"?"CBSE / NCERT":(state.board||"CBSE / NCERT");
    showView(PAGE_VIEW);refreshAuth();
  }
  init();
})();