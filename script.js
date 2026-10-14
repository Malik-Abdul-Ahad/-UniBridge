/* =========================================================
   UniBridge — script.js
   Vanilla JavaScript prototype logic:
   navigation, checklists, lessons, campus guide, mentor chat,
   study planner (localStorage), wellbeing, toasts, reset.
   ========================================================= */

(function () {
  'use strict';

  /* ---------- Small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const STORAGE_KEY = 'unibridge-demo-v1';

  /* =========================================================
     1. STATE + localStorage
     ========================================================= */

  // Local date helper: yyyy-mm-dd without timezone surprises
  function datePlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // The original demo state (used on first visit and after Reset Demo)
  function defaultState() {
    return {
      prepare: [],            // completed preparation checklist ids
      week: [],               // completed first-week checklist ids
      lessons: [],            // completed lesson ids
      campus: [],             // visited location ids
      wellbeing: '',          // last selected feeling
      tasks: [                // sample planner tasks
        { id: 'seed-1', title: 'Review lecture notes', course: 'Sociology 101', due: datePlus(2), done: false },
        { id: 'seed-2', title: 'Explore the campus map', course: 'University Orientation', due: datePlus(4), done: false }
      ]
    };
  }

  // Load saved progress, falling back to the original demo state
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const saved = JSON.parse(raw);
      return Object.assign(defaultState(), saved);
    } catch (err) {
      return defaultState(); // storage unavailable (private mode, file:// restrictions)
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* ignore: demo still works without persistence */
    }
  }

  let state = loadState();

  // Render callbacks registered by each feature (used by Reset Demo)
  const renderers = [];

  /* =========================================================
     2. TOAST NOTIFICATIONS
     ========================================================= */
  const TOAST_ICONS = { success: '✅', warn: '⚠️', info: '💡' };

  function toast(message, type = 'success') {
    const container = $('#toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast ${type}`;

    const ico = document.createElement('span');
    ico.className = 'toast-ico';
    ico.setAttribute('aria-hidden', 'true');
    ico.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

    const text = document.createElement('span');
    text.textContent = message;

    el.append(ico, text);
    container.appendChild(el);

    // Auto-dismiss with a fade-out animation
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 320);
    }, 2800);
  }

  /* =========================================================
     3. NAVIGATION (smooth scroll, mobile menu, scroll spy)
     ========================================================= */
  function scrollToId(id) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeMenu() {
    const menu = $('#nav-menu');
    const toggle = $('#nav-toggle');
    if (menu) menu.classList.remove('open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
    }
  }

  function initNavigation() {
    const navbar = $('#navbar');
    const toggle = $('#nav-toggle');
    const menu = $('#nav-menu');

    // Mobile menu
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        const open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      });
    }

    // Any element with [data-scroll] scrolls smoothly to its section
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-scroll]');
      if (!el) return;
      e.preventDefault();
      scrollToId(el.getAttribute('data-scroll'));
      closeMenu();
    });

    // Shadow on the navbar once the page is scrolled
    const onScroll = () => navbar && navbar.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Close the menu when the viewport grows back to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1100) closeMenu();
    });

    // Highlight the section currently being viewed
    const navAnchors = $$('.nav-links a[data-scroll]');
    const watched = navAnchors
      .map((a) => document.getElementById(a.getAttribute('data-scroll')))
      .filter(Boolean);

    if ('IntersectionObserver' in window && watched.length) {
      const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navAnchors.forEach((a) => {
            a.classList.toggle('active', a.getAttribute('data-scroll') === entry.target.id);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      watched.forEach((sec) => spy.observe(sec));
    }
  }

  /* =========================================================
     4. CHECKLISTS (preparation + first week)
     ========================================================= */
  const CHECKLISTS = [
    {
      group: 'prepare',
      list: '#prepare-list',
      fill: '#prepare-fill',
      count: '#prepare-count',
      bar: '#prepare-bar',
      doneMessage: 'Good progress. One more step completed.'
    },
    {
      group: 'week',
      list: '#week-list',
      fill: '#week-fill',
      count: '#week-count',
      bar: '#week-bar',
      doneMessage: 'Nice work. One more first-week task done.'
    }
  ];

  function setupChecklist(cfg) {
    const list = $(cfg.list);
    if (!list) return;

    const inputs = $$('.check-input', list);

    // Always read from the live state object so Reset Demo is reflected too
    const done = () => state[cfg.group];

    function render() {
      let completed = 0;
      inputs.forEach((input) => {
        const isDone = done().indexOf(input.dataset.id) !== -1;
        input.checked = isDone;
        input.closest('.check-item').classList.toggle('is-done', isDone);
        if (isDone) completed++;
      });

      const total = inputs.length;
      const pct = total ? Math.round((completed / total) * 100) : 0;

      const fill = $(cfg.fill);
      fill.style.width = pct + '%';
      fill.classList.toggle('is-complete', pct === 100);

      $(cfg.count).textContent = `${completed} of ${total} completed · ${pct}%`;
      $(cfg.bar).setAttribute('aria-valuenow', String(pct));
    }

    // A single listener handles every checkbox in the group
    list.addEventListener('change', (e) => {
      const input = e.target.closest('.check-input');
      if (!input) return;

      const id = input.dataset.id;
      const completedIds = done();
      const at = completedIds.indexOf(id);
      if (input.checked && at === -1) completedIds.push(id);
      if (!input.checked && at !== -1) completedIds.splice(at, 1);

      render();
      save();

      if (input.checked) {
        if (completedIds.length === inputs.length) {
          toast('Checklist complete — excellent preparation!', 'success');
        } else {
          toast(cfg.doneMessage, 'success');
        }
      }
    });

    render();
    renderers.push(render);
  }

  /* =========================================================
     5. ORIENTATION LESSONS
     ========================================================= */
  const LESSONS = {
    'lesson-1': {
      title: 'How University Classes Work',
      time: 'Estimated time: 4 min',
      body: `
        <p>University teaching is usually split into <strong>lectures</strong> and <strong>tutorials</strong>.
        A lecture is a large session where your teacher explains new material. A tutorial is a smaller
        group where you practise, discuss, and ask questions.</p>
        <div class="lesson-example">
          <strong>Remember</strong>
          Your weekly timetable lists every class, room, and time. Write your slots down on day one
          so you always know where you need to be.
        </div>
        <div class="lesson-tip"><span aria-hidden="true">⏱️</span>
        <span>Tip: arrive five minutes early and sit where you can see the board and hear clearly.</span></div>`
    },
    'lesson-2': {
      title: 'Communicating with Teachers',
      time: 'Estimated time: 3 min',
      body: `
        <p>At university, students should communicate respectfully. Instead of writing
        &lsquo;Send me the notes,&rsquo; write a clear message explaining your name, course, and question.</p>
        <div class="lesson-example">
          <strong>Example message</strong>
          Dear Sir/Madam, I am Ali from Sociology 101, section B. I missed Tuesday&rsquo;s lecture on
          socialization and would like to ask which pages I should read. Thank you for your time.
        </div>
        <div class="lesson-tip"><span aria-hidden="true">✉️</span>
        <span>Tip: use your university email and allow one working day for a reply. You can also ask
        during office hours.</span></div>`
    },
    'lesson-3': {
      title: 'Managing Assignments',
      time: 'Estimated time: 5 min',
      body: `
        <p>Big assignments feel easier when you break them into small steps: read the question,
        collect sources, make an outline, write a draft, then review. Give every step its own date
        in your <strong>Study Planner</strong>.</p>
        <div class="lesson-example">
          <strong>Example plan</strong>
          Essay due 20 October &rarr; outline by 10 October, first draft by 15 October,
          final review by 18 October.
        </div>
        <div class="lesson-tip"><span aria-hidden="true">📅</span>
        <span>Tip: submit a little early rather than late — and check the portal for the exact
        submission format.</span></div>`
    },
    'lesson-4': {
      title: 'Working with New Classmates',
      time: 'Estimated time: 4 min',
      body: `
        <p>Everyone around you is also new. A short introduction is all it takes: your name,
        your course, and one thing you enjoy. Small conversations repeated over a few weeks
        turn into friendships.</p>
        <div class="lesson-example">
          <strong>Example introduction</strong>
          Hi, I am Sana. I am new here and I like photography. Want to compare notes after the lecture?
        </div>
        <div class="lesson-tip"><span aria-hidden="true">🤝</span>
        <span>Tip: join the official class group in your first week and introduce yourself —
        most classmates are waiting for someone else to go first.</span></div>`
    }
  };

  let activeLesson = null;   // lesson id currently open in the modal
  let lastFocused = null;    // element to return focus to when a modal closes

  function openOverlay(overlay) {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    const focusable = overlay.querySelector('button, input, [href]');
    if (focusable) focusable.focus();
  }

  function closeOverlay(overlay) {
    overlay.hidden = true;
    if (!$$('.modal-overlay:not([hidden])').length) {
      document.body.style.overflow = '';
    }
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function renderLessons() {
    $$('.lesson-card').forEach((card) => {
      const id = card.dataset.lesson;
      const done = state.lessons.indexOf(id) !== -1;
      const pill = $('[data-status]', card);
      const btn = $('[data-open-lesson]', card);

      card.classList.toggle('is-done', done);
      pill.textContent = done ? 'Completed' : 'Not started';
      pill.classList.toggle('done', done);
      btn.textContent = done ? 'Review Lesson' : 'Start Lesson';
    });
  }

  function openLesson(id) {
    const lesson = LESSONS[id];
    if (!lesson) return;
    activeLesson = id;

    $('#lesson-modal-title').textContent = lesson.title;
    $('#lesson-modal-time').textContent = `⏱️ ${lesson.time}`;
    $('#lesson-modal-body').innerHTML = lesson.body;

    const done = state.lessons.indexOf(id) !== -1;
    const btn = $('#mark-lesson-complete');
    btn.disabled = done;
    btn.textContent = done ? 'Lesson Completed ✓' : 'Mark Lesson Complete';

    openOverlay($('#lesson-modal'));
  }

  function markLessonComplete() {
    if (!activeLesson) return;
    if (state.lessons.indexOf(activeLesson) === -1) {
      state.lessons.push(activeLesson);
      save();
      renderLessons();

      const btn = $('#mark-lesson-complete');
      btn.disabled = true;
      btn.textContent = 'Lesson Completed ✓';

      toast(`Completed: ${LESSONS[activeLesson].title}`, 'success');
    }
  }

  function initLessons() {
    document.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open-lesson]');
      if (open) openLesson(open.getAttribute('data-open-lesson'));
    });
    $('#mark-lesson-complete').addEventListener('click', markLessonComplete);
    renderLessons(); // restore saved lesson status on page load
    renderers.push(renderLessons);
  }

  /* =========================================================
     6. CAMPUS GUIDE
     ========================================================= */
  function renderCampus() {
    $$('[data-visit]').forEach((btn) => {
      const id = btn.getAttribute('data-visit');
      const visited = state.campus.indexOf(id) !== -1;
      const card = btn.closest('.campus-card');

      btn.textContent = visited ? 'Visited' : 'Mark as Visited';
      btn.classList.toggle('is-visited', visited);
      btn.disabled = visited;
      card.classList.toggle('visited', visited);
    });

    const total = $$('[data-visit]').length;
    $('#campus-count').textContent = `${state.campus.length} of ${total} locations visited`;
  }

  function initCampus() {
    const grid = $('#campus-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-visit]');
        if (!btn || btn.disabled) return;

        state.campus.push(btn.getAttribute('data-visit'));
        save();
        renderCampus();
        toast(`${btn.getAttribute('data-name')} marked as visited.`, 'success');
      });
    }
    renderCampus(); // restore saved locations on page load
    renderers.push(renderCampus);
  }

  /* =========================================================
     7. MENTOR CHAT (simulated, no backend)
     ========================================================= */
  const CHAT_RULES = [
    {
      keys: ['classroom', 'class room', 'class '],
      reply: 'Check your timetable on the portal, then open the Campus Guide to see the building. Walk the route once before your first class — it really helps.'
    },
    {
      keys: ['assignment', 'deadline', 'due'],
      reply: 'Break each assignment into small steps and add them to the Study Planner with dates. Set one reminder two days before the deadline so nothing surprises you.'
    },
    {
      keys: ['friend', 'make friend', 'classmate', 'people'],
      reply: 'Say hello to the person next to you, join the official class group, and try one student society. Short, repeated conversations are how friendships start.'
    },
    {
      keys: ['help', 'support', 'stuck', 'advisor'],
      reply: 'Start with your academic advisor, the Student Affairs Office, or your course teacher. You can also ask in the official class group — people are usually happy to help.'
    },
    {
      keys: ['teacher', 'lecturer', 'professor', 'email', 'contact'],
      reply: 'You can send a respectful email with your name, course, and clear question. You can also ask during office hours.'
    },
    {
      keys: ['portal', 'login', 'system', 'online'],
      reply: 'The university portal is where you find courses, announcements, and submission links. Practise opening it once a day during your first week so it feels normal.'
    },
    {
      keys: ['exam', 'study', 'routine', 'focus'],
      reply: 'Create a weekly study routine with small fixed blocks instead of one long session. Your Study Planner is a good place to keep those blocks visible.'
    }
  ];

  const CHAT_FALLBACKS = [
    'Good question! Start with the orientation lessons and the campus guide — they cover most of this. Asking for help is a normal part of university life.',
    'You are doing better than you think. Try one small step today, and if you get stuck, your lecturer or the Student Affairs Office can help.'
  ];
  let fallbackIndex = 0;

  function findReply(question) {
    const q = question.toLowerCase();
    for (const rule of CHAT_RULES) {
      if (rule.keys.some((k) => q.indexOf(k) !== -1)) return rule.reply;
    }
    const reply = CHAT_FALLBACKS[fallbackIndex % CHAT_FALLBACKS.length];
    fallbackIndex++;
    return reply;
  }

  function addMessage(text, who) {
    const body = $('#chat-body');
    const wrap = document.createElement('div');
    wrap.className = `msg ${who}`;

    const bubble = document.createElement('p');
    bubble.textContent = text;

    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    wrap.append(bubble, time);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function sendMessage(text) {
    const question = text.trim();
    if (!question) {
      toast('Type a question first, then press Send.', 'warn');
      return;
    }

    addMessage(question, 'user');

    // Show a typing indicator, then the simulated reply
    const body = $('#chat-body');
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    setTimeout(() => {
      typing.remove();
      addMessage(findReply(question), 'mentor');
    }, 850);
  }

  function initChat() {
    $('#open-chat').addEventListener('click', () => {
      openOverlay($('#chat-modal'));
      setTimeout(() => $('#chat-text').focus(), 60);
    });

    $('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chat-text');
      sendMessage(input.value);
      input.value = '';
      input.focus();
    });

    $('#chat-quick').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-question]');
      if (chip) sendMessage(chip.getAttribute('data-question'));
    });
  }

  /* =========================================================
     8. STUDY PLANNER (create / complete / delete + localStorage)
     ========================================================= */
  function formatDate(iso) {
    if (!iso) return 'No due date';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return 'No due date';
    return 'Due ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function isOverdue(iso) {
    if (!iso) return false;
    const due = new Date(iso + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return !isNaN(due) && due < today;
  }

  function renderTasks() {
    const list = $('#task-list');
    list.innerHTML = '';

    state.tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'task-item';
      if (task.done) li.classList.add('done');
      if (!task.done && isOverdue(task.due)) li.classList.add('overdue');

      // Main info
      const main = document.createElement('div');
      main.className = 'task-main';

      const title = document.createElement('p');
      title.className = 'task-title';
      title.textContent = task.title;

      const meta = document.createElement('p');
      meta.className = 'task-meta';

      const course = document.createElement('span');
      course.textContent = '📚 ' + (task.course || 'General');

      const due = document.createElement('span');
      due.textContent = '📅 ' + formatDate(task.due);

      meta.append(course, due);

      if (task.done) {
        const label = document.createElement('span');
        label.className = 'badge badge-green';
        label.textContent = 'Completed';
        meta.appendChild(label);
      } else if (isOverdue(task.due)) {
        const warn = document.createElement('span');
        warn.className = 'warn';
        warn.textContent = 'Overdue';
        meta.appendChild(warn);
      }

      main.append(title, meta);

      // Buttons
      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'task-btn' + (task.done ? '' : ' done-btn');
      toggleBtn.dataset.action = 'toggle';
      toggleBtn.dataset.id = task.id;
      toggleBtn.textContent = task.done ? 'Undo' : 'Complete';
      toggleBtn.setAttribute('aria-label', (task.done ? 'Undo completion of ' : 'Complete ') + task.title);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'task-btn delete-btn';
      delBtn.dataset.action = 'delete';
      delBtn.dataset.id = task.id;
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('aria-label', 'Delete ' + task.title);

      actions.append(toggleBtn, delBtn);
      li.append(main, actions);
      list.appendChild(li);
    });

    // Counter + empty state
    const doneCount = state.tasks.filter((t) => t.done).length;
    const counter = $('#task-count');
    counter.textContent = state.tasks.length
      ? `${state.tasks.length} task${state.tasks.length === 1 ? '' : 's'} · ${doneCount} completed`
      : '0 tasks';
    counter.classList.toggle('neutral', doneCount === 0);

    $('#task-empty').classList.toggle('show', state.tasks.length === 0);
  }

  function initPlanner() {
    const form = $('#planner-form');
    const titleInput = $('#task-title');
    const error = $('#form-error');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();

      if (!title) {
        error.hidden = false;
        titleInput.focus();
        toast('Please write a task title first.', 'warn');
        return;
      }
      error.hidden = true;

      state.tasks.unshift({
        id: 'task-' + Date.now(),
        title: title,
        course: $('#task-course').value.trim() || 'General',
        due: $('#task-due').value || '',
        done: false
      });
      save();
      renderTasks();
      form.reset();
      toast('Task added to your study planner.', 'success');
    });

    titleInput.addEventListener('input', () => {
      if (titleInput.value.trim()) error.hidden = true;
    });

    // One listener handles Complete / Undo / Delete
    $('#task-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const task = state.tasks.find((t) => t.id === btn.dataset.id);
      if (!task) return;

      if (btn.dataset.action === 'toggle') {
        task.done = !task.done;
        save();
        renderTasks();
        toast(task.done ? 'Task marked as completed.' : 'Task reopened.', task.done ? 'success' : 'info');
      }

      if (btn.dataset.action === 'delete') {
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        save();
        renderTasks();
        toast('Task deleted.', 'info');
      }
    });

    renderTasks();
    renderers.push(renderTasks);
  }

  /* =========================================================
     9. WELLBEING CHECK-IN (supportive, non-medical)
     ========================================================= */
  const FEELINGS = {
    'Very confident': {
      icon: '😄',
      title: 'Great energy!',
      text: 'Keep the momentum: set one weekly goal, stay ahead of your deadlines, and consider helping a classmate who is also adjusting.'
    },
    'Confident': {
      icon: '🙂',
      title: 'That is a solid place to start.',
      text: 'Keep your planner up to date and try one new activity this week — a society, a study group, or a short conversation with a teacher.'
    },
    'Unsure': {
      icon: '😐',
      title: 'Thanks for sharing.',
      text: 'It is normal to feel unsure during a major transition. Try completing one small task today and speak to a classmate or mentor.'
    },
    'Stressed': {
      icon: '😟',
      title: 'Take one step at a time.',
      text: 'Take one step at a time. Review your planner and contact a mentor, teacher, or university support service if you need help.'
    },
    'Very stressed': {
      icon: '😰',
      title: 'Thank you for telling us.',
      text: 'Start small: plan only tomorrow, take regular breaks, and talk to someone you trust. If things feel heavy, please reach out to your university support service or a qualified professional — this prototype does not give medical advice.'
    }
  };

  function showFeeling(name, announce) {
    const data = FEELINGS[name];
    if (!data) return;

    $$('.feeling-btn').forEach((b) => b.classList.toggle('selected', b.dataset.feeling === name));

    $('#feeling-ico').textContent = data.icon;
    $('#feeling-title').textContent = `${data.title} You chose: ${name}.`;
    $('#feeling-text').textContent = data.text;
    $('#feeling-response').hidden = false;

    if (announce) toast('Check-in saved. Thanks for sharing how you feel.', 'info');
  }

  function initWellbeing() {
    $('#feeling-row').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-feeling]');
      if (!btn) return;
      state.wellbeing = btn.dataset.feeling;
      save();
      showFeeling(state.wellbeing, true);
    });

    if (state.wellbeing) showFeeling(state.wellbeing, false);
    renderers.push(() => {
      if (state.wellbeing) {
        showFeeling(state.wellbeing, false);
      } else {
        $$('.feeling-btn').forEach((b) => b.classList.remove('selected'));
        $('#feeling-response').hidden = true;
      }
    });
  }

  /* =========================================================
     10. MODALS (shared open/close behaviour)
     ========================================================= */
  function initModals() {
    // Close button or backdrop click closes the modal
    document.addEventListener('click', (e) => {
      const closer = e.target.closest('[data-close-modal]');
      if (closer) {
        closeOverlay(closer.closest('.modal-overlay'));
        return;
      }
      if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        closeOverlay(e.target);
      }
    });

    // Escape closes whichever modal is open, then the mobile menu
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = $('.modal-overlay:not([hidden])');
      if (open) closeOverlay(open);
      else closeMenu();
    });
  }

  /* =========================================================
     11. RESET DEMO
     ========================================================= */
  function resetDemo() {
    state = defaultState();

    // Reset chat conversation to the opening greeting
    const body = $('#chat-body');
    if (body) {
      body.innerHTML =
        '<div class="msg mentor"><p>Hi! I am Areeba, your senior mentor. Ask me anything about starting university. 😊</p></div>';
    }

    save();
    renderers.forEach((render) => render());

    // Close any open modal / mobile menu
    $$('.modal-overlay:not([hidden])').forEach(closeOverlay);
    closeMenu();

    toast('Demo progress cleared. The original demo state is back.', 'info');
  }

  /* =========================================================
     12. INIT
     ========================================================= */
  function init() {
    initNavigation();
    CHECKLISTS.forEach(setupChecklist);
    initLessons();
    initCampus();
    initChat();
    initPlanner();
    initWellbeing();
    initModals();

    $('#reset-demo').addEventListener('click', resetDemo);
    $('#reset-demo-footer').addEventListener('click', resetDemo);

    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    // First run: persist the original demo state so Reset Demo can restore it
    if (!localStorage.getItem(STORAGE_KEY)) save();
  }

  init();
})();
